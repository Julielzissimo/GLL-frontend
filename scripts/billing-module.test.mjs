import assert from "node:assert/strict";
import test from "node:test";

test("billing module loads and registers its feature factory", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {};

  try {
    await import("../web/billing.js");
    assert.equal(typeof globalThis.window.GLLBilling?.createBillingFeature, "function");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
