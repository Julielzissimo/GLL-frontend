import { FINANCE_ELIGIBLE_BID_STATUSES, createFinanceLedgerPanel, financeMoney } from "./finance-ledger.js";

const eligibleStatuses = new Set(FINANCE_ELIGIBLE_BID_STATUSES);

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function editalLabel(bid, ledger) {
  return String(ledger?.edital_number || bid?.edital_number || bid?.id || "Edital");
}

function listRowMarkup(bid, ledger, selectedBidId) {
  const selected = String(selectedBidId) === String(bid.id);
  return `<tr class="${selected ? "is-selected" : ""}"><td><button class="finance-edital-link" type="button" data-finance-select-bid="${escape(bid.id)}" aria-current="${selected ? "true" : "false"}">${escape(editalLabel(bid, ledger))}</button><small>${escape(bid.buyer_agency || ledger?.buyer_agency || "Órgão não informado")}</small></td><td>${escape(bid.status || ledger?.bid_status || "")}</td><td class="numeric">${financeMoney(ledger?.expected_profit)}</td><td class="numeric">${financeMoney(ledger?.due_amount)}</td><td class="numeric">${financeMoney(ledger?.received_amount)}</td><td class="numeric"><strong>${financeMoney(ledger?.recognized_profit)}</strong></td><td class="numeric">${financeMoney(ledger?.outstanding_amount)}</td></tr>`;
}

export function createFinanceFeature({ root, service, getBids = () => [], isAdmin = () => false, navigate = () => undefined, onSaved = () => undefined, toast = () => undefined }) {
  const listRoot = root?.querySelector("#financeLedgerList");
  const detailRoot = root?.querySelector("#financeLedgerDetail");
  const noticeRoot = root?.querySelector("#financeLedgerNotice");
  const searchInput = root?.querySelector("#financeLedgerSearch");
  const panel = createFinanceLedgerPanel({
    root: detailRoot,
    service,
    getBid: () => getBids().find((bid) => String(bid.id) === String(state.selectedBidId)) || null,
    isAdmin,
    navigate: (page, bidId) => {
      if (page === "billing") navigate(page, bidId);
    },
    onSaved,
    toast,
    billingLink: true,
  });
  const state = { ledgers: [], selectedBidId: null, loading: false, error: "", filter: "" };

  function visibleRows() {
    const bids = getBids();
    const ledgerByBid = new Map(state.ledgers.filter((row) => !row.cancelled_at).map((row) => [String(row.bid_id), row]));
    const query = state.filter.trim().toLocaleLowerCase("pt-BR");
    return bids.map((bid) => ({ bid, ledger: ledgerByBid.get(String(bid.id)) || null }))
      .filter(({ bid, ledger }) => ledger || (eligibleStatuses.has(bid.status) && Boolean(bid.quotation_id)))
      .filter(({ bid, ledger }) => !query || [editalLabel(bid, ledger), bid.buyer_agency, bid.status]
        .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query)))
      .sort((a, b) => editalLabel(a.bid, a.ledger).localeCompare(editalLabel(b.bid, b.ledger), "pt-BR", { numeric: true }));
  }

  function renderList() {
    if (!listRoot) return;
    listRoot.setAttribute("aria-busy", String(state.loading));
    if (state.loading && !state.ledgers.length) {
      listRoot.innerHTML = `<tr><td colspan="7"><p class="finance-loading" role="status">Consolidando lucros e faturamento por edital…</p></td></tr>`;
      return;
    }
    const rows = visibleRows();
    if (!rows.length) {
      listRoot.innerHTML = `<tr><td colspan="7"><p class="finance-empty">Nenhum edital com orçamento e situação financeira disponível.</p></td></tr>`;
      return;
    }
    listRoot.innerHTML = rows.map(({ bid, ledger }) => listRowMarkup(bid, ledger, state.selectedBidId)).join("");
  }

  async function loadSummaries() {
    if (!isAdmin()) {
      state.ledgers = [];
      renderList();
      return;
    }
    const before = await service.listBidLedgers();
    const hasLedger = new Set(before.filter((row) => !row.cancelled_at).map((row) => String(row.bid_id)));
    const eligible = getBids().filter((bid) => (eligibleStatuses.has(bid.status) && bid.quotation_id) || hasLedger.has(String(bid.id)));
    const syncErrors = [];
    for (let index = 0; index < eligible.length; index += 5) {
      const chunk = eligible.slice(index, index + 5);
      const results = await Promise.allSettled(chunk.map((bid) => service.syncBid(bid.id)));
      results.forEach((result, position) => {
        if (result.status === "rejected") syncErrors.push(`${eligible[index + position].edital_number || eligible[index + position].id}: ${result.reason?.message || "falha ao consolidar"}`);
      });
    }
    state.ledgers = await service.listBidLedgers();
    state.error = syncErrors.length ? `Alguns editais não foram consolidados: ${syncErrors.join(" · ")}` : "";
  }

  async function refresh({ refreshPanel = true } = {}) {
    if (!root) return;
    if (!isAdmin()) {
      root.classList.add("hidden");
      return;
    }
    root.classList.remove("hidden");
    state.loading = true;
    state.error = "";
    if (noticeRoot) noticeRoot.textContent = "";
    renderList();
    try {
      await loadSummaries();
      if (noticeRoot) noticeRoot.textContent = state.error;
      const rows = visibleRows();
      if (!rows.some(({ bid }) => String(bid.id) === String(state.selectedBidId))) state.selectedBidId = rows[0]?.bid.id || null;
      renderList();
      if (refreshPanel && state.selectedBidId) await panel.refresh();
      else if (!state.selectedBidId) panel.hide();
    } catch (error) {
      state.error = error?.message || "Não foi possível carregar o Fluxo de Caixa.";
      if (noticeRoot) noticeRoot.textContent = state.error;
      if (listRoot) listRoot.innerHTML = `<tr><td colspan="7"><div class="finance-alert finance-alert-danger" role="alert">${escape(state.error)} <button class="quiet-action compact-action" type="button" data-finance-page-retry>Tentar novamente</button></div></td></tr>`;
    } finally {
      state.loading = false;
      renderList();
    }
  }

  function selectBid(bidId, { refresh: shouldRefresh = true } = {}) {
    state.selectedBidId = String(bidId);
    renderList();
    if (shouldRefresh) void panel.refresh();
  }

  if (root && !root.dataset.financeBound) {
    root.dataset.financeBound = "true";
    root.addEventListener("click", (event) => {
      const select = event.target.closest("[data-finance-select-bid]");
      if (select) selectBid(select.dataset.financeSelectBid);
      if (event.target.closest("[data-finance-page-retry]")) void refresh();
    });
    searchInput?.addEventListener("input", () => {
      state.filter = searchInput.value;
      renderList();
    });
  }

  return {
    showPage: (selectedBidId = null) => {
      if (selectedBidId) state.selectedBidId = String(selectedBidId);
      return refresh();
    },
    refresh,
    refreshSummaries: () => refresh({ refreshPanel: false }),
    selectBid,
    hide: () => panel.hide(),
    reset: () => {
      state.ledgers = [];
      state.selectedBidId = null;
      state.error = "";
      state.filter = "";
      if (searchInput) searchInput.value = "";
      panel.hide();
    },
  };
}
