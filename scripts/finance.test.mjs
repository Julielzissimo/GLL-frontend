import test from "node:test";
import assert from "node:assert/strict";
import { calculateFinanceSummary } from "../web/finance.js";

test("caixa não desconta custo pago pelo acionista nem quitação histórica duas vezes", () => {
  const result = calculateFinanceSummary({
    finance_settings: [{ opening_balance: 20 }],
    finance_bid_profits: [{ expected_profit: 250 }],
    finance_receipts: [{ amount: 200 }, { amount: 999, cancelled_at: "2026-01-01" }],
    finance_expenses: [{ id: "a", amount: 100, historical_reimbursed: 40 }],
    finance_reimbursements: [{ expense_id: "a", amount: 10 }],
    finance_withdrawals: [{ amount: 35 }],
  });
  assert.deepEqual(result, { balance: 175, expected: 250, received: 200, owed: 50 });
});

test("saldo de caixa e ressarcimento podem ficar negativos", () => {
  const result = calculateFinanceSummary({
    finance_settings: [], finance_bid_profits: [], finance_receipts: [],
    finance_expenses: [{ id: "a", amount: 10, historical_reimbursed: 0 }],
    finance_reimbursements: [{ expense_id: "a", amount: 15 }], finance_withdrawals: [],
  });
  assert.equal(result.balance, -15);
  assert.equal(result.owed, -5);
});
