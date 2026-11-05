import {
  calculateCashflowMetrics,
  formatBrl,
  moneyToDecimalString,
  parseMoneyToCents,
  parseQuantityToUnits,
  splitCentsByPercent,
  validateInvoiceReceipt,
  validateReceiptLine,
} from "./finance-money.js";
import { createCashflowService } from "./finance-service.js";

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

function defaultCostCents(invoice, quantity) {
  const quantityUnits = BigInt(parseQuantityToUnits(quantity));
  const unitCostCents = BigInt(Math.max(0, Number(invoice.unit_cost_cents || 0)));
  return Number((unitCostCents * quantityUnits + 5000n) / 10000n);
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
    state.drawerKind = kind;
    dialog.classList.toggle("cashflow-dialog-wide", wide);
    dialog.innerHTML = `<form id="cashflowDrawerForm" class="cashflow-drawer-form" novalidate>
      <header class="cashflow-drawer-header"><div><span class="eyebrow">LANÇAMENTO FINANCEIRO</span><h2 id="cashflowDrawerTitle">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="icon-button modal-close-button" type="button" data-cf-close aria-label="Fechar">×</button></header>
      <div class="cashflow-drawer-body">${body}<div class="cashflow-form-error" data-cf-error role="alert" aria-live="assertive"></div></div>
      <footer class="cashflow-drawer-footer"><button type="button" class="quiet-action" data-cf-close>Cancelar</button><button type="submit" class="primary-action" ${state.saving ? "disabled" : ""}>${escapeHtml(submitLabel)}</button></footer>
    </form>`;
    if (!dialog.open) dialog.showModal();
    const firstField = dialog.querySelector("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])");
    firstField?.focus();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
    state.drawerKind = null;
    dialog.innerHTML = "";
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
      <article class="cashflow-metric"><span>Saldo atual em caixa</span><strong>${formatBrl(values.cashBalanceCents)}</strong><small>Entradas menos despesas pagas, reembolsos e retiradas</small></article>
      <article class="cashflow-metric"><span>Reserva disponível para despesas</span><strong>${formatBrl(values.expenseReserveBalanceCents)}</strong><small>Reserva constituída menos valores já comprometidos</small></article>
      <article class="cashflow-metric"><span>Lucro disponível para retirada</span><strong>${formatBrl(values.profitAvailableCents)}</strong><small>Lucro reconhecido somente após crédito confirmado</small></article>
      <article class="cashflow-metric"><span>Reembolsos pendentes</span><strong>${formatBrl(values.reimbursementPendingCents)}</strong><small>Valores devidos a quem antecipou despesas</small></article>`;
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
    if (!rows.length) return emptyState("Nenhum recebimento encontrado", "Os recebimentos só aparecem depois da confirmação de um crédito vinculado a uma nota fiscal de item faturado.");
    const body = rows.map((receipt) => {
      const lines = rowsForReceipt(receipt.id);
      const itemText = lines.map((line) => {
        const invoice = data.allInvoices.find((row) => String(row.id) === String(line.invoice_id));
        const invoiceNumber = invoice?.invoice_number ? `NF ${invoice.invoice_number}` : `NF ${line.invoice_id}`;
        return `<span class="cashflow-row-sub">${escapeHtml(invoiceNumber)} · Item ${escapeHtml(invoice?.item_number ?? "—")} · ${escapeHtml(line.received_quantity)} un.</span>`;
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
    if (!rows.length) return emptyState("Nenhuma despesa encontrada", "Registre despesas da empresa ou despesas antecipadas para acompanhar a obrigação de reembolso.");
    const refunds = buildExpenseRefunds(state.data);
    return `<div class="cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Pago por</th><th class="cashflow-number">Valor</th><th>Tratamento</th><th>Situação</th><th></th></tr></thead><tbody>${rows.map((expense) => {
      const paidBy = expense.payer_type === "company" ? "Empresa" : partyName(state.data, expense.payer_party_id);
      const refunded = refunds.get(String(expense.id)) || 0;
      const owed = expense.payer_type === "company" ? 0 : Math.max(0, parseMoneyToCents(expense.amount) - refunded);
      const treatment = expense.profit_treatment === "included_in_item_cost" ? "Custo já considerado no item" : expense.profit_treatment === "outside_reserve" ? "Fora da reserva" : "Usou reserva de despesas";
      return `<tr><td>${formatDate(expense.occurred_on)}</td><td><strong>${escapeHtml(expense.description)}</strong>${expense.proof_storage_path ? `<span class="cashflow-row-sub">Comprovante disponível</span>` : ""}</td><td>${escapeHtml(expense.category)}</td><td>${escapeHtml(paidBy)}</td><td class="cashflow-number"><strong>${formatBrl(parseMoneyToCents(expense.amount))}</strong></td><td>${escapeHtml(treatment)}</td><td>${owed > 0 ? `<span class="cashflow-badge warning">A devolver ${formatBrl(owed)}</span>` : `<span class="cashflow-badge success">Sem pendência</span>`}</td><td>${expense.proof_storage_path ? `<button type="button" class="text-action" data-cf-action="view-proof" data-path="${escapeHtml(expense.proof_storage_path)}">Comprovante</button>` : ""}${owed > 0 && isAdmin() ? ` <button type="button" class="text-action" data-cf-action="reimburse" data-id="${escapeHtml(expense.id)}">Reembolsar</button>` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function reimbursementTable() {
    const refunds = buildExpenseRefunds(state.data);
    const rows = state.data.expenses.filter((expense) => {
      if (expense.reversed_at || expense.payer_type === "company") return false;
      if (state.filters.from && String(expense.occurred_on).slice(0, 10) < state.filters.from) return false;
      if (state.filters.to && String(expense.occurred_on).slice(0, 10) > state.filters.to) return false;
      return parseMoneyToCents(expense.amount) > (refunds.get(String(expense.id)) || 0);
    });
    if (!rows.length) return emptyState("Nenhum reembolso pendente", "Despesas pagas pela empresa não geram saldo de reembolso.");
    return `<div class="cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th>Despesa de origem</th><th>Quem antecipou</th><th class="cashflow-number">Valor original</th><th class="cashflow-number">Já devolvido</th><th class="cashflow-number">Saldo a devolver</th><th>Ação</th></tr></thead><tbody>${rows.map((expense) => {
      const refunded = refunds.get(String(expense.id)) || 0;
      const amount = parseMoneyToCents(expense.amount);
      const remaining = amount - refunded;
      return `<tr><td><strong>${escapeHtml(expense.description)}</strong><span class="cashflow-row-sub">${formatDate(expense.occurred_on)}</span></td><td>${escapeHtml(partyName(state.data, expense.payer_party_id))}</td><td class="cashflow-number">${formatBrl(amount)}</td><td class="cashflow-number">${formatBrl(refunded)}</td><td class="cashflow-number"><strong>${formatBrl(remaining)}</strong></td><td>${isAdmin() ? `<button type="button" class="primary-action small-action" data-cf-action="reimburse" data-id="${escapeHtml(expense.id)}">Registrar devolução</button>` : "—"}</td></tr>`;
    }).join("")}</tbody></table></div>`;
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
      ? `<div class="cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th>Participante financeiro</th><th class="cashflow-number">Percentual padrão</th><th>Edital</th><th class="cashflow-number">Reservado</th><th class="cashflow-number">Retirado</th><th class="cashflow-number">Disponível</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.participant.name)}</strong></td><td class="cashflow-number">${Number(row.participant.default_share_percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</td><td>${escapeHtml(bidName(accessibleBids(), row.bid.id))}</td><td class="cashflow-number">${formatBrl(row.reservedCents)}</td><td class="cashflow-number">${formatBrl(row.withdrawnCents)}</td><td class="cashflow-number"><strong>${formatBrl(row.availableCents)}</strong></td><td>${isAdmin() && row.availableCents > 0 ? `<button type="button" class="text-action" data-cf-action="withdraw" data-bid="${escapeHtml(row.bid.id)}" data-party="${escapeHtml(row.participant.id)}">Registrar retirada</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
      : emptyState("Nenhuma reserva por edital", "Lucro só aparece depois do recebimento. Cadastre participantes financeiros para reconhecer reservas.");
    const partiesTable = participantList.length
      ? `<div class="cashflow-party-list"><h3>Participantes financeiros cadastrados</h3>${participantList.map((party) => `<div class="cashflow-party-row"><span><strong>${escapeHtml(party.name)}</strong><small>${Number(party.default_share_percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% padrão</small></span>${isAdmin() ? `<button type="button" class="text-action" data-cf-action="edit-party" data-id="${escapeHtml(party.id)}">Editar</button>` : ""}</div>`).join("")}</div>`
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
    state.activeTab = "receipts";
    state.filters = { from: "", to: "" };
    headerActions.innerHTML = "";
    dashboard.innerHTML = "";
    workspace.innerHTML = "";
    dashboard.classList.add("hidden");
    workspace.classList.add("hidden");
    setStatus("Abra esta página para carregar os lançamentos financeiros.", "info");
  }

  function makeInvoiceCard(invoice, index) {
    const safeId = String(invoice.id).replace(/[^a-zA-Z0-9_-]/g, "_");
    const defaultQuantity = Math.min(invoice.open_quantity, 1);
    const defaultAmount = Math.min(invoice.open_amount_cents, saleAmountForQuantity(invoice, defaultQuantity));
    const cost = defaultCostCents(invoice, defaultQuantity);
    const reserve = defaultReserveCents(defaultAmount, cost, state.data.settings.default_expense_reserve_percent);
    const profit = Math.max(0, defaultAmount - cost - reserve);
    let shares = [];
    try { shares = splitCentsByPercent(profit, activeParticipants().map((party) => ({ id: party.id, percent: party.default_share_percent || 0 }))); } catch { /* An admin can set the distribution manually while defaults are adjusted. */ }
    const allocations = activeParticipants().map((party) => {
      const share = shares.find((row) => String(row.id) === String(party.id));
      return `<label class="cashflow-field cashflow-allocation-field">${escapeHtml(party.name)}<input type="text" inputmode="decimal" name="allocation_${safeId}_${escapeHtml(party.id)}" value="${escapeHtml(amountAsInput(share?.cents || 0))}" data-cf-allocation="${safeId}" data-cf-party="${escapeHtml(party.id)}" disabled /></label>`;
    }).join("");
    return `<article class="cashflow-invoice-card" data-cf-invoice-card="${safeId}">
      <label class="cashflow-invoice-choice"><input type="checkbox" name="invoice_${safeId}" value="${escapeHtml(invoice.id)}" data-cf-invoice-check="${safeId}" /><span><strong>NF ${escapeHtml(invoice.invoice_number)}</strong><small>Edital ${escapeHtml(bidName(accessibleBids(), invoice.bid_id))} · Item ${escapeHtml(invoice.item_number)} · ${escapeHtml(invoice.item_description)}</small><small>Faturado: ${escapeHtml(invoice.invoice_quantity)} ${escapeHtml(invoice.item_unit)} · Unidades recebidas: ${escapeHtml(invoice.received_quantity)} · Saldo: ${escapeHtml(invoice.open_quantity)} · Crédito: ${formatBrl(invoice.received_amount_cents)} · Saldo financeiro: ${formatBrl(invoice.open_amount_cents)} · Nota: ${formatBrl(invoice.face_amount_cents)}</small></span></label>
      <div class="cashflow-invoice-fields"><label class="cashflow-field">Quantidade relacionada<input type="number" min="0" max="${escapeHtml(invoice.open_quantity)}" step="0.0001" name="quantity_${safeId}" value="0" data-cf-quantity="${safeId}" disabled /><small>Controla o saldo de unidades separadamente do valor recebido.</small></label>
      <label class="cashflow-field">Valor recebido nesta parcela (R$)<input type="text" inputmode="decimal" name="amount_${safeId}" value="0,00" data-cf-amount="${safeId}" data-touched="false" disabled /><small>Saldo financeiro da nota: ${formatBrl(invoice.open_amount_cents)}.</small></label>
      <label class="cashflow-field">Custo atribuído (R$)<input type="text" inputmode="decimal" name="cost_${safeId}" value="${escapeHtml(amountAsInput(cost))}" data-cf-cost="${safeId}" data-default-cents="${cost}" data-touched="false" disabled /></label>
      <label class="cashflow-field">Reserva de despesas (R$)<input type="text" inputmode="decimal" name="reserve_${safeId}" value="${escapeHtml(amountAsInput(reserve))}" data-cf-reserve="${safeId}" data-default-cents="${reserve}" data-touched="false" disabled /></label></div>
      <div class="cashflow-line-summary" data-cf-line-summary="${safeId}">Valor recebido ${formatBrl(defaultAmount)} · lucro distribuível ${formatBrl(profit)}</div>
      ${invoice.unit_cost_cents === 0 ? `<p class="cashflow-inline-note" data-cf-cost-note="${safeId}">O orçamento não informa custo de fornecedor; confira ou corrija o custo antes de reconhecer o lucro.</p>` : ""}
      ${allocations ? `<div class="cashflow-allocation-list" data-cf-allocation-list="${safeId}"><strong>Distribuição deste item</strong>${allocations}</div>` : `<p class="cashflow-inline-note">Cadastre participantes financeiros antes de distribuir o lucro.</p>`}
      <label class="cashflow-field cashflow-reason-field">Justificativa para custo manual<input type="text" name="cost_reason_${safeId}" maxlength="500" data-cf-cost-reason="${safeId}" disabled /></label>
      <label class="cashflow-field cashflow-reason-field">Justificativa para reserva manual<input type="text" name="reserve_reason_${safeId}" maxlength="500" data-cf-reserve-reason="${safeId}" disabled /></label>
    </article>`;
  }

  function receiptDrawer(bidId) {
    const bidsWithInvoices = accessibleBids().filter((bid) => state.data.invoices.some((invoice) => String(invoice.bid_id) === String(bid.id)));
    const selectedBidId = bidId || bidsWithInvoices[0]?.id || "";
    const invoices = state.data.invoices.filter((invoice) => String(invoice.bid_id) === String(selectedBidId));
    const bidOptions = bidsWithInvoices.map((bid) => {
      const label = bidLabel(bid);
      return [String(bid.id), `${label.title} · ${label.subtitle}`];
    });
    const participantSharesValid = activeParticipants().length > 0
      && activeParticipants().reduce((sum, party) => sum + Number(party.default_share_percent || 0), 0) === 100;
    const invoiceList = invoices.length
      ? invoices.map(makeInvoiceCard).join("")
      : emptyState("Sem nota fiscal elegível", "Apenas itens faturados com saldo monetário podem receber crédito.");
    const body = `<div class="cashflow-form-grid"><label class="cashflow-field cashflow-field-wide">Edital obrigatório<select name="bid_id" required>${selectOptions(bidOptions, selectedBidId)}</select></label>
      <label class="cashflow-field">Data do crédito<input name="received_on" type="date" value="${dateInputValue()}" required /></label>
      <label class="cashflow-field">Forma de recebimento<select name="payment_method" required>${selectOptions(PAYMENT_METHODS, "transfer")}</select></label>
      <label class="cashflow-field cashflow-field-wide">Referência bancária ou do pagamento<input name="payment_reference" maxlength="120" placeholder="Opcional · ajuda a evitar duplicidade" /></label>
      <label class="cashflow-field cashflow-field-wide">Observações<textarea name="notes" rows="2" maxlength="1000"></textarea></label></div>
      <section class="cashflow-drawer-section"><div><h3>Notas fiscais e itens faturados</h3><p>Informe separadamente as unidades relacionadas e o valor efetivamente recebido. Cada saldo é validado contra a nota fiscal.</p></div></section>
      <div class="cashflow-invoice-list">${invoiceList}</div>
      <section class="cashflow-drawer-section"><div><h3>Distribuição do recebimento</h3><p>Custos e reservas são apurados por item; o lucro só será reconhecido com o crédito confirmado.</p></div></section>
      <label class="cashflow-field">Forma de distribuição<select name="distribution_mode" data-cf-distribution-mode><option value="default">Percentuais padrão</option><option value="manual">Ajuste manual por item</option></select></label>
      ${!participantSharesValid ? `<p class="cashflow-inline-note">Os percentuais padrão precisam totalizar 100% para usar a distribuição padrão. Ajuste os participantes antes de registrar o recebimento.</p>` : ""}
      <label class="cashflow-field cashflow-reason-field">Justificativa da distribuição manual<textarea name="distribution_justification" rows="2" maxlength="500" data-cf-distribution-reason disabled></textarea></label>
      <div class="cashflow-calculation" data-cf-receipt-total>Selecione uma ou mais notas para conciliar o recebimento.</div>
      ${commonConfirmation("Confirmo que o crédito foi efetivamente recebido e que os valores correspondem às notas selecionadas.")}`;
    openDialog("Registrar recebimento", "Vincule o crédito a um edital e às notas fiscais correspondentes.", body, "Confirmar recebimento", "receipt", true);
    updateReceiptForm();
  }

  function receiptFormLines() {
    const form = dialog.querySelector("form");
    if (!form) return [];
    return [...form.querySelectorAll("[data-cf-invoice-check]:checked")].map((checkbox) => {
      const id = checkbox.dataset.cfInvoiceCheck;
      const invoice = state.data.invoices.find((row) => String(row.id).replace(/[^a-zA-Z0-9_-]/g, "_") === id);
      if (!invoice) return null;
      const quantityInput = form.querySelector(`[data-cf-quantity="${id}"]`);
      const amountInput = form.querySelector(`[data-cf-amount="${id}"]`);
      const costInput = form.querySelector(`[data-cf-cost="${id}"]`);
      const reserveInput = form.querySelector(`[data-cf-reserve="${id}"]`);
      const quantityInputValue = parseQuantity(quantityInput.value, "Quantidade relacionada");
      const amountInputCents = parseAmount(amountInput.value, "Valor recebido");
      const invoiceReceipt = validateInvoiceReceipt({
        quantity: quantityInputValue,
        openQuantity: invoice.open_quantity,
        amountCents: amountInputCents,
        openAmountCents: invoice.open_amount_cents,
      });
      const quantity = invoiceReceipt.quantity;
      const amountCents = invoiceReceipt.amountCents;
      const costCents = parseAmount(costInput.value, "Custo atribuído");
      const reserveCents = parseAmount(reserveInput.value, "Reserva de despesas");
      const line = validateReceiptLine({ amountCents, costCents, reserveCents });
      return { id, invoice, quantity, amountCents, costCents, reserveCents, profitCents: line.profitCents, lossCents: line.lossCents };
    }).filter(Boolean);
  }

  function updateReceiptForm({ defaults = false } = {}) {
    const form = dialog.querySelector("form");
    if (!form || state.drawerKind !== "receipt") return;
    const mode = form.elements.distribution_mode.value;
    const reservePercent = Number(state.data.settings.default_expense_reserve_percent || 0);
    for (const card of form.querySelectorAll("[data-cf-invoice-card]")) {
      const id = card.dataset.cfInvoiceCard;
      const checked = Boolean(card.querySelector(`[data-cf-invoice-check="${id}"]`)?.checked);
      for (const input of card.querySelectorAll("input")) {
        if (input.type !== "checkbox") input.disabled = !checked || (input.dataset.cfAllocation && mode !== "manual");
      }
      if (!checked) continue;
      const invoice = state.data.invoices.find((row) => String(row.id).replace(/[^a-zA-Z0-9_-]/g, "_") === id);
      const quantity = parseFloat(card.querySelector(`[data-cf-quantity="${id}"]`).value || "0") || 0;
      const amountInput = card.querySelector(`[data-cf-amount="${id}"]`);
      const defaultAmountCents = Math.min(invoice.open_amount_cents, saleAmountForQuantity(invoice, quantity));
      let amountCents = defaultAmountCents;
      if (amountInput.dataset.touched !== "true") {
        amountInput.value = amountAsInput(defaultAmountCents);
        amountInput.dataset.touched = "false";
      } else {
        try { amountCents = parseAmount(amountInput.value, "Valor recebido"); } catch { amountCents = 0; }
      }
      const costInput = card.querySelector(`[data-cf-cost="${id}"]`);
      const reserveInput = card.querySelector(`[data-cf-reserve="${id}"]`);
      const nextDefaultCost = defaultCostCents(invoice, quantity);
      const costCents = costInput.dataset.touched !== "true"
        ? nextDefaultCost
        : (() => { try { return parseAmount(costInput.value); } catch { return 0; } })();
      if (costInput.dataset.touched !== "true") costInput.value = amountAsInput(nextDefaultCost);
      const nextDefaultReserve = defaultReserveCents(amountCents, costCents, reservePercent);
      const reserveCents = reserveInput.dataset.touched !== "true"
        ? nextDefaultReserve
        : (() => { try { return parseAmount(reserveInput.value); } catch { return 0; } })();
      if (reserveInput.dataset.touched !== "true") reserveInput.value = amountAsInput(nextDefaultReserve);
      const profitCents = Math.max(0, amountCents - costCents - reserveCents);
      const summary = card.querySelector(`[data-cf-line-summary="${id}"]`);
      if (summary) summary.textContent = `Valor recebido ${formatBrl(amountCents)} · custo ${formatBrl(costCents)} · reserva ${formatBrl(reserveCents)} · lucro distribuível ${formatBrl(profitCents)}`;
      const allocationFields = [...card.querySelectorAll(`[data-cf-allocation="${id}"]`)];
      if (defaults || allocationFields.every((field) => field.dataset.touched !== "true")) {
        let split = [];
        try { split = splitCentsByPercent(profitCents, activeParticipants().map((party) => ({ id: party.id, percent: party.default_share_percent || 0 }))); } catch { /* Manual distribution remains available. */ }
        for (const field of allocationFields) {
          const amount = split.find((share) => String(share.id) === String(field.dataset.cfParty))?.cents || 0;
          field.value = amountAsInput(amount);
        }
      }
      for (const field of allocationFields) field.disabled = !checked || mode !== "manual";
      for (const reasonInput of card.querySelectorAll("[data-cf-cost-reason], [data-cf-reserve-reason]")) reasonInput.disabled = !checked;
    }
    const reason = form.querySelector("[data-cf-distribution-reason]");
    if (reason) reason.disabled = mode !== "manual";
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
      if (mode === "manual") {
        let allocationTotal = 0;
        for (const line of lines) {
          for (const party of activeParticipants()) {
            const field = form.querySelector(`[data-cf-allocation="${line.id}"][data-cf-party="${party.id}"]`);
            if (field) allocationTotal += parseAmount(field.value, "Distribuição do participante");
          }
        }
        totals.innerHTML += `<p>${allocationTotal === profit ? "A distribuição manual concilia com o lucro." : `Distribuição informada ${formatBrl(allocationTotal)} · diferença ${formatBrl(profit - allocationTotal)}`}</p>`;
      }
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
      <p class="cashflow-inline-note">Quando um participante antecipa uma despesa, o reembolso reduz o saldo a devolver e o caixa.</p>`;
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
    const already = buildExpenseRefunds(state.data).get(String(expense.id)) || 0;
    const due = parseMoneyToCents(expense.amount) - already;
    const body = `<div class="cashflow-callout"><strong>${escapeHtml(partyName(state.data, expense.payer_party_id))}</strong><span>${escapeHtml(expense.description)} · pendente ${formatBrl(due)}</span></div>
      <div class="cashflow-form-grid"><label class="cashflow-field">Valor a devolver (R$)<input name="amount" type="text" inputmode="decimal" value="${escapeHtml(amountAsInput(due))}" required /></label>
      <label class="cashflow-field">Data do pagamento<input name="paid_on" type="date" value="${dateInputValue()}" required /></label>
      <label class="cashflow-field">Forma de pagamento<select name="payment_method" required>${selectOptions(PAYMENT_METHODS, "pix")}</select></label>
      <label class="cashflow-field">Origem dos recursos<select name="funding_source" required><option value="expense_reserve">Reserva de despesas</option><option value="operating_cash">Caixa da empresa</option><option value="other">Outra origem</option></select></label>
      <label class="cashflow-field cashflow-field-wide">Observações<textarea name="notes" rows="2" maxlength="500"></textarea></label></div>
      ${commonConfirmation("Confirmo que o valor foi pago ao credor identificado.")}`;
    openDialog("Registrar reembolso", "A devolução diminui o saldo devido e o caixa da empresa.", body, "Confirmar reembolso", "reimbursement");
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
      <label class="cashflow-field">Percentual padrão de lucro<input name="share_percent" type="number" min="0" max="100" step="0.01" value="${escapeHtml(party?.default_share_percent ?? "0.00")}" /></label>
      <label class="cashflow-checkbox-field"><input type="checkbox" name="active" ${party?.active === false ? "" : "checked"} /><span>Cadastro ativo</span></label></div>
      <p class="cashflow-inline-note">O percentual padrão pode ser alterado em um recebimento, com justificativa.</p>`;
    openDialog(party ? "Editar participante" : "Novo participante", "Cadastre quem receberá distribuições de lucro.", body, "Salvar cadastro", "party");
    dialog.querySelector("form").dataset.partyId = party?.id || "";
  }

  function receiptDetail(receiptId) {
    const receipt = state.data.receipts.find((row) => String(row.id) === String(receiptId));
    if (!receipt) return;
    const lines = rowsForReceipt(receipt.id);
    const allocationRows = state.data.allocations.filter((row) => String(row.receipt_id) === String(receipt.id));
    const lineHtml = lines.map((line) => {
      const invoice = state.data.allInvoices.find((row) => String(row.id) === String(line.invoice_id));
      const allocations = allocationRows.filter((row) => String(row.receipt_line_id) === String(line.id));
      return `<div class="cashflow-detail-row"><strong>NF ${escapeHtml(invoice?.invoice_number || line.invoice_id)} · Item ${escapeHtml(invoice?.item_number || "—")}</strong><span>${escapeHtml(line.received_quantity)} un. · Recebido ${formatBrl(parseMoneyToCents(line.received_amount))} · Custo ${formatBrl(parseMoneyToCents(line.cost_amount))} · Reserva ${formatBrl(parseMoneyToCents(line.reserve_amount))}</span><span>Lucro desta linha ${formatBrl(parseMoneyToCents(line.profit_amount))}</span>${allocations.map((row) => `<span>${escapeHtml(partyName(state.data, row.participant_id))}: ${formatBrl(parseMoneyToCents(row.amount))}</span>`).join("")}${line.cost_justification ? `<small>Justificativa do custo: ${escapeHtml(line.cost_justification)}</small>` : ""}${line.reserve_justification ? `<small>Justificativa da reserva: ${escapeHtml(line.reserve_justification)}</small>` : ""}</div>`;
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
    const confirmationRequired = ["receipt", "reimbursement", "withdrawal", "reverse-receipt"].includes(state.drawerKind);
    if (confirmationRequired && !confirmation) throw new Error("Confirme que revisou os dados antes de salvar.");

    if (state.drawerKind === "receipt") {
      const bidId = String(formData.get("bid_id") || "");
      if (!bidId) throw new Error("Selecione um edital.");
      const selected = receiptFormLines();
      if (!selected.length) throw new Error("Selecione pelo menos uma nota fiscal.");
      const distributionMode = String(formData.get("distribution_mode") || "default");
      const justification = String(formData.get("distribution_justification") || "").trim();
      if (distributionMode === "manual" && justification.length < 5) throw new Error("Explique a alteração manual da distribuição.");
      const totalProfitCents = selected.reduce((sum, line) => sum + line.profitCents, 0);
      const defaultShareBasisPoints = activeParticipants().reduce((sum, party) => sum + Math.round(Number(party.default_share_percent || 0) * 100), 0);
      if (distributionMode === "default" && totalProfitCents > 0 && defaultShareBasisPoints !== 10000) {
        throw new Error("Os percentuais padrão dos participantes ativos precisam somar 100% ou use a distribuição manual com justificativa.");
      }
      const lines = selected.map((line) => {
        const formId = line.id;
        const costInput = form.querySelector(`[data-cf-cost="${formId}"]`);
        const reserveInput = form.querySelector(`[data-cf-reserve="${formId}"]`);
        const costReason = String(form.querySelector(`[data-cf-cost-reason="${formId}"]`)?.value || "").trim();
        const reserveReason = String(form.querySelector(`[data-cf-reserve-reason="${formId}"]`)?.value || "").trim();
        const defaultCost = defaultCostCents(line.invoice, line.quantity);
        const defaultReserve = defaultReserveCents(line.amountCents, line.costCents, state.data.settings.default_expense_reserve_percent);
        if (line.costCents !== defaultCost && costReason.length < 5) throw new Error(`Justifique o custo manual da NF ${line.invoice.invoice_number}.`);
        if (line.reserveCents !== defaultReserve && reserveReason.length < 5) throw new Error(`Justifique a reserva manual da NF ${line.invoice.invoice_number}.`);
        let participantAllocations = [];
        if (distributionMode === "manual") {
          participantAllocations = activeParticipants().map((party) => ({
            participantId: party.id,
            amountCents: parseAmount(form.querySelector(`[data-cf-allocation="${formId}"][data-cf-party="${party.id}"]`)?.value || "0", "Distribuição do participante"),
          }));
          const total = participantAllocations.reduce((sum, row) => sum + row.amountCents, 0);
          if (total !== line.profitCents) throw new Error(`A distribuição manual do item ${line.invoice.item_number} precisa totalizar ${formatBrl(line.profitCents)}.`);
        }
        return {
          invoiceId: line.invoice.id,
          receivedQuantity: line.quantity,
          amountCents: line.amountCents,
          costCents: line.costCents,
          costJustification: costReason,
          reserveCents: line.reserveCents,
          reserveJustification: reserveReason,
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
        distributionJustification: justification,
        idempotencyKey: String(formData.get("idempotency_key") || randomId()),
        lines,
      });
    }

    if (state.drawerKind === "expense") {
      const payerType = String(formData.get("payer_type") || "");
      if (payerType !== "company" && payerType !== "participant") throw new Error("Selecione a empresa ou um participante como pagador.");
      const partyId = payerType === "company" ? null : String(formData.get("payer_party_id") || "");
      if (payerType !== "company" && !partyId) throw new Error("Selecione quem antecipou a despesa.");
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
        fundingSource: String(formData.get("funding_source") || ""),
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
      const sharePercent = Number(formData.get("share_percent") || 0);
      if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) throw new Error("O percentual padrão deve ficar entre 0% e 100%.");
      return state.service.saveParty({
        id: String(form.dataset.partyId || "") || null,
        name: String(formData.get("name") || "").trim(),
        sharePercent,
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
      await runBusy(() => runSubmission(event.target), "Salvando lançamento financeiro…");
      const label = state.drawerKind === "receipt" ? "Recebimento registrado" : state.drawerKind === "expense" ? "Despesa registrada" : state.drawerKind === "reimbursement" ? "Reembolso registrado" : state.drawerKind === "withdrawal" ? "Retirada registrada" : state.drawerKind === "reverse-receipt" ? "Recebimento estornado" : state.drawerKind === "party" ? "Cadastro atualizado" : "Ajustes salvos";
      closeDialog();
      toast(label, "success");
      onSaved();
      await showPage(true);
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
    if (target.matches("[data-cf-amount], [data-cf-cost], [data-cf-reserve], [data-cf-allocation]")) target.dataset.touched = "true";
    if (target.matches("[data-cf-quantity], [data-cf-amount], [data-cf-cost], [data-cf-reserve], [data-cf-allocation], [data-cf-distribution-mode]")) updateReceiptForm();
  }

  function onChange(event) {
    const target = event.target;
    if (target.matches("[data-cf-filter]")) {
      state.filters[target.dataset.cfFilter] = target.value;
      renderDashboard();
      renderWorkspace();
      return;
    }
    if (target.matches("[data-cf-invoice-check]")) {
      const id = target.dataset.cfInvoiceCheck;
      const card = target.closest("[data-cf-invoice-card]");
      if (target.checked) {
        const invoice = state.data.invoices.find((row) => String(row.id).replace(/[^a-zA-Z0-9_-]/g, "_") === id);
        const quantity = Math.min(Number(invoice.open_quantity || 0), 1);
        const amount = Math.min(invoice.open_amount_cents, saleAmountForQuantity(invoice, quantity));
        card.querySelector(`[data-cf-quantity="${id}"]`).value = String(quantity);
        const amountInput = card.querySelector(`[data-cf-amount="${id}"]`);
        amountInput.value = amountAsInput(amount);
        amountInput.dataset.touched = "false";
        card.querySelector(`[data-cf-cost="${id}"]`).dataset.touched = "false";
        card.querySelector(`[data-cf-reserve="${id}"]`).dataset.touched = "false";
        for (const field of card.querySelectorAll(`[data-cf-allocation="${id}"]`)) field.dataset.touched = "false";
      }
      updateReceiptForm();
      return;
    }
    if (target.matches("[data-cf-distribution-mode]")) {
      updateReceiptForm({ defaults: target.value === "default" });
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
    if (target.hasAttribute("data-cf-close")) return closeDialog();
    if (target.dataset.cfTab) {
      state.activeTab = target.dataset.cfTab;
      renderWorkspace();
      return;
    }
    switch (target.dataset.cfAction) {
      case "new-receipt": return receiptDrawer();
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
  dialog.addEventListener("submit", onSubmit);
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  return {
    showPage,
    refresh: () => showPage(true),
    hide,
    reset,
  };
}

window.GLLFinance = Object.freeze({ createCashflowFeature });
