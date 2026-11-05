import { calculateItemObjective, calculateRecognizedProfitDelta, formatCents, parseMoneyToCents } from "./finance-money.js";

export const FINANCE_ELIGIBLE_BID_STATUSES = Object.freeze(["Em Fornecimento", "Faturado"]);

const eligibleStatuses = new Set(FINANCE_ELIGIBLE_BID_STATUSES);
const dateFormatter = new Intl.DateTimeFormat("pt-BR");

function decimalText(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Informe um valor financeiro válido.");
    return String(value);
  }
  return String(value ?? "").trim();
}

export function financeMoney(value) {
  const cents = financeCents(value);
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(absolute / 100n);
  return `${negative ? "−" : ""}R$ ${whole},${String(absolute % 100n).padStart(2, "0")}`;
}

export function financeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function financeCents(value) {
  return parseMoneyToCents(decimalText(value));
}

export function calculateObjectiveProfit({ quantity, supplierCost, finalBid }) {
  return calculateItemObjective({
    quantity: String(quantity), supplierCost: String(supplierCost), unitPrice: String(finalBid),
  }).expectedProfit;
}

export function calculateRecognizedProfit(expectedProfit, receivedAmount, contractAmount) {
  const amount = decimalText(receivedAmount);
  if (financeCents(contractAmount) <= 0n || financeCents(amount) === 0n) return "0.00";
  return calculateRecognizedProfitDelta({
    expectedProfit: decimalText(expectedProfit), receivableBase: decimalText(contractAmount),
    receivedBefore: "0.00", receiptAmount: amount,
  });
}

export function buildFinanceAllocations(rows, readAmount) {
  return rows.map((row) => {
    const cents = financeCents(readAmount(row));
    if (cents < 0n) throw new RangeError("O valor recebido não pode ser negativo.");
    return { profit_item_id: row.profit_item_id, amount: formatCents(cents) };
  }).filter((row) => financeCents(row.amount) > 0n);
}

export function financeReceiptAllocationTotal(allocations) {
  return allocations.reduce((sum, allocation) => sum + financeCents(allocation.amount), 0n);
}

export function financeReceiptNetAmount(receipt, allocations, adjustments) {
  const linkedAllocations = allocations.filter((allocation) => String(allocation.receipt_id) === String(receipt.id));
  if (linkedAllocations.length) {
    const cents = linkedAllocations.reduce((total, allocation) => {
      const changes = adjustments.filter((adjustment) => String(adjustment.receipt_allocation_id) === String(allocation.id));
      return total + financeCents(allocation.amount) + changes.reduce((sum, change) => sum + financeCents(change.amount_delta), 0n);
    }, 0n);
    return formatCents(cents);
  }
  const changes = adjustments.filter((adjustment) => String(adjustment.receipt_id) === String(receipt.id) && !adjustment.receipt_allocation_id);
  return formatCents(financeCents(receipt.amount)
    + changes.reduce((sum, change) => sum + financeCents(change.amount_delta), 0n));
}

function assertQuery(result) {
  if (result?.error) throw new Error(result.error.message || "Não foi possível consultar o razão financeiro.");
  return result?.data ?? null;
}

export function createFinanceLedgerService(getClient) {
  function client() {
    const current = getClient?.();
    if (!current) throw new Error("O Fluxo de Caixa exige uma sessão conectada ao Supabase.");
    return current;
  }

  async function rpc(name, args) {
    return assertQuery(await client().rpc(name, args));
  }

  async function command(name, payload) {
    return rpc("finance_cashflow_execute", { p_command: name, p_payload: payload });
  }

  async function query(table, filterColumn, filterValue, orderColumn = null) {
    let request = client().from(table).select("*").eq(filterColumn, filterValue);
    if (orderColumn) request = request.order(orderColumn, { ascending: false });
    return assertQuery(await request) || [];
  }

  return Object.freeze({
    syncBid(bidId) {
      return command("sync_bid", { bid_id: String(bidId) });
    },
    registerReceipt({ bidId, receivedOn, allocations, requestId, sourceReference = "" }) {
      return command("register_receipt", {
        bid_id: String(bidId), received_on: receivedOn, allocations,
        request_id: requestId, source_reference: sourceReference || null,
      });
    },
    adjustProfit({ profitItemId, expectedProfit, reason, requestId }) {
      return command("adjust_profit", {
        profit_item_id: profitItemId, expected_profit: expectedProfit,
        reason, request_id: requestId,
      });
    },
    adjustRecognizedProfit({ profitItemId, recognizedProfit, reason, requestId }) {
      return command("adjust_recognized_profit", {
        profit_item_id: profitItemId, recognized_profit: recognizedProfit,
        reason, request_id: requestId,
      });
    },
    allocateExistingReceipt({ receiptId, allocations, reason, requestId }) {
      return command("allocate_existing_receipt", {
        receipt_id: receiptId, allocations, reason, request_id: requestId,
      });
    },
    adjustLegacyReceipt({ receiptId, amountDelta, reason, requestId }) {
      return command("adjust_legacy_receipt", {
        receipt_id: receiptId, amount_delta: amountDelta, reason, request_id: requestId,
      });
    },
    adjustReceipt({ receiptAllocationId, amountDelta, reason, requestId }) {
      return command("adjust_receipt", {
        receipt_allocation_id: receiptAllocationId, amount_delta: amountDelta,
        reason, request_id: requestId,
      });
    },
    reverseReceipt({ receiptId, requestId, reason }) {
      return command("reverse_receipt", {
        receipt_id: receiptId, request_id: requestId, reason,
      });
    },
    async listBidLedgers() {
      const rows = assertQuery(await client().from("finance_bid_ledger").select("*").order("edital_number")) || [];
      return rows;
    },
    async loadBidLedger(bidId) {
      const matches = assertQuery(await client().from("finance_bid_ledger").select("*").eq("bid_id", String(bidId))) || [];
      const summary = matches.find((row) => !row.cancelled_at) || matches[0] || null;
      if (!summary) return null;
      const [items, receipts, profitAdjustments, recognitionAdjustments, receiptAllocations, receiptAdjustments] = await Promise.all([
        query("finance_bid_item_ledger", "bid_profit_id", summary.bid_profit_id),
        query("finance_receipts", "bid_profit_id", summary.bid_profit_id, "received_on"),
        query("finance_profit_adjustments", "bid_profit_id", summary.bid_profit_id, "created_at"),
        query("finance_recognition_adjustments", "bid_profit_id", summary.bid_profit_id, "created_at"),
        query("finance_receipt_allocations", "bid_profit_id", summary.bid_profit_id, "created_at"),
        query("finance_receipt_adjustments", "bid_profit_id", summary.bid_profit_id, "created_at"),
      ]);
      return { summary, items, receipts, profitAdjustments, recognitionAdjustments, receiptAllocations, receiptAdjustments };
    },
  });
}

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function dateLabel(value) {
  if (!value) return "Data não informada";
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? String(value) : dateFormatter.format(parsed);
}

function requestId(form) {
  form.dataset.requestId ||= crypto.randomUUID();
  return form.dataset.requestId;
}

function formError(form, message) {
  const node = form.querySelector("[data-finance-error]");
  if (node) node.textContent = message || "";
}

function allocationTotalMatches(allocations, expected) {
  return financeReceiptAllocationTotal(allocations) === financeCents(expected);
}

function adjustmentsForAllocation(allocation, adjustments) {
  return adjustments.filter((adjustment) => String(adjustment.receipt_allocation_id) === String(allocation.id));
}

function renderProfitAdjustment(item, enabled) {
  if (!enabled) return "";
  const objective = financeCents(item.received_amount) === 0n
    ? `<details class="finance-adjustment"><summary>Corrigir lucro objetivo</summary><form data-finance-profit-form data-profit-item-id="${escape(item.profit_item_id)}">
    <label>Lucro objetivo ajustado (R$)<input name="expected_profit" type="number" step="0.01" value="${escape(item.expected_profit)}" required /></label>
    <label>Justificativa<textarea name="reason" rows="2" minlength="5" maxlength="1000" required></textarea></label>
    <p class="finance-error" data-finance-error role="alert"></p><button class="quiet-action compact-action" type="submit">Registrar ajuste</button>
  </form></details>`
    : `<small class="finance-adjustment-locked">Lucro objetivo bloqueado após o primeiro recebimento.</small>`;
  const recognized = financeCents(item.received_amount) > 0n
    ? `<details class="finance-adjustment"><summary>Corrigir lucro reconhecido</summary><form data-finance-recognized-profit-form data-profit-item-id="${escape(item.profit_item_id)}">
    <p class="finance-help">A correção será aplicada ao recebimento mais recente do item, com os percentuais vigentes registrados nele.</p>
    <label>Lucro reconhecido ajustado (R$)<input name="recognized_profit" type="number" step="0.01" value="${escape(item.recognized_profit)}" required /></label>
    <label>Justificativa<textarea name="reason" rows="2" minlength="5" maxlength="1000" required></textarea></label>
    <p class="finance-error" data-finance-error role="alert"></p><button class="quiet-action compact-action" type="submit">Registrar correção</button>
  </form></details>` : "";
  return `<div class="finance-item-adjustments">${objective}${recognized}</div>`;
}

function renderItemsTable(data, canCreate) {
  if (!data.items.length) return `<p class="finance-empty">Nenhum item vencedor do orçamento foi consolidado para este edital.</p>`;
  const rows = data.items.map((item) => `<tr>
    <td><strong>Item ${escape(item.budget_item_number)}</strong><span>${escape(item.budget_description || "Sem descrição")}</span></td>
    <td class="numeric">${financeNumber(item.budget_quantity).toLocaleString("pt-BR")}</td>
    <td class="numeric">${financeMoney(item.expected_profit)}</td>
    <td class="numeric">${financeMoney(item.due_amount)}</td>
    <td class="numeric">${financeMoney(item.received_amount)}</td>
    <td class="numeric"><strong>${financeMoney(item.recognized_profit)}</strong></td>
    <td class="numeric">${financeMoney(item.outstanding_amount)}</td>
    <td>${renderProfitAdjustment(item, canCreate)}</td>
  </tr>`).join("");
  return `<div class="table-wrap finance-table-wrap"><table class="finance-table"><thead><tr><th>Item do orçamento</th><th>Qtd.</th><th>Lucro objetivo</th><th>Faturado</th><th>Recebido</th><th>Lucro reconhecido</th><th>A receber</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderReceiptForm(data, enabled) {
  if (!enabled || !data.items.length) return "";
  const available = data.items.filter((item) => financeCents(item.outstanding_amount) > 0n);
  if (!available.length) return `<p class="finance-empty">Não há saldo faturado disponível para novos recebimentos.</p>`;
  const fields = available.map((item) => `<label class="finance-allocation-field"><span>Item ${escape(item.budget_item_number)} · ${escape(item.budget_description || "Sem descrição")}<small>Saldo: ${financeMoney(item.outstanding_amount)}</small></span><input data-receipt-item="${escape(item.profit_item_id)}" type="number" min="0" max="${escape(item.outstanding_amount)}" step="0.01" value="0" aria-label="Valor recebido do item ${escape(item.budget_item_number)}" /></label>`).join("");
  return `<details class="finance-action-section" open><summary>Registrar recebimento do órgão</summary><form data-finance-receipt-form>
    <div class="finance-form-grid"><label>Data do recebimento<input name="received_on" type="date" value="${new Date().toISOString().slice(0, 10)}" required /></label><label>Referência / documento do órgão<input name="source_reference" type="text" maxlength="120" placeholder="Opcional" /></label></div>
    <div class="finance-allocation-list">${fields}</div><div class="finance-form-actions"><button class="quiet-action compact-action" type="button" data-finance-fill-remaining>Preencher saldos faturados</button><button class="primary-action compact-action" type="submit">Registrar recebimento</button></div>
    <p class="finance-error" data-finance-error role="alert"></p></form></details>`;
}

function renderLegacyAllocationForm(receipt, data) {
  const amount = financeReceiptNetAmount(receipt, data.receiptAllocations, data.receiptAdjustments);
  const available = data.items.filter((item) => financeCents(item.due_amount) - financeCents(item.received_amount) > 0n);
  if (!available.length) return `<p class="finance-error">Não há saldo faturado nos itens para vincular este recebimento legado.</p>`;
  return `<details class="finance-action-section"><summary>Vincular aos itens · total ${financeMoney(amount)}</summary><form data-finance-legacy-allocation-form data-receipt-id="${escape(receipt.id)}" data-legacy-total="${escape(amount)}">
    <p class="finance-help">A soma dos itens deve ser igual ao recebimento líquido legado de ${financeMoney(amount)}. Os valores continuam no histórico original.</p>
    <div class="finance-allocation-list">${available.map((item) => {
      const capacity = formatCents(financeCents(item.due_amount) - financeCents(item.received_amount));
      return `<label class="finance-allocation-field"><span>Item ${escape(item.budget_item_number)} · ${escape(item.budget_description || "Sem descrição")}<small>Saldo: ${financeMoney(capacity)}</small></span><input data-legacy-allocation-item="${escape(item.profit_item_id)}" type="number" min="0" max="${escape(capacity)}" step="0.01" value="0" aria-label="Valor a vincular ao item ${escape(item.budget_item_number)}" /></label>`;
    }).join("")}</div>
    <label>Justificativa do vínculo<textarea name="reason" rows="2" minlength="5" maxlength="1000" required></textarea></label><div class="finance-form-actions"><button class="quiet-action compact-action" type="button" data-finance-fill-legacy="${escape(amount)}">Distribuir saldo legado</button><button class="primary-action compact-action" type="submit">Vincular recebimento</button></div>
    <p class="finance-error" data-finance-error role="alert"></p></form></details>`;
}

function renderLegacyReceiptCorrection(receipt, data) {
  const current = financeReceiptNetAmount(receipt, data.receiptAllocations, data.receiptAdjustments);
  return `<form class="finance-inline-adjust" data-finance-legacy-receipt-adjust-form data-receipt-id="${escape(receipt.id)}">
    <label>Correção (R$)<input name="amount_delta" type="number" step="0.01" placeholder="Ex.: -10,00" required /></label>
    <label>Justificativa<textarea name="reason" rows="2" minlength="5" maxlength="1000" required></textarea></label>
    <small>Saldo legado atual: ${financeMoney(current)}</small><p class="finance-error" data-finance-error role="alert"></p><button class="quiet-action compact-action" type="submit">Corrigir recebimento legado</button>
  </form>`;
}

function renderAllocationCorrection(allocation, data, canCorrect) {
  const item = data.items.find((row) => String(row.profit_item_id) === String(allocation.profit_item_id));
  const changes = adjustmentsForAllocation(allocation, data.receiptAdjustments);
  const current = formatCents(financeCents(allocation.amount)
    + changes.reduce((sum, change) => sum + financeCents(change.amount_delta), 0n));
  return `<div class="finance-receipt-allocation"><div><strong>Item ${escape(item?.budget_item_number ?? "—")}</strong><span>${escape(item?.budget_description || "Item do orçamento")}</span></div><strong>${financeMoney(current)}</strong>${canCorrect ? `<form data-finance-receipt-adjust-form data-receipt-allocation-id="${escape(allocation.id)}">
    <label>Correção (R$)<input name="amount_delta" type="number" step="0.01" placeholder="Ex.: -10,00" required /></label><label>Justificativa<textarea name="reason" rows="2" minlength="5" maxlength="1000" required></textarea></label>
    <p class="finance-error" data-finance-error role="alert"></p><button class="quiet-action compact-action" type="submit">Corrigir valor do item</button></form>` : `<small>Estornado; para registrar novamente, crie um novo recebimento.</small>`}</div>`;
}

function renderReceiptHistory(data, canCreate, canCorrect) {
  if (!data.receipts.length) return `<p class="finance-empty">Nenhum recebimento registrado para este edital.</p>`;
  return data.receipts.map((receipt) => {
    const allocations = data.receiptAllocations.filter((allocation) => String(allocation.receipt_id) === String(receipt.id));
    const receiptAdjustments = data.receiptAdjustments.filter((adjustment) => String(adjustment.receipt_id) === String(receipt.id));
    const net = financeReceiptNetAmount(receipt, data.receiptAllocations, data.receiptAdjustments);
    const legacy = !receipt.client_request_id && !allocations.length;
    const receiptReversed = receiptAdjustments.some((adjustment) => adjustment.event_kind === "reversal");
    const events = receiptAdjustments.map((adjustment) => `<li><span>${dateLabel(adjustment.created_at)} · ${adjustment.event_kind === "reversal" ? "Estorno" : "Correção"}</span><strong>${financeMoney(adjustment.amount_delta)}</strong><p>${escape(adjustment.reason)}</p></li>`).join("");
    return `<article class="finance-receipt-card${receipt.cancelled_at ? " is-cancelled" : ""}">
      <header><div><strong>${financeMoney(net)}</strong><span>${dateLabel(receipt.received_on)}${receipt.source_reference ? ` · ${escape(receipt.source_reference)}` : ""}</span></div>${receipt.cancelled_at ? `<span class="finance-pill finance-pill-muted">Cancelado</span>` : receiptReversed ? `<span class="finance-pill finance-pill-muted">Estornado</span>` : legacy ? `<span class="finance-pill finance-pill-warning">Legado sem item</span>` : `<span class="finance-pill finance-pill-success">Vinculado aos itens</span>`}</header>
      ${allocations.length ? `<div class="finance-receipt-allocation-list">${allocations.map((allocation) => renderAllocationCorrection(allocation, data, canCorrect && !receiptReversed)).join("")}</div>` : ""}
      ${legacy && financeCents(net) > 0n && canCreate && !receipt.cancelled_at && !receiptReversed ? renderLegacyAllocationForm(receipt, data) : ""}
      ${legacy && canCorrect && !receipt.cancelled_at && !receiptReversed ? renderLegacyReceiptCorrection(receipt, data) : ""}
      ${events ? `<details class="finance-adjustment-history"><summary>Histórico de ajustes e estornos</summary><ol>${events}</ol></details>` : ""}
      ${canCorrect && !receipt.cancelled_at && financeCents(net) > 0n ? `<form class="finance-reversal-form" data-finance-reverse-form data-receipt-id="${escape(receipt.id)}"><label>Justificativa do estorno<textarea name="reason" rows="2" minlength="5" maxlength="1000" required></textarea></label><p class="finance-error" data-finance-error role="alert"></p><button class="danger-action compact-action" type="submit">Estornar recebimento</button></form>` : ""}
    </article>`;
  }).join("");
}

function renderProfitHistory(data) {
  if (!data.profitAdjustments.length && !data.recognitionAdjustments.length) return `<p class="finance-empty">Nenhuma correção de lucro registrada.</p>`;
  const objectiveEvents = data.profitAdjustments.map((adjustment) => {
    const item = data.items.find((row) => String(row.profit_item_id) === String(adjustment.profit_item_id));
    return { id: adjustment.id, date: adjustment.created_at, title: adjustment.entry_kind === "legacy" ? "Lucro legado preservado" : `Lucro objetivo · item ${item?.budget_item_number ?? "—"}`, reason: adjustment.reason, before: adjustment.expected_profit_before, after: adjustment.expected_profit_after };
  });
  const recognizedEvents = data.recognitionAdjustments.map((adjustment) => {
    const item = data.items.find((row) => String(row.profit_item_id) === String(adjustment.profit_item_id));
    return { id: adjustment.id, date: adjustment.created_at, title: `Lucro reconhecido · item ${item?.budget_item_number ?? "—"}`, reason: adjustment.reason, before: adjustment.recognized_profit_before, after: adjustment.recognized_profit_after };
  });
  const events = [...objectiveEvents, ...recognizedEvents].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `<ol class="finance-profit-history">${events.map((event) => `<li><div><strong>${escape(event.title)}</strong><span>${dateLabel(event.date)}</span></div><p>${escape(event.reason)}</p><small>${financeMoney(event.before)} → ${financeMoney(event.after)}</small></li>`).join("")}</ol>`;
}

export function financeLedgerPanelMarkup({ bid, data, isAdmin = false, billingLink = false, financeLink = false, loading = false, error = "" }) {
  if (!isAdmin) return "";
  if (loading) return `<section class="finance-ledger-panel" aria-busy="true"><p class="finance-loading" role="status">Carregando razão financeiro…</p></section>`;
  if (error) return `<section class="finance-ledger-panel"><div class="finance-alert finance-alert-danger" role="alert">${escape(error)} <button class="quiet-action compact-action" type="button" data-finance-retry>Tentar novamente</button></div></section>`;
  if (!data) return `<section class="finance-ledger-panel"><div class="finance-empty">Este edital não tem lançamento financeiro. Os novos lançamentos são habilitados somente em “Em Fornecimento” ou “Faturado”.</div></section>`;

  const { summary } = data;
  const eligible = eligibleStatuses.has(bid.status);
  const canCorrect = isAdmin;
  const sourceWarning = financeCents(summary.unallocated_legacy_amount) > 0n
    ? `<div class="finance-alert finance-alert-warning" role="status">${financeMoney(summary.unallocated_legacy_amount)} em recebimentos anteriores ainda não está vinculado a itens. Vincule-os antes de lançar novos recebimentos.</div>`
    : "";
  const canRegisterReceipt = eligible && financeCents(summary.unallocated_legacy_amount) <= 0n;
  return `<section class="finance-ledger-panel" aria-labelledby="financeLedgerTitle">
    <header class="finance-ledger-heading"><div><span class="eyebrow">FLUXO DE CAIXA · EDITAL</span><h2 id="financeLedgerTitle">Lucro e recebimentos</h2><p>Fonte compartilhada com o Faturamento. O lucro reconhecido acompanha os valores faturados e recebidos por item.</p></div><div class="finance-ledger-links">${billingLink ? `<button class="quiet-action compact-action" type="button" data-finance-open-billing="${escape(bid.id)}">Abrir Faturamento</button>` : ""}${financeLink ? `<button class="quiet-action compact-action" type="button" data-finance-open-cashflow="${escape(bid.id)}">Abrir Fluxo de Caixa</button>` : ""}</div></header>
    <dl class="finance-ledger-summary"><div><dt>Lucro objetivo</dt><dd>${financeMoney(summary.expected_profit)}</dd></div><div><dt>Valor faturado</dt><dd>${financeMoney(summary.due_amount)}</dd></div><div><dt>Recebido</dt><dd>${financeMoney(summary.received_amount)}</dd></div><div><dt>Lucro reconhecido</dt><dd>${financeMoney(summary.recognized_profit)}</dd></div><div><dt>Saldo a receber</dt><dd>${financeMoney(summary.outstanding_amount)}</dd></div></dl>
    ${sourceWarning}<section class="finance-ledger-section"><div class="finance-section-heading"><div><h3>Resultado por item</h3><p>O lucro objetivo vem do orçamento vinculado e pode receber correções justificadas.</p></div></div>${renderItemsTable(data, isAdmin)}</section>
    ${renderReceiptForm(data, canRegisterReceipt)}
    <section class="finance-ledger-section"><div class="finance-section-heading"><div><h3>Recebimentos do órgão</h3><p>Registros integrais, parciais, correções e estornos permanecem no histórico.</p></div></div><div class="finance-receipt-list">${renderReceiptHistory(data, canCorrect, canCorrect)}</div></section>
    <details class="finance-ledger-section finance-adjustment-history"><summary>Histórico de lucro objetivo</summary>${renderProfitHistory(data)}</details>
  </section>`;
}

export function createFinanceLedgerPanel({ root, service, getBid, isAdmin = () => false, navigate = () => undefined, onSaved = () => undefined, toast = () => undefined, billingLink = false, financeLink = false }) {
  const state = { data: null, bidId: null, loading: false, error: "" };
  if (!root) return { refresh: async () => undefined, hide: () => undefined };

  function render() {
    const bid = getBid?.();
    if (!bid) {
      root.replaceChildren();
      root.classList.toggle("hidden", !isAdmin());
      return;
    }
    root.innerHTML = financeLedgerPanelMarkup({ bid, data: state.data, isAdmin: isAdmin(), billingLink, financeLink, loading: state.loading, error: state.error });
    root.classList.toggle("hidden", !isAdmin());
  }

  async function refresh() {
    const bid = getBid?.();
    if (!bid || !isAdmin()) {
      state.data = null;
      state.bidId = bid?.id || null;
      state.error = "";
      state.loading = false;
      render();
      return;
    }
    state.bidId = String(bid.id);
    state.loading = true;
    state.error = "";
    render();
    try {
      if (eligibleStatuses.has(bid.status)) await service.syncBid(bid.id);
      else if (await service.loadBidLedger(bid.id)) await service.syncBid(bid.id);
      state.data = await service.loadBidLedger(bid.id);
    } catch (error) {
      state.error = error?.message || "Não foi possível carregar o razão financeiro.";
    } finally {
      state.loading = false;
      render();
    }
  }

  function requestAmounts(form, selector) {
    return buildFinanceAllocations([...form.querySelectorAll(selector)].map((input) => ({
      profit_item_id: input.dataset.receiptItem || input.dataset.legacyAllocationItem,
      amount: input.value,
    })), (row) => row.amount);
  }

  async function completeAction(form, action, successMessage) {
    formError(form, "");
    try {
      await action();
      await refresh();
      onSaved?.();
      toast(successMessage, "success");
    } catch (error) {
      formError(form, error?.message || "Não foi possível registrar a alteração.");
    }
  }

  root.addEventListener("click", (event) => {
    const retry = event.target.closest("[data-finance-retry]");
    if (retry) void refresh();
    const openBilling = event.target.closest("[data-finance-open-billing]");
    if (openBilling) navigate("billing", openBilling.dataset.financeOpenBilling);
    const openCashflow = event.target.closest("[data-finance-open-cashflow]");
    if (openCashflow) navigate("financeLedger", openCashflow.dataset.financeOpenCashflow);
    const fillRemaining = event.target.closest("[data-finance-fill-remaining]");
    if (fillRemaining) {
      const form = fillRemaining.closest("form");
      form?.querySelectorAll("[data-receipt-item]").forEach((input) => {
        const item = state.data?.items.find((row) => String(row.profit_item_id) === String(input.dataset.receiptItem));
        input.value = formatCents(financeCents(item?.outstanding_amount ?? "0.00"));
      });
    }
    const fillLegacy = event.target.closest("[data-finance-fill-legacy]");
    if (fillLegacy) {
      const form = fillLegacy.closest("form");
      let remaining = financeCents(fillLegacy.dataset.financeFillLegacy);
      for (const input of form?.querySelectorAll("[data-legacy-allocation-item]") || []) {
        const item = state.data?.items.find((row) => String(row.profit_item_id) === String(input.dataset.legacyAllocationItem));
        const capacityValue = financeCents(item?.due_amount ?? "0.00") - financeCents(item?.received_amount ?? "0.00");
        const capacity = capacityValue > 0n ? capacityValue : 0n;
        const assigned = remaining < capacity ? remaining : capacity;
        input.value = formatCents(assigned);
        remaining -= assigned;
      }
    }
  });

  root.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-finance-profit-form], form[data-finance-recognized-profit-form], form[data-finance-receipt-form], form[data-finance-legacy-allocation-form], form[data-finance-legacy-receipt-adjust-form], form[data-finance-receipt-adjust-form], form[data-finance-reverse-form]");
    if (!form) return;
    event.preventDefault();
    const values = new FormData(form);
    const id = requestId(form);
    if (form.matches("[data-finance-profit-form]")) {
      const reason = String(values.get("reason") || "").trim();
      let expected;
      try { expected = formatCents(financeCents(values.get("expected_profit"))); }
      catch { return formError(form, "Informe um lucro objetivo válido, com até duas casas decimais."); }
      if (financeCents(expected) < 0n || reason.length < 5) return formError(form, "Informe um lucro objetivo não negativo e uma justificativa de pelo menos 5 caracteres.");
      void completeAction(form, () => service.adjustProfit({ profitItemId: form.dataset.profitItemId, expectedProfit: expected, reason, requestId: id }), "Lucro objetivo corrigido com histórico.");
      return;
    }
    if (form.matches("[data-finance-recognized-profit-form]")) {
      const reason = String(values.get("reason") || "").trim();
      let recognized;
      try { recognized = formatCents(financeCents(values.get("recognized_profit"))); }
      catch { return formError(form, "Informe um lucro reconhecido válido, com até duas casas decimais."); }
      if (financeCents(recognized) < 0n || reason.length < 5) return formError(form, "Informe um lucro reconhecido não negativo e uma justificativa de pelo menos 5 caracteres.");
      void completeAction(form, () => service.adjustRecognizedProfit({ profitItemId: form.dataset.profitItemId, recognizedProfit: recognized, reason, requestId: id }), "Correção do lucro reconhecido registrada.");
      return;
    }
    if (form.matches("[data-finance-receipt-form]")) {
      const allocations = requestAmounts(form, "[data-receipt-item]");
      if (!allocations.length) return formError(form, "Informe um valor recebido em pelo menos um item faturado.");
      void completeAction(form, () => service.registerReceipt({
        bidId: getBid()?.id,
        receivedOn: values.get("received_on"),
        allocations,
        requestId: id,
        sourceReference: String(values.get("source_reference") || "").trim(),
      }), "Recebimento registrado por item.");
      return;
    }
    if (form.matches("[data-finance-legacy-allocation-form]")) {
      const allocations = requestAmounts(form, "[data-legacy-allocation-item]");
      const reason = String(values.get("reason") || "").trim();
      if (!allocationTotalMatches(allocations, form.dataset.legacyTotal)) return formError(form, "A soma dos itens deve corresponder ao recebimento legado líquido.");
      if (reason.length < 5) return formError(form, "Explique a justificativa do vínculo.");
      void completeAction(form, () => service.allocateExistingReceipt({ receiptId: form.dataset.receiptId, allocations, reason, requestId: id }), "Recebimento legado vinculado aos itens.");
      return;
    }
    if (form.matches("[data-finance-legacy-receipt-adjust-form]")) {
      const reason = String(values.get("reason") || "").trim();
      let delta;
      try { delta = formatCents(financeCents(values.get("amount_delta"))); }
      catch { return formError(form, "Informe uma correção válida, com até duas casas decimais."); }
      if (financeCents(delta) === 0n || reason.length < 5) return formError(form, "Informe uma correção diferente de zero e sua justificativa.");
      void completeAction(form, () => service.adjustLegacyReceipt({ receiptId: form.dataset.receiptId, amountDelta: delta, reason, requestId: id }), "Correção de recebimento registrada no histórico.");
      return;
    }
    if (form.matches("[data-finance-receipt-adjust-form]")) {
      const reason = String(values.get("reason") || "").trim();
      let delta;
      try { delta = formatCents(financeCents(values.get("amount_delta"))); }
      catch { return formError(form, "Informe uma correção válida, com até duas casas decimais."); }
      if (financeCents(delta) === 0n || reason.length < 5) return formError(form, "Informe uma correção diferente de zero e sua justificativa.");
      void completeAction(form, () => service.adjustReceipt({ receiptAllocationId: form.dataset.receiptAllocationId, amountDelta: delta, reason, requestId: id }), "Correção do recebimento registrada no histórico.");
      return;
    }
    const reason = String(values.get("reason") || "").trim();
    if (reason.length < 5) return formError(form, "Explique a justificativa do estorno.");
    void completeAction(form, () => service.reverseReceipt({ receiptId: form.dataset.receiptId, requestId: id, reason }), "Estorno registrado no histórico.");
  });

  return { refresh, hide: () => { state.data = null; state.loading = false; state.error = ""; render(); }, get data() { return state.data; } };
}
