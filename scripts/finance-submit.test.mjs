import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {};
const { submitCashflowOperation, savedCashflowRecordIsVisible } = await import("../web/finance.js");

test("a rejected receipt cannot become a success when the loading wrapper swallows errors", async () => {
  const databaseError = new Error("O recebimento supera o saldo do item.");
  const runBusy = async (operation) => {
    try {
      await operation();
    } catch {
      // The application loading wrapper currently consumes thrown errors.
    }
  };

  await assert.rejects(
    submitCashflowOperation(runBusy, () => Promise.reject(databaseError), "Salvando…"),
    (error) => error === databaseError,
  );
  await assert.rejects(
    submitCashflowOperation(async () => undefined, () => ({ id: "not-saved" }), "Salvando…"),
    /Não foi possível confirmar o lançamento/,
  );
});

test("a save is confirmed only when its receipt or reimbursement appears in refreshed data", async () => {
  const runBusy = async (operation) => operation();
  const receipt = await submitCashflowOperation(runBusy, async () => ({ id: "receipt-1" }), "Salvando…");
  assert.equal(savedCashflowRecordIsVisible({ receipts: [] }, "receipt", receipt), false);
  assert.equal(savedCashflowRecordIsVisible({ receipts: [{ id: "receipt-1" }] }, "receipt", receipt), true);
  assert.equal(savedCashflowRecordIsVisible({ reimbursements: [] }, "reimbursement", { id: "refund-1" }), false);
  assert.equal(savedCashflowRecordIsVisible({ reimbursements: [{ id: "refund-1" }] }, "reimbursement", { id: "refund-1" }), true);
});
