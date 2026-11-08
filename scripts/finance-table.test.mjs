import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {};
const { reimbursementTableRows } = await import("../web/finance.js");

test("reimbursement rows retain settled expenses and show each recorded payment", () => {
  const data = {
    expenses: [
      { id: "expense-1", occurred_on: "2026-11-04", reimbursement_direction: "payable", amount: "180.00" },
      { id: "expense-2", occurred_on: "2026-11-05", reimbursement_direction: "receivable", amount: "90.00" },
      { id: "expense-3", occurred_on: "2026-11-05", reimbursement_direction: "none", amount: "20.00" },
    ],
    reimbursements: [
      { id: "payment-1", expense_id: "expense-1", paid_on: "2026-11-06", amount: "100.00" },
      { id: "payment-2", expense_id: "expense-1", paid_on: "2026-11-07", amount: "80.00" },
      { id: "payment-3", expense_id: "expense-2", paid_on: "2026-11-08", amount: "90.00" },
      { id: "unrelated", expense_id: "expense-3", paid_on: "2026-11-08", amount: "20.00" },
    ],
  };

  const all = reimbursementTableRows(data);
  assert.deepEqual(all.expenses.map((row) => row.id), ["expense-1", "expense-2"]);
  assert.deepEqual(all.payments.map((row) => row.id), ["payment-1", "payment-2", "payment-3"]);

  const filtered = reimbursementTableRows(data, { from: "2026-11-07", to: "2026-11-08" });
  assert.deepEqual(filtered.expenses, []);
  assert.deepEqual(filtered.payments.map((row) => row.id), ["payment-2", "payment-3"]);
});
