import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SUPABASE_CONFIG_PATH = new URL("./build-web.mjs", import.meta.url);
const FUNCTION_NAME = "radar-neon-backfill";
const MAX_FINALIZATION_RECONCILIATION_ROUNDS = 2;
const COLLECTIONS = [
  "modalities",
  "states",
  "municipalities",
  "platforms",
  "domains",
  "tenders",
  "item_sync",
  "items",
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
  if (error?.status !== 409 || !Array.isArray(error.payload?.unverifiedCollections)) return [];
  return [...new Set(error.payload.unverifiedCollections.filter((value) => COLLECTIONS.includes(value)))];
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure ${name} no ambiente homolog.`);
  return value;
}

async function readHomologSupabaseConfig() {
  const source = await readFile(SUPABASE_CONFIG_PATH, "utf8");
  const block = source.match(/homolog:\s*\{([\s\S]*?)\n\s{2}\},/u)?.[1];
  if (!block) throw new Error("Não foi possível identificar a configuração Supabase de homologação.");
  const supabaseUrl = block.match(/supabaseUrl:\s*["']([^"']+)["']/u)?.[1];
  const publishableKey = block.match(/supabaseAnonKey:\s*["']([^"']+)["']/u)?.[1];
  if (!supabaseUrl || !publishableKey?.startsWith("sb_publishable_")) {
    throw new Error("A configuração pública Supabase de homologação está incompleta.");
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

async function main() {
  const email = requiredEnvironment("GLL_E2E_EMAIL");
  const password = requiredEnvironment("GLL_E2E_PASSWORD");
  const { supabaseUrl, publishableKey } = await readHomologSupabaseConfig();
  const headers = { apikey: publishableKey, "content-type": "application/json" };
  const session = await fetchJson(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    { method: "POST", headers, body: JSON.stringify({ email, password }) },
    "Autenticação do administrador E2E",
  );
  const accessToken = session?.access_token;
  if (typeof accessToken !== "string" || !accessToken) throw new Error("A autenticação não retornou uma sessão válida.");
  process.stdout.write("::add-mask::" + accessToken + "\n");
  const functionHeaders = { ...headers, authorization: `Bearer ${accessToken}` };

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
      pendingCollections = unverifiedRadarCollections(error);
      if (pendingCollections.length && round < MAX_FINALIZATION_RECONCILIATION_ROUNDS) continue;
      throw error;
    }
    if (finalized?.ready !== true || finalized?.verifiedCollections !== COLLECTIONS.length) {
      throw new Error("O backfill não confirmou todas as coleções; a leitura continua no Supabase.");
    }
    process.stdout.write("Backfill conferido; leitura Neon liberada em homologação.\n");
    return;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write((error instanceof Error ? error.message : "Falha no backfill Neon do Radar.") + "\n");
    process.exitCode = 1;
  });
}
