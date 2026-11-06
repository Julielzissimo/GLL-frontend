const MONEY_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function normalizeDecimalInput(value) {
  let text = String(value ?? "").trim().replace(/[R$\s]/g, "");
  if (!text) return "";
  const negative = text.startsWith("-");
  text = text.replace(/^[+-]/, "");
  if (text.includes(",")) text = text.replaceAll(".", "").replace(",", ".");
  if (!/^\d+(?:\.\d*)?$/.test(text)) throw new Error("Informe um valor numérico válido.");
  return `${negative ? "-" : ""}${text}`;
}

function parseScaledDecimal(value, scale) {
  const normalized = normalizeDecimalInput(value);
  if (!normalized) return 0n;
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  if (fraction.length > scale) throw new Error(`Use no máximo ${scale} casas decimais.`);
  const units = BigInt(whole || "0") * (10n ** BigInt(scale))
    + BigInt((fraction + "0".repeat(scale)).slice(0, scale) || "0");
  return negative ? -units : units;
}

export function parseMoneyToCents(value) {
  return Number(parseScaledDecimal(value, 2));
}

export function parseQuantityToUnits(value) {
  return Number(parseScaledDecimal(value, 4));
}

export function costForQuantityCents(unitCostPrice, quantity) {
  const unitCostUnits = parseScaledDecimal(unitCostPrice, 4);
  const quantityUnits = parseScaledDecimal(quantity, 4);
  if (unitCostUnits < 0n || quantityUnits < 0n) throw new Error("Custo e quantidade devem ser não negativos.");
  return Number((unitCostUnits * quantityUnits + 500000n) / 1000000n);
}

export function quantityUnitsToNumber(units) {
  return Number(units || 0) / 10000;
}

export function moneyToDecimalString(cents) {
  const amount = BigInt(Math.trunc(Number(cents) || 0));
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function formatBrl(cents) {
  return MONEY_FORMATTER.format((Number(cents) || 0) / 100);
}

export function percentToBasisPoints(value) {
  return Number(parseScaledDecimal(value, 2));
}

export function splitCentsByPercent(totalCents, shares) {
  const total = BigInt(Math.trunc(Number(totalCents) || 0));
  if (total < 0n) throw new Error("O valor a distribuir não pode ser negativo.");
  if (!Array.isArray(shares) || shares.length === 0) {
    if (total === 0n) return [];
    throw new Error("Cadastre participantes financeiros antes de distribuir lucro.");
  }

  const normalized = shares.map((share) => ({
    ...share,
    basisPoints: BigInt(percentToBasisPoints(share.percent)),
    tieBreaker: String(share.id ?? ""),
  }));
  if (normalized.some((share) => share.basisPoints < 0n)) {
    throw new Error("Os percentuais não podem ser negativos.");
  }
  const totalBasisPoints = normalized.reduce((sum, share) => sum + share.basisPoints, 0n);
  if (total > 0n && totalBasisPoints !== 10000n) {
    throw new Error("Os percentuais dos participantes devem somar 100%.");
  }

  const rows = normalized.map((share) => {
    const weighted = total * share.basisPoints;
    return {
      ...share,
      cents: weighted / 10000n,
      remainder: weighted % 10000n,
    };
  });
  let unallocated = total - rows.reduce((sum, row) => sum + row.cents, 0n);
  const remainderOrder = rows.slice().sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.tieBreaker.localeCompare(b.tieBreaker);
  });
  for (const row of remainderOrder) {
    if (unallocated <= 0n) break;
    row.cents += 1n;
    unallocated -= 1n;
  }
  if (unallocated !== 0n) throw new Error("Não foi possível conciliar a distribuição em centavos.");
  const centsById = new Map(rows.map((row) => [row.id, Number(row.cents)]));
  return normalized.map((share) => ({
    id: share.id,
    percent: share.percent,
    cents: centsById.get(share.id) || 0,
  }));
}

export function validateReceiptLine({ amountCents, costCents, reserveCents }) {
  const amount = Number(amountCents);
  const cost = Number(costCents);
  const reserve = Number(reserveCents);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("O recebimento por nota deve ser maior que zero.");
  if (!Number.isSafeInteger(cost) || cost < 0) throw new Error("O custo deve ser zero ou maior.");
  if (!Number.isSafeInteger(reserve) || reserve < 0) throw new Error("A reserva deve ser zero ou maior.");
  if (reserve > Math.max(0, amount - cost)) throw new Error("A reserva não pode superar o valor recebido depois dos custos.");
  return {
    profitCents: Math.max(0, amount - cost - reserve),
    lossCents: Math.max(0, cost + reserve - amount),
  };
}

export function validateInvoiceReceipt({ quantity, openQuantity, amountCents, openAmountCents }) {
  const quantityUnits = parseScaledDecimal(quantity, 4);
  const openQuantityUnits = parseScaledDecimal(openQuantity, 4);
  const amount = Number(amountCents);
  const openAmount = Number(openAmountCents);
  if (quantityUnits <= 0n) throw new Error("Informe uma quantidade relacionada maior que zero.");
  if (quantityUnits > openQuantityUnits) throw new Error("A quantidade informada supera o saldo faturado.");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("O valor recebido deve ser maior que zero.");
  if (!Number.isSafeInteger(openAmount) || openAmount < 0 || amount > openAmount) {
    throw new Error("O valor informado supera o saldo financeiro da nota fiscal.");
  }
  return { quantity: Number(quantityUnits) / 10000, amountCents: amount };
}

function active(row) {
  return !row?.reversed_at;
}

function centsFromDatabase(value) {
  if (value === null || value === undefined || value === "") return 0;
  return Number(parseScaledDecimal(value, 2));
}

function dateInRange(value, from, to) {
  const date = String(value || "").slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

export function cashflowExpenseReimbursementDirection(expense) {
  const direction = expense?.reimbursement_direction;
  if (direction === "none" || direction === "receivable" || direction === "payable") return direction;
  return expense?.payer_type === "company" ? "none" : "payable";
}

export function calculateCashflowMetrics(data, filters = {}) {
  const receipts = (data.receipts || []).filter(active);
  const receiptIds = new Set(receipts.map((row) => String(row.id)));
  const lines = (data.receiptLines || []).filter((row) => receiptIds.has(String(row.receipt_id)));
  const allocations = (data.allocations || []).filter((row) => receiptIds.has(String(row.receipt_id)));
  const expenses = (data.expenses || []).filter(active);
  const reimbursements = (data.reimbursements || []).filter(active);
  const withdrawals = (data.withdrawals || []).filter(active);
  const expensesById = new Map(expenses.map((row) => [String(row.id), row]));

  const grossReceiptsCents = receipts.reduce((sum, row) => sum + centsFromDatabase(row.gross_amount), 0);
  const companyExpensesCents = expenses
    .filter((row) => row.payer_type === "company" && cashflowExpenseReimbursementDirection(row) !== "receivable")
    .reduce((sum, row) => sum + centsFromDatabase(row.amount), 0);
  const reimbursementsPaidCents = reimbursements
    .filter((row) => cashflowExpenseReimbursementDirection(expensesById.get(String(row.expense_id))) === "payable")
    .reduce((sum, row) => sum + centsFromDatabase(row.amount), 0);
  const reimbursementsReceivedCents = reimbursements
    .filter((row) => cashflowExpenseReimbursementDirection(expensesById.get(String(row.expense_id))) === "receivable")
    .reduce((sum, row) => sum + centsFromDatabase(row.amount), 0);
  const withdrawalsCents = withdrawals.reduce((sum, row) => sum + centsFromDatabase(row.amount), 0);
  const openingBalanceCents = centsFromDatabase(data.settings?.opening_cash_balance);
  const cashBalanceCents = openingBalanceCents + grossReceiptsCents
    + reimbursementsReceivedCents - companyExpensesCents - reimbursementsPaidCents - withdrawalsCents;

  const reservedForExpensesCents = lines.reduce((sum, row) => sum + centsFromDatabase(row.reserve_amount), 0);
  const chargedToExpenseReserveCents = expenses.reduce((sum, row) => sum + centsFromDatabase(row.reserve_charge_amount), 0);
  const expenseReserveBalanceCents = reservedForExpensesCents - chargedToExpenseReserveCents;

  const reimbursementsByExpense = new Map();
  for (const row of reimbursements) {
    const key = String(row.expense_id);
    reimbursementsByExpense.set(key, (reimbursementsByExpense.get(key) || 0) + centsFromDatabase(row.amount));
  }
  const reimbursementPendingCents = expenses
    .filter((row) => cashflowExpenseReimbursementDirection(row) === "payable")
    .reduce((sum, row) => sum + Math.max(0, centsFromDatabase(row.amount) - (reimbursementsByExpense.get(String(row.id)) || 0)), 0);
  const reimbursementReceivableCents = expenses
    .filter((row) => cashflowExpenseReimbursementDirection(row) === "receivable")
    .reduce((sum, row) => sum + Math.max(0, centsFromDatabase(row.amount) - (reimbursementsByExpense.get(String(row.id)) || 0)), 0);

  const reservedByParticipant = new Map();
  for (const row of allocations) {
    const key = String(row.participant_id);
    reservedByParticipant.set(key, (reservedByParticipant.get(key) || 0) + centsFromDatabase(row.amount));
  }
  const withdrawnByParticipantAndBid = new Map();
  for (const row of withdrawals) {
    const key = `${row.bid_id}:${row.participant_id}`;
    withdrawnByParticipantAndBid.set(key, (withdrawnByParticipantAndBid.get(key) || 0) + centsFromDatabase(row.amount));
  }
  const participantBalances = (data.parties || [])
    .filter((party) => party.party_type === "participant")
    .map((party) => {
      const reservedCents = reservedByParticipant.get(String(party.id)) || 0;
      const withdrawnCents = withdrawals
        .filter((row) => String(row.participant_id) === String(party.id))
        .reduce((sum, row) => sum + centsFromDatabase(row.amount), 0);
      return { participant: party, reservedCents, withdrawnCents, availableCents: reservedCents - withdrawnCents };
    });
  const profitAvailableCents = participantBalances.reduce((sum, row) => sum + row.availableCents, 0);

  const selectedReceipts = receipts.filter((row) =>
    dateInRange(row.received_on, filters.from, filters.to));
  const receivedInPeriodCents = selectedReceipts.reduce((sum, row) => sum + centsFromDatabase(row.gross_amount), 0);

  return {
    grossReceiptsCents,
    receivedInPeriodCents,
    cashBalanceCents,
    expenseReserveBalanceCents,
    profitAvailableCents,
    reimbursementPendingCents,
    reimbursementReceivableCents,
    participantBalances,
    receiptCount: selectedReceipts.length,
  };
}
