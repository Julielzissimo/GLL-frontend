import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SUPABASE_CONFIG_PATH = new URL("./build-web.mjs", import.meta.url);
const FUNCTION_NAME = "radar-neon-backfill";
const MAX_FINALIZATION_RECONCILIATION_ROUNDS = 2;
const SUPABASE_PROJECTS = {
  homolog: "dwotbzrjcetizyygzoty",
  production: "siqsjxohpcrujobkbshn",
};
const COLLECTIONS = [
  "modalities",
  "states",
  "municipalities",
  "platforms",
  "domains",
  "tenders",
  "item_sync",
  "items",
  "coverage",
];
const MAX_PAGES_PER_COLLECTION = 100_000;

class RadarHttpError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "RadarHttpError";
    this.status = status;
    this.payload = payload;
  }
}

export function unverifiedRadarCollections(error) {
  if (error?.status !== 409) return [];
  const candidates = Array.isArray(error.payload?.unverifiedCollections)
    ? [...error.payload.unverifiedCollections]
    : [];
  if (typeof error.payload?.collection === "string") candidates.push(error.payload.collection);
  return [...new Set(candidates.filter((value) => COLLECTIONS.includes(value)))];
}

export function radarBackfillReconciliationDiagnostics(error) {
  if (error?.status !== 409 || !COLLECTIONS.includes(error.payload?.collection)) return null;
  const payload = error.payload;
  const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const differingFieldNames = [...new Set((Array.isArray(payload.mismatchDiagnostics)
    ? payload.mismatchDiagnostics
    : []).flatMap((diagnostic) => Array.isArray(diagnostic?.differingFields)
    ? diagnostic.differingFields.filter((field) => typeof field === "string" && /^[a-z][a-z0-9_]{0,63}$/u.test(field))
    : []))].sort();
  return {
    collection: payload.collection,
    sourceCount: count(payload.sourceCount),
    neonCount: count(payload.neonCount),
    checkedRows: count(payload.checkedRows),
    missingRows: count(payload.missingRows),
    contentMismatches: count(payload.contentMismatches),
    mismatchDiagnosticsAvailable: payload.mismatchDiagnosticsAvailable === true,
    differingFieldNames,
    stableDuringReconciliation: typeof payload.stableDuringReconciliation === "boolean"
      ? payload.stableDuringReconciliation
      : null,
  };
}

export function isRadarBackfillFinalized(result) {
  if (result?.ready !== true
    || result?.reconciliation !== "source_rows_and_contract_fields_match"
    || result?.stableAcrossPasses !== true
    || !Array.isArray(result?.verifiedCollections)) return false;
  const verified = result.verifiedCollections.map((entry) =>
    typeof entry === "string" ? entry : entry?.collection
  );
  return verified.length === COLLECTIONS.length
    && new Set(verified).size === COLLECTIONS.length
    && COLLECTIONS.every((collection) => verified.includes(collection));
}

function requiredEnvironment(name, environment) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure ${name} no ambiente ${environment}.`);
  return value;
}

async function readSupabaseConfig(environment) {
  if (!Object.hasOwn(SUPABASE_PROJECTS, environment)) throw new Error("Ambiente de backfill inválido.");
  const source = await readFile(SUPABASE_CONFIG_PATH, "utf8");
  const block = source.match(new RegExp(`${environment}:\\s*\\{([\\s\\S]*?)\\n\\s{2}\\},`, "u"))?.[1];
  if (!block) throw new Error(`Não foi possível identificar a configuração Supabase de ${environment}.`);
  const supabaseUrl = block.match(/supabaseUrl:\s*["']([^"']+)["']/u)?.[1];
  const publishableKey = block.match(/supabaseAnonKey:\s*["']([^"']+)["']/u)?.[1];
  const expectedHost = `${SUPABASE_PROJECTS[environment]}.supabase.co`;
  if (!supabaseUrl || new URL(supabaseUrl).hostname !== expectedHost
    || !publishableKey?.startsWith("sb_publishable_")) {
    throw new Error(`A configuração pública Supabase de ${environment} está incompleta ou aponta a outro projeto.`);
  }
  return { supabaseUrl, publishableKey };
}

async function fetchJson(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof result?.error === "string" ? result.error : `HTTP ${response.status}`;
        throw new RadarHttpError(`${label}: ${message}`, response.status, result);
      }
      return result;
    } catch (error) {
      if (error instanceof RadarHttpError && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label}: falha de rede.`);
}

async function syncCollection(collection, supabaseUrl, functionHeaders) {
  let cursor = null;
  let totalProcessed = 0;
  for (let page = 1; page <= MAX_PAGES_PER_COLLECTION; page += 1) {
    const result = await fetchJson(
      `${supabaseUrl}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: functionHeaders,
        body: JSON.stringify({ collection, cursor }),
      },
      `Backfill ${collection}`,
    );
    totalProcessed += Number(result?.processed || 0);
    process.stdout.write(`${collection}: lote ${page}, ${Number(result?.read || 0)} lidos, ${totalProcessed} aplicados.\n`);
    if (result?.done === true) return;
    if (!result?.nextCursor || JSON.stringify(result.nextCursor) === JSON.stringify(cursor)) {
      throw new Error(`O cursor de ${collection} não avançou; o backfill foi interrompido com segurança.`);
    }
    cursor = result.nextCursor;
    if (page === MAX_PAGES_PER_COLLECTION) throw new Error(`Limite de páginas atingido em ${collection}.`);
  }
}

async function verifyCollection(collection, supabaseUrl, functionHeaders) {
  const result = await fetchJson(
    `${supabaseUrl}/functions/v1/${FUNCTION_NAME}`,
    {
      method: "POST",
      headers: functionHeaders,
      body: JSON.stringify({ collection, verify: true }),
    },
    `Conferência ${collection}`,
  );
  process.stdout.write(`${collection}: Supabase ${result?.sourceCount}; Neon ${result?.neonCount}.\n`);
  return result;
}

export async function runRadarNeonBackfill(environment) {
  const { supabaseUrl, publishableKey } = await readSupabaseConfig(environment);
  const headers = { apikey: publishableKey, "content-type": "application/json" };
  let functionHeaders = headers;
  if (environment === "homolog") {
    const email = requiredEnvironment("GLL_E2E_EMAIL", environment);
    const password = requiredEnvironment("GLL_E2E_PASSWORD", environment);
    const session = await fetchJson(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      { method: "POST", headers, body: JSON.stringify({ email, password }) },
      "Autenticação do administrador E2E",
    );
    const accessToken = session?.access_token;
    if (typeof accessToken !== "string" || !accessToken) throw new Error("A autenticação não retornou uma sessão válida.");
    functionHeaders = { ...headers, authorization: `Bearer ${accessToken}` };
  } else if (environment === "production") {
    const backfillToken = requiredEnvironment("GLL_RADAR_BACKFILL_TOKEN", environment);
    functionHeaders = { ...headers, "x-radar-backfill-token": backfillToken };
  } else {
    throw new Error("Ambiente de backfill inválido.");
  }

  for (const collection of COLLECTIONS) await syncCollection(collection, supabaseUrl, functionHeaders);

  let pendingCollections = COLLECTIONS;
  for (let round = 0; round <= MAX_FINALIZATION_RECONCILIATION_ROUNDS; round += 1) {
    if (round > 0) {
      process.stdout.write(
        `Reconciliando coleções do Radar após novas alterações na origem: ${pendingCollections.join(", ")} (tentativa ${round}/${MAX_FINALIZATION_RECONCILIATION_ROUNDS}).\n`,
      );
      for (const collection of pendingCollections) await syncCollection(collection, supabaseUrl, functionHeaders);
    }

    const checks = await Promise.all(
      COLLECTIONS.map((collection) => verifyCollection(collection, supabaseUrl, functionHeaders)),
    );
    pendingCollections = checks
      .filter((check) => check?.neonCountAtLeastSourceCount !== true)
      .map((check) => check.collection)
      .filter((collection) => COLLECTIONS.includes(collection));
    if (pendingCollections.length) {
      if (round === MAX_FINALIZATION_RECONCILIATION_ROUNDS) {
        throw new Error(`A contagem do Neon continua incompleta em: ${pendingCollections.join(", ")}.`);
      }
      continue;
    }

    let finalized;
    try {
      finalized = await fetchJson(
        `${supabaseUrl}/functions/v1/${FUNCTION_NAME}`,
        {
          method: "POST",
          headers: functionHeaders,
          body: JSON.stringify({ finalize: true }),
        },
        "Ativação da leitura Neon",
      );
    } catch (error) {
      const diagnostics = radarBackfillReconciliationDiagnostics(error);
      if (diagnostics) {
        process.stdout.write(
          `Reconciliação ${diagnostics.collection}: `
          + `Supabase=${diagnostics.sourceCount ?? "indisponível"}; `
          + `Neon=${diagnostics.neonCount ?? "indisponível"}; `
          + `verificadas=${diagnostics.checkedRows ?? "indisponível"}; `
          + `ausentes=${diagnostics.missingRows ?? "indisponível"}; `
          + `divergências=${diagnostics.contentMismatches ?? "indisponível"}; `
          + `campos=${diagnostics.differingFieldNames.length
            ? diagnostics.differingFieldNames.join(",")
            : diagnostics.mismatchDiagnosticsAvailable ? "nenhum identificado" : "indisponível"}; `
          + `estável=${diagnostics.stableDuringReconciliation ?? "indisponível"}.\n`,
        );
      }
      pendingCollections = unverifiedRadarCollections(error);
      if (pendingCollections.length && round < MAX_FINALIZATION_RECONCILIATION_ROUNDS) continue;
      throw error;
    }
    if (!isRadarBackfillFinalized(finalized)) {
      throw new Error("O backfill não confirmou todas as coleções; a leitura continua no Supabase.");
    }
    process.stdout.write(`Backfill conferido; readiness do Neon confirmada em ${environment}.\n`);
    return;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRadarNeonBackfill("homolog").catch((error) => {
    process.stderr.write((error instanceof Error ? error.message : "Falha no backfill Neon do Radar.") + "\n");
    process.exitCode = 1;
  });
}
