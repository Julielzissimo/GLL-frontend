import assert from "node:assert/strict";
import test from "node:test";

import {
  isRadarBackfillFinalized,
  radarBackfillReconciliationDiagnostics,
  unverifiedRadarCollections,
} from "./backfill_radar_neon_homolog.mjs";

test("backfill reconciliation accepts only known collections from HTTP 409", () => {
  const error = Object.assign(new Error("incomplete"), {
    status: 409,
    payload: { unverifiedCollections: ["items", "coverage", "unknown", "items", "tenders"] },
  });

  assert.deepEqual(unverifiedRadarCollections(error), ["items", "coverage", "tenders"]);
});

test("backfill reconciliation ignores non-conflict and malformed responses", () => {
  assert.deepEqual(unverifiedRadarCollections({ status: 503, payload: { unverifiedCollections: ["items"] } }), []);
  assert.deepEqual(unverifiedRadarCollections({ status: 409, payload: { unverifiedCollections: "items" } }), []);
  assert.deepEqual(unverifiedRadarCollections({ status: 409, payload: { unverifiedCollections: ["radar_licitacoes"] } }), []);
});

test("content reconciliation retries the collection returned by the finalizer", () => {
  assert.deepEqual(unverifiedRadarCollections({ status: 409, payload: { collection: "items" } }), ["items"]);
  assert.deepEqual(unverifiedRadarCollections({ status: 409, payload: { collection: "unknown" } }), []);
});

test("reconciliation diagnostics expose only safe collection counts", () => {
  const details = radarBackfillReconciliationDiagnostics({
    status: 409,
    payload: {
      collection: "items",
      sourceCount: 65_481,
      neonCount: 65_481,
      checkedRows: 65_481,
      missingRows: 0,
      contentMismatches: 1,
      stableDuringReconciliation: false,
      rowKey: "must not be exposed",
      sourceValue: "must not be exposed",
    },
  });

  assert.deepEqual(details, {
    collection: "items",
    sourceCount: 65_481,
    neonCount: 65_481,
    checkedRows: 65_481,
    missingRows: 0,
    contentMismatches: 1,
    stableDuringReconciliation: false,
  });
  assert.equal(radarBackfillReconciliationDiagnostics({
    status: 409,
    payload: { collection: "unknown", contentMismatches: 1 },
  }), null);
  assert.equal(radarBackfillReconciliationDiagnostics({
    status: 503,
    payload: { collection: "items", contentMismatches: 1 },
  }), null);
});

test("backfill finalization validates every collection from the content reconciliation response", () => {
  const collections = ["modalities", "states", "municipalities", "platforms", "domains", "tenders", "item_sync", "items", "coverage"];
  const result = {
    ready: true,
    reconciliation: "source_rows_and_contract_fields_match",
    stableAcrossPasses: true,
    verifiedCollections: collections.map((collection) => ({ collection, checkedRows: 1 })),
  };

  assert.equal(isRadarBackfillFinalized(result), true);
  assert.equal(isRadarBackfillFinalized({ ...result, verifiedCollections: collections.length }), false);
  assert.equal(isRadarBackfillFinalized({ ...result, verifiedCollections: result.verifiedCollections.slice(1) }), false);
  assert.equal(isRadarBackfillFinalized({ ...result, verifiedCollections: [...result.verifiedCollections.slice(1), result.verifiedCollections[1]] }), false);
  assert.equal(isRadarBackfillFinalized({ ...result, stableAcrossPasses: false }), false);
});
