import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createIdempotencyKeyCache,
  calculateExpenseBalance,
  calculateExpenseOverview,
  calculateExpenseReimbursed,
  expensePayerKey,
  filterGeneralExpenses,
  formatFinanceCurrency,
  validateGeneralExpenseDraft,
  validateReimbursementAmount,
} from "../web/finance-expenses.js";

const [appSource, pageSource, markup] = await Promise.all([
  readFile(new URL("../web/app.js", import.meta.url), "utf8"),
  readFile(new URL("../web/finance-expenses.js", import.meta.url), "utf8"),
  readFile(new URL("../web/index.html", import.meta.url), "utf8"),
]);

const participantExpense = {
  id: "expense-participant",
  payer_type: "participant",
  participant_payer_id: "participant-1",
  amount: "100.00",
  historical_reimbursed_amount: "0.00",
  paid_on: "2026-11-01",
};

test("participant and third-party payments create a calculable debt after partial reimbursements", () => {
  const reimbursements = [
    { id: "r-1", expense_id: participantExpense.id, amount: "20.00" },
    { id: "r-2", expense_id: participantExpense.id, amount: "35.00" },
  ];
  const reversals = [{ reimbursement_id: "r-1", amount: "5.00" }];
  assert.equal(calculateExpenseReimbursed(participantExpense, reimbursements, reversals), "50.00");
  assert.equal(calculateExpenseBalance(participantExpense, { reimbursements, reversals }), "50.00");

  const thirdPartyExpense = { ...participantExpense, id: "expense-third-party", payer_type: "third_party" };
  assert.equal(calculateExpenseBalance(thirdPartyExpense), "100.00");
});

test("company-paid expense has no reimbursement debt", () => {
  assert.equal(calculateExpenseBalance({
    id: "expense-company",
    payer_type: "organization",
    amount: "250.00",
  }), "0.00");
});

test("historical imports keep the exact payer label without assigning a participant", () => {
  const imported = {
    id: "expense-unresolved",
    payer_type: "unresolved",
    participant_payer_id: null,
    third_party_payer_id: null,
    source_payer_label: "Márlon",
    amount: "40.00",
    historical_reimbursed_amount: "0.00",
    is_historical: true,
    paid_on: "2026-07-23",
  };
  assert.equal(expensePayerKey(imported), "unresolved:Márlon");
  assert.equal(calculateExpenseBalance(imported), "40.00");
  assert.deepEqual(filterGeneralExpenses([imported], { payerKey: "unresolved:Márlon" }), [imported]);
  assert.match(pageSource, /Pagador histórico sem vínculo/);
  assert.match(pageSource, /source_payer_label/);
});

test("expense result counts each expense once and ignores reimbursement cash movements", () => {
  const expenses = [
    { ...participantExpense, amount: "100.00" },
    { id: "expense-company", payer_type: "organization", amount: "45.90", paid_on: "2026-11-02" },
  ];
  const related = {
    reimbursements: [{ id: "r-1", expense_id: participantExpense.id, amount: "30.00" }],
  };
  assert.deepEqual(calculateExpenseOverview(expenses, related), {
    count: 2,
    total: "145.90",
    pending: "70.00",
  });
});

test("reimbursement amount accepts partial/full payments and rejects zero or overpayment exactly", () => {
  assert.equal(validateReimbursementAmount("25.50", "25.50"), "25.50");
  assert.throws(() => validateReimbursementAmount("25.51", "25.50"), /excede o saldo pendente/);
  assert.throws(() => validateReimbursementAmount("0.00", "25.50"), /maior que zero/);
});

test("filters use responsible identity and inclusive payment period", () => {
  const expenses = [
    participantExpense,
    { id: "expense-company", payer_type: "organization", amount: "45.90", paid_on: "2026-11-02" },
    { id: "expense-third", payer_type: "third_party", third_party_payer_id: "third-1", amount: "10.00", paid_on: "2026-11-03" },
  ];
  assert.deepEqual(filterGeneralExpenses(expenses, {
    payerKey: "participant:participant-1",
    startDate: "2026-11-01",
    endDate: "2026-11-02",
  }).map((expense) => expense.id), ["expense-participant"]);
  assert.deepEqual(filterGeneralExpenses(expenses, { startDate: "2026-11-02" }).map((expense) => expense.id), ["expense-company", "expense-third"]);
});

test("expense draft requires a registered payer for participant and third party cases", () => {
  assert.deepEqual(validateGeneralExpenseDraft({
    payer_type: "organization",
    paid_on: "2026-11-04",
    amount: "12.5",
    description: "Material de escritório",
  }), {
    payer_type: "organization",
    paid_on: "2026-11-04",
    amount: "12.50",
    description: "Material de escritório",
  });
  assert.throws(() => validateGeneralExpenseDraft({
    payer_type: "participant",
    paid_on: "2026-11-04",
    amount: "12.50",
    description: "Material de escritório",
  }), /Selecione o participante/);
  assert.throws(() => validateGeneralExpenseDraft({
    payer_type: "third_party",
    third_party_payer_id: "third-1",
    paid_on: "2026-11-04",
    amount: "0.00",
    description: "Material de escritório",
  }), /maior que zero/);
});

test("invalid calendar dates are rejected and leap dates are accepted", () => {
  const validDraft = {
    payer_type: "organization",
    paid_on: "2026-02-28",
    amount: "1.00",
    description: "Despesa fictícia",
  };
  assert.equal(validateGeneralExpenseDraft({ ...validDraft, paid_on: "2024-02-29" }).paid_on, "2024-02-29");
  assert.throws(() => validateGeneralExpenseDraft({ ...validDraft, paid_on: "2026-02-29" }), /data válida/);
  assert.throws(() => validateGeneralExpenseDraft({ ...validDraft, paid_on: "2026-13-01" }), /data válida/);
});

test("an uncertain retry reuses its idempotency key until the payload changes or succeeds", () => {
  const cache = createIdempotencyKeyCache();
  const form = {};
  let nextKey = 0;
  const createKey = () => `request-${++nextKey}`;
  const payload = { amount: "25.00" };

  assert.equal(cache.getOrCreate(form, "reimburse_expense", payload, createKey), "request-1");
  assert.equal(cache.getOrCreate(form, "reimburse_expense", payload, createKey), "request-1");
  assert.equal(cache.getOrCreate(form, "reimburse_expense", { amount: "20.00" }, createKey), "request-2");
  cache.clear(form);
  assert.equal(cache.getOrCreate(form, "reimburse_expense", { amount: "20.00" }, createKey), "request-3");
});

test("currency display formats exact cents without converting the amount to Number", () => {
  assert.equal(formatFinanceCurrency("90071992547409.91"), "R$ 90.071.992.547.409,91");
});

test("Financeiro is wired to the administrator route without exposing spreadsheet import UI", () => {
  assert.match(appSource, /finance:\s*"financeiro"/);
  assert.match(appSource, /page === "finance" && !isCurrentUserAdmin\(\)/);
  assert.match(markup, /id="navFinanceButton"/);
  assert.match(markup, /id="financePage"/);
  assert.doesNotMatch(pageSource, /import_expenses/);
});
