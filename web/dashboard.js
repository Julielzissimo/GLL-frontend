import { calculateDashboard, DASHBOARD_STATUSES } from "./dashboard-metrics.js";

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const quantity = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value || 0);
const percent = (value) => value === null ? "—" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const infoIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>';
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
  const maximum = Math.max(1, ...report.byStatus.map((entry) => entry.value));
  return `<section class="section-band finance-panel"><div class="panel-heading"><div><h2>Potencial por status</h2><p>Valor total dos itens vencidos, agrupado pelo status atual do edital.</p></div></div><div class="finance-bars">${report.byStatus.map((entry) => `<button class="finance-bar-row" type="button" data-dashboard-status="${escape(entry.status)}" aria-label="${escape(entry.status)}: ${money(entry.value)}, ${entry.count} itens. Filtrar por este status"><span class="finance-bar-label">${escape(entry.status)}</span><span class="finance-bar-track"><span class="finance-bar-fill" style="width:${entry.value ? Math.max(3, entry.value / maximum * 100) : 0}%"></span></span><strong>${money(entry.value)}</strong></button>`).join("")}</div></section>`;
}

function invoiceChart(report) {
  const months = report.invoiceSeries.slice(-6);
  const maximum = Math.max(1, ...months.map((entry) => entry.value));
  return `<section class="section-band finance-panel finance-invoices"><div class="panel-heading"><div><span class="finance-homolog-tag">Dados de homologação</span><h2>Faturamento registrado</h2><p>Notas fiscais: quantidade registrada e valor inferido pela quantidade × valor final do item. A nota não possui valor monetário próprio neste fluxo.</p></div></div><div class="finance-invoice-summary"><strong>${quantity(report.totals.invoicedQuantity)} un.</strong><span>com nota fiscal</span><strong>${money(report.totals.invoicedValue)}</strong><span>valor inferido · nenhum pagamento confirmado</span></div>${months.length ? `<div class="finance-month-bars" role="img" aria-label="Valores inferidos das notas fiscais por mês da nota">${months.map((entry) => `<div class="finance-month"><span class="finance-month-track"><span style="height:${Math.max(4, entry.value / maximum * 100)}%"></span></span><strong>${money(entry.value)}</strong><small>${escape(entry.month.slice(5))}/${escape(entry.month.slice(0, 4))}</small></div>`).join("")}</div>` : '<p class="finance-empty-note">Nenhuma nota fiscal registrada para os itens deste recorte.</p>'}<button class="finance-card-link" type="button" data-dashboard-scope="invoice">Ver itens com nota fiscal →</button></section>`;
}

function detailRows(report, scope) {
  return report.rows.filter((row) => scope !== "cost" && scope !== "profit" && scope !== "margin" ? scope !== "invoice" || row.invoicedQuantity > 0 : row.costKnown);
}

export function createDashboardFeature({ root, getData, getInvoices, openBid }) {
  const state = { from: "", to: "", status: "Todos", invoices: [], loaded: false, loading: false, error: "", scope: "potential", details: false, request: 0 };
  let active = false;

  function render() {
    if (!active) return;
    const report = calculateDashboard({ ...getData(), invoices: state.invoices, from: state.from, to: state.to, status: state.status });
    const scopeLabels = { potential: "Potencial de faturamento", cost: "Custo conhecido", profit: "Lucro estimado", margin: "Margem estimada", invoice: "Itens com nota fiscal" };
    const detail = detailRows(report, state.scope);
    root.innerHTML = `<form class="section-band finance-filters" id="dashboardFilters"><label>De<input type="date" name="from" value="${escape(state.from)}" aria-label="Data inicial da sessão"></label><label>Até<input type="date" name="to" value="${escape(state.to)}" aria-label="Data final da sessão"></label><label>Status<select name="status" aria-label="Status do edital"><option>Todos</option>${DASHBOARD_STATUSES.map((status) => `<option ${status === state.status ? "selected" : ""}>${escape(status)}</option>`).join("")}</select></label><button class="primary-action" type="submit">Aplicar filtros</button><button class="quiet-action" type="button" data-dashboard-clear>Limpar</button></form>
      ${state.error ? `<p class="finance-error" role="alert">Não foi possível carregar as notas fiscais: ${escape(state.error)}. Os indicadores de notas estão indisponíveis até uma nova tentativa. <button type="button" data-dashboard-retry>Tentar novamente</button></p>` : ""}
      ${state.loading ? '<p class="finance-loading" role="status">Carregando notas fiscais…</p>' : ""}
      <div class="finance-metrics">${metricContent(report)}</div>
      ${report.rows.length ? `<div class="finance-charts">${statusChart(report)}${state.loaded ? invoiceChart(report) : '<section class="section-band finance-panel"><span class="finance-homolog-tag">Dados de homologação</span><h2>Faturamento registrado</h2><p>Os dados de notas fiscais estão indisponíveis no momento.</p></section>'}</div>` : '<section class="section-band finance-empty"><h2>Nenhum item vencido neste recorte</h2><p>Marque itens como vencidos em editais elegíveis ou ajuste os filtros para visualizar o potencial.</p><button class="quiet-action" type="button" data-dashboard-bids>Ver licitações</button></section>'}
      ${report.rows.length && state.details ? `<section class="section-band finance-details" id="dashboardDetails" aria-labelledby="dashboardDetailsTitle"><div class="panel-heading"><div><h2 id="dashboardDetailsTitle">${scopeLabels[state.scope]}</h2><p>${detail.length} ${detail.length === 1 ? "item" : "itens"} no detalhamento</p></div><button class="quiet-action" type="button" data-dashboard-close>Fechar</button></div><div class="table-wrap"><table><thead><tr><th>Edital / órgão</th><th>Item</th><th>Status</th><th>Potencial</th><th>${state.scope === "invoice" ? "Com nota / valor inferido" : "Custo / lucro estimado"}</th><th>Acesso</th></tr></thead><tbody>${detail.map((row) => `<tr><td><strong>${escape(row.bidNumber)}</strong><small>${escape(row.agency)}</small></td><td><strong>${escape(row.itemNumber)}</strong><small>${escape(row.description)}</small></td><td>${escape(row.status)}</td><td>${money(row.potential)}</td><td>${state.scope === "invoice" ? `${quantity(row.invoicedQuantity)} un. · ${money(row.invoicedValue)}` : row.costKnown ? `${money(row.cost)} / ${money(row.potential - row.cost)}` : "Custo não informado"}</td><td><button class="text-action" type="button" data-dashboard-bid="${escape(row.bidId)}">Abrir edital</button></td></tr>`).join("")}</tbody></table></div></section>` : ""}
      <p class="finance-method-note">Período pela data da sessão do edital. Notas agrupadas pela data da nota fiscal. Potencial, nota fiscal e pagamento representam etapas diferentes.</p>`;
  }

  async function loadInvoices() {
    const request = ++state.request;
    state.loading = true; state.error = ""; state.loaded = false; render();
    try {
      const invoices = await getInvoices();
      if (request !== state.request || !active) return;
      state.invoices = invoices; state.loaded = true;
    } catch (error) {
      if (request !== state.request || !active) return;
      state.invoices = []; state.error = error.message || "erro desconhecido";
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
    const help = event.target.closest("[data-finance-help]");
    if (help) { help.setAttribute("aria-expanded", String(help.getAttribute("aria-expanded") !== "true")); return; }
    if (event.target.closest("[data-dashboard-clear]")) { state.from = ""; state.to = ""; state.status = "Todos"; state.details = false; render(); return; }
    if (event.target.closest("[data-dashboard-retry]")) { void loadInvoices(); return; }
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
    showPage() { active = true; render(); void loadInvoices(); },
    refresh() { if (active) void loadInvoices(); },
    hide() { active = false; state.request += 1; },
    reset() { active = false; state.request += 1; state.invoices = []; state.loaded = false; state.details = false; },
  };
}

window.GLLDashboard = { createDashboardFeature };
