import assert from "node:assert/strict";
import test from "node:test";

import { unverifiedRadarCollections } from "./backfill_radar_neon_homolog.mjs";

test("backfill reconciliation accepts only known collections from HTTP 409", () => {
  const error = Object.assign(new Error("incomplete"), {
    status: 409,
    payload: { unverifiedCollections: ["items", "unknown", "items", "tenders"] },
  });

  assert.deepEqual(unverifiedRadarCollections(error), ["items", "tenders"]);
});

test("backfill reconciliation ignores non-conflict and malformed responses", () => {
  assert.deepEqual(unverifiedRadarCollections({ status: 503, payload: { unverifiedCollections: ["items"] } }), []);
  assert.deepEqual(unverifiedRadarCollections({ status: 409, payload: { unverifiedCollections: "items" } }), []);
  assert.deepEqual(unverifiedRadarCollections({ status: 409, payload: { unverifiedCollections: ["radar_licitacoes"] } }), []);
});
