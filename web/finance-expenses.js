import { createCashflowService } from "./finance-service.js";
import { formatCents, parseMoneyToCents, sumMoney } from "./finance-money.js";

const ADMIN_ROLE = "Administrador";
const PAYER_TYPES = new Set(["organization", "participant", "third_party"]);
const AUDITED_TABLES = new Set([
  "cashflow_expenses",
  "cashflow_expense_adjustments",
  "cashflow_reimbursements",
  "cashflow_reimbursement_reversals",
]);

export function expensePayerKey(expense) {
  if (expense?.payer_type === "organization") return "organization";
  if (expense?.payer_type === "unresolved" && expense.source_payer_label) {
    return `unresolved:${expense.source_payer_label}`;
  }
  if (expense?.payer_type === "participant" && expense.participant_payer_id) {
    return `participant:${expense.participant_payer_id}`;
  }
  if (expense?.payer_type === "third_party" && expense.third_party_payer_id) {
    return `third_party:${expense.third_party_payer_id}`;
  }
  return "";
}

export function calculateExpenseAmount(expense, adjustments = []) {
  const deltas = adjustments
    .filter((row) => row.expense_id === expense.id)
    .map((row) => row.amount_delta);
  return sumMoney([String(expense.amount), ...deltas.map(String)]);
}

export function calculateExpenseReimbursed(expense, reimbursements = [], reversals = []) {
  const expenseReimbursements = reimbursements.filter((row) => row.expense_id === expense.id);
  const reimbursementIds = new Set(expenseReimbursements.map((row) => row.id));
  const reversalAmounts = reversals
    .filter((row) => reimbursementIds.has(row.reimbursement_id))
    .map((row) => row.amount);
  return sumMoney([
    String(expense.historical_reimbursed_amount || "0.00"),
    ...expenseReimbursements.map((row) => String(row.amount)),
    ...reversalAmounts.map((amount) => formatCents(-parseMoneyToCents(String(amount)))),
  ]);
}

export function calculateExpenseBalance(expense, {
  adjustments = [],
  reimbursements = [],
  reversals = [],
} = {}) {
  if (expense?.payer_type === "organization") return "0.00";
  const total = parseMoneyToCents(calculateExpenseAmount(expense, adjustments));
  const reimbursed = parseMoneyToCents(calculateExpenseReimbursed(expense, reimbursements, reversals));
  return formatCents(total > reimbursed ? total - reimbursed : 0n);
}

export function calculateExpenseOverview(expenses, related = {}) {
  return Object.freeze({
    count: expenses.length,
    total: sumMoney(expenses.map((expense) => calculateExpenseAmount(expense, related.adjustments || []))),
    pending: sumMoney(expenses.map((expense) => calculateExpenseBalance(expense, related))),
  });
}

export function filterGeneralExpenses(expenses, { payerKey = "", startDate = "", endDate = "" } = {}) {
  return expenses.filter((expense) => {
    if (payerKey && expensePayerKey(expense) !== payerKey) return false;
    if (startDate && expense.paid_on < startDate) return false;
    if (endDate && expense.paid_on > endDate) return false;
    return true;
  });
}

export function validateReimbursementAmount(amount, pendingAmount) {
  const amountCents = parseMoneyToCents(String(amount));
  const pendingCents = parseMoneyToCents(String(pendingAmount));
  if (amountCents <= 0n) throw new RangeError("Informe um valor de ressarcimento maior que zero.");
  if (amountCents > pendingCents) throw new RangeError("O valor excede o saldo pendente desta despesa.");
  return formatCents(amountCents);
}

export function createIdempotencyKeyCache() {
  const entries = new WeakMap();
  return Object.freeze({
    getOrCreate(form, command, payload, createKey) {
      if (!form || typeof form !== "object") throw new TypeError("O formulário da ação é obrigatório.");
      if (typeof createKey !== "function") throw new TypeError("Informe a função que cria a chave idempotente.");
      const fingerprint = JSON.stringify([command, payload]);
      const existing = entries.get(form);
      if (existing?.fingerprint === fingerprint) return existing.key;
      const key = createKey();
      entries.set(form, { fingerprint, key });
      return key;
    },
    clear(form) {
      entries.delete(form);
    },
  });
}

export function validateGeneralExpenseDraft(draft) {
  const payerType = String(draft.payer_type || "");
  const paidOn = String(draft.paid_on || "");
  const description = String(draft.description || "").trim();
  const amount = formatCents(parseMoneyToCents(String(draft.amount || "")));
  if (!PAYER_TYPES.has(payerType)) throw new TypeError("Selecione quem pagou a despesa.");
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(paidOn);
  let normalizedDate = "";
  if (dateParts) {
    const calendarDate = new Date(0);
    calendarDate.setUTCHours(0, 0, 0, 0);
    calendarDate.setUTCFullYear(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]));
    normalizedDate = calendarDate.toISOString().slice(0, 10);
  }
  if (!dateParts || normalizedDate !== paidOn) {
    throw new TypeError("Informe uma data válida para a despesa.");
  }
  if (parseMoneyToCents(amount) <= 0n) throw new RangeError("Informe um valor maior que zero.");
  if (!description) throw new TypeError("Informe a descrição da despesa.");
  const participantId = String(draft.participant_payer_id || "").trim();
  const thirdPartyId = String(draft.third_party_payer_id || "").trim();
  if (payerType === "participant" && !participantId) throw new TypeError("Selecione o participante financeiro que pagou.");
  if (payerType === "third_party" && !thirdPartyId) throw new TypeError("Selecione o terceiro que pagou.");
  return Object.freeze({
    payer_type: payerType,
    ...(payerType === "participant" ? { participant_payer_id: participantId } : {}),
    ...(payerType === "third_party" ? { third_party_payer_id: thirdPartyId } : {}),
    paid_on: paidOn,
    amount,
    description,
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatFinanceCurrency(value) {
  const cents = parseMoneyToCents(String(value));
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, "0");
  const formattedWhole = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(whole);
  return `${negative ? "−" : ""}R$ ${formattedWhole},${fraction}`;
}

function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "—");
}

function payerTypeLabel(type) {
  if (type === "organization") return "Empresa";
  if (type === "participant") return "Participante";
  if (type === "third_party") return "Terceiro";
  return "Pagador histórico sem vínculo";
}

function payerLabel(expense, participantsById, thirdPartiesById) {
  if (expense.payer_type === "organization") return "Empresa";
  if (expense.payer_type === "unresolved") {
    return String(expense.source_payer_label || "Pagador histórico sem identificação");
  }
  if (expense.payer_type === "participant") {
    return participantsById.get(expense.participant_payer_id)?.display_name || "Participante indisponível";
  }
  return thirdPartiesById.get(expense.third_party_payer_id)?.display_name || "Terceiro indisponível";
}

function todayInBusinessTimezone() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function assertQuery(result, label) {
  if (result?.error) throw new Error(result.error.message || `Não foi possível carregar ${label}.`);
  return Array.isArray(result?.data) ? result.data : [];
}

async function readRows(client, table, columns, { orderBy, limit } = {}) {
  let query = client.from(table).select(columns);
  for (const [column, ascending] of orderBy || []) query = query.order(column, { ascending });
  if (limit) query = query.limit(limit);
  return assertQuery(await query, table);
}

export function createCashflowExpenseFeature({ getClient, getUserRole, getUsers = () => [], getActorName = () => "", onNavigate = () => undefined }) {
  const root = document.getElementById("financeRoot");
  const status = document.getElementById("financeStatus");
  const state = {
    expenses: [],
    participants: [],
    thirdPartyPayers: [],
    adjustments: [],
    reimbursements: [],
    reversals: [],
    auditLog: [],
  };
  let filters = { payerKey: "", startDate: "", endDate: "" };
  let activeExpenseId = "";
  let generation = 0;
  const submissionKeys = createIdempotencyKeyCache();
  const inFlightForms = new WeakSet();

  function isAdmin() {
    return getUserRole() === ADMIN_ROLE;
  }

  function serviceFor(client) {
    return createCashflowService(client, { getUserRole });
  }

  function participantMap() {
    return new Map(state.participants.map((participant) => [participant.id, participant]));
  }

  function thirdPartyMap() {
    return new Map(state.thirdPartyPayers.map((payer) => [payer.id, payer]));
  }

  function related() {
    return {
      adjustments: state.adjustments,
      reimbursements: state.reimbursements,
      reversals: state.reversals,
    };
  }

  function visibleExpenses() {
    return filterGeneralExpenses(state.expenses, filters);
  }

  function setStatus(message, tone = "") {
    status.textContent = message;
    status.classList.toggle("form-error", tone === "error");
    status.classList.toggle("cashflow-success", tone === "success");
  }

  function payerOptions() {
    const participants = state.participants
      .slice()
      .sort((left, right) => left.display_name.localeCompare(right.display_name, "pt-BR"));
    const thirdParties = state.thirdPartyPayers
      .slice()
      .sort((left, right) => left.display_name.localeCompare(right.display_name, "pt-BR"));
    const importedPayers = [...new Set(state.expenses
      .filter((expense) => expense.payer_type === "unresolved" && expense.source_payer_label)
      .map((expense) => String(expense.source_payer_label)))]
      .sort((left, right) => left.localeCompare(right, "pt-BR"));
    return [
      '<option value="">Todos os responsáveis</option>',
      '<option value="organization">Empresa</option>',
      ...participants.map((person) => `<option value="participant:${escapeHtml(person.id)}">${escapeHtml(person.display_name)} · participante</option>`),
      ...thirdParties.map((person) => `<option value="third_party:${escapeHtml(person.id)}">${escapeHtml(person.display_name)} · terceiro</option>`),
      ...importedPayers.map((name) => `<option value="unresolved:${escapeHtml(name)}">${escapeHtml(name)} · pagador sem vínculo</option>`),
    ].join("");
  }

  function selectOptions(rows, selectedId = "") {
    if (!rows.length) return '<option value="">Nenhum cadastro disponível</option>';
    return `<option value="">Selecione</option>${rows
      .slice()
      .sort((left, right) => left.display_name.localeCompare(right.display_name, "pt-BR"))
      .map((row) => `<option value="${escapeHtml(row.id)}" ${row.id === selectedId ? "selected" : ""}>${escapeHtml(row.display_name)}</option>`)
      .join("")}`;
  }

  function expenseRowsMarkup(expenses) {
    const participants = participantMap();
    const thirdParties = thirdPartyMap();
    if (!expenses.length) {
      return '<tr><td class="cashflow-table-empty" colspan="8">Nenhuma despesa encontrada para os filtros selecionados.</td></tr>';
    }
    return expenses.map((expense) => {
      const amount = calculateExpenseAmount(expense, state.adjustments);
      const reimbursed = calculateExpenseReimbursed(expense, state.reimbursements, state.reversals);
      const pending = calculateExpenseBalance(expense, related());
      const hasDebt = expense.payer_type !== "organization" && parseMoneyToCents(pending) > 0n;
      const action = hasDebt
        ? `<button class="quiet-action compact-action" type="button" data-open-reimbursement="${escapeHtml(expense.id)}">Registrar ressarcimento</button>`
        : '<span class="cashflow-settled">Sem pendência</span>';
      return `<tr>
        <td>${escapeHtml(formatDate(expense.paid_on))}</td>
        <td><strong>${escapeHtml(expense.description)}</strong><small>${escapeHtml(payerTypeLabel(expense.payer_type))}</small></td>
        <td>${escapeHtml(payerLabel(expense, participants, thirdParties))}</td>
        <td class="cashflow-money">${escapeHtml(formatFinanceCurrency(amount))}</td>
        <td class="cashflow-money">${escapeHtml(formatFinanceCurrency(reimbursed))}</td>
        <td class="cashflow-money">${escapeHtml(expense.payer_type === "organization" ? "—" : formatFinanceCurrency(pending))}</td>
        <td>${escapeHtml(expense.created_by ? actorName(expense.created_by) : "—")}</td>
        <td>${action}</td>
      </tr>`;
    }).join("");
  }

  function actorName(actorId) {
    const suppliedName = String(getActorName(actorId) || "").trim();
    if (suppliedName) return suppliedName;
    const user = getUsers().find((candidate) => candidate.auth_user_id === actorId);
    const name = user?.name || user?.display_name || user?.email;
    return name || `Conta ${actorId}`;
  }

  function auditSummary(entry) {
    const row = entry.new_data && typeof entry.new_data === "object" ? entry.new_data : {};
    if (entry.table_name === "cashflow_expenses") {
      const expense = state.expenses.find((candidate) => candidate.id === entry.record_id);
      return {
        title: `Despesa registrada: ${row.description || "Despesa geral"}`,
        detail: `${formatFinanceCurrency(String(row.amount || "0.00"))} · ${formatDate(row.paid_on)} · ${expense ? payerLabel(expense, participantMap(), thirdPartyMap()) : payerTypeLabel(row.payer_type)}`,
      };
    }
    const reimbursement = entry.table_name === "cashflow_reimbursements"
      ? row
      : state.reimbursements.find((candidate) => candidate.id === row.reimbursement_id);
    const expense = state.expenses.find((candidate) => candidate.id === reimbursement?.expense_id);
    if (entry.table_name === "cashflow_expense_adjustments") {
      return { title: `Ajuste de despesa: ${expense?.description || "Despesa geral"}`, detail: `${formatFinanceCurrency(String(row.amount_delta || "0.00"))} · ${row.reason || ""}` };
    }
    if (entry.table_name === "cashflow_reimbursement_reversals") {
      return { title: `Estorno de ressarcimento: ${expense?.description || "Despesa geral"}`, detail: `${formatFinanceCurrency(String(row.amount || "0.00"))} · ${row.reason || ""}` };
    }
    return {
      title: `Ressarcimento registrado: ${expense?.description || "Despesa geral"}`,
      detail: `${formatFinanceCurrency(String(row.amount || "0.00"))} · ${formatDate(row.paid_on)} · ${row.reason || ""}`,
    };
  }

  function auditMarkup() {
    const entries = state.auditLog
      .filter((entry) => AUDITED_TABLES.has(entry.table_name))
      .sort((left, right) => String(right.occurred_at).localeCompare(String(left.occurred_at)));
    if (!entries.length) return '<div class="empty-state compact-empty">Nenhuma movimentação registrada.</div>';
    return `<ol class="cashflow-audit-list">${entries.map((entry) => {
      const summary = auditSummary(entry);
      const timestamp = new Date(entry.occurred_at).toLocaleString("pt-BR");
      return `<li>
        <span class="cashflow-audit-marker" aria-hidden="true"></span>
        <div class="cashflow-audit-copy">
          <strong>${escapeHtml(summary.title)}</strong>
          <span>${escapeHtml(summary.detail)}</span>
          <small>${escapeHtml(timestamp)} · Responsável: ${escapeHtml(actorName(entry.actor_id))}</small>
        </div>
      </li>`;
    }).join("")}</ol>`;
  }

  function render() {
    const expenses = visibleExpenses();
    const summary = calculateExpenseOverview(expenses, related());
    root.innerHTML = `
      <section class="section-band cashflow-section" aria-labelledby="cashflowExpenseFormTitle">
        <div class="cashflow-section-heading"><div><h2 id="cashflowExpenseFormTitle">Registrar despesa geral</h2><p>Registre despesas da empresa sem vínculo com editais. O valor entra uma única vez no resultado gerencial.</p></div></div>
        <form class="form-grid cashflow-expense-form" data-expense-form>
          <label>Quem pagou?<select name="payer_type" required><option value="organization">Empresa</option><option value="participant">Participante financeiro</option><option value="third_party">Terceiro</option></select></label>
          <label class="hidden" data-payer-field="participant">Participante financeiro<select name="participant_payer_id" disabled>${selectOptions(state.participants)}</select></label>
          <label class="hidden" data-payer-field="third_party">Terceiro pagador<select name="third_party_payer_id" disabled>${selectOptions(state.thirdPartyPayers)}</select></label>
          <label>Data do pagamento<input name="paid_on" type="date" value="${escapeHtml(todayInBusinessTimezone())}" required /></label>
          <label>Valor<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0,00" required /></label>
          <label class="cashflow-description-field">Descrição<input name="description" required /></label>
          <div class="button-row"><button class="primary-action" type="submit">Salvar despesa</button></div>
        </form>
        ${state.participants.length ? "" : '<p class="cashflow-inline-note">Para lançar uma despesa paga por participante, cadastre primeiro a pessoa em Dados da Empresa. <button class="quiet-action compact-action" type="button" data-go-company-data>Ir para Dados da Empresa</button></p>'}
        ${state.thirdPartyPayers.length ? "" : '<p class="cashflow-inline-note">Cadastre um terceiro pagador abaixo para usá-lo em uma despesa.</p>'}
      </section>

      <details class="section-band cashflow-section cashflow-third-party-registration">
        <summary><span><strong>Cadastrar terceiro pagador</strong><small>Disponibilize um terceiro para novos lançamentos.</small></span></summary>
        <form class="form-grid" data-third-party-form>
          <label>Nome do terceiro<input name="display_name" required /></label>
          <div class="button-row"><button class="quiet-action" type="submit">Cadastrar terceiro</button></div>
        </form>
      </details>

      <section class="cashflow-metrics" aria-label="Indicadores de despesas">
        <article class="section-band cashflow-metric"><span>Despesas no período</span><strong>${escapeHtml(formatFinanceCurrency(summary.total))}</strong><small>${summary.count} ${summary.count === 1 ? "despesa" : "despesas"}</small></article>
        <article class="section-band cashflow-metric"><span>Pendente de ressarcimento</span><strong>${escapeHtml(formatFinanceCurrency(summary.pending))}</strong><small>Saldo devido a participantes e terceiros</small></article>
      </section>

      <section class="section-band cashflow-section" aria-labelledby="cashflowExpenseListTitle">
        <div class="cashflow-section-heading"><div><h2 id="cashflowExpenseListTitle">Despesas registradas</h2><p>A despesa é contada uma vez; ressarcimentos atualizam apenas o saldo devido e o caixa.</p></div></div>
        <div class="cashflow-filters" role="group" aria-label="Filtros de despesas">
          <label>Responsável pelo pagamento<select data-filter="payerKey">${payerOptions()}</select></label>
          <label>De<input type="date" data-filter="startDate" /></label>
          <label>Até<input type="date" data-filter="endDate" /></label>
          <button class="quiet-action" type="button" data-clear-filters>Limpar filtros</button>
        </div>
        <div class="table-wrap cashflow-table-wrap"><table class="cashflow-table"><thead><tr><th scope="col">Data</th><th scope="col">Despesa</th><th scope="col">Responsável pelo pagamento</th><th scope="col">Valor</th><th scope="col">Ressarcido</th><th scope="col">Pendente</th><th scope="col">Registrado por</th><th scope="col">Ação</th></tr></thead><tbody>${expenseRowsMarkup(expenses)}</tbody></table></div>
      </section>

      <section class="section-band cashflow-section" aria-labelledby="cashflowAuditTitle">
        <div class="cashflow-section-heading"><div><h2 id="cashflowAuditTitle">Histórico auditável</h2><p>Últimas movimentações, com data, operação e responsável autenticado.</p></div></div>
        ${auditMarkup()}
      </section>

      <dialog class="cashflow-dialog" aria-labelledby="cashflowReimbursementTitle" data-reimbursement-dialog>
        <div class="cashflow-dialog-heading"><div><span class="eyebrow">RESSARCIMENTO</span><h2 id="cashflowReimbursementTitle">Registrar pagamento</h2><p data-reimbursement-description></p></div><button class="icon-button modal-close-button" type="button" aria-label="Fechar" data-close-reimbursement><span data-gll-icon="close" aria-hidden="true"></span></button></div>
        <p class="cashflow-dialog-balance">Saldo pendente: <strong data-reimbursement-balance></strong></p>
        <form class="form-grid" data-reimbursement-form>
          <label>Data do pagamento<input name="paid_on" type="date" value="${escapeHtml(todayInBusinessTimezone())}" required /></label>
          <label>Valor<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required /></label>
          <label class="cashflow-description-field">Observação<input name="reason" value="Ressarcimento da despesa" required /></label>
          <p class="form-error cashflow-dialog-error" role="alert" data-reimbursement-error></p>
          <div class="button-row end"><button class="quiet-action" type="button" data-close-reimbursement>Cancelar</button><button class="primary-action" type="submit">Confirmar ressarcimento</button></div>
        </form>
      </dialog>`;
    const payerFilter = root.querySelector('[data-filter="payerKey"]');
    if (payerFilter) payerFilter.value = filters.payerKey;
    for (const field of ["startDate", "endDate"]) {
      const input = root.querySelector(`[data-filter="${field}"]`);
      if (input) input.value = filters[field];
    }
  }

  function updatePayerFields(form) {
    const type = form.elements.namedItem("payer_type")?.value;
    for (const field of form.querySelectorAll("[data-payer-field]")) {
      const isVisible = field.dataset.payerField === type;
      field.classList.toggle("hidden", !isVisible);
      const select = field.querySelector("select");
      select.disabled = !isVisible;
      select.required = isVisible;
    }
  }

  async function load() {
    const currentGeneration = ++generation;
    const client = getClient();
    if (!client) throw new Error("O Financeiro exige uma sessão conectada ao Supabase.");
    if (!isAdmin()) throw new Error("Somente um Administrador da empresa pode consultar despesas financeiras.");
    setStatus("Carregando despesas…");
    const [expenses, participants, thirdParties, adjustments, reimbursements, reversals, auditLog] = await Promise.all([
      readRows(client, "cashflow_expenses", "id,payer_type,participant_payer_id,third_party_payer_id,source_payer_label,paid_on,amount,description,is_historical,historical_reimbursed_amount,created_by,created_at", { orderBy: [["paid_on", false], ["created_at", false]] }),
      readRows(client, "cashflow_participants", "id,display_name", { orderBy: [["display_name", true]] }),
      readRows(client, "cashflow_third_party_payers", "id,display_name", { orderBy: [["display_name", true]] }),
      readRows(client, "cashflow_expense_adjustments", "id,expense_id,amount_delta,reason,created_by,created_at"),
      readRows(client, "cashflow_reimbursements", "id,expense_id,paid_on,amount,reason,created_by,created_at", { orderBy: [["paid_on", false], ["created_at", false]] }),
      readRows(client, "cashflow_reimbursement_reversals", "id,reimbursement_id,amount,reason,created_by,created_at"),
      readRows(client, "cashflow_audit_log", "id,table_name,record_id,operation,new_data,actor_id,occurred_at", { orderBy: [["occurred_at", false]], limit: 100 }),
    ]);
    if (currentGeneration !== generation) return;
    Object.assign(state, { expenses, participants, thirdPartyPayers: thirdParties, adjustments, reimbursements, reversals, auditLog });
    render();
    setStatus("");
  }

  async function refreshAfterMutation(successMessage) {
    try {
      await load();
    } catch (error) {
      setStatus(`${successMessage} A listagem não foi atualizada: ${error.message || "falha de conexão"}.`, "error");
      return;
    }
    setStatus(successMessage, "success");
  }

  async function recordExpense(form) {
    if (!isAdmin()) throw new Error("Somente um Administrador da empresa pode registrar despesas.");
    const draft = Object.fromEntries(new FormData(form));
    const payload = validateGeneralExpenseDraft(draft);
    const service = serviceFor(getClient());
    const idempotencyKey = submissionKeys.getOrCreate(form, "record_expense", payload, () => service.newIdempotencyKey());
    await service.execute("record_expense", payload, idempotencyKey);
    submissionKeys.clear(form);
    form.reset();
    await refreshAfterMutation("Despesa registrada. O saldo devido foi calculado automaticamente.");
  }

  async function recordThirdParty(form) {
    if (!isAdmin()) throw new Error("Somente um Administrador da empresa pode cadastrar pagadores.");
    const displayName = String(new FormData(form).get("display_name") || "").trim();
    if (!displayName) throw new TypeError("Informe o nome do terceiro.");
    const service = serviceFor(getClient());
    const payload = { display_name: displayName };
    const idempotencyKey = submissionKeys.getOrCreate(form, "create_third_party_payer", payload, () => service.newIdempotencyKey());
    await service.execute("create_third_party_payer", payload, idempotencyKey);
    submissionKeys.clear(form);
    form.reset();
    await refreshAfterMutation("Terceiro cadastrado.");
  }

  function openReimbursement(expenseId) {
    const expense = state.expenses.find((candidate) => candidate.id === expenseId);
    if (!expense || expense.payer_type === "organization") return;
    const pending = calculateExpenseBalance(expense, related());
    if (parseMoneyToCents(pending) <= 0n) return;
    activeExpenseId = expense.id;
    const dialog = root.querySelector("[data-reimbursement-dialog]");
    dialog.querySelector("[data-reimbursement-description]").textContent = expense.description;
    dialog.querySelector("[data-reimbursement-balance]").textContent = formatFinanceCurrency(pending);
    dialog.querySelector('[name="amount"]').max = pending;
    dialog.querySelector('[name="amount"]').value = "";
    dialog.querySelector('[name="paid_on"]').value = todayInBusinessTimezone();
    dialog.querySelector('[name="reason"]').value = "Ressarcimento da despesa";
    dialog.querySelector("[data-reimbursement-error]").textContent = "";
    dialog.showModal();
  }

  async function recordReimbursement(form) {
    const expense = state.expenses.find((candidate) => candidate.id === activeExpenseId);
    if (!expense) throw new Error("A despesa selecionada não está mais disponível.");
    const pending = calculateExpenseBalance(expense, related());
    const formData = new FormData(form);
    const amount = validateReimbursementAmount(formData.get("amount"), pending);
    const paidOn = String(formData.get("paid_on") || "");
    const reason = String(formData.get("reason") || "").trim();
    if (!paidOn || !reason) throw new TypeError("Informe a data e a observação do ressarcimento.");
    const service = serviceFor(getClient());
    const payload = {
      expense_id: expense.id,
      amount,
      paid_on: paidOn,
      reason,
    };
    const idempotencyKey = submissionKeys.getOrCreate(form, "reimburse_expense", payload, () => service.newIdempotencyKey());
    await service.execute("reimburse_expense", payload, idempotencyKey);
    submissionKeys.clear(form);
    root.querySelector("[data-reimbursement-dialog]").close();
    activeExpenseId = "";
    await refreshAfterMutation("Ressarcimento registrado. A despesa original permaneceu única no resultado gerencial.");
  }

  root.addEventListener("change", (event) => {
    if (event.target.name === "payer_type" && event.target.form?.matches("[data-expense-form]")) {
      updatePayerFields(event.target.form);
      return;
    }
    const filterName = event.target.dataset.filter;
    if (filterName && Object.hasOwn(filters, filterName)) {
      filters = { ...filters, [filterName]: event.target.value };
      render();
    }
  });

  root.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-reimbursement]");
    if (openButton) {
      openReimbursement(openButton.dataset.openReimbursement);
      return;
    }
    if (event.target.closest("[data-close-reimbursement]")) {
      root.querySelector("[data-reimbursement-dialog]")?.close();
      activeExpenseId = "";
      return;
    }
    if (event.target.closest("[data-clear-filters]")) {
      filters = { payerKey: "", startDate: "", endDate: "" };
      render();
    }
    if (event.target.closest("[data-go-company-data]")) onNavigate("companyData");
  });

  root.addEventListener("submit", async (event) => {
    const form = event.target;
    const dialogError = root.querySelector("[data-reimbursement-error]");
    if (form.matches("[data-reimbursement-form]")) {
      event.preventDefault();
      if (inFlightForms.has(form)) return;
      inFlightForms.add(form);
      const submitButton = form.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      if (dialogError) dialogError.textContent = "";
      try {
        await recordReimbursement(form);
      } catch (error) {
        if (dialogError) dialogError.textContent = error.message || "Não foi possível registrar o ressarcimento.";
      } finally {
        inFlightForms.delete(form);
        if (submitButton?.isConnected) submitButton.disabled = false;
      }
      return;
    }
    if (!form.matches("[data-expense-form]") && !form.matches("[data-third-party-form]")) return;
    event.preventDefault();
    if (inFlightForms.has(form)) return;
    inFlightForms.add(form);
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      setStatus("");
      if (form.matches("[data-expense-form]")) await recordExpense(form);
      else await recordThirdParty(form);
    } catch (error) {
      setStatus(error.message || "Não foi possível salvar a movimentação.", "error");
    } finally {
      inFlightForms.delete(form);
      if (submitButton?.isConnected) submitButton.disabled = false;
    }
  });

  async function showPage() {
    if (!isAdmin()) {
      root.innerHTML = '<div class="section-band" role="alert">Somente Administradores podem acessar o Financeiro.</div>';
      return;
    }
    try {
      await load();
    } catch (error) {
      root.innerHTML = '<div class="section-band cashflow-error" role="alert">Não foi possível carregar as despesas financeiras.</div>';
      setStatus(error.message || "Falha ao carregar dados do Financeiro.", "error");
    }
  }

  function reset() {
    generation += 1;
    activeExpenseId = "";
    filters = { payerKey: "", startDate: "", endDate: "" };
    Object.assign(state, { expenses: [], participants: [], thirdPartyPayers: [], adjustments: [], reimbursements: [], reversals: [], auditLog: [] });
    root.replaceChildren();
    setStatus("");
  }

  return Object.freeze({ showPage, reset, refresh: load });
}
