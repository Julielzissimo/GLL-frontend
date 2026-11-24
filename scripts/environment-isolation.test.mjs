import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const build = (target, overrides = {}) => spawnSync(
  process.execPath,
  ["scripts/build-web.mjs", target],
  { cwd: process.cwd(), env: { ...process.env, ...overrides }, encoding: "utf8" },
);

function readRuntimeConfig(target) {
  const source = readFileSync(new URL(`../dist/${target === "production" ? "prod" : target}/env.js`, import.meta.url), "utf8");
  const match = source.match(/^window\.GLL_CONFIG = (.+);\s*$/s);
  assert.ok(match, `runtime config for ${target} was generated`);
  return JSON.parse(match[1]);
}

test("homolog build rejects the production Supabase project before writing output", () => {
  const result = build("homolog", { GLL_SUPABASE_URL: "https://siqsjxohpcrujobkbshn.supabase.co" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /não corresponde ao projeto Supabase/);
});

test("production build rejects the homolog Supabase project", () => {
  const result = build("production", { GLL_SUPABASE_URL: "https://dwotbzrjcetizyygzoty.supabase.co" });
  assert.notEqual(result.status, 0);
});

test("homolog build rejects the production publishable key", () => {
  const result = build("homolog", { GLL_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_MiojjcG8vXoQxn3NBcRgUQ_ymOMWAkW" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /não pode ser usada/);
});

test("build never includes a Supabase secret key", () => {
  const result = build("homolog", { GLL_SUPABASE_PUBLISHABLE_KEY: "sb_secret_example" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /somente uma chave pública/);
});

test("homolog enables document lookup while keeping other Radar fallback actions disabled", () => {
  const result = build("homolog", {
    GLL_RADAR_DETAILS_FALLBACK_HOMOLOG: "",
    GLL_RADAR_DOCUMENTS_FALLBACK_HOMOLOG: "",
  });
  assert.equal(result.status, 0, result.stderr);
  const config = readRuntimeConfig("homolog");
  assert.equal(config.radarDocumentsFallbackEnabled, true);
  assert.equal(config.radarDetailsFallbackEnabled, false);
});

test("production enables promoted Radar document lookup without metadata fallback", () => {
  const result = build("production", {
    GLL_RADAR_DETAILS_FALLBACK_PRODUCTION: "",
    GLL_RADAR_DOCUMENTS_FALLBACK_PRODUCTION: "",
  });
  assert.equal(result.status, 0, result.stderr);
  const config = readRuntimeConfig("production");
  assert.equal(config.radarDocumentsFallbackEnabled, true);
  assert.equal(config.radarDetailsFallbackEnabled, false);
});
