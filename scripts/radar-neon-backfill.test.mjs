import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
