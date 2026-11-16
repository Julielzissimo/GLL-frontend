import { calculateDashboard, calculateSupplyTracking, DASHBOARD_STATUSES } from "./dashboard-metrics.js";

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const quantity = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value || 0);
const percent = (value) => value === null ? "—" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const infoIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>';
const statusPresentation = Object.freeze({
  Disputada: { modifier: "disputada", icon: "warning" },
  Aprovada: { modifier: "aprovada", icon: "success" },
  "Em Fornecimento": { modifier: "fornecimento", icon: "package" },
  Faturado: { modifier: "faturado", icon: "document" },
});
const SUPPLY_ITEMS_PAGE_SIZE = 10;
const explanations = {
  potential: "Soma de quantidade × valor final dos itens marcados como vencidos em editais Disputada, Aprovada, Em Fornecimento ou Faturado, dentro do período da sessão e do status escolhidos. É potencial comercial, não valor a receber confirmado nem pagamento.",
  cost: "Soma de quantidade × custo unitário somente dos itens vencidos com custo informado e maior que zero. Itens sem custo ficam fora deste card, mas permanecem no potencial.",
  profit: "Potencial dos itens com custo conhecido menos o custo desses mesmos itens. Não inclui impostos, despesas adicionais ou itens sem custo. Confira a cobertura exibida abaixo.",
  margin: "Lucro estimado dividido pelo potencial dos itens com custo conhecido. Se nenhum item tiver custo, a margem fica indisponível. A cobertura indica quanto do potencial entrou no cálculo.",
};

function metricCard(key, label, value, note) {
  return `<article class="finance-metric finance-metric--${key}"><div class="finance-metric-heading"><span>${label}</span><span class="finance-help"><button class="finance-help-button" type="button" aria-label="Sobre ${label}: ${escape(explanations[key])}" aria-expanded="false" data-finance-help>${infoIcon}</button><span class="finance-tooltip" role="tooltip">${escape(explanations[key])}</span></span></div><strong>${value}</strong><small>${note}</small><button class="finance-card-link" type="button" data-dashboard-scope="${key}">Ver itens <span aria-hidden="true">→</span></button></article>`;
}

function metricContent(report) {
  const { totals, rows } = report;
  const coverage = `Cobertura: ${percent(totals.coverage)} do potencial · ${totals.coveredItems} de ${rows.length} itens`;
  return [
    metricCard("potential", "Potencial de faturamento", money(totals.potential), `${rows.length} ${rows.length === 1 ? "item vencido" : "itens vencidos"} no recorte`),
    metricCard("cost", "Custo conhecido", money(totals.cost), coverage),
    metricCard("profit", "Lucro estimado", totals.coveredItems ? money(totals.profit) : "—", coverage),
    metricCard("margin", "Margem estimada", percent(totals.margin), coverage),
  ].join("");
}

function statusChart(report) {
  const total = report.byStatus.reduce((sum, entry) => sum + entry.value, 0);
  const rows = report.byStatus.map((entry) => {
    const presentation = statusPresentation[entry.status] || { modifier: "default", icon: "document" };
    const share = total > 0 ? Math.min(100, Math.max(0, (entry.value / total) * 100)) : 0;
    const displayedShare = Math.round(share * 10) / 10;
    const shareLabel = percent(displayedShare);
    const icon = window.GLLDesignSystem?.ICONS?.[presentation.icon] || "";

    return `<button class="finance-status-row finance-status-row--${presentation.modifier}" type="button" data-dashboard-status="${escape(entry.status)}" aria-label="${escape(entry.status)}: ${money(entry.value)}, ${shareLabel} do total estimado, ${entry.count} itens. Filtrar por este status">
      <span class="finance-status-row__identity"><span class="finance-status-row__icon" aria-hidden="true">${icon}</span><span class="finance-status-row__label">${escape(entry.status)}</span></span>
      <span class="finance-status-row__chart"><span class="finance-status-row__track" role="progressbar" aria-label="${escape(entry.status)} como percentual do total estimado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${displayedShare}" aria-valuetext="${shareLabel} do total estimado" style="--progress: ${share}%"><span class="finance-status-row__fill"></span></span><span class="finance-status-row__percentage">${shareLabel}</span></span>
      <strong class="finance-status-row__amount">${money(entry.value)}</strong>
    </button>`;
  }).join("");
  const headingIcon = window.GLLDesignSystem?.ICONS?.layoutDashboard || "";
  const totalIcon = window.GLLDesignSystem?.ICONS?.quotation || "";

  return `<section class="section-band finance-panel finance-status-panel" aria-labelledby="dashboardStatusTitle">
    <div class="panel-heading finance-status-heading"><span class="finance-status-heading__icon" aria-hidden="true">${headingIcon}</span><div><h2 id="dashboardStatusTitle">Faturamento estimado por status</h2><p>Valor total dos itens vencidos, agrupado pelo status atual do edital.</p></div></div>
    <div class="finance-status-summary" role="group" aria-label="Valor total estimado"><span class="finance-status-summary__icon" aria-hidden="true">${totalIcon}</span><span class="finance-status-summary__content"><span>Total estimado</span><strong>${money(total)}</strong></span></div>
    <div class="finance-status-rows" role="group" aria-label="Valores por status do edital">${rows}</div>
  </section>`;
}

function invoiceChart(report) {
  const months = report.invoiceSeries.slice(-6);
  const maximum = Math.max(1, ...months.map((entry) => entry.value));
  return `<section class="section-band finance-panel finance-invoices"><div class="panel-heading"><div><span class="finance-homolog-tag">Dados de homologação</span><h2>Faturamento registrado</h2><p>Notas fiscais: quantidade registrada e valor inferido pela quantidade × valor final do item. A nota não possui valor monetário próprio neste fluxo.</p></div></div><div class="finance-invoice-summary"><strong>${quantity(report.totals.invoicedQuantity)} un.</strong><span>com nota fiscal</span><strong>${money(report.totals.invoicedValue)}</strong><span>valor inferido · nenhum pagamento confirmado</span></div>${months.length ? `<div class="finance-month-bars" role="img" aria-label="Valores inferidos das notas fiscais por mês da nota">${months.map((entry) => `<div class="finance-month"><span class="finance-month-track"><span style="height:${Math.max(4, entry.value / maximum * 100)}%"></span></span><strong>${money(entry.value)}</strong><small>${escape(entry.month.slice(5))}/${escape(entry.month.slice(0, 4))}</small></div>`).join("")}</div>` : '<p class="finance-empty-note">Nenhuma nota fiscal registrada para os itens deste recorte.</p>'}<button class="finance-card-link" type="button" data-dashboard-scope="invoice">Ver itens com nota fiscal →</button></section>`;
}

function supplyItemsPage(bid, state) {
  const totalItems = bid.items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / SUPPLY_ITEMS_PAGE_SIZE));
  const bidId = String(bid.bidId);
  const currentPage = Math.min(Math.max(1, Number(state.supplyPages.get(bidId) || 1)), totalPages);
  state.supplyPages.set(bidId, currentPage);
  const firstItem = (currentPage - 1) * SUPPLY_ITEMS_PAGE_SIZE;
  return {
    currentPage,
    totalPages,
    totalItems,
    firstItem,
    rows: bid.items.slice(firstItem, firstItem + SUPPLY_ITEMS_PAGE_SIZE),
  };
}

function supplyPagination(bid, page) {
  if (page.totalPages <= 1) return "";
  const first = page.firstItem + 1;
  const last = Math.min(page.firstItem + SUPPLY_ITEMS_PAGE_SIZE, page.totalItems);
  return `<nav class="finance-supply-pagination" aria-label="Paginação dos itens do edital ${escape(bid.bidNumber)}"><span class="finance-supply-pagination-summary" aria-live="polite">Página ${page.currentPage.toLocaleString("pt-BR")} de ${page.totalPages.toLocaleString("pt-BR")} · Exibindo ${first.toLocaleString("pt-BR")}–${last.toLocaleString("pt-BR")} de ${page.totalItems.toLocaleString("pt-BR")} itens</span><div class="finance-supply-pagination-actions"><button class="quiet-action compact-action" type="button" data-dashboard-supply-bid="${escape(bid.bidId)}" data-dashboard-supply-page="${page.currentPage - 1}" data-dashboard-supply-direction="previous" aria-label="Página anterior dos itens do edital ${escape(bid.bidNumber)}"${page.currentPage <= 1 ? " disabled" : ""}>Anterior</button><button class="quiet-action compact-action" type="button" data-dashboard-supply-bid="${escape(bid.bidId)}" data-dashboard-supply-page="${page.currentPage + 1}" data-dashboard-supply-direction="next" aria-label="Próxima página dos itens do edital ${escape(bid.bidNumber)}"${page.currentPage >= page.totalPages ? " disabled" : ""}>Próxima</button></div></nav>`;
}

function supplySection(bids, state) {
  let content;
  if (state.loading || (!state.loaded && !state.error)) {
    content = '<p class="finance-supply-message" role="status">Carregando o acompanhamento de fornecimento…</p>';
  } else if (state.error) {
    content = `<div class="finance-supply-message" role="alert"><p>Não foi possível carregar as quantidades de empenho, entrega e faturamento: ${escape(state.error)}</p><button class="quiet-action" type="button" data-dashboard-retry>Tentar novamente</button></div>`;
  } else if (!bids.length) {
    content = '<p class="finance-supply-message">Nenhum edital em fornecimento para acompanhar.</p>';
  } else {
    content = `<div class="finance-supply-bids">${bids.map((bid) => {
      const page = supplyItemsPage(bid, state);
      return `<article class="finance-supply-bid"><header class="finance-supply-bid-heading"><div><h3>Edital ${escape(bid.bidNumber)}</h3><p>${escape(bid.agency || "Órgão não informado")}</p></div><span class="finance-supply-status">Em Fornecimento</span><button class="quiet-action" type="button" data-dashboard-bid="${escape(bid.bidId)}" aria-label="Abrir edital ${escape(bid.bidNumber)}">Abrir edital</button></header><div class="finance-supply-totals" role="group" aria-label="Totais por etapa do edital ${escape(bid.bidNumber)}"><div><span>Solicitado</span><strong>${quantity(bid.totals.requestedQuantity)}</strong></div><div><span>Entregue</span><strong>${quantity(bid.totals.deliveredQuantity)}</strong></div><div><span>Faturado</span><strong>${quantity(bid.totals.invoicedQuantity)}</strong></div></div>${bid.items.length ? `<div class="finance-supply-table-wrap"><table aria-label="Quantidades solicitadas, entregues e faturadas do edital ${escape(bid.bidNumber)}"><thead><tr><th scope="col">Item</th><th scope="col">Solicitado</th><th scope="col">Entregue</th><th scope="col">Faturado</th></tr></thead><tbody>${page.rows.map((item) => `<tr><th scope="row"><strong>Item ${escape(item.itemNumber)}</strong><small>${escape(item.description || "Sem descrição")}</small></th><td class="finance-supply-quantity">${quantity(item.requestedQuantity)}</td><td class="finance-supply-quantity">${quantity(item.deliveredQuantity)}</td><td class="finance-supply-quantity">${quantity(item.invoicedQuantity)}</td></tr>`).join("")}</tbody></table></div>${supplyPagination(bid, page)}` : '<p class="finance-supply-empty-note">Nenhum item marcado como vencido neste edital.</p>'}</article>`;
    }).join("")}</div>`;
  }

  const count = state.loaded
    ? `${bids.length} ${bids.length === 1 ? "edital" : "editais"}`
    : state.loading ? "Carregando…" : "Indisponível";
  return `<section class="section-band finance-panel finance-supply" aria-labelledby="dashboardSupplyTitle"><div class="panel-heading"><div><h2 id="dashboardSupplyTitle">Acompanhamento de fornecimento</h2><p>Quantidades dos itens marcados como vencidos. Solicitado corresponde aos empenhos registrados; entrega e faturamento são somados separadamente.</p></div><span class="finance-supply-count">${count}</span></div>${content}</section>`;
}

function detailRows(report, scope) {
  return report.rows.filter((row) => scope !== "cost" && scope !== "profit" && scope !== "margin" ? scope !== "invoice" || row.invoicedQuantity > 0 : row.costKnown);
}

export function calculateFinanceTooltipPlacement({ anchorLeft, anchorRight, contentLeft, viewportWidth, edge, gap, maxWidth }) {
  const contentRight = viewportWidth - edge;
  const rightSpace = Math.max(0, contentRight - anchorRight - gap);
  const leftSpace = Math.max(0, anchorLeft - gap - contentLeft);
  const rightWidth = Math.min(maxWidth, rightSpace);
  const leftWidth = Math.min(maxWidth, leftSpace);
  const useRight = rightWidth >= maxWidth / 2 || (leftWidth < maxWidth / 2 && rightWidth >= leftWidth);
  const availableWidth = Math.max(1, Math.floor(useRight ? rightSpace : leftSpace));
  const width = Math.min(maxWidth, availableWidth);
  const left = useRight ? anchorRight + gap : Math.max(contentLeft, anchorLeft - gap - width);

  return { side: useRight ? "right" : "left", left, width };
}

function positionFinanceTooltip(root, button) {
  const tooltip = button.nextElementSibling;
  if (!tooltip?.matches(".finance-tooltip")) return;

  const tokens = getComputedStyle(document.documentElement);
  const tokenPixels = (name, fallback) => {
    const value = tokens.getPropertyValue(name).trim();
    const size = Number.parseFloat(value);
    if (!Number.isFinite(size)) return fallback;
    return value.endsWith("rem") ? size * (Number.parseFloat(tokens.fontSize) || 16) : size;
  };
  const edge = tokenPixels("--gll-space-3", 12);
  const gap = tokenPixels("--gll-space-2", 8);
  const maxWidth = 310;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const anchor = button.getBoundingClientRect();
  const contentLeft = Math.max(edge, root.getBoundingClientRect().left);
  const placement = calculateFinanceTooltipPlacement({
    anchorLeft: anchor.left,
    anchorRight: anchor.right,
    contentLeft,
    viewportWidth,
    edge,
    gap,
    maxWidth,
  });

  tooltip.style.width = `${placement.width}px`;
  tooltip.style.maxHeight = `${Math.max(1, viewportHeight - edge * 2)}px`;
  tooltip.style.left = `${placement.left}px`;

  const tooltipHeight = tooltip.getBoundingClientRect().height;
  tooltip.style.top = `${Math.max(edge, Math.min(anchor.top, viewportHeight - edge - tooltipHeight))}px`;
}

export function createDashboardFeature({ root, getData, getTrackingData, openBid }) {
  const emptyTrackingData = () => ({ fulfillments: [], commitments: [], deliveries: [], invoices: [] });
  const state = { from: "", to: "", status: "Todos", trackingData: emptyTrackingData(), supplyPages: new Map(), loaded: false, loading: false, error: "", scope: "potential", details: false, request: 0 };
  let active = false;

  function render() {
    if (!active) return;
    const data = getData();
    const report = calculateDashboard({ ...data, invoices: state.trackingData.invoices, from: state.from, to: state.to, status: state.status });
    const supplyingBids = calculateSupplyTracking({ ...data, ...state.trackingData });
    const scopeLabels = { potential: "Potencial de faturamento", cost: "Custo conhecido", profit: "Lucro estimado", margin: "Margem estimada", invoice: "Itens com nota fiscal" };
    const detail = detailRows(report, state.scope);
    root.innerHTML = `<form class="section-band finance-filters" id="dashboardFilters"><label>De<input type="date" name="from" value="${escape(state.from)}" aria-label="Data inicial da sessão"></label><label>Até<input type="date" name="to" value="${escape(state.to)}" aria-label="Data final da sessão"></label><label>Status<select name="status" aria-label="Status do edital"><option>Todos</option>${DASHBOARD_STATUSES.map((status) => `<option ${status === state.status ? "selected" : ""}>${escape(status)}</option>`).join("")}</select></label><button class="primary-action" type="submit">Aplicar filtros</button><button class="quiet-action" type="button" data-dashboard-clear>Limpar</button></form>
      <div class="finance-metrics">${metricContent(report)}</div>
      ${report.rows.length ? `<div class="finance-charts">${statusChart(report)}${state.loaded ? invoiceChart(report) : `<section class="section-band finance-panel"><span class="finance-homolog-tag">Dados de homologação</span><h2>Faturamento registrado</h2><p>${state.loading ? "Carregando notas fiscais…" : "Os dados de notas fiscais estão indisponíveis no momento."}</p></section>`}</div>` : '<section class="section-band finance-empty"><h2>Nenhum item vencido neste recorte</h2><p>Marque itens como vencidos em editais elegíveis ou ajuste os filtros para visualizar o potencial.</p><button class="quiet-action" type="button" data-dashboard-bids>Ver licitações</button></section>'}
      ${supplySection(supplyingBids, state)}
      ${report.rows.length && state.details ? `<section class="section-band finance-details" id="dashboardDetails" aria-labelledby="dashboardDetailsTitle"><div class="panel-heading"><div><h2 id="dashboardDetailsTitle">${scopeLabels[state.scope]}</h2><p>${detail.length} ${detail.length === 1 ? "item" : "itens"} no detalhamento</p></div><button class="quiet-action" type="button" data-dashboard-close>Fechar</button></div><div class="table-wrap"><table><thead><tr><th>Edital / órgão</th><th>Item</th><th>Status</th><th>Potencial</th><th>${state.scope === "invoice" ? "Com nota / valor inferido" : "Custo / lucro estimado"}</th><th>Acesso</th></tr></thead><tbody>${detail.map((row) => `<tr><td><strong>${escape(row.bidNumber)}</strong><small>${escape(row.agency)}</small></td><td><strong>${escape(row.itemNumber)}</strong><small>${escape(row.description)}</small></td><td>${escape(row.status)}</td><td>${money(row.potential)}</td><td>${state.scope === "invoice" ? `${quantity(row.invoicedQuantity)} un. · ${money(row.invoicedValue)}` : row.costKnown ? `${money(row.cost)} / ${money(row.potential - row.cost)}` : "Custo não informado"}</td><td><button class="text-action" type="button" data-dashboard-bid="${escape(row.bidId)}">Abrir edital</button></td></tr>`).join("")}</tbody></table></div></section>` : ""}
      <p class="finance-method-note">Período pela data da sessão do edital. Notas agrupadas pela data da nota fiscal. Potencial, nota fiscal e pagamento representam etapas diferentes.</p>`;
  }

  function repositionOpenFinanceTooltip() {
    const button = root.querySelector("[data-finance-help][aria-expanded='true']")
      || root.querySelector(".finance-help:hover > [data-finance-help]")
      || root.querySelector(".finance-help:focus-within > [data-finance-help]");
    if (button) positionFinanceTooltip(root, button);
  }

  root.addEventListener("pointerover", (event) => {
    const button = event.target.closest("[data-finance-help]");
    if (button) positionFinanceTooltip(root, button);
  });
  root.addEventListener("focusin", (event) => {
    const button = event.target.closest("[data-finance-help]");
    if (button) positionFinanceTooltip(root, button);
  });
  window.addEventListener("resize", repositionOpenFinanceTooltip, { passive: true });
  document.addEventListener("scroll", repositionOpenFinanceTooltip, { capture: true, passive: true });
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(repositionOpenFinanceTooltip).observe(root);
  }

  async function loadTrackingData() {
    const request = ++state.request;
    state.loading = true; state.error = ""; state.loaded = false; render();
    try {
      const trackingData = await getTrackingData();
      if (request !== state.request || !active) return;
      state.trackingData = { ...emptyTrackingData(), ...trackingData }; state.loaded = true;
    } catch (error) {
      if (request !== state.request || !active) return;
      state.trackingData = emptyTrackingData(); state.error = error.message || "erro desconhecido";
    } finally {
      if (request === state.request) { state.loading = false; render(); }
    }
  }

  root.addEventListener("submit", (event) => {
    if (event.target.id !== "dashboardFilters") return;
    event.preventDefault();
    const values = new FormData(event.target);
    state.from = String(values.get("from") || ""); state.to = String(values.get("to") || ""); state.status = String(values.get("status") || "Todos");
    state.details = false; render();
  });
  root.addEventListener("click", (event) => {
    const supplyPageButton = event.target.closest("[data-dashboard-supply-page]");
    if (supplyPageButton) {
      const bidId = String(supplyPageButton.dataset.dashboardSupplyBid);
      const direction = supplyPageButton.dataset.dashboardSupplyDirection;
      const page = Number(supplyPageButton.dataset.dashboardSupplyPage);
      if (Number.isInteger(page) && page >= 1) {
        state.supplyPages.set(bidId, page);
        render();
        const pageButtons = [...root.querySelectorAll("[data-dashboard-supply-bid][data-dashboard-supply-direction]")]
          .filter((button) => button.dataset.dashboardSupplyBid === bidId);
        const nextFocus = pageButtons.find((button) => button.dataset.dashboardSupplyDirection === direction && !button.disabled)
          || pageButtons.find((button) => !button.disabled);
        nextFocus?.focus();
      }
      return;
    }
    const help = event.target.closest("[data-finance-help]");
    if (help) {
      const isOpening = help.getAttribute("aria-expanded") !== "true";
      if (isOpening) positionFinanceTooltip(root, help);
      help.setAttribute("aria-expanded", String(isOpening));
      return;
    }
    if (event.target.closest("[data-dashboard-clear]")) { state.from = ""; state.to = ""; state.status = "Todos"; state.details = false; render(); return; }
    if (event.target.closest("[data-dashboard-retry]")) { void loadTrackingData(); return; }
    if (event.target.closest("[data-dashboard-close]")) { state.details = false; render(); return; }
    if (event.target.closest("[data-dashboard-bids]")) { openBid(null); return; }
    const bidButton = event.target.closest("[data-dashboard-bid]");
    if (bidButton) { openBid(bidButton.dataset.dashboardBid); return; }
    const statusButton = event.target.closest("[data-dashboard-status]");
    if (statusButton) { state.status = statusButton.dataset.dashboardStatus; state.details = true; state.scope = "potential"; render(); return; }
    const scopeButton = event.target.closest("[data-dashboard-scope]");
    if (scopeButton) { state.scope = scopeButton.dataset.dashboardScope; state.details = true; render(); root.querySelector("#dashboardDetails")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") root.querySelectorAll("[data-finance-help][aria-expanded='true']").forEach((button) => button.setAttribute("aria-expanded", "false"));
  });

  return {
    showPage() { active = true; render(); void loadTrackingData(); },
    refresh() { if (active) void loadTrackingData(); },
    hide() { active = false; state.request += 1; },
    reset() { active = false; state.request += 1; state.trackingData = emptyTrackingData(); state.supplyPages.clear(); state.loaded = false; state.loading = false; state.error = ""; state.details = false; },
  };
}

window.GLLDashboard = { createDashboardFeature };
