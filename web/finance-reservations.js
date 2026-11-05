import { createCashflowService } from "./finance-service.js";
import { formatCents, parseMoneyToCents, sumMoney } from "./finance-money.js";
import { createIdempotencyKeyCache } from "./finance-expenses.js";

const ADMIN_ROLE = "Administrador";
const AUDIT_TABLES = new Set(["cashflow_redistributions", "cashflow_withdrawals",
  "cashflow_withdrawal_reversals", "cashflow_receipt_reversals", "cashflow_reserve_adjustments",
  "cashflow_finance_recognition_adjustments"]);

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function formatFinanceCurrency(value) {
  const cents = parseMoneyToCents(String(value));
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(absolute / 100n);
  return `${negative ? "−" : ""}R$ ${whole},${String(absolute % 100n).padStart(2, "0")}`;
}

function validDate(value) {
  const text = String(value || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toISOString().slice(0, 10) === text;
}

function requireReason(reason) {
  const value = String(reason || "").trim();
  if (!value) throw new TypeError("Informe a justificativa para manter o histórico auditável.");
  return value;
}

export function calculateReservationBalance(events, reservationId, participantId) {
  return sumMoney(events.filter((event) => event.reservation_id === reservationId
    && event.participant_id === participantId).map((event) => String(event.amount_signed)));
}

export function calculateParticipantReserveBalance(events, participantId) {
  return sumMoney(events.filter((event) => event.participant_id === participantId)
    .map((event) => String(event.amount_signed)));
}

export function calculateCashAvailable(events) {
  return sumMoney(events.map((event) => String(event.amount_signed)));
}

export function calculateRecognizedProfit(allocations, reversals, adjustments = []) {
  const recognized = allocations.reduce((sum, row) => sum + parseMoneyToCents(String(row.recognized_profit_amount)), 0n);
  const reversed = reversals.reduce((sum, row) => sum + parseMoneyToCents(String(row.recognized_profit_amount)), 0n);
  const adjusted = adjustments.reduce((sum, row) => sum + parseMoneyToCents(String(row.amount_delta)), 0n);
  return formatCents(recognized - reversed + adjusted);
}

export function validateWithdrawalDraft(draft) {
  const amount = formatCents(parseMoneyToCents(String(draft.amount || "")));
  const cents = parseMoneyToCents(amount);
  if (cents <= 0n) throw new RangeError("Informe uma retirada maior que zero.");
  if (!draft.bidId || !draft.reservationId || !draft.participantId) {
    throw new TypeError("A retirada precisa estar vinculada ao edital, à reserva e ao beneficiário.");
  }
  if (!validDate(draft.paidOn)) throw new TypeError("Informe uma data válida para a retirada.");
  if (cents > parseMoneyToCents(String(draft.reservationBalance))) {
    throw new RangeError("O valor excede o saldo reservado disponível deste beneficiário.");
  }
  if (cents > parseMoneyToCents(String(draft.participantBalance))) {
    throw new RangeError("O valor excede o saldo total reservado deste beneficiário.");
  }
  if (cents > parseMoneyToCents(String(draft.recognizedProfitAvailable))) {
    throw new RangeError("O valor excede o lucro reconhecido ainda disponível para esta reserva.");
  }
  if (cents > parseMoneyToCents(String(draft.cashAvailable))) {
    throw new RangeError("O valor excede o caixa disponível após despesas e retiradas anteriores.");
  }
  return Object.freeze({ amount, paid_on: draft.paidOn, reason: requireReason(draft.reason) });
}

export function validateRedistributionDraft(draft) {
  const amount = formatCents(parseMoneyToCents(String(draft.amount || "")));
  const cents = parseMoneyToCents(amount);
  if (cents <= 0n) throw new RangeError("Informe uma redistribuição maior que zero.");
  if (!draft.reservationId || !draft.fromParticipantId || !draft.toParticipantId
      || draft.fromParticipantId === draft.toParticipantId) {
    throw new TypeError("Selecione beneficiários diferentes para a redistribuição.");
  }
  if (cents > parseMoneyToCents(String(draft.sourceBalance))) {
    throw new RangeError("A redistribuição excede o saldo do beneficiário de origem.");
  }
  return Object.freeze({ amount, reason: requireReason(draft.reason) });
}

export function validateReversalAmount(value, outstanding) {
  const amount = formatCents(parseMoneyToCents(String(value || "")));
  const cents = parseMoneyToCents(amount);
  if (cents <= 0n) throw new RangeError("Informe um valor de estorno maior que zero.");
  if (cents > parseMoneyToCents(String(outstanding))) {
    throw new RangeError("O estorno excede o valor ainda não estornado.");
  }
  return amount;
}

function todayInBusinessTimezone() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function asOf(rows, participantId, date) {
  return rows.filter((row) => row.participant_id === participantId && row.effective_on <= date)
    .sort((a, b) => b.effective_on.localeCompare(a.effective_on)
      || String(b.created_at).localeCompare(String(a.created_at)))[0];
}

async function queryRows(client, table, columns, orderBy) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = client.from(table).select(columns);
    if (orderBy) query = query.order(orderBy, { ascending: true }).order("id", { ascending: true });
    const result = await query.range(offset, offset + pageSize - 1);
    if (result?.error) throw new Error(result.error.message || `Não foi possível carregar ${table}.`);
    const page = Array.isArray(result?.data) ? result.data : [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function createCashflowReservationFeature({
  getClient, getUserRole, getUsers = () => [], getBids = () => [], getActorName = () => "",
  getBidLabel = (id) => id, navigate = () => undefined, toast = () => undefined, container, statusElement,
}) {
  const root = container || document.getElementById("financeReservationsRoot");
  const status = statusElement || document.getElementById("financeReservationsStatus");
  const state = {};
  const idempotency = createIdempotencyKeyCache();
  const inFlight = new WeakSet();
  let generation = 0;
  let action = null;
  let selectedBillingBid = "";

  function actorName(id) {
    const supplied = String(getActorName(id) || "").trim();
    if (supplied) return supplied;
    const user = getUsers().find((candidate) => candidate.auth_user_id === id);
    return user?.name || user?.display_name || user?.email || "Usuário";
  }
  function participantName(id) {
    return state.participants.find((row) => row.id === id)?.display_name || "Beneficiário indisponível";
  }
  function bidLabel(id) {
    return String(getBidLabel(id) || id || "Edital indisponível");
  }
  function balance(reservationId, participantId) {
    return calculateReservationBalance(state.reserveEvents, reservationId, participantId);
  }
  function recognizedAvailable(reservationId) {
    const reservation = state.reservations.find((row) => row.id === reservationId);
    if (!reservation) return "0.00";
    const reversed = state.receiptReversals
      .filter((row) => row.receipt_allocation_id === reservation.receipt_allocation_id)
      .reduce((sum, row) => sum + parseMoneyToCents(String(row.recognized_profit_amount)), 0n);
    const adjusted = (state.recognitionAdjustments || [])
      .filter((row) => row.reservation_id === reservationId)
      .reduce((sum, row) => sum + parseMoneyToCents(String(row.amount_delta)), 0n);
    const recognized = parseMoneyToCents(String(reservation.recognized_profit_snapshot)) + adjusted - reversed;
    const withdrawn = state.withdrawals.filter((row) => row.reservation_id === reservationId)
      .reduce((sum, row) => {
        const reversedAmount = state.withdrawalReversals.filter((entry) => entry.withdrawal_id === row.id)
          .reduce((total, entry) => total + parseMoneyToCents(String(entry.amount)), 0n);
        return sum + parseMoneyToCents(String(row.amount)) - reversedAmount;
      }, 0n);
    return formatCents(recognized > withdrawn ? recognized - withdrawn : 0n);
  }
  function eligibleDestinations(sourceId) {
    const date = todayInBusinessTimezone();
    return state.participants.filter((person) => {
      if (person.id === sourceId) return false;
      return asOf(state.profiles, person.id, date)?.distribution_eligible === true
        && asOf(state.participantStatuses, person.id, date)?.is_active === true;
    }).sort((a, b) => a.display_name.localeCompare(b.display_name, "pt-BR"));
  }

  function eligibleBids() {
    return getBids().filter((bid) => ["Em Fornecimento", "Faturado"].includes(bid.status))
      .slice().sort((a, b) => bidLabel(a.id).localeCompare(bidLabel(b.id), "pt-BR"));
  }

  function receiptNavigation() {
    const bids = eligibleBids();
    const selected = bids.some((bid) => String(bid.id) === String(selectedBillingBid)) ? selectedBillingBid : "";
    const options = bids.map((bid) => `<option value="${escapeHtml(bid.id)}" ${String(bid.id) === String(selected) ? "selected" : ""}>${escapeHtml(bidLabel(bid.id))}</option>`).join("");
    return `<section class="section-band cashflow-section" aria-labelledby="cashflowReceiptTitle">
      <div class="cashflow-section-heading"><div><h2 id="cashflowReceiptTitle">Recebimentos e correções</h2>
        <p>Registre recebimentos parciais, ajustes e estornos no Faturamento. Reservas e caixa sincronizam nesta tela.</p></div></div>
      <div class="cashflow-billing-link"><label>Edital<select data-billing-bid><option value="">Selecione</option>${options}</select></label>
        <button class="quiet-action compact-action" type="button" data-open-billing ${selected ? "" : "disabled"}>Abrir Faturamento</button></div>
    </section>`;
  }

  function actionPanel() {
    if (!action) return "";
    let title = "";
    let description = "";
    let fields = "";
    if (action.kind === "withdraw") {
      title = "Registrar retirada";
      description = `${participantName(action.participantId)} · Edital ${bidLabel(action.bidId)} · Reserva ${formatFinanceCurrency(balance(action.reservationId, action.participantId))} · Lucro reconhecido disponível ${formatFinanceCurrency(recognizedAvailable(action.reservationId))} · Caixa ${formatFinanceCurrency(state.cashAvailable)}`;
      fields = `<label>Data da retirada<input name="paid_on" type="date" value="${todayInBusinessTimezone()}" required></label>
        <label>Valor<input name="amount" inputmode="decimal" autocomplete="off" required></label>
        <label class="cashflow-field-wide">Justificativa<input name="reason" maxlength="500" required></label>`;
    } else if (action.kind === "redistribute") {
      title = "Redistribuir reserva";
      description = `${participantName(action.participantId)} · Saldo de origem ${formatFinanceCurrency(balance(action.reservationId, action.participantId))}`;
      const options = eligibleDestinations(action.participantId).map((person) =>
        `<option value="${escapeHtml(person.id)}">${escapeHtml(person.display_name)}</option>`).join("");
      fields = `<label>Beneficiário elegível<select name="to_participant_id" required><option value="">Selecione</option>${options}</select></label>
        <label>Valor<input name="amount" inputmode="decimal" autocomplete="off" required></label>
        <label class="cashflow-field-wide">Justificativa<input name="reason" maxlength="500" required></label>`;
    } else if (action.kind === "reverse_withdrawal") {
      title = "Estornar retirada";
      description = `${participantName(action.participantId)} · Edital ${bidLabel(action.bidId)} · Saldo não estornado ${formatFinanceCurrency(action.outstanding)}`;
      fields = `<label>Data do estorno<input name="reversed_on" type="date" value="${todayInBusinessTimezone()}" required></label>
        <label>Valor<input name="amount" inputmode="decimal" value="${escapeHtml(action.outstanding)}" required></label>
        <label class="cashflow-field-wide">Motivo do estorno<input name="reason" maxlength="500" required></label>`;
    }
    return `<section class="section-band cashflow-section cashflow-action-panel" aria-labelledby="cashflowActionTitle">
      <div class="cashflow-section-heading"><div><h2 id="cashflowActionTitle" tabindex="-1">${title}</h2><p>${escapeHtml(description)}</p></div>
        <button class="quiet-action compact-action" type="button" data-cancel-reservation-action>Cancelar</button></div>
      <form class="form-grid cashflow-reservation-form" data-reservation-action-form>${fields}
        <p class="cashflow-action-error form-error hidden" role="alert"></p>
        <div class="button-row end cashflow-field-wide"><button class="primary-action" type="submit">Confirmar registro</button></div>
      </form></section>`;
  }

  function reservationRows() {
    if (!state.reservationAllocations.length) return '<tr><td class="cashflow-table-empty" colspan="8">Nenhuma reserva de lucro reconhecido foi encontrada.</td></tr>';
    return state.reservationAllocations.map((allocation) => {
      const reservation = state.reservations.find((row) => row.id === allocation.reservation_id);
      if (!reservation) return "";
      const receiptAllocation = state.receiptAllocations.find((row) => row.id === reservation.receipt_allocation_id);
      const receipt = state.receipts.find((row) => row.id === receiptAllocation?.receipt_id);
      const target = state.targets.find((row) => row.id === receiptAllocation?.profit_target_id);
      const available = balance(reservation.id, allocation.participant_id);
      const recognitionDelta = (state.recognitionAdjustments || [])
        .filter((row) => row.reservation_id === reservation.id)
        .reduce((sum, row) => sum + parseMoneyToCents(String(row.amount_delta)), 0n);
      const recognized = formatCents(parseMoneyToCents(String(reservation.recognized_profit_snapshot)) + recognitionDelta);
      const controls = parseMoneyToCents(available) > 0n
        ? `<button class="quiet-action compact-action" type="button" data-reservation-action="withdraw" data-reservation-id="${escapeHtml(reservation.id)}" data-participant-id="${escapeHtml(allocation.participant_id)}" data-bid-id="${escapeHtml(target?.bid_id || "")}">Retirar</button>
          <button class="quiet-action compact-action" type="button" data-reservation-action="redistribute" data-reservation-id="${escapeHtml(reservation.id)}" data-participant-id="${escapeHtml(allocation.participant_id)}">Redistribuir</button>`
        : '<span class="cashflow-settled">Sem saldo</span>';
      return `<tr><td><strong>${escapeHtml(bidLabel(target?.bid_id || receipt?.bid_id))}</strong><small>Recebido em ${escapeHtml(receipt?.received_on || "—")}</small></td>
        <td>${escapeHtml(participantName(allocation.participant_id))}</td><td class="cashflow-money">${escapeHtml(allocation.percentage_snapshot)}%</td>
        <td class="cashflow-money">${escapeHtml(formatFinanceCurrency(recognized))}</td>
        <td class="cashflow-money">${escapeHtml(formatFinanceCurrency(allocation.amount))}</td><td class="cashflow-money"><strong>${escapeHtml(formatFinanceCurrency(available))}</strong></td>
        <td>${escapeHtml(actorName(reservation.created_by))}</td><td>${controls}</td></tr>`;
    }).join("");
  }

  function receiptRows() {
    if (!state.receiptAllocations.length) return '<tr><td class="cashflow-table-empty" colspan="6">Nenhum recebimento reconhecido.</td></tr>';
    return state.receiptAllocations.map((allocation) => {
      const receipt = state.receipts.find((row) => row.id === allocation.receipt_id);
      const target = state.targets.find((row) => row.id === allocation.profit_target_id);
      const item = state.items.find((row) => String(row.id) === String(target?.item_id));
      const reversed = sumMoney(state.receiptReversals.filter((row) => row.receipt_allocation_id === allocation.id).map((row) => String(row.amount)));
      const controls = `<button class="quiet-action compact-action" type="button" data-open-billing-bid="${escapeHtml(receipt?.bid_id || "")}">Abrir Faturamento</button>`;
      return `<tr><td>${escapeHtml(bidLabel(receipt?.bid_id))}</td><td>${escapeHtml(receipt?.received_on || "—")}</td>
        <td>${escapeHtml(item?.item_number || target?.item_id || "—")}</td><td class="cashflow-money">${escapeHtml(formatFinanceCurrency(allocation.recognized_profit_amount))}</td>
        <td class="cashflow-money">${escapeHtml(formatFinanceCurrency(reversed))}</td><td>${controls}</td></tr>`;
    }).join("");
  }

  function withdrawalRows() {
    if (!state.withdrawals.length) return '<tr><td class="cashflow-table-empty" colspan="7">Nenhuma retirada foi registrada.</td></tr>';
    return state.withdrawals.map((withdrawal) => {
      const reversed = sumMoney(state.withdrawalReversals.filter((row) => row.withdrawal_id === withdrawal.id)
        .map((row) => String(row.amount)));
      const outstanding = formatCents(parseMoneyToCents(String(withdrawal.amount)) - parseMoneyToCents(reversed));
      const controls = parseMoneyToCents(outstanding) > 0n
        ? '<button class="quiet-action compact-action" type="button" data-reservation-action="reverse_withdrawal" data-withdrawal-id="' + escapeHtml(withdrawal.id)
          + '" data-participant-id="' + escapeHtml(withdrawal.participant_id) + '" data-bid-id="' + escapeHtml(withdrawal.bid_id)
          + '" data-outstanding="' + escapeHtml(outstanding) + '">Estornar retirada</button>'
        : '<span class="cashflow-settled">Estornada</span>';
      return '<tr><td>' + escapeHtml(bidLabel(withdrawal.bid_id)) + '</td><td>' + escapeHtml(participantName(withdrawal.participant_id))
        + '</td><td>' + escapeHtml(withdrawal.paid_on) + '</td><td class="cashflow-money">' + escapeHtml(formatFinanceCurrency(withdrawal.amount))
        + '</td><td class="cashflow-money">' + escapeHtml(formatFinanceCurrency(reversed)) + '</td><td>' + escapeHtml(actorName(withdrawal.created_by))
        + '</td><td>' + controls + '</td></tr>';
    }).join("");
  }

  function auditRows() {
    const labels = { cashflow_redistributions: "Redistribuição", cashflow_withdrawals: "Retirada",
      cashflow_withdrawal_reversals: "Estorno de retirada", cashflow_receipt_reversals: "Estorno de recebimento",
      cashflow_reserve_adjustments: "Ajuste de reserva",
      cashflow_finance_recognition_adjustments: "Correção de lucro reconhecido" };
    const entries = state.audit.filter((row) => AUDIT_TABLES.has(row.table_name))
      .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at))).slice(0, 30);
    if (!entries.length) return '<tr><td class="cashflow-table-empty" colspan="5">As movimentações aparecerão aqui.</td></tr>';
    return entries.map((entry) => {
      const row = entry.new_data || {};
      const value = row.amount ?? row.amount_delta ?? row.recognized_profit_amount;
      const amount = value == null ? "—" : formatFinanceCurrency(String(value));
      const relatedWithdrawal = row.withdrawal_id
        ? state.withdrawals.find((withdrawal) => withdrawal.id === row.withdrawal_id) : null;
      const relatedReceiptAllocation = row.receipt_allocation_id
        ? state.receiptAllocations.find((allocation) => allocation.id === row.receipt_allocation_id) : null;
      const relatedReceipt = relatedReceiptAllocation
        ? state.receipts.find((receipt) => receipt.id === relatedReceiptAllocation.receipt_id) : null;
      const reference = row.bid_id ? bidLabel(row.bid_id)
        : relatedWithdrawal ? bidLabel(relatedWithdrawal.bid_id)
          : relatedReceipt ? bidLabel(relatedReceipt.bid_id)
            : row.from_participant_id && row.to_participant_id
              ? participantName(row.from_participant_id) + " → " + participantName(row.to_participant_id)
              : row.participant_id ? participantName(row.participant_id) : "—";
      return `<tr><td>${escapeHtml(labels[entry.table_name])}</td><td>${escapeHtml(reference)}</td>
        <td class="cashflow-money">${escapeHtml(amount)}</td><td>${escapeHtml(row.reason || "—")}</td>
        <td>${escapeHtml(new Date(entry.occurred_at).toLocaleString("pt-BR"))}<small>${escapeHtml(actorName(entry.actor_id))}</small></td></tr>`;
    }).join("");
  }

  function render() {
    if (!root) return;
    const reserved = sumMoney(state.participants.map((person) =>
      calculateParticipantReserveBalance(state.reserveEvents, person.id)));
    const recognized = calculateRecognizedProfit(state.receiptAllocations, state.receiptReversals,
      state.recognitionAdjustments || []);
    root.innerHTML = `<section class="cashflow-reservation-overview" aria-label="Resumo de reservas e retiradas">
      <article><span>Lucro reconhecido</span><strong>${escapeHtml(formatFinanceCurrency(recognized))}</strong></article>
      <article><span>Saldo reservado</span><strong>${escapeHtml(formatFinanceCurrency(reserved))}</strong></article>
      <article><span>Caixa disponível</span><strong>${escapeHtml(formatFinanceCurrency(state.cashAvailable))}</strong></article></section>
      ${receiptNavigation()}
      ${actionPanel()}
      <section class="section-band cashflow-section" aria-labelledby="cashflowReservationsTitle">
        <div class="cashflow-section-heading"><div><h2 id="cashflowReservationsTitle">Reservas por edital e beneficiário</h2>
        <p>O reconhecimento reserva automaticamente os percentuais vigentes no recebimento. Reserva não transfere nem saca dinheiro.</p></div></div>
        <div class="cashflow-table-wrap"><table class="cashflow-table cashflow-reservation-table"><thead><tr>
          <th>Edital</th><th>Beneficiário</th><th>Percentual</th><th>Lucro reconhecido</th><th>Reserva original</th><th>Saldo reservado</th><th>Responsável</th><th>Ações</th>
        </tr></thead><tbody>${reservationRows()}</tbody></table></div></section>
      <section class="section-band cashflow-section" aria-labelledby="cashflowRecognizedTitle">
        <div class="cashflow-section-heading"><div><h2 id="cashflowRecognizedTitle">Recebimentos reconhecidos</h2><p>Estornos preservam o histórico e não podem reduzir uma reserva abaixo de zero.</p></div></div>
        <div class="cashflow-table-wrap"><table class="cashflow-table cashflow-receipt-table"><thead><tr><th>Edital</th><th>Data</th><th>Item</th><th>Lucro reconhecido</th><th>Valor estornado</th><th>Ações</th></tr></thead><tbody>${receiptRows()}</tbody></table></div></section>
      <section class="section-band cashflow-section" aria-labelledby="cashflowWithdrawalsTitle">
        <div class="cashflow-section-heading"><div><h2 id="cashflowWithdrawalsTitle">Retiradas registradas</h2><p>Cada lançamento identifica edital, beneficiário, data, valor e responsável. Estornos também ficam auditados.</p></div></div>
        <div class="cashflow-table-wrap"><table class="cashflow-table cashflow-withdrawal-table"><thead><tr><th>Edital</th><th>Beneficiário</th><th>Data</th><th>Valor</th><th>Valor estornado</th><th>Responsável</th><th>Ações</th></tr></thead><tbody>${withdrawalRows()}</tbody></table></div></section>
      <section class="section-band cashflow-section" aria-labelledby="cashflowAuditTitle">
        <div class="cashflow-section-heading"><div><h2 id="cashflowAuditTitle">Histórico auditável</h2><p>Redistribuições, retiradas e estornos preservam seus registros anteriores.</p></div></div>
        <div class="cashflow-table-wrap"><table class="cashflow-table cashflow-audit-table"><thead><tr><th>Movimentação</th><th>Referência</th><th>Valor</th><th>Justificativa</th><th>Data e responsável</th></tr></thead><tbody>${auditRows()}</tbody></table></div></section>`;
  }

  async function load(client) {
    const tables = [
      ["reservations", "cashflow_reservations", "id,receipt_allocation_id,recognized_profit_snapshot,reserved_on,created_by", "reserved_on"],
      ["reservationAllocations", "cashflow_reservation_allocations", "reservation_id,participant_id,percentage_snapshot,amount", "created_at"],
      ["reserveEvents", "cashflow_reservation_events", "reservation_id,participant_id,event_type,amount_signed,source_id,reason,created_at,created_by", "created_at"],
      ["receiptAllocations", "cashflow_receipt_allocations", "id,receipt_id,profit_target_id,amount,recognized_profit_amount", "created_at"],
      ["receiptReversals", "cashflow_receipt_reversals", "receipt_allocation_id,amount,recognized_profit_amount", "created_at"],
      ["recognitionAdjustments", "cashflow_finance_recognition_adjustments", "id,reservation_id,amount_delta,reason,created_at,created_by", "created_at"],
      ["receipts", "cashflow_receipts", "id,bid_id,received_on,created_by", "received_on"],
      ["targets", "cashflow_item_profit_targets", "id,bid_id,item_id,receivable_base,expected_profit", "created_at"],
      ["items", "items", "id,item_number", "item_number"],
      ["participants", "cashflow_participants", "id,display_name", "display_name"],
      ["profiles", "cashflow_participant_profile_versions", "participant_id,distribution_eligible,effective_on,created_at", "effective_on"],
      ["participantStatuses", "cashflow_participant_status_events", "participant_id,is_active,effective_on,created_at", "effective_on"],
      ["withdrawals", "cashflow_withdrawals", "id,reservation_id,bid_id,participant_id,amount,paid_on,reason,created_by", "paid_on"],
      ["withdrawalReversals", "cashflow_withdrawal_reversals", "withdrawal_id,amount", "created_at"],
      ["cashEvents", "cashflow_cash_events", "amount_signed,event_type,occurred_on", "occurred_on"],
      ["audit", "cashflow_audit_log", "table_name,record_id,new_data,actor_id,occurred_at", "occurred_at"],
    ];
    const results = await Promise.all(tables.map(([, table, columns, order]) => queryRows(client, table, columns, order)));
    tables.forEach(([key], index) => { state[key] = results[index]; });
    state.cashAvailable = calculateCashAvailable(state.cashEvents);
  }

  async function submit(form) {
    if (inFlight.has(form)) return;
    const button = form.querySelector('[type="submit"]');
    const error = form.querySelector(".cashflow-action-error");
    const values = Object.fromEntries(new FormData(form).entries());
    const current = action;
    try {
      let command;
      let payload;
      if (current.kind === "withdraw") {
        const checked = validateWithdrawalDraft({ amount: values.amount, paidOn: values.paid_on, reason: values.reason,
          bidId: current.bidId, reservationId: current.reservationId, participantId: current.participantId,
          reservationBalance: balance(current.reservationId, current.participantId),
          participantBalance: calculateParticipantReserveBalance(state.reserveEvents, current.participantId),
          recognizedProfitAvailable: recognizedAvailable(current.reservationId),
          cashAvailable: state.cashAvailable });
        command = "withdraw_by_bid";
        payload = { reservation_id: current.reservationId, participant_id: current.participantId, bid_id: current.bidId, ...checked };
      } else if (current.kind === "redistribute") {
        const checked = validateRedistributionDraft({ amount: values.amount, reason: values.reason,
          reservationId: current.reservationId, fromParticipantId: current.participantId,
          toParticipantId: values.to_participant_id, sourceBalance: balance(current.reservationId, current.participantId) });
        command = "redistribute_reservation";
        payload = { reservation_id: current.reservationId, from_participant_id: current.participantId,
          to_participant_id: values.to_participant_id, ...checked };
      } else {
        const amount = validateReversalAmount(values.amount, current.outstanding);
        if (!validDate(values.reversed_on)) throw new TypeError("Informe uma data válida para o estorno.");
        const reason = requireReason(values.reason);
        command = "reverse_withdrawal";
        payload = { withdrawal_id: current.sourceId, amount, reversed_on: values.reversed_on, reason };
      }
      inFlight.add(form);
      button.disabled = true;
      const service = createCashflowService(getClient(), { getUserRole });
      const key = idempotency.getOrCreate(form, command, payload, () => service.newIdempotencyKey());
      await service.execute(command, payload, key);
      idempotency.clear(form);
      action = null;
      await showPage();
      status.textContent = "Movimentação registrada com sucesso.";
      toast("Movimentação do Fluxo de Caixa registrada.", "success");
    } catch (cause) {
      error.textContent = cause.message || "Não foi possível registrar a movimentação.";
      error.classList.remove("hidden");
      status.textContent = error.textContent;
      status.classList.add("form-error");
    } finally {
      inFlight.delete(form);
      if (button.isConnected) button.disabled = false;
    }
  }

  root?.addEventListener("click", (event) => {
    const billing = event.target.closest("[data-open-billing]");
    const billingBid = event.target.closest("[data-open-billing-bid]");
    if (billing || billingBid) {
      const bidId = billingBid?.dataset.openBillingBid || selectedBillingBid;
      if (bidId) navigate("billing", bidId);
      return;
    }
    if (event.target.closest("[data-cancel-reservation-action]")) { action = null; render(); return; }
    const button = event.target.closest("[data-reservation-action]");
    if (!button) return;
    action = {
      kind: button.dataset.reservationAction, reservationId: button.dataset.reservationId || "",
      participantId: button.dataset.participantId || "", bidId: button.dataset.bidId || "",
      sourceId: button.dataset.withdrawalId || button.dataset.allocationId || "",
      outstanding: button.dataset.outstanding || "", recognizedProfit: button.dataset.recognizedProfit || "0.00",
    };
    render();
  });
  root?.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-reservation-action-form]");
    if (!form) return;
    event.preventDefault();
    void submit(form);
  });
  root?.addEventListener("change", (event) => {
    const select = event.target.closest("[data-billing-bid]");
    if (!select) return;
    selectedBillingBid = select.value;
    render();
  });

  async function showPage() {
    const current = ++generation;
    if (!root || !status) return;
    if (getUserRole() !== ADMIN_ROLE) {
      root.innerHTML = '<p class="empty-state">Somente administradores podem consultar reservas e retiradas.</p>';
      return;
    }
    const client = getClient();
    if (!client) { root.innerHTML = ""; status.textContent = "Entre novamente para consultar o Fluxo de Caixa."; return; }
    status.textContent = "Carregando reservas e movimentações...";
    status.classList.remove("form-error");
    await load(client);
    if (current !== generation) return;
    render();
    status.textContent = "";
  }

  return Object.freeze({
    showPage,
    reset() {
      generation += 1;
      action = null;
      for (const key of Object.keys(state)) delete state[key];
      if (root) root.innerHTML = "";
      if (status) { status.textContent = ""; status.classList.remove("form-error"); }
    },
  });
}
