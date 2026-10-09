import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const build = (target, overrides = {}) => spawnSync(
  process.execPath,
  ["scripts/build-web.mjs", target],
  { cwd: process.cwd(), env: { ...process.env, ...overrides }, encoding: "utf8" },
);

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
