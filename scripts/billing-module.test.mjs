import assert from "node:assert/strict";
import test from "node:test";

test("billing module loads and registers its feature factory", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  globalThis.window = {};
  globalThis.document = { getElementById: () => null };

  try {
    await import("../web/billing.js");
    assert.equal(typeof globalThis.window.GLLBilling?.createBillingFeature, "function");
    const feature = globalThis.window.GLLBilling.createBillingFeature({
      getBid: () => ({ id: 1 }),
      getBudgetItems: () => [],
      store: { getBillingData: async () => { throw new Error("Falha de leitura"); } },
    });
    await assert.doesNotReject(feature.refresh());
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
