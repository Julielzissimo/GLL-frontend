import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCashAvailable,
  calculateParticipantReserveBalance,
  calculateRecognizedProfit,
  calculateReservationBalance,
  formatFinanceCurrency,
  validateRedistributionDraft,
  validateReversalAmount,
  validateWithdrawalDraft,
} from "../web/finance-reservations.js";

const events = [
  { reservation_id: "r1", participant_id: "p1", amount_signed: "60.00" },
  { reservation_id: "r1", participant_id: "p1", amount_signed: "-10.00" },
  { reservation_id: "r1", participant_id: "p1", amount_signed: "-5.00" },
  { reservation_id: "r1", participant_id: "p2", amount_signed: "40.00" },
  { reservation_id: "r2", participant_id: "p1", amount_signed: "10.00" },
];

test("reserve balances include allocations, redistributions, withdrawals and reversals as signed events", () => {
  assert.equal(calculateReservationBalance(events, "r1", "p1"), "45.00");
  assert.equal(calculateParticipantReserveBalance(events, "p1"), "55.00");
  assert.equal(calculateReservationBalance(events, "r1", "p2"), "40.00");
});

test("global cash availability includes company expenses, previous withdrawals and withdrawal reversals", () => {
  assert.equal(calculateCashAvailable([
    { amount_signed: "1000.00", event_type: "profit_receipt" },
    { amount_signed: "-120.00", event_type: "company_expense" },
    { amount_signed: "-500.00", event_type: "withdrawal" },
    { amount_signed: "50.00", event_type: "withdrawal_reversal" },
  ]), "430.00");
});

test("recognized profit is reduced by receipt reversals without floating point", () => {
  assert.equal(calculateRecognizedProfit(
    [{ recognized_profit_amount: "20.01" }, { recognized_profit_amount: "0.99" }],
    [{ recognized_profit_amount: "5.00" }],
  ), "16.00");
  assert.equal(calculateRecognizedProfit(
    [{ recognized_profit_amount: "20.01" }, { recognized_profit_amount: "0.99" }],
    [{ recognized_profit_amount: "5.00" }],
    [{ amount_delta: "2.10" }, { amount_delta: "-0.35" }],
  ), "17.75");
});

test("withdrawal validates edital, beneficiary, date, reason, reserved balance and global cash", () => {
  const valid = {
    amount: "25.00",
    paidOn: "2026-11-04",
    reason: "Retirada aprovada na conferência mensal",
    bidId: "bid-123",
    reservationId: "reservation-123",
    participantId: "participant-123",
    reservationBalance: "30.00",
    participantBalance: "50.00",
    recognizedProfitAvailable: "50.00",
    cashAvailable: "100.00",
  };
  assert.deepEqual(validateWithdrawalDraft(valid), {
    amount: "25.00",
    paid_on: "2026-11-04",
    reason: valid.reason,
  });
  assert.throws(() => validateWithdrawalDraft({ ...valid, amount: "-1.00" }), /maior que zero/);
  assert.throws(() => validateWithdrawalDraft({ ...valid, bidId: "" }), /vinculada ao edital/);
  assert.throws(() => validateWithdrawalDraft({ ...valid, paidOn: "2026-02-30" }), /data válida/);
  assert.throws(() => validateWithdrawalDraft({ ...valid, reason: " " }), /justificativa/);
  assert.throws(() => validateWithdrawalDraft({ ...valid, amount: "30.01" }), /saldo reservado/);
  assert.throws(() => validateWithdrawalDraft({ ...valid, amount: "40.00", reservationBalance: "50.00", participantBalance: "30.00" }), /saldo total reservado/);
  assert.throws(() => validateWithdrawalDraft({ ...valid, amount: "50.01" }), /saldo reservado/);
  assert.throws(() => validateWithdrawalDraft({ ...valid, amount: "40.00", reservationBalance: "50.00", participantBalance: "50.00", recognizedProfitAvailable: "39.99" }), /lucro reconhecido/);
  assert.throws(() => validateWithdrawalDraft({ ...valid, amount: "40.00", reservationBalance: "50.00", participantBalance: "50.00", recognizedProfitAvailable: "50.00", cashAvailable: "39.99" }), /caixa disponível/);
});

test("redistributions require a distinct beneficiary, positive amount and an auditable reason", () => {
  const valid = {
    amount: "10.00", reason: "Correção de percentuais por acordo documentado",
    reservationId: "r1", fromParticipantId: "p1", toParticipantId: "p2", sourceBalance: "10.00",
  };
  assert.equal(validateRedistributionDraft(valid).amount, "10.00");
  assert.throws(() => validateRedistributionDraft({ ...valid, toParticipantId: "p1" }), /diferentes/);
  assert.throws(() => validateRedistributionDraft({ ...valid, amount: "10.01" }), /excede o saldo/);
  assert.throws(() => validateRedistributionDraft({ ...valid, reason: "" }), /justificativa/);
  assert.throws(() => validateRedistributionDraft({ ...valid, amount: "0.00" }), /maior que zero/);
});

test("reversal amounts cannot exceed the outstanding source value", () => {
  assert.equal(validateReversalAmount("5.00", "10.00"), "5.00");
  assert.throws(() => validateReversalAmount("10.01", "10.00"), /excede o valor ainda não estornado/);
  assert.throws(() => validateReversalAmount("0.00", "10.00"), /maior que zero/);
});

test("money formatting handles reais and negative historical corrections exactly", () => {
  assert.equal(formatFinanceCurrency("123456.78"), "R$ 123.456,78");
  assert.equal(formatFinanceCurrency("-0.01"), "−R$ 0,01");
});
