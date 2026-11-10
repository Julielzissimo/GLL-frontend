import {
  cashflowExpenseReimbursementDirection,
  calculateCashflowMetrics,
  costForQuantityCents,
  formatBrl,
  moneyToDecimalString,
  parseMoneyToCents,
  parseQuantityToUnits,
  splitCentsByParticipantRules,
  validateInvoiceReceipt,
  validateReceiptLine,
} from "./finance-money.js";
import { createCashflowService, eligibleReceiptBids } from "./finance-service.js";

const PAYMENT_METHODS = Object.freeze([
  ["pix", "Pix"],
  ["transfer", "Transferência"],
  ["boleto", "Boleto"],
  ["cash", "Dinheiro"],
  ["credit_card", "Cartão de crédito"],
  ["debit_card", "Cartão de débito"],
  ["other", "Outro"],
]);

const TABS = Object.freeze([
  ["receipts", "Recebimentos"],
  ["expenses", "Despesas"],
  ["reimbursements", "Reembolsos"],
  ["participants", "Participantes"],
  ["history", "Histórico"],
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("pt-BR").format(date);
}

function emptyState(title, detail) {
  return `<div class="cashflow-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
}

function selectOptions(options, selected = "") {
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function bidLabel(bid) {
  const number = bid?.edital_number || bid?.edital || bid?.number || bid?.id || "Edital";
  const agency = bid?.buyer_agency || bid?.agency || "Órgão não informado";
  return { title: `Edital ${number}`, subtitle: agency };
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function amountAsInput(cents) {
  return moneyToDecimalString(cents).replace(".", ",");
}

function parseAmount(value, label = "Valor") {
  try {
    const cents = parseMoneyToCents(value);
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error();
    return cents;
  } catch {
    throw new Error(`${label}: informe um valor igual ou maior que zero, com até duas casas decimais.`);
  }
}

function parseQuantity(value, label = "Quantidade") {
  try {
    const units = parseQuantityToUnits(value);
    if (!Number.isSafeInteger(units) || units < 0) throw new Error();
    return units / 10000;
  } catch {
    throw new Error(`${label}: informe uma quantidade igual ou maior que zero, com até quatro casas decimais.`);
  }
}

function defaultCostCents(item, quantity) {
  return costForQuantityCents(item.unit_cost_price ?? moneyToDecimalString(item.unit_cost_cents || 0), quantity);
}

function saleAmountForQuantity(invoice, quantity) {
  const quantityUnits = BigInt(parseQuantityToUnits(quantity));
  const unitSaleCents = BigInt(Math.max(0, Number(invoice.unit_sale_cents || 0)));
  return Number((unitSaleCents * quantityUnits + 5000n) / 10000n);
}

function defaultReserveCents(amountCents, costCents, reservePercent) {
  const margin = Math.max(0, Number(amountCents) - Number(costCents));
  return Math.round(margin * Number(reservePercent || 0) / 100);
}

function paymentMethodLabel(value) {
  return PAYMENT_METHODS.find(([key]) => key === value)?.[1] || value || "—";
}

function partyName(data, partyId) {
  return data.parties.find((row) => String(row.id) === String(partyId))?.name || "Pessoa não identificada";
}

function bidName(bids, bidId) {
  const bid = bids.find((row) => String(row.id) === String(bidId));
  return bid ? bidLabel(bid).title : "Edital não disponível";
}

function buildExpenseRefunds(data) {
  const amounts = new Map();
  for (const refund of data.reimbursements) {
    if (refund.reversed_at) continue;
    const key = String(refund.expense_id);
    amounts.set(key, (amounts.get(key) || 0) + parseMoneyToCents(refund.amount));
  }
  return amounts;
}

export function reimbursementTableRows(data, filters = {}) {
  const expenses = (data.expenses || []).filter((expense) => !expense.reversed_at
    && ["receivable", "payable"].includes(cashflowExpenseReimbursementDirection(expense)));
  const expensesById = new Map(expenses.map((expense) => [String(expense.id), expense]));
  const inPeriod = (value) => (!filters.from || String(value || "").slice(0, 10) >= filters.from)
    && (!filters.to || String(value || "").slice(0, 10) <= filters.to);
  return {
    expenses: expenses.filter((expense) => inPeriod(expense.occurred_on)),
    payments: (data.reimbursements || []).filter((payment) => !payment.reversed_at
      && expensesById.has(String(payment.expense_id)) && inPeriod(payment.paid_on)),
  };
}

export async function submitCashflowOperation(runBusy, operation, message) {
  let completed = false;
  let result;
  let failure;
  await runBusy(async () => {
    try {
      result = await operation();
    } catch (error) {
      failure = error;
    } finally {
      completed = true;
    }
  }, message);
  if (failure) throw failure;
  if (!completed) throw new Error("Não foi possível confirmar o lançamento. Tente novamente.");
  return result;
}

export function savedCashflowRecordIsVisible(data, kind, result) {
  const collection = {
    receipt: "receipts",
    expense: "expenses",
    reimbursement: "reimbursements",
  }[kind];
  if (!collection) return true;
  if (!result?.id) return false;
  return (data?.[collection] || []).some((row) => String(row.id) === String(result.id));
}

export function createCashflowFeature(options = {}) {
  const {
    getClient = () => null,
    getBids = () => [],
    getUsers = () => [],
    getUserId = () => null,
    getOrganizationId = () => null,
    isAdmin = () => false,
    toast = () => undefined,
    runBusy = (operation) => operation(),
    onSaved = () => undefined,
  } = options;

  const page = document.getElementById("cashflowPage");
  const status = document.getElementById("cashflowStatus");
  const dashboard = document.getElementById("cashflowDashboard");
  const workspace = document.getElementById("cashflowWorkspace");
  const headerActions = document.getElementById("cashflowHeaderActions");
  const dialog = document.createElement("dialog");
  dialog.id = "cashflowDrawer";
  dialog.className = "cashflow-dialog";
  dialog.setAttribute("aria-labelledby", "cashflowDrawerTitle");
  document.body.append(dialog);

  const receiptDiscardDialog = document.createElement("dialog");
  receiptDiscardDialog.id = "cashflowReceiptDiscardDialog";
  receiptDiscardDialog.className = "quotation-item-discard-modal";
  receiptDiscardDialog.setAttribute("aria-labelledby", "cashflowReceiptDiscardTitle");
  receiptDiscardDialog.setAttribute("aria-describedby", "cashflowReceiptDiscardDescription");
  receiptDiscardDialog.innerHTML = `<div class="quotation-item-discard-content">
    <h2 id="cashflowReceiptDiscardTitle">Descartar alterações?</h2>
    <p id="cashflowReceiptDiscardDescription">Há alterações não salvas no recebimento. Se você sair agora, elas serão perdidas.</p>
    <div class="button-row end">
      <button class="quiet-action" type="button" data-cf-discard-continue autofocus>Continuar editando</button>
      <button class="danger-action" type="button" data-cf-discard-confirm>Descartar alterações</button>
    </div>
  </div>`;
  document.body.append(receiptDiscardDialog);

  const state = {
    status: "idle",
    error: "",
    activeTab: "receipts",
    filters: { from: "", to: "" },
    data: null,
    service: null,
    drawerKind: null,
    loadingPromise: null,
    saving: false,
    openingReceipt: false,
    receiptOpenRequest: 0,
    receiptDirty: false,
  };

  const accessibleBids = () => (Array.isArray(getBids()) ? getBids() : []);
  const activeParticipants = () => (state.data?.parties || []).filter((party) => party.active && party.party_type === "participant");
  const metrics = () => state.data
    ? calculateCashflowMetrics(state.data, state.filters)
    : null;

  function ensureClient() {
    const client = getClient();
    if (!client) throw new Error("Entre em uma organização conectada ao Supabase para consultar os lançamentos do Fluxo de Caixa.");
    return client;
  }

  function setStatus(message, tone = "info") {
    status.textContent = message;
    status.dataset.tone = tone;
    status.classList.remove("hidden");
  }

  function moneyInput(name, label, cents, attrs = "") {
    return `<label class="cashflow-field">${escapeHtml(label)}<input name="${escapeHtml(name)}" inputmode="decimal" autocomplete="off" value="${escapeHtml(amountAsInput(cents))}" ${attrs} /></label>`;
  }

  function commonConfirmation(text = "Confirmo que revisei o edital, a data e os valores deste lançamento.") {
    return `<label class="cashflow-confirm"><input type="checkbox" name="confirmation" required /><span>${escapeHtml(text)}</span></label>`;
  }

  function openDialog(title, subtitle, body, submitLabel, kind, wide = false) {
    if (!dialog.open && kind === "receipt") state.receiptDirty = false;
    state.drawerKind = kind;
    dialog.classList.toggle("cashflow-dialog-wide", wide);
    const eyebrow = kind === "expense" ? "" : '<span class="eyebrow">LANÇAMENTO FINANCEIRO</span>';
    dialog.innerHTML = `<form id="cashflowDrawerForm" class="cashflow-drawer-form" novalidate>
      <header class="cashflow-drawer-header"><div>${eyebrow}<h2 id="cashflowDrawerTitle">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="icon-button modal-close-button" type="button" data-cf-close aria-label="Fechar">×</button></header>
      <div class="cashflow-drawer-body">${body}<div class="cashflow-form-error" data-cf-error role="alert" aria-live="assertive"></div></div>
      <footer class="cashflow-drawer-footer"><button type="button" class="quiet-action" data-cf-close>Cancelar</button><button type="submit" class="primary-action" ${state.saving ? "disabled" : ""}>${escapeHtml(submitLabel)}</button></footer>
    </form>`;
    if (!dialog.open) dialog.showModal();
    const firstField = dialog.querySelector("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])");
    firstField?.focus();
  }

  function closeDialog() {
    if (receiptDiscardDialog.open) receiptDiscardDialog.close();
    if (dialog.open) dialog.close();
    state.drawerKind = null;
    state.receiptDirty = false;
    dialog.innerHTML = "";
  }

  function requestCloseDialog() {
    if (state.saving) return;
    if (state.drawerKind !== "receipt" || !state.receiptDirty) {
      closeDialog();
      return;
    }
    if (!receiptDiscardDialog.open) receiptDiscardDialog.showModal();
  }

  function trackReceiptChanges(event) {
    if (state.drawerKind === "receipt" && event.target.closest?.("#cashflowDrawerForm")) {
      state.receiptDirty = true;
    }
  }

  function renderHeaderActions() {
    headerActions.innerHTML = isAdmin()
      ? `<button class="quiet-action" type="button" data-cf-action="new-expense">Nova despesa</button><button class="primary-action" type="button" data-cf-action="new-receipt">Registrar recebimento</button>`
      : `<span class="cashflow-read-only-note">Consulta dos lançamentos financeiros</span>`;
  }

  function renderDashboard() {
    const values = metrics();
    const receivedLabel = "Recebido no período";
    dashboard.innerHTML = `<article class="cashflow-metric"><span>${receivedLabel}</span><strong>${formatBrl(values.receivedInPeriodCents)}</strong><small>${values.receiptCount} recebimento(s) confirmado(s)</small></article>
      <article class="cashflow-metric"><span>Reserva disponível para despesas</span><strong>${formatBrl(values.expenseReserveBalanceCents)}</strong><small>Reserva constituída menos valores já comprometidos</small></article>
      <article class="cashflow-metric"><span>Lucro disponível para retirada</span><strong>${formatBrl(values.profitAvailableCents)}</strong><small>Lucro reconhecido somente após crédito confirmado</small></article>
      <article class="cashflow-metric"><span>Reembolsos a receber</span><strong>${formatBrl(values.reimbursementReceivableCents)}</strong><small>Despesas da empresa ainda não reembolsadas</small></article>
      <article class="cashflow-metric"><span>Reembolsos a pagar</span><strong>${formatBrl(values.reimbursementPendingCents)}</strong><small>Valores devidos a quem antecipou despesas</small></article>`;
    dashboard.classList.remove("hidden");
  }

  function filterToolbar() {
    return `<div class="cashflow-filters"><label>Data inicial<input type="date" data-cf-filter="from" value="${escapeHtml(state.filters.from)}" /></label>
      <label>Data final<input type="date" data-cf-filter="to" value="${escapeHtml(state.filters.to)}" /></label>
      <button type="button" class="quiet-action" data-cf-action="clear-filters">Limpar filtros</button>
      <button type="button" class="quiet-action" data-cf-action="refresh">Atualizar</button></div>`;
  }

  function renderTabs() {
    return `<nav class="cashflow-tabs" role="tablist" aria-label="Seções do Fluxo de Caixa">${TABS.map(([id, label]) => `<button type="button" role="tab" aria-selected="${state.activeTab === id}" class="cashflow-tab ${state.activeTab === id ? "active" : ""}" data-cf-tab="${id}">${label}</button>`).join("")}</nav>`;
  }

  function filteredByDate(rows, dateKey) {
    return rows.filter((row) => (!state.filters.from || String(row[dateKey] || "").slice(0, 10) >= state.filters.from)
      && (!state.filters.to || String(row[dateKey] || "").slice(0, 10) <= state.filters.to));
  }

  function rowsForReceipt(receiptId) {
    return (state.data.receiptLines || []).filter((line) => String(line.receipt_id) === String(receiptId));
  }

  function receiptTable() {
    const data = state.data;
    const rows = filteredByDate(data.receipts.filter((row) => !row.reversed_at), "received_on");
    if (!rows.length) return emptyState("Nenhum recebimento encontrado", "Os recebimentos aparecem depois da confirmação de um crédito vinculado a um item vencido, com ou sem nota fiscal.");
    const body = rows.map((receipt) => {
      const lines = rowsForReceipt(receipt.id);
      const itemText = lines.map((line) => {
        const invoice = line.invoice_id == null ? null : data.allInvoices.find((row) => String(row.id) === String(line.invoice_id));
        const item = data.awardedItems.find((row) => String(row.quotation_item_id) === String(line.quotation_item_id));
        const source = invoice?.invoice_number ? `NF ${invoice.invoice_number}` : "Sem nota fiscal";
        return `<span class="cashflow-row-sub">${escapeHtml(source)} · Item ${escapeHtml(invoice?.item_number ?? item?.item_number ?? "—")} · ${escapeHtml(line.received_quantity)} un.</span>`;
      }).join("");
      return `<tr><td>${formatDate(receipt.received_on)}</td><td><strong>${escapeHtml(bidName(accessibleBids(), receipt.bid_id))}</strong><span class="cashflow-row-sub">${escapeHtml(receipt.payment_reference || paymentMethodLabel(receipt.payment_method))}</span></td>
        <td>${itemText || "—"}</td><td class="cashflow-number"><strong>${formatBrl(parseMoneyToCents(receipt.gross_amount))}</strong></td>
        <td class="cashflow-number">${formatBrl(parseMoneyToCents(receipt.cost_total))}</td><td class="cashflow-number">${formatBrl(parseMoneyToCents(receipt.loss_amount))}</td><td class="cashflow-number">${formatBrl(parseMoneyToCents(receipt.expense_reserve_amount))}</td>
        <td class="cashflow-number"><strong>${formatBrl(parseMoneyToCents(receipt.distributable_profit))}</strong></td><td><button class="text-action" type="button" data-cf-action="receipt-detail" data-id="${escapeHtml(receipt.id)}">Detalhes</button>${isAdmin() ? ` <button class="text-action cashflow-danger-action" type="button" data-cf-action="reverse-receipt" data-id="${escapeHtml(receipt.id)}">Estornar</button>` : ""}</td></tr>`;
    }).join("");
    return `<div class="cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th>Data do crédito</th><th>Edital</th><th>Notas e itens</th><th class="cashflow-number">Recebido</th><th class="cashflow-number">Custos</th><th class="cashflow-number">Prejuízo</th><th class="cashflow-number">Reserva</th><th class="cashflow-number">Lucro distribuído</th><th>Ações</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function expenseTable() {
    const rows = filteredByDate(state.data.expenses.filter((row) => !row.reversed_at), "occurred_on");
    if (!rows.length) return emptyState("Nenhuma despesa encontrada", "Registre despesas da empresa para acompanhar valores a receber ou antecipações de participantes para acompanhar valores a devolver.");
    const refunds = buildExpenseRefunds(state.data);
    return `<div class="cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Pago por</th><th class="cashflow-number">Valor</th><th>Tratamento</th><th>Situação</th><th></th></tr></thead><tbody>${rows.map((expense) => {
      const paidBy = expense.payer_type === "company" ? "Empresa" : partyName(state.data, expense.payer_party_id);
      const refunded = refunds.get(String(expense.id)) || 0;
      const direction = cashflowExpenseReimbursementDirection(expense);
      const remaining = direction === "none" ? 0 : Math.max(0, parseMoneyToCents(expense.amount) - refunded);
      const treatment = direction === "receivable" ? "Reembolso da empresa" : expense.profit_treatment === "included_in_item_cost" ? "Custo já considerado no item" : expense.profit_treatment === "outside_reserve" ? "Fora da reserva" : "Usou reserva de despesas";
      const status = remaining > 0 && direction === "receivable"
        ? `<span class="cashflow-badge warning">A receber ${formatBrl(remaining)}</span>`
        : remaining > 0 && direction === "payable"
          ? `<span class="cashflow-badge warning">Pendente</span><span class="cashflow-row-sub">A devolver ${formatBrl(remaining)}</span>`
          : direction === "receivable"
            ? `<span class="cashflow-badge success">Recebido</span>`
            : direction === "payable"
              ? `<span class="cashflow-badge success">Pago</span>`
              : `<span class="cashflow-badge success">Sem pendência</span>`;
      const reimbursementAction = direction === "receivable" ? "Registrar recebimento" : "Reembolsar";
      return `<tr><td>${formatDate(expense.occurred_on)}</td><td><strong>${escapeHtml(expense.description)}</strong>${expense.proof_storage_path ? `<span class="cashflow-row-sub">Comprovante disponível</span>` : ""}</td><td>${escapeHtml(expense.category)}</td><td>${escapeHtml(paidBy)}</td><td class="cashflow-number"><strong>${formatBrl(parseMoneyToCents(expense.amount))}</strong></td><td>${escapeHtml(treatment)}</td><td>${status}</td><td>${expense.proof_storage_path ? `<button type="button" class="text-action" data-cf-action="view-proof" data-path="${escapeHtml(expense.proof_storage_path)}">Comprovante</button>` : ""}${remaining > 0 && isAdmin() ? ` <button type="button" class="text-action" data-cf-action="reimburse" data-id="${escapeHtml(expense.id)}">${reimbursementAction}</button>` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function reimbursementTable() {
    const refunds = buildExpenseRefunds(state.data);
    const { expenses, payments } = reimbursementTableRows(state.data, state.filters);
    if (!expenses.length && !payments.length) return emptyState("Nenhum reembolso encontrado", "Despesas reembolsáveis e pagamentos registrados aparecem aqui conforme as datas selecionadas.");
    const expenseById = new Map(state.data.expenses.map((expense) => [String(expense.id), expense]));
    const expenseTable = expenses.length ? `<div class="cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th>Despesa de origem</th><th>Pagador</th><th class="cashflow-number">Valor original</th><th class="cashflow-number">Já recebido / devolvido</th><th class="cashflow-number">Saldo pendente</th><th>Situação / ação</th></tr></thead><tbody>${expenses.map((expense) => {
      const refunded = refunds.get(String(expense.id)) || 0;
      const amount = parseMoneyToCents(expense.amount);
      const remaining = Math.max(0, amount - refunded);
      const isReceivable = cashflowExpenseReimbursementDirection(expense) === "receivable";
      const payer = isReceivable ? "Empresa" : partyName(state.data, expense.payer_party_id);
      const action = isReceivable ? "Registrar recebimento" : "Registrar pagamento";
      const status = remaining > 0 ? "Pendente" : isReceivable ? "Recebido" : "Pago";
      return `<tr><td><strong>${escapeHtml(expense.description)}</strong><span class="cashflow-row-sub">${formatDate(expense.occurred_on)}</span></td><td>${escapeHtml(payer)}</td><td class="cashflow-number">${formatBrl(amount)}</td><td class="cashflow-number">${formatBrl(refunded)}</td><td class="cashflow-number"><strong>${formatBrl(remaining)}</strong></td><td><span class="cashflow-badge ${remaining > 0 ? "warning" : "success"}">${status}</span>${remaining > 0 && isAdmin() ? ` <button type="button" class="primary-action small-action" data-cf-action="reimburse" data-id="${escapeHtml(expense.id)}">${action}</button>` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>` : "";
    const paymentTable = payments.length ? `<h3 class="cashflow-section-title">Lançamentos de reembolso</h3><div class="cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th>Data</th><th>Despesa de origem</th><th>Tipo</th><th>Forma de pagamento</th><th class="cashflow-number">Valor</th></tr></thead><tbody>${payments.map((payment) => {
      const expense = expenseById.get(String(payment.expense_id));
      const type = cashflowExpenseReimbursementDirection(expense) === "receivable" ? "Recebido da empresa" : "Devolvido ao participante";
      return `<tr><td>${formatDate(payment.paid_on)}</td><td>${escapeHtml(expense.description)}</td><td>${type}</td><td>${escapeHtml(paymentMethodLabel(payment.payment_method))}</td><td class="cashflow-number"><strong>${formatBrl(parseMoneyToCents(payment.amount))}</strong></td></tr>`;
    }).join("")}</tbody></table></div>` : "";
    return `${expenseTable}${paymentTable}`;
  }

  function participantRows() {
    const activeReceipts = state.data.receipts.filter((row) => !row.reversed_at);
    const receiptById = new Map(activeReceipts.map((row) => [String(row.id), row]));
    const reserved = new Map();
    for (const allocation of state.data.allocations) {
      const receipt = receiptById.get(String(allocation.receipt_id));
      if (!receipt) continue;
      const key = `${receipt.bid_id}:${allocation.participant_id}`;
      reserved.set(key, (reserved.get(key) || 0) + parseMoneyToCents(allocation.amount));
    }
    const withdrawn = new Map();
    for (const withdrawal of state.data.withdrawals.filter((row) => !row.reversed_at)) {
      const key = `${withdrawal.bid_id}:${withdrawal.participant_id}`;
      withdrawn.set(key, (withdrawn.get(key) || 0) + parseMoneyToCents(withdrawal.amount));
    }
    const pairs = [];
    for (const bid of accessibleBids()) {
      for (const participant of activeParticipants()) {
        const key = `${bid.id}:${participant.id}`;
        const reservedCents = reserved.get(key) || 0;
        const withdrawnCents = withdrawn.get(key) || 0;
        if (reservedCents > 0 || withdrawnCents > 0) pairs.push({ bid, participant, reservedCents, withdrawnCents, availableCents: reservedCents - withdrawnCents });
      }
    }
    return pairs;
  }

  function participantTable() {
    const rows = participantRows();
    const participantList = activeParticipants();
    const partyTools = isAdmin() ? `<div class="cashflow-toolbar-actions"><button type="button" class="primary-action" data-cf-action="new-participant">Novo participante</button></div>` : "";
    const memberTable = participantList.length
      ? `<div class="cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th>Participante financeiro</th><th class="cashflow-number">Distribuição padrão</th><th>Edital</th><th class="cashflow-number">Reservado</th><th class="cashflow-number">Retirado</th><th class="cashflow-number">Disponível</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.participant.name)}</strong></td><td class="cashflow-number">${row.participant.equal_share ? "Divisão igualitária" : `${Number(row.participant.default_share_percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}</td><td>${escapeHtml(bidName(accessibleBids(), row.bid.id))}</td><td class="cashflow-number">${formatBrl(row.reservedCents)}</td><td class="cashflow-number">${formatBrl(row.withdrawnCents)}</td><td class="cashflow-number"><strong>${formatBrl(row.availableCents)}</strong></td><td>${isAdmin() && row.availableCents > 0 ? `<button type="button" class="text-action" data-cf-action="withdraw" data-bid="${escapeHtml(row.bid.id)}" data-party="${escapeHtml(row.participant.id)}">Registrar retirada</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
      : emptyState("Nenhuma reserva por edital", "Lucro só aparece depois do recebimento. Cadastre participantes financeiros para reconhecer reservas.");
    const partiesTable = participantList.length
      ? `<div class="cashflow-party-list"><h3>Participantes financeiros cadastrados</h3>${participantList.map((party) => `<div class="cashflow-party-row"><span><strong>${escapeHtml(party.name)}</strong><small>${party.equal_share ? "Divisão igualitária" : `${Number(party.default_share_percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% padrão`}</small></span>${isAdmin() ? `<button type="button" class="text-action" data-cf-action="edit-party" data-id="${escapeHtml(party.id)}">Editar</button>` : ""}</div>`).join("")}</div>`
      : emptyState("Cadastre os participantes financeiros", "As participações são configuráveis por organização. A distribuição de cada recebimento fica registrada por edital e não muda quando o padrão for atualizado.");
    return `<div class="cashflow-section-heading"><div><h2>Distribuição do lucro</h2><p>Reserva, retirada e saldo disponível são acompanhados por participante e edital.</p></div>${partyTools}</div>${memberTable}${partiesTable}`;
  }

  function historyTable() {
    const rows = state.data.auditEvents.filter((row) => {
      const date = String(row.created_at || "").slice(0, 10);
      return (!state.filters.from || date >= state.filters.from) && (!state.filters.to || date <= state.filters.to);
    });
    if (!rows.length) return emptyState("Nenhum evento no histórico", "Cada operação financeira e ajuste manual gera um registro de auditoria.");
    const users = getUsers() || [];
    return `<div class="cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th>Data e hora</th><th>Evento</th><th>Edital</th><th>Autor</th><th>Detalhe</th></tr></thead><tbody>${rows.map((event) => {
      const actor = users.find((user) => String(user.auth_user_id) === String(event.actor_id));
      const actorName = actor?.display_name || actor?.full_name || actor?.name || "Usuário do GLL";
      const details = event.details && typeof event.details === "object" ? event.details : {};
      const detail = details.description || details.reason || details.reference || (details.amount ? formatBrl(parseMoneyToCents(details.amount)) : "—");
      return `<tr><td>${escapeHtml(new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.created_at)))}</td><td><strong>${escapeHtml(event.event_type)}</strong></td><td>${event.bid_id ? escapeHtml(bidName(accessibleBids(), event.bid_id)) : "Geral da empresa"}</td><td>${escapeHtml(actorName)}</td><td>${escapeHtml(detail)}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function renderWorkspace() {
    let content = "";
    if (state.activeTab === "receipts") content = receiptTable();
    if (state.activeTab === "expenses") content = expenseTable();
    if (state.activeTab === "reimbursements") content = reimbursementTable();
    if (state.activeTab === "participants") content = participantTable();
    if (state.activeTab === "history") content = historyTable();
    workspace.innerHTML = `${filterToolbar()}${renderTabs()}<section class="cashflow-panel" role="tabpanel">${content}</section><p class="cashflow-footnote">Os lançamentos são imutáveis. Estornos autorizados e correções preservam a trilha de auditoria.</p>`;
  }

  function render() {
    if (!page || !state.data) return;
    status.classList.add("hidden");
    renderHeaderActions();
    renderDashboard();
    workspace.classList.remove("hidden");
    renderWorkspace();
  }

  async function showPage(force = false) {
    if (state.loadingPromise && !force) return state.loadingPromise;
    if (!isAdmin()) {
      state.data = null;
      state.service = null;
      setStatus("O Fluxo de Caixa contém dados financeiros da organização e está disponível somente para o perfil Administrador.", "danger");
      dashboard.classList.add("hidden");
      workspace.classList.add("hidden");
      return null;
    }
    if (state.data && !force) {
      render();
      return state.data;
    }
    state.status = "loading";
    setStatus("Carregando lançamentos do Fluxo de Caixa…", "info");
    dashboard.classList.add("hidden");
    workspace.classList.add("hidden");
    state.loadingPromise = (async () => {
      try {
        const client = ensureClient();
        state.service = createCashflowService(client);
        state.data = await state.service.load(accessibleBids());
        state.status = "ready";
        state.error = "";
        render();
        return state.data;
      } catch (error) {
        state.status = "error";
        state.error = error.message || "Não foi possível carregar os lançamentos.";
        setStatus(state.error, "danger");
        dashboard.classList.add("hidden");
        workspace.classList.add("hidden");
        return null;
      } finally {
        state.loadingPromise = null;
      }
    })();
    return state.loadingPromise;
  }

  function hide() {
    if (dialog.open) dialog.close();
  }

  function reset() {
    hide();
    state.data = null;
    state.service = null;
    state.status = "idle";
    state.error = "";
    state.receiptOpenRequest += 1;
    state.openingReceipt = false;
    state.activeTab = "receipts";
    state.filters = { from: "", to: "" };
    headerActions.innerHTML = "";
    dashboard.innerHTML = "";
    workspace.innerHTML = "";
    dashboard.classList.add("hidden");
    workspace.classList.add("hidden");
    setStatus("Abra esta página para carregar os lançamentos financeiros.", "info");
  }

  function receiptLineContext(item, invoice = null) {
    const line = invoice
      ? { ...item, unit_sale_cents: invoice.unit_sale_cents }
      : item;
    const availableQuantity = Math.max(0, Math.min(item.open_quantity, invoice?.open_quantity ?? item.open_quantity));
    const availableAmount = Math.max(0, Math.min(item.open_amount_cents, invoice?.open_amount_cents ?? item.open_amount_cents));
    return { line, availableQuantity, availableAmount, selectable: availableQuantity > 0 && availableAmount > 0 && line.unit_sale_cents > 0 };
  }

  function remainingReceiptLineBalance(form, card, item, invoice = null) {
    const otherLines = [...form.querySelectorAll("[data-cf-line-check]:checked")]
      .filter((checkbox) => {
        const otherCard = checkbox.closest("[data-cf-line-card]");
        return otherCard !== card && String(otherCard?.dataset.cfItemId) === String(item.id);
      });
    const usedQuantity = otherLines.reduce((sum, checkbox) => {
      const otherCard = checkbox.closest("[data-cf-line-card]");
      return sum + (parseFloat(otherCard.querySelector(`[data-cf-quantity="${checkbox.dataset.cfLineCheck}"]`).value || "0") || 0);
    }, 0);
    const usedAmount = otherLines.reduce((sum, checkbox) => {
      const otherCard = checkbox.closest("[data-cf-line-card]");
      try { return sum + parseAmount(otherCard.querySelector(`[data-cf-amount="${checkbox.dataset.cfLineCheck}"]`).value || "0"); } catch { return sum; }
    }, 0);
    const { line } = receiptLineContext(item, invoice);
    const availableQuantity = Math.max(0, Math.min(item.open_quantity - usedQuantity, invoice?.open_quantity ?? item.open_quantity));
    const availableAmount = Math.max(0, Math.min(item.open_amount_cents - usedAmount, invoice?.open_amount_cents ?? item.open_amount_cents));
    return { line, availableQuantity, availableAmount };
  }

  function makeReceiptLineCard(item, invoice = null) {
    const id = String(invoice ? `invoice_${invoice.id}` : `item_${item.id}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    const { line, availableQuantity, availableAmount, selectable } = receiptLineContext(item, invoice);
    const defaultQuantity = selectable ? Math.min(availableQuantity, 1) : 0;
    const defaultAmount = Math.min(availableAmount, saleAmountForQuantity(line, defaultQuantity));
    const cost = defaultCostCents(line, defaultQuantity);
    const reserve = defaultReserveCents(defaultAmount, cost, state.data.settings.default_expense_reserve_percent);
    const profit = Math.max(0, defaultAmount - cost - reserve);
    let shares = [];
    try { shares = splitCentsByParticipantRules(profit, activeParticipants()); } catch { /* An admin can set the distribution manually while defaults are adjusted. */ }
    const allocations = activeParticipants().map((party) => {
      const share = shares.find((row) => String(row.id) === String(party.id));
      return `<label class="cashflow-field cashflow-allocation-field">${escapeHtml(party.name)}<input type="text" inputmode="decimal" name="allocation_${id}_${escapeHtml(party.id)}" value="${escapeHtml(amountAsInput(share?.cents || 0))}" data-cf-allocation="${id}" data-cf-party="${escapeHtml(party.id)}" disabled /></label>`;
    }).join("");
    const source = invoice ? `NF ${escapeHtml(invoice.invoice_number)}` : "Sem nota fiscal";
    return `<article class="cashflow-invoice-card" data-cf-line-card="${id}" data-cf-item-id="${escapeHtml(item.id)}" data-cf-invoice-id="${escapeHtml(invoice?.id || "")}">
      <label class="cashflow-invoice-choice"><input type="checkbox" name="receipt_line_${id}" value="${escapeHtml(invoice?.id || item.id)}" data-cf-line-check="${id}" ${selectable ? "" : "disabled"} /><span class="cashflow-invoice-choice-copy"><strong>${source}</strong><small>${invoice ? "Recebimento relacionado a esta nota" : "Recebimento relacionado diretamente ao item"}</small>${!selectable ? `<small>Sem saldo disponível para este lançamento.</small>` : ""}</span></label>
      <div class="cashflow-line-details" data-cf-line-details="${id}" hidden>
        <div class="cashflow-invoice-fields"><label class="cashflow-field">Quantidade neste recebimento<input type="number" min="0" max="${escapeHtml(availableQuantity)}" step="0.0001" name="quantity_${id}" value="0" data-cf-quantity="${id}" disabled /><small data-cf-quantity-limit="${id}">Disponível: ${escapeHtml(availableQuantity)} ${escapeHtml(item.item_unit)}</small></label>
        <label class="cashflow-field">Valor recebido (R$)<input type="text" inputmode="decimal" name="amount_${id}" value="0,00" data-cf-amount="${id}" data-touched="false" disabled /><small data-cf-amount-limit="${id}">Saldo financeiro disponível: ${formatBrl(availableAmount)}.</small></label>
        <label class="cashflow-field">Custo<input type="text" inputmode="decimal" name="cost_${id}" value="${escapeHtml(amountAsInput(cost))}" data-cf-cost="${id}" readonly aria-readonly="true" disabled /></label>
        <label class="cashflow-field">Reserva de despesas (R$)<input type="text" inputmode="decimal" name="reserve_${id}" value="${escapeHtml(amountAsInput(reserve))}" data-cf-reserve="${id}" data-default-cents="${reserve}" data-touched="false" disabled /></label>
        <label class="cashflow-field">Lucro distribuível (R$)<input type="text" value="${escapeHtml(amountAsInput(profit))}" data-cf-profit="${id}" readonly aria-readonly="true" disabled /></label></div>
        <label class="cashflow-checkbox-field"><input type="checkbox" name="manual_${id}" data-cf-manual="${id}" disabled /><span>Distribuir o lucro deste item manualmente</span></label>
        ${allocations ? `<div class="cashflow-allocation-list" data-cf-allocation-list="${id}"><strong>Distribuição do lucro deste item</strong>${allocations}</div>` : `<p class="cashflow-inline-note">Cadastre participantes financeiros antes de distribuir o lucro.</p>`}
      </div>
    </article>`;
  }

  async function openReceiptDrawer(bidId = "") {
    if (state.openingReceipt) return;
    const requestId = state.receiptOpenRequest + 1;
    state.receiptOpenRequest = requestId;
    state.openingReceipt = true;
    try {
      const refreshedData = await showPage(true);
      if (requestId === state.receiptOpenRequest && refreshedData) receiptDrawer(bidId);
    } finally {
      if (requestId === state.receiptOpenRequest) state.openingReceipt = false;
    }
  }

  function receiptDrawer(bidId) {
    const winningItems = state.data.awardedItems || [];
    const bidsWithItems = eligibleReceiptBids(accessibleBids(), winningItems);
    const selectedBidId = bidId || "";
    const items = selectedBidId
      ? winningItems.filter((item) => String(item.bid_id) === String(selectedBidId))
      : [];
    const bidOptions = [["", "Selecione um edital"], ...bidsWithItems.map((bid) => {
      const label = bidLabel(bid);
      return [String(bid.id), `${label.title} · ${label.subtitle}`];
    })];
    const itemList = !selectedBidId
      ? emptyState("Selecione um edital", "Os itens marcados como vencidos aparecerão aqui, mesmo antes do lançamento das notas fiscais.")
      : items.length
        ? items.map((item) => {
          const itemInvoices = state.data.allInvoices.filter((invoice) => String(invoice.bid_id) === String(item.bid_id)
            && String(invoice.quotation_item_id) === String(item.quotation_item_id));
          const invoiceCards = itemInvoices.map((invoice) => makeReceiptLineCard(item, invoice)).join("");
          return `<section class="cashflow-awarded-item"><header><span><strong>Item ${escapeHtml(item.item_number)} · ${escapeHtml(item.item_description)}</strong><small>${escapeHtml(item.contract_quantity)} ${escapeHtml(item.item_unit)} adjudicadas</small></span><span class="cashflow-badge warning">Vencido</span></header><div class="cashflow-item-lines">${invoiceCards}${makeReceiptLineCard(item)}</div></section>`;
        }).join("")
        : emptyState("Nenhum item marcado como vencido", "O edital precisa ter ao menos um item marcado como vencido para registrar o recebimento.");
    const body = `<div class="cashflow-form-grid"><label class="cashflow-field cashflow-field-wide">Edital obrigatório<select name="bid_id" required>${selectOptions(bidOptions, selectedBidId)}</select></label>
      <label class="cashflow-field">Data do crédito<input name="received_on" type="date" value="${dateInputValue()}" required /></label>
      <label class="cashflow-field">Forma de recebimento<select name="payment_method" required>${selectOptions(PAYMENT_METHODS, "transfer")}</select></label>
      <label class="cashflow-field cashflow-field-wide">Referência bancária ou do pagamento<input name="payment_reference" maxlength="120" placeholder="Opcional · ajuda a evitar duplicidade" /></label>
      <label class="cashflow-field cashflow-field-wide">Observações<textarea name="notes" rows="2" maxlength="1000"></textarea></label></div>
      <section class="cashflow-drawer-section"><div><h3>Itens marcados como vencidos</h3><p>Para cada item, marque uma ou mais opções de recebimento e informe as quantidades correspondentes.</p></div></section>
      <div class="cashflow-invoice-list">${itemList}</div>
      <div class="cashflow-distribution-panel" data-cf-distribution-panel hidden>
        <div class="cashflow-calculation" data-cf-receipt-total>Selecione um edital e marque os itens que fazem parte deste recebimento.</div>
      </div>`;
    openDialog("Registrar recebimento", "Vincule o crédito a um edital e aos itens marcados como vencidos.", body, "Confirmar recebimento", "receipt", true);
    updateReceiptForm();
  }

  function receiptFormLines() {
    const form = dialog.querySelector("form");
    if (!form) return [];
    const lines = [...form.querySelectorAll("[data-cf-line-check]:checked")].map((checkbox) => {
      const id = checkbox.dataset.cfLineCheck;
      const card = checkbox.closest("[data-cf-line-card]");
      const item = state.data.awardedItems.find((row) => String(row.id) === String(card?.dataset.cfItemId));
      const invoiceId = card?.dataset.cfInvoiceId || "";
      const invoice = invoiceId ? state.data.allInvoices.find((row) => String(row.id) === String(invoiceId)) : null;
      if (!item || (invoiceId && !invoice)) return null;
      const openQuantity = Math.min(item.open_quantity, invoice?.open_quantity ?? item.open_quantity);
      const openAmountCents = Math.min(item.open_amount_cents, invoice?.open_amount_cents ?? item.open_amount_cents);
      const quantityInputValue = parseQuantity(form.querySelector(`[data-cf-quantity="${id}"]`).value, "Quantidade relacionada");
      const amountInputCents = parseAmount(form.querySelector(`[data-cf-amount="${id}"]`).value, "Valor recebido");
      const invoiceReceipt = validateInvoiceReceipt({
        quantity: quantityInputValue,
        openQuantity,
        amountCents: amountInputCents,
        openAmountCents,
      });
      const costCents = parseAmount(form.querySelector(`[data-cf-cost="${id}"]`).value, "Custo");
      const reserveCents = parseAmount(form.querySelector(`[data-cf-reserve="${id}"]`).value, "Reserva de despesas");
      const line = validateReceiptLine({ amountCents: invoiceReceipt.amountCents, costCents, reserveCents });
      return { id, item, invoice, quantity: invoiceReceipt.quantity, amountCents: invoiceReceipt.amountCents, costCents, reserveCents, profitCents: line.profitCents, lossCents: line.lossCents };
    }).filter(Boolean);
    const totalsByItem = new Map();
    for (const line of lines) {
      const total = totalsByItem.get(String(line.item.id)) || { quantity: 0, amountCents: 0, item: line.item };
      total.quantity += line.quantity;
      total.amountCents += line.amountCents;
      totalsByItem.set(String(line.item.id), total);
    }
    for (const total of totalsByItem.values()) {
      if (total.quantity > total.item.open_quantity + 0.0000001) throw new Error(`A quantidade total selecionada supera o saldo do item ${total.item.item_number}.`);
      if (total.amountCents > total.item.open_amount_cents) throw new Error(`O valor total selecionado supera o saldo financeiro do item ${total.item.item_number}.`);
    }
    return lines;
  }

  function updateReceiptForm() {
    const form = dialog.querySelector("form");
    if (!form || state.drawerKind !== "receipt") return;
    const reservePercent = Number(state.data.settings.default_expense_reserve_percent || 0);
    const distributionPanel = form.querySelector("[data-cf-distribution-panel]");
    if (distributionPanel) distributionPanel.hidden = !form.querySelector("[data-cf-line-check]:checked");
    for (const card of form.querySelectorAll("[data-cf-line-card]")) {
      const id = card.dataset.cfLineCard;
      const checkbox = card.querySelector(`[data-cf-line-check="${id}"]`);
      const checked = Boolean(checkbox?.checked);
      const details = card.querySelector(`[data-cf-line-details="${id}"]`);
      if (details) details.hidden = !checked;
      card.classList.toggle("is-selected", checked);
      const manual = card.querySelector(`[data-cf-manual="${id}"]`);
      if (manual) manual.disabled = !checked;
      for (const input of card.querySelectorAll("input, select")) {
        if (input.type !== "checkbox") input.disabled = !checked || (input.dataset.cfAllocation && !manual?.checked);
      }
      if (!checked) continue;
      const item = state.data.awardedItems.find((row) => String(row.id) === String(card.dataset.cfItemId));
      const invoiceId = card.dataset.cfInvoiceId || "";
      const invoice = invoiceId ? state.data.allInvoices.find((row) => String(row.id) === String(invoiceId)) : null;
      if (!item) continue;
      const { line, availableQuantity, availableAmount } = remainingReceiptLineBalance(form, card, item, invoice);
      const quantityInput = card.querySelector(`[data-cf-quantity="${id}"]`);
      quantityInput.max = String(availableQuantity);
      card.querySelector(`[data-cf-quantity-limit="${id}"]`).textContent = `Disponível: ${availableQuantity} ${item.item_unit}`;
      card.querySelector(`[data-cf-amount-limit="${id}"]`).textContent = `Saldo financeiro disponível: ${formatBrl(availableAmount)}.`;
      const quantity = parseFloat(quantityInput.value || "0") || 0;
      const amountInput = card.querySelector(`[data-cf-amount="${id}"]`);
      const defaultAmountCents = Math.min(availableAmount, saleAmountForQuantity(line, quantity));
      let amountCents = defaultAmountCents;
      if (amountInput.dataset.touched !== "true") {
        amountInput.value = amountAsInput(defaultAmountCents);
        amountInput.dataset.touched = "false";
      } else {
        try { amountCents = parseAmount(amountInput.value, "Valor recebido"); } catch { amountCents = 0; }
      }
      const costInput = card.querySelector(`[data-cf-cost="${id}"]`);
      const reserveInput = card.querySelector(`[data-cf-reserve="${id}"]`);
      const nextDefaultCost = defaultCostCents(line, quantity);
      const costCents = nextDefaultCost;
      costInput.value = amountAsInput(nextDefaultCost);
      const nextDefaultReserve = defaultReserveCents(amountCents, costCents, reservePercent);
      const reserveCents = reserveInput.dataset.touched !== "true"
        ? nextDefaultReserve
        : (() => { try { return parseAmount(reserveInput.value); } catch { return 0; } })();
      if (reserveInput.dataset.touched !== "true") reserveInput.value = amountAsInput(nextDefaultReserve);
      const profitCents = Math.max(0, amountCents - costCents - reserveCents);
      card.querySelector(`[data-cf-profit="${id}"]`).value = amountAsInput(profitCents);
      const allocationFields = [...card.querySelectorAll(`[data-cf-allocation="${id}"]`)];
      if (allocationFields.every((field) => field.dataset.touched !== "true")) {
        let split = [];
        try { split = splitCentsByParticipantRules(profitCents, activeParticipants()); } catch { /* Manual distribution remains available. */ }
        for (const field of allocationFields) {
          const amount = split.find((share) => String(share.id) === String(field.dataset.cfParty))?.cents || 0;
          field.value = amountAsInput(amount);
        }
      }
      for (const field of allocationFields) field.disabled = !checked || !manual?.checked;
    }
    const totals = form.querySelector("[data-cf-receipt-total]");
    try {
      const lines = receiptFormLines();
      const amount = lines.reduce((sum, line) => sum + line.amountCents, 0);
      const costs = lines.reduce((sum, line) => sum + line.costCents, 0);
      const reserve = lines.reduce((sum, line) => sum + line.reserveCents, 0);
      const profit = lines.reduce((sum, line) => sum + line.profitCents, 0);
      const loss = lines.reduce((sum, line) => sum + line.lossCents, 0);
      totals.innerHTML = `<div><span>Recebido bruto</span><strong>${formatBrl(amount)}</strong></div><div><span>Custos dos itens</span><strong>${formatBrl(costs)}</strong></div><div><span>Reserva para despesas</span><strong>${formatBrl(reserve)}</strong></div><div class="cashflow-total-final"><span>Lucro distribuível</span><strong>${formatBrl(profit)}</strong></div>`;
      if (loss > 0) totals.innerHTML += `<div><span>Prejuízo dos itens</span><strong>${formatBrl(loss)}</strong></div>`;
      if (lines.some((line) => form.querySelector(`[data-cf-manual="${line.id}"]`)?.checked)) {
        let allocationTotal = 0;
        for (const line of lines) {
          if (!form.querySelector(`[data-cf-manual="${line.id}"]`)?.checked) continue;
          for (const party of activeParticipants()) {
            const field = form.querySelector(`[data-cf-allocation="${line.id}"][data-cf-party="${party.id}"]`);
            if (field) allocationTotal += parseAmount(field.value, "Distribuição do participante");
          }
        }
        const manualProfit = lines.filter((line) => form.querySelector(`[data-cf-manual="${line.id}"]`)?.checked)
          .reduce((sum, line) => sum + line.profitCents, 0);
        totals.innerHTML += `<p>${allocationTotal === manualProfit ? "A distribuição manual concilia com o lucro dos itens marcados." : `Distribuição manual informada ${formatBrl(allocationTotal)} · diferença ${formatBrl(manualProfit - allocationTotal)}`}</p>`;
      }
      if (!lines.length) totals.innerHTML += "<p>Marque ao menos uma opção de recebimento dos itens vencidos.</p>";
    } catch (error) {
      totals.textContent = error.message;
    }
  }

  function expenseDrawer() {
    const options = [["company", "Empresa"], ["participant", "Participante financeiro"]];
    const payerOptions = activeParticipants().map((party) => [String(party.id), party.name]);
    const body = `<div class="cashflow-form-grid"><label class="cashflow-field cashflow-field-wide">Descrição<input name="description" maxlength="180" required /></label>
      <label class="cashflow-field">Categoria<input name="category" maxlength="80" required placeholder="Ex.: tributos, logística, material" /></label>
      <label class="cashflow-field">Valor (R$)<input name="amount" type="text" inputmode="decimal" required /></label>
      <label class="cashflow-field">Data da despesa<input name="occurred_on" type="date" value="${dateInputValue()}" required /></label>
      <label class="cashflow-field">Forma de pagamento<select name="payment_method" required>${selectOptions(PAYMENT_METHODS, "pix")}</select></label>
      <label class="cashflow-field">Quem pagou<select name="payer_type" required>${selectOptions(options, "company")}</select></label>
      <label class="cashflow-field cashflow-payer-field hidden">Pagador cadastrado<select name="payer_party_id">${selectOptions([["", "Selecione quem antecipou"], ...payerOptions])}</select></label>
      <label class="cashflow-field cashflow-field-wide">Observações<textarea name="notes" rows="2" maxlength="1000"></textarea></label>
      <label class="cashflow-field cashflow-field-wide">Comprovante opcional<input type="file" name="proof" accept="application/pdf,image/jpeg,image/png,image/webp" /><small>PDF, JPEG, PNG ou WebP · até 10 MB.</small></label></div>
      <p class="cashflow-inline-note">Despesas pagas pela empresa ficam fora do caixa e da reserva até o recebimento do reembolso. Despesas antecipadas por participantes ficam pendentes até o pagamento.</p>`;
    openDialog("Nova despesa", "Registre uma despesa da organização.", body, "Salvar despesa", "expense");
    const payerField = dialog.querySelector(".cashflow-payer-field");
    dialog.querySelector('[name="payer_type"]')?.addEventListener("change", (event) => {
      const isCompany = event.target.value === "company";
      payerField.classList.toggle("hidden", isCompany);
      payerField.querySelector("select").required = !isCompany;
    });
  }

  function reimbursementDrawer(expenseId) {
    const expense = state.data.expenses.find((row) => String(row.id) === String(expenseId));
    if (!expense) return toast("A despesa não está disponível para este perfil.", "error");
    const direction = cashflowExpenseReimbursementDirection(expense);
    if (!["receivable", "payable"].includes(direction)) return toast("Esta despesa não possui saldo de reembolso pendente.", "error");
    const isReceivable = direction === "receivable";
    const already = buildExpenseRefunds(state.data).get(String(expense.id)) || 0;
    const due = parseMoneyToCents(expense.amount) - already;
    const body = `<div class="cashflow-callout"><strong>${isReceivable ? "Empresa" : escapeHtml(partyName(state.data, expense.payer_party_id))}</strong><span>${escapeHtml(expense.description)} · pendente ${formatBrl(due)}</span></div>
      <div class="cashflow-form-grid"><label class="cashflow-field">${isReceivable ? "Valor a receber (R$)" : "Valor a devolver (R$)"}<input name="amount" type="text" inputmode="decimal" value="${escapeHtml(amountAsInput(due))}" required /></label>
      <label class="cashflow-field">${isReceivable ? "Data do recebimento" : "Data do pagamento"}<input name="paid_on" type="date" value="${dateInputValue()}" required /></label>
      <label class="cashflow-field">Forma de pagamento<select name="payment_method" required>${selectOptions(PAYMENT_METHODS, "pix")}</select></label>
      ${isReceivable ? "" : `<label class="cashflow-field">Origem dos recursos<select name="funding_source" required><option value="expense_reserve">Reserva de despesas</option><option value="operating_cash">Caixa da empresa</option><option value="other">Outra origem</option></select></label>`}
      <label class="cashflow-field cashflow-field-wide">Observações<textarea name="notes" rows="2" maxlength="500"></textarea></label></div>
      ${isReceivable ? commonConfirmation("Confirmo que o reembolso foi recebido pela empresa.") : ""}`;
    openDialog(
      isReceivable ? "Registrar reembolso recebido" : "Registrar pagamento de reembolso",
      isReceivable ? "O recebimento reduz o saldo pendente e aumenta o caixa da empresa." : "O pagamento reduz o saldo devido e o caixa da empresa.",
      body,
      isReceivable ? "Confirmar recebimento" : "Confirmar pagamento",
      "reimbursement",
    );
    dialog.querySelector("form").dataset.expenseId = String(expense.id);
  }

  function withdrawalDrawer(bidId, participantId) {
    const pair = participantRows().find((row) => String(row.bid.id) === String(bidId) && String(row.participant.id) === String(participantId));
    if (!pair) return toast("Não há lucro disponível para retirada neste edital.", "error");
    const body = `<div class="cashflow-callout"><strong>${escapeHtml(pair.participant.name)}</strong><span>${escapeHtml(bidName(accessibleBids(), bidId))} · disponível ${formatBrl(pair.availableCents)}</span></div>
      <div class="cashflow-form-grid"><label class="cashflow-field">Valor da retirada (R$)<input name="amount" type="text" inputmode="decimal" value="${escapeHtml(amountAsInput(pair.availableCents))}" required /></label>
      <label class="cashflow-field">Data da retirada<input name="withdrawn_on" type="date" value="${dateInputValue()}" required /></label>
      <label class="cashflow-field">Forma de pagamento<select name="payment_method" required>${selectOptions(PAYMENT_METHODS, "pix")}</select></label>
      <label class="cashflow-field cashflow-field-wide">Observações<textarea name="notes" rows="2" maxlength="500"></textarea></label></div>
      <p class="cashflow-inline-note">A retirada é debitada do lucro deste edital e reduz o caixa. Ela não altera despesas nem reembolsos.</p>
      ${commonConfirmation("Confirmo que a retirada foi efetivada e está vinculada ao edital exibido.")}`;
    openDialog("Registrar retirada", "Retire somente o saldo de lucro disponível deste edital.", body, "Confirmar retirada", "withdrawal");
    dialog.querySelector("form").dataset.bidId = String(bidId);
    dialog.querySelector("form").dataset.participantId = String(participantId);
  }

  function partyDrawer(party = null) {
    if (party && party.party_type !== "participant") return;
    const body = `<div class="cashflow-form-grid"><label class="cashflow-field cashflow-field-wide">Nome do participante<input name="name" maxlength="160" value="${escapeHtml(party?.name || "")}" required /></label>
      <label class="cashflow-field">Percentual padrão de lucro<input name="share_percent" type="number" min="0" max="100" step="0.01" value="${escapeHtml(party?.default_share_percent ?? "0.00")}" ${party?.equal_share ? "disabled" : ""} /><small>Ignorado na divisão igualitária.</small></label>
      <label class="cashflow-checkbox-field"><input type="checkbox" name="equal_share" ${party?.equal_share ? "checked" : ""} /><span>Dividir igualmente o lucro restante entre os participantes marcados</span></label>
      <label class="cashflow-checkbox-field"><input type="checkbox" name="active" ${party?.active === false ? "" : "checked"} /><span>Cadastro ativo</span></label></div>
      <p class="cashflow-inline-note">Participantes marcados dividem igualmente o lucro restante após os percentuais fixos. O ajuste manual é feito em cada item do recebimento.</p>`;
    openDialog(party ? "Editar participante" : "Novo participante", "Cadastre quem receberá distribuições de lucro.", body, "Salvar cadastro", "party");
    dialog.querySelector("form").dataset.partyId = party?.id || "";
  }

  function receiptDetail(receiptId) {
    const receipt = state.data.receipts.find((row) => String(row.id) === String(receiptId));
    if (!receipt) return;
    const lines = rowsForReceipt(receipt.id);
    const allocationRows = state.data.allocations.filter((row) => String(row.receipt_id) === String(receipt.id));
    const lineHtml = lines.map((line) => {
      const invoice = line.invoice_id == null ? null : state.data.allInvoices.find((row) => String(row.id) === String(line.invoice_id));
      const item = state.data.awardedItems.find((row) => String(row.quotation_item_id) === String(line.quotation_item_id));
      const allocations = allocationRows.filter((row) => String(row.receipt_line_id) === String(line.id));
      const source = invoice?.invoice_number ? `NF ${invoice.invoice_number}` : "Sem nota fiscal";
      return `<div class="cashflow-detail-row"><strong>${escapeHtml(source)} · Item ${escapeHtml(invoice?.item_number ?? item?.item_number ?? "—")}</strong><span>${escapeHtml(line.received_quantity)} un. · Recebido ${formatBrl(parseMoneyToCents(line.received_amount))} · Custo ${formatBrl(parseMoneyToCents(line.cost_amount))} · Reserva ${formatBrl(parseMoneyToCents(line.reserve_amount))}</span><span>Lucro desta linha ${formatBrl(parseMoneyToCents(line.profit_amount))} · ${line.distribution_mode === "manual" ? "Distribuição manual" : "Distribuição padrão"}</span>${allocations.map((row) => `<span>${escapeHtml(partyName(state.data, row.participant_id))}: ${formatBrl(parseMoneyToCents(row.amount))}</span>`).join("")}${line.cost_justification ? `<small>Justificativa do custo: ${escapeHtml(line.cost_justification)}</small>` : ""}${line.reserve_justification ? `<small>Justificativa da reserva: ${escapeHtml(line.reserve_justification)}</small>` : ""}</div>`;
    }).join("");
    const body = `<div class="cashflow-callout"><strong>${escapeHtml(bidName(accessibleBids(), receipt.bid_id))}</strong><span>${formatDate(receipt.received_on)} · ${escapeHtml(paymentMethodLabel(receipt.payment_method))}${receipt.payment_reference ? ` · ${escapeHtml(receipt.payment_reference)}` : ""}</span></div>${lineHtml}<div class="cashflow-calculation"><div><span>Recebido bruto</span><strong>${formatBrl(parseMoneyToCents(receipt.gross_amount))}</strong></div><div><span>Custos</span><strong>${formatBrl(parseMoneyToCents(receipt.cost_total))}</strong></div><div><span>Prejuízo</span><strong>${formatBrl(parseMoneyToCents(receipt.loss_amount))}</strong></div><div><span>Reserva</span><strong>${formatBrl(parseMoneyToCents(receipt.expense_reserve_amount))}</strong></div><div class="cashflow-total-final"><span>Lucro distribuível</span><strong>${formatBrl(parseMoneyToCents(receipt.distributable_profit))}</strong></div></div>${receipt.notes ? `<p>${escapeHtml(receipt.notes)}</p>` : ""}`;
    openDialog(receipt.reversed_at ? "Recebimento estornado" : "Detalhes do recebimento", `Lançamento ${String(receipt.id).slice(0, 8)} · ${formatDate(receipt.received_on)}`, body, "Fechar", "detail");
    dialog.querySelector("[type=submit]").hidden = true;
  }

  function reverseReceiptDrawer(receiptId) {
    const receipt = state.data.receipts.find((row) => String(row.id) === String(receiptId));
    if (!receipt || receipt.reversed_at) return;
    const body = `<div class="cashflow-callout"><strong>${escapeHtml(bidName(accessibleBids(), receipt.bid_id))}</strong><span>${formatBrl(parseMoneyToCents(receipt.gross_amount))} · ${formatDate(receipt.received_on)}</span></div>
      <p>O estorno reduz o saldo de caixa, as reservas e o lucro reconhecido. O banco bloqueia o estorno quando já houver retiradas, despesas comprometidas ou saldo insuficiente.</p>
      <label class="cashflow-field">Motivo do estorno<textarea name="reason" rows="3" maxlength="500" required></textarea></label>
      ${commonConfirmation("Confirmo que este recebimento foi registrado por engano ou precisa ser integralmente estornado.")}`;
    openDialog("Estornar recebimento", "O evento original será preservado e receberá o motivo do estorno.", body, "Confirmar estorno", "reverse-receipt");
    dialog.querySelector("form").dataset.receiptId = String(receipt.id);
  }

  async function viewProof(path) {
    if (!path) return;
    const popup = window.open("about:blank", "_blank");
    try {
      const url = await state.service.signedProofUrl(path);
      if (popup) popup.location.href = url;
      else toast("O navegador bloqueou a nova guia. Tente novamente permitindo pop-ups para o GLL.", "warning");
    } catch (error) {
      popup?.close();
      toast(error.message, "error");
    }
  }

  async function runSubmission(form) {
    if (!isAdmin()) throw new Error("Somente Administradores podem registrar ou alterar lançamentos financeiros.");
    const formData = new FormData(form);
    const confirmation = formData.get("confirmation") === "on";
    const reimbursementNeedsConfirmation = state.drawerKind === "reimbursement"
      && cashflowExpenseReimbursementDirection(state.data?.expenses.find((row) => String(row.id) === String(form.dataset.expenseId))) === "receivable";
    const confirmationRequired = reimbursementNeedsConfirmation || ["withdrawal", "reverse-receipt"].includes(state.drawerKind);
    if (confirmationRequired && !confirmation) throw new Error("Confirme que revisou os dados antes de salvar.");

    if (state.drawerKind === "receipt") {
      const bidId = String(formData.get("bid_id") || "");
      if (!bidId) throw new Error("Selecione um edital.");
      const selected = receiptFormLines();
      if (!selected.length) throw new Error("Marque pelo menos um item vencido.");
      const distributionMode = selected.some((line) => form.querySelector(`[data-cf-manual="${line.id}"]`)?.checked) ? "manual" : "default";
      const lines = selected.map((line) => {
        const formId = line.id;
        let participantAllocations = [];
        const lineDistributionMode = form.querySelector(`[data-cf-manual="${formId}"]`)?.checked ? "manual" : "default";
        if (lineDistributionMode === "default" && line.profitCents > 0) splitCentsByParticipantRules(line.profitCents, activeParticipants());
        if (lineDistributionMode === "manual") {
          participantAllocations = activeParticipants().map((party) => ({
            participantId: party.id,
            amountCents: parseAmount(form.querySelector(`[data-cf-allocation="${formId}"][data-cf-party="${party.id}"]`)?.value || "0", "Distribuição do participante"),
          }));
          const total = participantAllocations.reduce((sum, row) => sum + row.amountCents, 0);
          if (total !== line.profitCents) throw new Error(`A distribuição manual do item ${line.item.item_number} precisa totalizar ${formatBrl(line.profitCents)}.`);
        }
        return {
          invoiceId: line.invoice?.id ?? null,
          quotationItemId: line.item.quotation_item_id,
          receivedQuantity: line.quantity,
          amountCents: line.amountCents,
          costCents: line.costCents,
          costJustification: "",
          reserveCents: line.reserveCents,
          reserveJustification: "",
          distributionMode: lineDistributionMode,
          participantAllocations,
        };
      });
      return state.service.recordReceipt({
        bidId,
        receivedOn: String(formData.get("received_on") || ""),
        paymentMethod: String(formData.get("payment_method") || ""),
        paymentReference: String(formData.get("payment_reference") || "").trim(),
        notes: String(formData.get("notes") || "").trim(),
        distributionMode,
        distributionJustification: "",
        idempotencyKey: String(formData.get("idempotency_key") || randomId()),
        lines,
      });
    }

    if (state.drawerKind === "expense") {
      const payerType = String(formData.get("payer_type") || "");
      if (payerType !== "company" && payerType !== "participant") throw new Error("Selecione a empresa ou um participante como pagador.");
      const partyId = payerType === "company" ? null : String(formData.get("payer_party_id") || "");
      if (payerType !== "company" && !partyId) throw new Error("Selecione quem antecipou a despesa.");
      const profitTreatment = payerType === "company" ? "outside_reserve" : "expense_reserve";
      const justification = "";
      const proof = formData.get("proof");
      if (proof?.size > 10 * 1024 * 1024) throw new Error("O comprovante deve ter no máximo 10 MB.");
      if (proof?.size && !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(proof.type)) throw new Error("Use PDF, JPEG, PNG ou WebP no comprovante.");
      let proofPath = "";
      try {
        if (proof?.size) proofPath = await state.service.uploadProof(getOrganizationId(), proof);
        const response = await state.service.recordExpense({
          idempotencyKey: String(formData.get("idempotency_key") || randomId()),
          description: String(formData.get("description") || "").trim(),
          category: String(formData.get("category") || "").trim(),
          amountCents: parseAmount(formData.get("amount"), "Valor da despesa"),
          occurredOn: String(formData.get("occurred_on") || ""),
          paymentMethod: String(formData.get("payment_method") || ""),
          payerType,
          payerPartyId: partyId,
          profitTreatment,
          justification,
          notes: String(formData.get("notes") || "").trim(),
          proofStoragePath: proofPath,
        });
        return response;
      } catch (error) {
        if (proofPath) await state.service.removeProof(proofPath).catch(() => undefined);
        throw error;
      }
    }

    if (state.drawerKind === "reimbursement") {
      const formId = String(form.dataset.expenseId || "");
      const expense = state.data.expenses.find((row) => String(row.id) === formId);
      const remaining = parseMoneyToCents(expense.amount) - (buildExpenseRefunds(state.data).get(formId) || 0);
      const amountCents = parseAmount(formData.get("amount"), "Valor do reembolso");
      if (amountCents <= 0 || amountCents > remaining) throw new Error(`O reembolso precisa ser maior que zero e não superar ${formatBrl(remaining)}.`);
      return state.service.recordReimbursement({
        expenseId: formId,
        amountCents,
        paidOn: String(formData.get("paid_on") || ""),
        paymentMethod: String(formData.get("payment_method") || ""),
        fundingSource: cashflowExpenseReimbursementDirection(expense) === "receivable"
          ? null
          : String(formData.get("funding_source") || ""),
        notes: String(formData.get("notes") || "").trim(),
        idempotencyKey: randomId(),
      });
    }

    if (state.drawerKind === "withdrawal") {
      const bidId = String(form.dataset.bidId || "");
      const participantId = String(form.dataset.participantId || "");
      const pair = participantRows().find((row) => String(row.bid.id) === bidId && String(row.participant.id) === participantId);
      const amountCents = parseAmount(formData.get("amount"), "Valor da retirada");
      if (!pair || amountCents <= 0 || amountCents > pair.availableCents) throw new Error(`A retirada não pode superar ${formatBrl(pair?.availableCents || 0)} disponíveis neste edital.`);
      return state.service.recordWithdrawal({
        bidId,
        participantId,
        amountCents,
        withdrawnOn: String(formData.get("withdrawn_on") || ""),
        paymentMethod: String(formData.get("payment_method") || ""),
        notes: String(formData.get("notes") || "").trim(),
        idempotencyKey: randomId(),
      });
    }

    if (state.drawerKind === "party") {
      const sharePercent = Number(form.elements.share_percent.value || 0);
      if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) throw new Error("O percentual padrão deve ficar entre 0% e 100%.");
      return state.service.saveParty({
        id: String(form.dataset.partyId || "") || null,
        name: String(formData.get("name") || "").trim(),
        sharePercent,
        equalShare: formData.get("equal_share") === "on",
        active: formData.get("active") === "on",
      });
    }

    if (state.drawerKind === "reverse-receipt") {
      const reason = String(formData.get("reason") || "").trim();
      if (reason.length < 5) throw new Error("Informe um motivo claro para o estorno.");
      return state.service.reverseReceipt(String(form.dataset.receiptId || ""), reason);
    }

    return null;
  }

  async function onSubmit(event) {
    if (event.target.id !== "cashflowDrawerForm") return;
    event.preventDefault();
    if (state.drawerKind === "detail") {
      closeDialog();
      return;
    }
    if (!event.target.reportValidity()) return;
    const error = dialog.querySelector("[data-cf-error]");
    error.textContent = "";
    state.saving = true;
    const submitButton = event.target.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Salvando…";
    try {
      const savedRecord = await submitCashflowOperation(runBusy, () => runSubmission(event.target), "Salvando lançamento financeiro…");
      const savedKind = state.drawerKind;
      if (savedKind === "receipt") {
        state.activeTab = "receipts";
        state.filters = { from: "", to: "" };
      } else if (savedKind === "expense" || savedKind === "reimbursement") {
        state.activeTab = savedKind === "expense" ? "expenses" : "reimbursements";
        state.filters = { from: "", to: "" };
      }
      const label = state.drawerKind === "receipt" ? "Recebimento registrado" : state.drawerKind === "expense" ? "Despesa registrada" : state.drawerKind === "reimbursement" ? "Reembolso registrado" : state.drawerKind === "withdrawal" ? "Retirada registrada" : state.drawerKind === "reverse-receipt" ? "Recebimento estornado" : state.drawerKind === "party" ? "Cadastro atualizado" : "Ajustes salvos";
      closeDialog();
      onSaved();
      const refreshedData = await showPage(true);
      const visible = savedCashflowRecordIsVisible(refreshedData, savedKind, savedRecord);
      toast(refreshedData && visible ? label : "O lançamento foi enviado, mas não apareceu na consulta. Use Atualizar e confira o Histórico antes de tentar salvar novamente.", refreshedData && visible ? "success" : "warning");
    } catch (errorValue) {
      error.textContent = errorValue.message || "Não foi possível salvar o lançamento.";
      submitButton.disabled = false;
      submitButton.textContent = state.drawerKind === "receipt" ? "Confirmar recebimento" : state.drawerKind === "expense" ? "Salvar despesa" : "Tentar novamente";
    } finally {
      state.saving = false;
    }
  }

  function onInput(event) {
    const target = event.target;
    if (target.matches("[data-cf-filter]")) {
      state.filters[target.dataset.cfFilter] = target.value;
      renderDashboard();
      renderWorkspace();
      return;
    }
    trackReceiptChanges(event);
    if (target.matches("[data-cf-amount], [data-cf-reserve], [data-cf-allocation]")) target.dataset.touched = "true";
    if (target.matches("[data-cf-quantity], [data-cf-amount], [data-cf-reserve], [data-cf-allocation]")) updateReceiptForm();
  }

  function onChange(event) {
    const target = event.target;
    if (target.matches("[data-cf-filter]")) {
      state.filters[target.dataset.cfFilter] = target.value;
      renderDashboard();
      renderWorkspace();
      return;
    }
    trackReceiptChanges(event);
    if (target.matches("[data-cf-line-check]")) {
      const id = target.dataset.cfLineCheck;
      const card = target.closest("[data-cf-line-card]");
      if (target.checked) {
        const item = state.data.awardedItems.find((row) => String(row.id) === String(card.dataset.cfItemId));
        const invoiceId = card.dataset.cfInvoiceId || "";
        const invoice = invoiceId ? state.data.allInvoices.find((row) => String(row.id) === String(invoiceId)) : null;
        const { line, availableQuantity, availableAmount } = remainingReceiptLineBalance(card.closest("form"), card, item, invoice);
        const quantity = Math.min(availableQuantity, 1);
        const amount = Math.min(availableAmount, saleAmountForQuantity(line, quantity));
        card.querySelector(`[data-cf-quantity="${id}"]`).value = String(quantity);
        const amountInput = card.querySelector(`[data-cf-amount="${id}"]`);
        amountInput.value = amountAsInput(amount);
        amountInput.dataset.touched = "false";
        card.querySelector(`[data-cf-reserve="${id}"]`).dataset.touched = "false";
        for (const field of card.querySelectorAll(`[data-cf-allocation="${id}"]`)) field.dataset.touched = "false";
      }
      updateReceiptForm();
      return;
    }
    if (target.matches("[data-cf-manual]")) {
      updateReceiptForm();
      return;
    }
    if (target.name === "equal_share" && state.drawerKind === "party") {
      dialog.querySelector('[name="share_percent"]').disabled = target.checked;
      return;
    }
    if (target.name === "bid_id" && state.drawerKind === "receipt") {
      receiptDrawer(target.value);
      return;
    }
    if (target.name === "payer_type" && state.drawerKind === "expense") {
      const payerField = dialog.querySelector(".cashflow-payer-field");
      const isCompany = target.value === "company";
      payerField.classList.toggle("hidden", isCompany);
      payerField.querySelector("select").required = !isCompany;
    }
  }

  function onClick(event) {
    const target = event.target.closest("[data-cf-action], [data-cf-tab], [data-cf-close]");
    if (!target) return;
    if (target.hasAttribute("data-cf-close")) return requestCloseDialog();
    if (target.dataset.cfTab) {
      state.activeTab = target.dataset.cfTab;
      renderWorkspace();
      return;
    }
    switch (target.dataset.cfAction) {
      case "new-receipt": return openReceiptDrawer();
      case "new-expense": return expenseDrawer();
      case "new-participant": return partyDrawer();
      case "edit-party": {
        const party = state.data.parties.find((row) => String(row.id) === String(target.dataset.id));
        if (party?.party_type === "participant") return partyDrawer(party);
        return undefined;
      }
      case "reimburse": return reimbursementDrawer(target.dataset.id);
      case "withdraw": return withdrawalDrawer(target.dataset.bid, target.dataset.party);
      case "receipt-detail": return receiptDetail(target.dataset.id);
      case "reverse-receipt": return reverseReceiptDrawer(target.dataset.id);
      case "view-proof": return viewProof(target.dataset.path);
      case "refresh": return showPage(true);
      case "clear-filters":
        state.filters = { from: "", to: "" };
        return render();
      default: return undefined;
    }
  }

  page?.addEventListener("click", onClick);
  page?.addEventListener("input", onInput);
  page?.addEventListener("change", onChange);
  dialog.addEventListener("input", onInput);
  dialog.addEventListener("change", onChange);
  dialog.addEventListener("submit", onSubmit);
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) requestCloseDialog();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestCloseDialog();
  });
  receiptDiscardDialog.addEventListener("click", (event) => {
    if (event.target === receiptDiscardDialog) {
      receiptDiscardDialog.close();
      return;
    }
    if (event.target.closest("[data-cf-discard-continue]")) {
      receiptDiscardDialog.close();
      return;
    }
    if (event.target.closest("[data-cf-discard-confirm]")) closeDialog();
  });
  receiptDiscardDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    receiptDiscardDialog.close();
  });

  return {
    showPage,
    refresh: () => showPage(true),
    hide,
    reset,
  };
}

window.GLLFinance = Object.freeze({ createCashflowFeature });
