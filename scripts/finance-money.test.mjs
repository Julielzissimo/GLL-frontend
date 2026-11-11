import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCashflowMetrics,
  costForQuantityCents,
  formatBrl,
  moneyToDecimalString,
  parseMoneyToCents,
  reimbursementPaymentLimitCents,
  splitCentsByPercent,
  splitCentsByParticipantRules,
  validateInvoiceReceipt,
  validateReceiptLine,
} from "../web/finance-money.js";

test("parses Brazilian currency exactly into integer cents", () => {
  assert.equal(parseMoneyToCents("R$ 1.234,56"), 123456);
  assert.equal(parseMoneyToCents("0,05"), 5);
  assert.equal(parseMoneyToCents("1234.56"), 123456);
  assert.equal(moneyToDecimalString(123456), "1234.56");
  assert.equal(formatBrl(123456), "R$ 1.234,56");
});

test("rejects fractional cents and malformed currency", () => {
  assert.throws(() => parseMoneyToCents("12,345"), /casas decimais/);
  assert.throws(() => parseMoneyToCents("12 reais"), /numérico/);
});

test("calculates item cost from the exact four-decimal unit price", () => {
  assert.equal(costForQuantityCents("28.7950", "400.0000"), 1151800);
  assert.equal(costForQuantityCents("28.7950", "0.5000"), 1440);
});

test("splits profit to exact cents with deterministic remainder", () => {
  const split = splitCentsByPercent(101, [
    { id: "a", percent: "50.00" },
    { id: "b", percent: "50.00" },
  ]);
  assert.deepEqual(split.map((row) => row.cents), [51, 50]);
  assert.equal(split.reduce((sum, row) => sum + row.cents, 0), 101);
});

test("rejects shares that do not reconcile to one hundred percent", () => {
  assert.throws(() => splitCentsByPercent(100, [
    { id: "a", percent: "60" },
    { id: "b", percent: "39" },
  ]), /somar 100%/);
});

test("divides a cent-exact profit equally among three participants", () => {
  const participants = ["a", "b", "c"].map((id) => ({ id, equal_share: true, default_share_percent: 0 }));
  assert.deepEqual(splitCentsByParticipantRules(10000, participants).map((row) => row.cents), [3334, 3333, 3333]);
  assert.deepEqual(splitCentsByParticipantRules(5, participants).map((row) => row.cents), [2, 2, 1]);
});

test("equal participants divide the profit left after fixed percentages", () => {
  const participants = [
    { id: "a", equal_share: false, default_share_percent: 20 },
    { id: "b", equal_share: true, default_share_percent: 0 },
    { id: "c", equal_share: true, default_share_percent: 0 },
  ];
  assert.deepEqual(splitCentsByParticipantRules(101, participants).map((row) => row.cents), [20, 41, 40]);
  assert.throws(() => splitCentsByParticipantRules(100, [
    { id: "a", equal_share: false, default_share_percent: 101 },
    { id: "b", equal_share: true, default_share_percent: 0 },
  ]), /entre 0% e 100%/);
});

test("reconciles profit and preserves an item loss when cost is above the receipt", () => {
  assert.deepEqual(validateReceiptLine({ amountCents: 10000, costCents: 4000, reserveCents: 1000 }), { profitCents: 5000, lossCents: 0 });
  assert.deepEqual(validateReceiptLine({ amountCents: 10000, costCents: 12000, reserveCents: 0 }), { profitCents: 0, lossCents: 2000 });
  assert.throws(() => validateReceiptLine({ amountCents: 10000, costCents: 7000, reserveCents: 4000 }), /superar/);
  assert.throws(() => validateReceiptLine({ amountCents: -1, costCents: 0, reserveCents: 0 }), /maior que zero/);
});

test("tracks invoice quantity and cash payment balances independently", () => {
  assert.deepEqual(validateInvoiceReceipt({
    quantity: "1",
    openQuantity: "3",
    amountCents: 5000,
    openAmountCents: 25000,
  }), { quantity: 1, amountCents: 5000 });
  assert.throws(() => validateInvoiceReceipt({ quantity: "4", openQuantity: "3", amountCents: 5000, openAmountCents: 25000 }), /saldo faturado/);
  assert.throws(() => validateInvoiceReceipt({ quantity: "1", openQuantity: "3", amountCents: 26000, openAmountCents: 25000 }), /saldo financeiro/);
});

test("caps reserve-funded reimbursements at the available reserve and pending balance", () => {
  assert.equal(reimbursementPaymentLimitCents({
    pendingCents: 15000,
    fundingSource: "expense_reserve",
    expenseReserveBalanceCents: 7000,
  }), 7000);
  assert.equal(reimbursementPaymentLimitCents({
    pendingCents: 5000,
    fundingSource: "expense_reserve",
    expenseReserveBalanceCents: 7000,
  }), 5000);
  assert.equal(reimbursementPaymentLimitCents({
    pendingCents: 15000,
    fundingSource: "operating_cash",
    expenseReserveBalanceCents: 0,
  }), 15000);
  assert.equal(reimbursementPaymentLimitCents({
    pendingCents: 15000,
    fundingSource: "expense_reserve",
    expenseReserveBalanceCents: 0,
  }), 0);
});

test("keeps cash, expense reserve, participant profit and reimbursements independent", () => {
  const metrics = calculateCashflowMetrics({
    settings: { opening_cash_balance: "100.00" },
    receipts: [{ id: "r1", bid_id: "b1", received_on: "2026-11-05", gross_amount: "100.00" }],
    receiptLines: [{ receipt_id: "r1", reserve_amount: "20.00" }],
    allocations: [{ receipt_id: "r1", participant_id: "p1", amount: "40.00" }],
    expenses: [
      { id: "e1", payer_type: "company", amount: "10.00", reserve_charge_amount: "10.00" },
      { id: "e2", payer_type: "participant", amount: "15.00", reserve_charge_amount: "10.00" },
    ],
    reimbursements: [{ expense_id: "e2", amount: "5.00", funding_source: "expense_reserve" }],
    withdrawals: [{ bid_id: "b1", participant_id: "p1", amount: "12.00" }],
    parties: [{ id: "p1", party_type: "participant" }],
  });
  assert.equal(metrics.cashBalanceCents, 17300);
  assert.equal(metrics.expenseReserveBalanceCents, 1500);
  assert.equal(metrics.profitAvailableCents, 2800);
  assert.equal(metrics.reimbursementPendingCents, 1000);
});

test("company reimbursements accumulate separately and enter cash only when received", () => {
  const metrics = calculateCashflowMetrics({
    settings: { opening_cash_balance: "100.00" },
    receipts: [{ id: "r1", bid_id: "b1", received_on: "2026-11-05", gross_amount: "100.00" }],
    receiptLines: [{ receipt_id: "r1", reserve_amount: "20.00" }],
    allocations: [{ receipt_id: "r1", participant_id: "p1", amount: "40.00" }],
    expenses: [
      { id: "e1", payer_type: "company", reimbursement_direction: "receivable", amount: "10.00", reserve_charge_amount: "0.00" },
      { id: "e2", payer_type: "participant", reimbursement_direction: "payable", amount: "15.00", reserve_charge_amount: "10.00" },
    ],
    reimbursements: [
      { expense_id: "e1", amount: "4.00" },
      { expense_id: "e2", amount: "5.00", funding_source: "operating_cash" },
    ],
    withdrawals: [{ bid_id: "b1", participant_id: "p1", amount: "12.00" }],
    parties: [{ id: "p1", party_type: "participant" }],
  });
  assert.equal(metrics.grossReceiptsCents, 10000);
  assert.equal(metrics.cashBalanceCents, 18700);
  assert.equal(metrics.expenseReserveBalanceCents, 2000);
  assert.equal(metrics.reimbursementReceivableCents, 600);
  assert.equal(metrics.reimbursementPendingCents, 1000);
});

test("excludes reversed receipts and their allocations from balances", () => {
  const metrics = calculateCashflowMetrics({
    settings: { opening_cash_balance: "0.00" },
    receipts: [{ id: "r1", bid_id: "b1", received_on: "2026-11-05", gross_amount: "100.00", reversed_at: "2026-11-06T00:00:00Z" }],
    receiptLines: [{ receipt_id: "r1", reserve_amount: "25.00" }],
    allocations: [{ receipt_id: "r1", participant_id: "p1", amount: "75.00" }],
    expenses: [], reimbursements: [], withdrawals: [],
    parties: [{ id: "p1", party_type: "participant" }],
  });
  assert.equal(metrics.cashBalanceCents, 0);
  assert.equal(metrics.expenseReserveBalanceCents, 0);
  assert.equal(metrics.profitAvailableCents, 0);
});
