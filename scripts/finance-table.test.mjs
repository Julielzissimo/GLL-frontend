import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {};
const {
  cashflowExpenseBidOptions,
  cashflowWithdrawalsForAccessibleBids,
  reimbursementTableRows,
  resolveCashflowExpenseBid,
} = await import("../web/finance.js");

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

test("expense bid search resolves only an exact accessible option and keeps general expenses", () => {
  const bids = [
    { id: "bid-1", edital_number: "123/2026", buyer_agency: "Secretaria Municipal" },
    { id: "bid-2", edital_number: "456/2026", buyer_agency: "Hospital Regional" },
  ];
  const firstOption = cashflowExpenseBidOptions(bids)[0];
  assert.deepEqual(resolveCashflowExpenseBid(firstOption.label.toLocaleUpperCase("pt-BR"), bids), {
    valid: true, bidId: "bid-1",
  });
  assert.deepEqual(resolveCashflowExpenseBid("", bids), { valid: true, bidId: null });
  assert.deepEqual(resolveCashflowExpenseBid("Edital 123", bids), { valid: false, bidId: null });
});

test("expense bid search disambiguates repeated edital labels", () => {
  const bids = [
    { id: "bid-abcdefgh-one", edital_number: "123/2026", buyer_agency: "Secretaria Municipal" },
    { id: "bid-abcdefgh-two", edital_number: "123/2026", buyer_agency: "Secretaria Municipal" },
  ];
  const options = cashflowExpenseBidOptions(bids);
  assert.notEqual(options[0].label, options[1].label);
  assert.equal(resolveCashflowExpenseBid(options[1].label, bids).bidId, bids[1].id);
});
test('withdrawal rows exclude bids outside the accessible list', () => {
  const withdrawals = [
    { id: 'visible', bid_id: 'bid-1', amount: '10.00' },
    { id: 'hidden', bid_id: 'bid-2', amount: '90.00' },
  ];
  assert.deepEqual(
    cashflowWithdrawalsForAccessibleBids(withdrawals, [{ id: 'bid-1' }]).map((row) => row.id),
    ['visible'],
  );
});
