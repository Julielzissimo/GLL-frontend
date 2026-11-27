import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { radarBackfillReconciliationDiagnostics } from "./backfill_radar_neon_homolog.mjs";

const script = await readFile(new URL("./backfill_radar_neon_homolog.mjs", import.meta.url), "utf8");
const productionScript = await readFile(new URL("./backfill_radar_neon_production.mjs", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/backfill-neon-homolog.yml", import.meta.url), "utf8");

test("Radar Neon backfill is restricted to homolog and an explicit run marker", () => {
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /push:\s*branches:\s*-\s*homolog\s*paths:/u);
  assert.match(workflow, /if:\s*>-\s*github\.ref_name == 'homolog'/u);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/u);
  assert.match(workflow, /github\.event_name == 'push'/u);
  assert.match(workflow, /contains\(github\.event\.head_commit\.message, '\[RADAR_NEON_BACKFILL\]'\)/u);
  assert.match(workflow, /environment: homolog/u);
  assert.match(workflow, /GLL_E2E_EMAIL: \$\{\{ secrets\.GLL_E2E_EMAIL \}\}/u);
  assert.match(workflow, /GLL_E2E_PASSWORD: \$\{\{ secrets\.GLL_E2E_PASSWORD \}\}/u);
  assert.doesNotMatch(workflow, /GLL_E2E_(?:EMAIL|PASSWORD)_PROD|PRODUCAO|production/u);
});

test("backfill uses the public homolog Supabase endpoint and the authenticated Edge Function", () => {
  assert.match(script, /readSupabaseConfig\(environment\)/u);
  assert.match(script, /SUPABASE_PROJECTS\s*=\s*\{/u);
  assert.match(script, /supabaseAnonKey/u);
  assert.match(script, /sb_publishable_/u);
  assert.match(script, /new URL\(supabaseUrl\)\.hostname !== expectedHost/u);
  assert.match(script, /functions\/v1\/\$\{FUNCTION_NAME\}/u);
  assert.match(script, /authorization:\s*`Bearer \$\{accessToken\}`/u);
  assert.match(script, /x-radar-backfill-token/u);
  assert.doesNotMatch(script, /postgres(?:ql)?:\/\/|GLL_RADAR_NEON_(?:READ|INGEST|MIGRATION)_URL/u);
  assert.match(productionScript, /runRadarNeonBackfill\("production"\)/u);
});

test("all collections are verified before the backfill readiness gate is enabled", () => {
  assert.match(script, /neonCountAtLeastSourceCount !== true/u);
  assert.match(script, /JSON\.stringify\(\{ finalize: true \}\)/u);
  assert.match(script, /isRadarBackfillFinalized\(finalized\)/u);
  assert.match(script, /verified\.includes\(collection\)/u);
  assert.match(script, /error\.payload\?\.collection/u);
  assert.match(script, /error\.status < 500 && error\.status !== 429/u);
});

test("backfill failure output includes only bounded, safe tender field names", () => {
  const diagnostics = radarBackfillReconciliationDiagnostics({
    status: 409,
    payload: {
      collection: "tenders",
      contentMismatches: 2,
      mismatchDiagnosticsAvailable: true,
      mismatchDiagnostics: [
        {
          differingFields: ["radar_engine_revision", "atualizado_em", "bad field", "x;secret"],
          neonRevisionIsHigher: true,
          neonUpdatedAtIsLater: true,
        },
        {
          differingFields: ["atualizado_em", "objeto_compra"],
          neonRevisionIsHigher: true,
          neonUpdatedAtIsLater: true,
        },
      ],
      sourceValue: "sensitive source data",
      targetValue: "sensitive target data",
      numero_controle_pncp: "identifier",
    },
  });

  assert.deepEqual(diagnostics.differingFieldNames, ["atualizado_em", "objeto_compra", "radar_engine_revision"]);
  assert.equal(diagnostics.mismatchDiagnosticsAvailable, true);
  assert.equal(diagnostics.neonRevisionIsHigher, true);
  assert.equal(diagnostics.neonUpdatedAtIsLater, true);
  assert.equal(Object.hasOwn(diagnostics, "sourceValue"), false);
  assert.equal(Object.hasOwn(diagnostics, "targetValue"), false);
  assert.equal(Object.hasOwn(diagnostics, "numero_controle_pncp"), false);
});

test("newer-version diagnostics remain unknown when only a subset of mismatches is described", () => {
  const diagnostics = radarBackfillReconciliationDiagnostics({
    status: 409,
    payload: {
      collection: "tenders",
      contentMismatches: 6,
      mismatchDiagnosticsAvailable: true,
      mismatchDiagnostics: [{
        differingFields: ["radar_engine_revision"],
        neonRevisionIsHigher: true,
        neonUpdatedAtIsLater: true,
      }],
    },
  });

  assert.equal(diagnostics.neonRevisionIsHigher, null);
  assert.equal(diagnostics.neonUpdatedAtIsLater, null);
});
