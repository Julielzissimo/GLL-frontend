import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("Faturamento preserva lançamentos em atualização e confirma descarte", async ({ page }) => {
  await page.setContent(`
    <div id="billingRoot">
      <p id="billingOverviewDescription"></p>
      <span id="billingItemCount"></span><span id="billingPendingCount"></span>
      <span id="billingPartialCount"></span><span id="billingSuppliedCount"></span>
      <span id="billingInvoicedCount"></span>
      <table><tbody id="billingTableBody"></tbody></table>
    </div>
    <dialog id="billingDrawer" aria-labelledby="billingDrawerTitle">
      <button type="button" data-close-billing-drawer>Fechar</button>
      <h2 id="billingDrawerTitle"></h2><p id="billingDrawerDescription"></p>
      <div id="billingDrawerContent"></div>
    </dialog>
    <dialog id="billingDiscardDialog" aria-labelledby="billingDiscardTitle">
      <h2 id="billingDiscardTitle">Descartar alterações?</h2>
      <button type="button" data-billing-continue>Continuar editando</button>
      <button type="button" data-billing-discard>Descartar alterações</button>
    </dialog>
  `);
  await page.addScriptTag({ path: resolve("web/billing.js") });
  await page.evaluate(async () => {
    window.billingFeature = window.GLLBilling.createBillingFeature({
      getBid: () => ({ id: 1, status: "Em Fornecimento" }),
      getQuotation: () => null,
      getBudgetItems: () => [{ id: 1, item_number: 1, quantity: 5, description: "Item fictício", final_bid: 100 }],
      store: { getBillingData: async () => ({ fulfillment: [{ id: 10, quotation_item_id: 1 }], commitment: [], delivery: [], invoice: [], cashflowInvoiceSummary: [] }) },
      toast: () => {},
      runBusy: (action) => action(),
      onSaved: () => {},
    });
    await window.billingFeature.showPage();
  });

  await page.getByRole("button", { name: "Acompanhar" }).click();
  await page.locator('[data-open-billing-section="invoice"]').click();
  await page.locator("[data-close-billing-drawer]").click();
  await expect(page.locator("#billingDiscardDialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Acompanhar" }).click();
  await page.locator('[data-open-billing-section="invoice"]').click();
  const number = page.locator("#billingInvoiceNumber");
  await number.fill("NF fictícia 123");
  const observations = page.locator("#billingInvoiceObservations");
  await observations.fill("Observação fictícia");
  await number.evaluate((field) => {
    field.focus();
    field.setSelectionRange(4, 4);
  });
  await page.evaluate(() => window.billingFeature.refresh());
  await expect(number).toHaveValue("NF fictícia 123");
  await expect(number).toBeFocused();
  await expect.poll(() => number.evaluate((field) => field.selectionStart)).toBe(4);
  await expect(observations).toHaveValue("Observação fictícia");

  await page.locator("[data-close-billing-drawer]").click();
  await expect(page.locator("#billingDiscardDialog")).toBeVisible();
  await page.locator("[data-billing-continue]").click();
  await expect(page.locator("#billingDrawer")).toBeVisible();
  await expect(number).toHaveValue("NF fictícia 123");

  await page.locator("#billingDrawer").press("Escape");
  await expect(page.locator("#billingDiscardDialog")).toBeVisible();
  await page.locator("[data-billing-discard]").click();
  await expect(page.locator("#billingDrawer")).not.toBeVisible();

  await page.getByRole("button", { name: "Acompanhar" }).click();
  await page.locator('[data-open-billing-section="delivery"]').click();
  const deliveryNotes = page.locator("#billingDeliveryNotes");
  await deliveryNotes.fill("Entrega fictícia");
  await deliveryNotes.evaluate((field) => field.setSelectionRange(5, 5));
  await page.evaluate(() => window.billingFeature.refresh());
  await expect(deliveryNotes).toHaveValue("Entrega fictícia");
  await expect(deliveryNotes).toBeFocused();
  await expect.poll(() => deliveryNotes.evaluate((field) => field.selectionStart)).toBe(5);
});
