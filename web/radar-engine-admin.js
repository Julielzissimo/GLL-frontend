const N = Object.freeze({
  discovered: "gll_radar_tenders_discovered", processed: "gll_radar_tenders_processed",
  complete: "gll_radar_tenders_items_complete", partial: "gll_radar_tenders_items_partial",
  failed: "gll_radar_tenders_items_failed", queue: "gll_radar_queue_jobs",
  queueAge: "gll_radar_queue_oldest_pending_age_seconds",
  published: "gll_radar_tenders_published_total",
  collectionAt: "gll_radar_scheduled_task_last_execution_timestamp_seconds",
  collectionOverdue: "gll_radar_scheduled_task_execution_overdue",
  httpRequests: "gll_radar_http_requests_total",
  httpSum: "gll_radar_http_request_duration_seconds_sum",
  httpCount: "gll_radar_http_request_duration_seconds_count",
  jobSum: "gll_radar_job_processing_duration_seconds_sum",
  jobCount: "gll_radar_job_processing_duration_seconds_count",
});
const TABS = [
  ["overview", "Visão geral"], ["queues", "Filas"], ["queries", "Consultas"],
  ["tenders", "Editais"], ["controls", "Controles"],
];
const UNAVAILABLE = "Indisponível";
const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

export function normalizeObservabilityPayload(payload) {
  if (!isRecord(payload) || payload.schemaVersion !== "1.0" || !Array.isArray(payload.metrics)) return null;
  const families = payload.metrics.filter((family) =>
    isRecord(family) && typeof family.name === "string" && Array.isArray(family.samples));
  return families.length ? { schemaVersion: payload.schemaVersion, generatedAt: payload.generatedAt || null, families } : null;
}

function samples(normalized, name) {
  if (!normalized) return [];
  return normalized.families.flatMap((family) => family.samples
    .filter((sample) => isRecord(sample) && sample.name === name && isRecord(sample.labels) && Number.isFinite(Number(sample.value)))
    .map((sample) => ({ labels: sample.labels, value: Number(sample.value) })));
}
function value(normalized, name, labels = {}) {
  return samples(normalized, name).find((sample) =>
    Object.entries(labels).every(([key, item]) => String(sample.labels[key]) === String(item)))?.value ?? null;
}
function sum(normalized, name, predicate) {
  const selected = samples(normalized, name).filter((sample) => predicate(sample.labels));
  return selected.length ? selected.reduce((total, sample) => total + sample.value, 0) : null;
}
function queueCount(normalized, states) {
  return sum(normalized, N.queue, (labels) => states.includes(String(labels.status || "")));
}
function average(normalized, sumName, countName, labels = {}) {
  const total = value(normalized, sumName, labels);
  const count = value(normalized, countName, labels);
  return total === null || count === null || count <= 0 ? null : total / count;
}
function aggregateAverage(normalized, sumName, countName) {
  const totals = samples(normalized, sumName).reduce((result, sample) => result + sample.value, 0);
  const counts = samples(normalized, countName).reduce((result, sample) => result + sample.value, 0);
  return counts > 0 ? totals / counts : null;
}
function serviceStatus(status) {
  if (status === "ok") return "Operacional";
  if (status === "unavailable") return "Indisponível";
  return UNAVAILABLE;
}

export function summarizeObservability(payload, health = {}) {
  const data = normalizeObservabilityPayload(payload);
  if (!data) return null;
  const queueRows = samples(data, N.queue);
  const requestRows = samples(data, N.httpRequests);
  const endpoints = [...new Set(requestRows.map((row) => row.labels.endpoint).filter(Boolean))].sort();
  const overdue = value(data, N.collectionOverdue, { task: "collection" });
  return {
    services: {
      api: serviceStatus(health.live?.status),
      runtime: serviceStatus(health.ready?.status),
      collection: overdue === null ? UNAVAILABLE : overdue === 0 ? "No prazo" : "Atrasada",
    },
    discovered: value(data, N.discovered),
    processed: value(data, N.processed),
    complete: value(data, N.complete),
    partial: value(data, N.partial),
    failed: value(data, N.failed),
    published: value(data, N.published),
    latestCollection: value(data, N.collectionAt, { task: "collection" }),
    averageProcessing: aggregateAverage(data, N.jobSum, N.jobCount),
    persistentFailures: queueCount(data, ["failed"]),
    queue: {
      pending: queueCount(data, ["queued"]),
      running: queueCount(data, ["running"]),
      completed: queueCount(data, ["succeeded"]),
      failed: queueCount(data, ["failed"]),
      review: null,
      oldestPendingAge: samples(data, N.queueAge).length
        ? Math.max(...samples(data, N.queueAge).map((row) => row.value)) : null,
      kinds: [...new Set(queueRows.map((row) => row.labels.kind).filter(Boolean))].sort(),
    },
    requests: endpoints.map((endpoint) => {
      const rows = requestRows.filter((row) => row.labels.endpoint === endpoint);
      return {
        endpoint: String(endpoint),
        requests: rows.reduce((total, row) => total + row.value, 0),
        errors: rows.filter((row) => row.labels.category !== "success").reduce((total, row) => total + row.value, 0),
        averageDuration: average(data, N.httpSum, N.httpCount, { endpoint }),
      };
    }),
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
function count(value) {
  return value === null || value === undefined ? UNAVAILABLE
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}
function duration(value) {
  if (value === null || value === undefined) return UNAVAILABLE;
  return value < 1 ? Math.round(value * 1000) + " ms"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value) + " s";
}
function date(value) {
  if (value === null || value === undefined || value <= 0) return UNAVAILABLE;
  const parsed = new Date(value * 1000);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed)
    : UNAVAILABLE;
}
function metricCard(label, amount, detail) {
  return '<article class="section-band radar-engine-metric-card"><span>' + escapeHtml(label) +
    '</span><strong>' + escapeHtml(amount) + '</strong><small>' + escapeHtml(detail) + "</small></article>";
}
function serviceCard(label, status, detail) {
  const tone = status === "Operacional" || status === "No prazo" ? "is-success"
    : status === "Atrasada" ? "is-danger" : "is-unavailable";
  return '<article class="section-band radar-engine-service-card"><div><h3>' + escapeHtml(label) +
    '</h3><p>' + escapeHtml(detail) + '</p></div><span class="radar-engine-state ' + tone + '">' +
    escapeHtml(status) + "</span></article>";
}
function emptyTable(columns, title, detail) {
  return '<tr><td colspan="' + columns + '"><div class="empty-state compact-empty"><strong>' +
    escapeHtml(title) + "</strong><span>" + escapeHtml(detail) + "</span></div></td></tr>";
}
function tabs(active) {
  return '<div class="radar-engine-tabs" role="tablist" aria-label="Seções do painel Radar Engine">' +
    TABS.map(([id, label]) => '<button type="button" class="radar-engine-tab' +
      (id === active ? " active" : "") + '" id="radar-engine-tab-' + id + '" role="tab" aria-selected="' +
      String(id === active) + '" aria-controls="radar-engine-panel-' + id + '" data-radar-engine-tab="' + id +
      '">' + escapeHtml(label) + "</button>").join("") + "</div>";
}
function sectionHeading(title, description) {
  return '<div class="radar-engine-section-heading"><div><h2>' + escapeHtml(title) +
    '</h2><p>' + escapeHtml(description) + "</p></div></div>";
}
function requestsTable(requests) {
  if (!requests.length) return emptyTable(4, "Histórico indisponível", "A Tarefa 4 fornece métricas agregadas, sem registros individuais de consultas.");
  return requests.map((row) => "<tr><td>" + escapeHtml(row.endpoint) + "</td><td>" +
    count(row.requests) + "</td><td>" + count(row.errors) + "</td><td>" +
    duration(row.averageDuration) + "</td></tr>").join("");
}
function queuePanel(summary) {
  const q = summary?.queue || {};
  const statuses = [
    ["Pendentes", q.pending], ["Em execução", q.running], ["Concluídas", q.completed],
    ["Com falha", q.failed], ["Em revisão", q.review],
  ];
  return '<section id="radar-engine-panel-queues" class="radar-engine-tab-panel hidden" role="tabpanel" aria-labelledby="radar-engine-tab-queues" data-radar-engine-panel="queues">' +
    sectionHeading("Filas de processamento", "O contrato de métricas expõe contagens por tipo e estado, sem itens individuais ou prioridade.") +
    '<div class="radar-engine-filter-row"><label>Tipo de tarefa<select disabled aria-describedby="radar-engine-filter-note"><option>Todos os tipos</option></select></label>' +
    '<label>Prioridade<select disabled aria-describedby="radar-engine-filter-note"><option>Todas as prioridades</option></select></label>' +
    '<p id="radar-engine-filter-note" class="radar-engine-help">Filtros detalhados aguardam a API administrativa de filas.</p></div>' +
    '<div class="radar-engine-queue-cards">' + statuses.map((row) => metricCard(row[0], count(row[1]), "Contagem agregada")).join("") + "</div>" +
    '<section class="section-band radar-engine-table-panel"><div class="radar-engine-section-heading"><div><h3>Tarefas</h3><p>Tipo, prioridade, idade e histórico por job ainda não estão disponíveis.</p></div></div>' +
    '<div class="table-wrap"><table><thead><tr><th>Tarefa</th><th>Tipo</th><th>Prioridade</th><th>Status</th><th>Atualizada</th></tr></thead><tbody>' +
    emptyTable(5, "Detalhes da fila indisponíveis", "A Tarefa 4 fornece somente contagens agregadas.") +
    "</tbody></table></div></section></section>";
}
function queriesPanel(summary) {
  return '<section id="radar-engine-panel-queries" class="radar-engine-tab-panel hidden" role="tabpanel" aria-labelledby="radar-engine-tab-queries" data-radar-engine-panel="queries">' +
    sectionHeading("Consultas ao PNCP", "Contadores e tempos agregados disponíveis no contrato de observabilidade.") +
    '<section class="section-band radar-engine-table-panel"><div class="table-wrap"><table><thead><tr><th>Endpoint</th><th>Requisições</th><th>Erros</th><th>Duração média</th></tr></thead><tbody>' +
    requestsTable(summary?.requests || []) + "</tbody></table></div></section>" +
    '<div class="section-band radar-engine-notice" role="status"><strong>Histórico por consulta indisponível</strong><p>Quantidade de registros retornados, tentativas e mensagens por chamada não são expostas pelas métricas agregadas.</p></div></section>';
}
function tendersPanel(summary) {
  const values = summary || {};
  return '<section id="radar-engine-panel-tenders" class="radar-engine-tab-panel hidden" role="tabpanel" aria-labelledby="radar-engine-tab-tenders" data-radar-engine-panel="tenders">' +
    sectionHeading("Editais e itens", "O contrato expõe totais de processamento, sem identificadores ou histórico por edital.") +
    '<div class="radar-engine-metric-grid">' +
    metricCard("Descobertos", count(values.discovered), "Identidades persistidas") +
    metricCard("Processados", count(values.processed), "Snapshot parcial ou completo") +
    metricCard("Itens completos", count(values.complete), "Estado atual") +
    metricCard("Itens parciais", count(values.partial), "Não representa lista completa") +
    metricCard("Falhas de itens", count(values.failed), "Último processamento") + "</div>" +
    '<section class="section-band radar-engine-table-panel"><div class="radar-engine-section-heading"><div><h3>Histórico de processamento</h3><p>Erros, status e snapshots por edital exigem uma API administrativa protegida.</p></div></div>' +
    '<div class="table-wrap"><table><thead><tr><th>Edital</th><th>Itens</th><th>Status</th><th>Último processamento</th><th>Erro</th></tr></thead><tbody>' +
    emptyTable(5, "Lista de editais indisponível", "Nenhum identificador de edital é incluído no contrato de métricas.") +
    "</tbody></table></div></section></section>";
}
function controlsPanel() {
  const explanation = "Ação bloqueada até existir API protegida com autorização administrativa, auditoria e controle contra duplicidade.";
  return '<section id="radar-engine-panel-controls" class="radar-engine-tab-panel hidden" role="tabpanel" aria-labelledby="radar-engine-tab-controls" data-radar-engine-panel="controls">' +
    sectionHeading("Controles administrativos", "As rotas de observabilidade da Tarefa 4 são somente de leitura.") +
    '<div class="section-band radar-engine-notice" role="status"><strong>Operações ainda não conectadas</strong><p>' + escapeHtml(explanation) + "</p></div>" +
    '<div class="radar-engine-controls-grid">' +
    '<article class="section-band radar-engine-control-card"><h3>Nova coleta incremental</h3><p>Solicita uma coleta sem criar tarefas duplicadas.</p><button class="primary-action" type="button" disabled aria-describedby="radar-engine-control-note">Solicitar coleta</button></article>' +
    '<article class="section-band radar-engine-control-card"><h3>Reprocessar falhas</h3><p>Reenfileira falhas preservando o histórico.</p><button class="quiet-action" type="button" disabled aria-describedby="radar-engine-control-note">Reprocessar falhas</button></article>' +
    '<article class="section-band radar-engine-control-card"><h3>Consultar licitação</h3><label>Identificador PNCP<input type="text" disabled placeholder="Informe o identificador PNCP" /></label><button class="quiet-action" type="button" disabled aria-describedby="radar-engine-control-note">Consultar edital</button></article>' +
    '<article class="section-band radar-engine-control-card"><h3>Reconciliar período</h3><div class="radar-engine-date-fields"><label>Data inicial<input type="date" disabled /></label><label>Data final<input type="date" disabled /></label></div><button class="quiet-action" type="button" disabled aria-describedby="radar-engine-control-note">Solicitar reconciliação</button></article>' +
    '<article class="section-band radar-engine-control-card"><h3>Status dos workers</h3><p>O contrato mostra atraso agregado do agendador, não a saúde individual de cada worker.</p><span class="radar-engine-state is-unavailable">Indisponível</span></article>' +
    '</div><p id="radar-engine-control-note" class="radar-engine-help">Operações custosas exigirão confirmação explícita, limite de taxa e auditoria antes de serem habilitadas.</p></section>';
}
function render(summary, state) {
  const services = [
    serviceCard("API Radar Engine", summary?.services.api || UNAVAILABLE, "Sinal de vida HTTP"),
    serviceCard("Runtime e persistência", summary?.services.runtime || UNAVAILABLE, "Prontidão da aplicação e do PostgreSQL"),
    serviceCard("Coleta agendada", summary?.services.collection || UNAVAILABLE, "Atraso calculado pelo scheduler"),
  ].join("");
  const message = state.error ? "Não foi possível consultar a integração de observabilidade."
    : state.metricsProvider ? (state.loading ? "Consultando a integração protegida…" : "Dados recebidos da integração protegida.")
      : "Aguardando integração protegida. As rotas internas do Engine não são chamadas diretamente pelo navegador.";
  const tone = state.error ? "danger" : state.metricsProvider ? "info" : "warning";
  const disabled = !state.metricsProvider || state.loading ? " disabled" : "";
  const busy = state.loading ? ' aria-busy="true"' : "";
  const values = summary || {};
  return '<div class="page-heading radar-engine-page-heading"><div><span class="eyebrow">ADMINISTRAÇÃO · RADAR</span><h1 id="radarEngineAdminTitle">Processamento do Radar</h1><p>Acompanhe a coleta, as filas e o processamento do GLL Radar Engine.</p></div><button class="quiet-action" type="button" data-radar-engine-refresh' + disabled + busy + '>Atualizar dados</button></div>' +
    '<div class="radar-engine-notice tone-' + tone + '" role="status" aria-live="polite">' + escapeHtml(message) + "</div>" +
    tabs(state.activeTab) +
    '<section id="radar-engine-panel-overview" class="radar-engine-tab-panel" role="tabpanel" aria-labelledby="radar-engine-tab-overview" data-radar-engine-panel="overview">' +
    sectionHeading("Status dos serviços", "O estado aparece como indisponível quando a fonte não fornece um valor.") +
    '<div class="radar-engine-service-grid">' + services + "</div>" +
    '<div class="radar-engine-metric-grid">' +
    metricCard("Última coleta PNCP", date(values.latestCollection), "Início do job agendado") +
    metricCard("Editais descobertos", count(values.discovered), "Identidades persistidas") +
    metricCard("Editais publicados", count(values.published), "Contador desde o início do processo") +
    metricCard("Tarefas pendentes", count(values.queue?.pending), "Jobs no estado queued") +
    metricCard("Falhas persistentes", count(values.persistentFailures), "Jobs no estado failed") +
    metricCard("Tempo médio de processamento", duration(values.averageProcessing), "Histograma desde o início do processo") +
    '</div><div class="radar-engine-limitation" role="note"><strong>Escopo dos dados</strong><span>As métricas da Tarefa 4 são agregadas e não incluem IDs de editais, payloads ou histórico detalhado.</span></div></section>' +
    queuePanel(summary) + queriesPanel(summary) + tendersPanel(summary) + controlsPanel();
}

export function createRadarEngineAdminFeature({ container, metricsProvider = null } = {}) {
  const state = { activeTab: "overview", summary: null, loading: false, error: false, metricsProvider };
  if (!container) return { showPage: async () => undefined, refresh: async () => undefined };

  function paint() {
    container.setAttribute?.("aria-busy", String(state.loading));
    container.innerHTML = render(state.summary, state);
    container.querySelectorAll?.("[data-radar-engine-tab]").forEach((tab) => {
      const active = tab.dataset.radarEngineTab === state.activeTab;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    container.querySelectorAll?.("[data-radar-engine-panel]").forEach((panel) =>
      panel.classList.toggle("hidden", panel.dataset.radarEnginePanel !== state.activeTab));
  }

  async function refresh() {
    if (state.loading) return null;
    if (!state.metricsProvider) {
      paint();
      return null;
    }
    state.loading = true;
    state.error = false;
    paint();
    try {
      const result = await state.metricsProvider.load();
      state.summary = summarizeObservability(result?.metrics, { live: result?.live, ready: result?.ready });
      if (!state.summary) state.error = true;
      return state.summary;
    } catch {
      state.summary = null;
      state.error = true;
      return null;
    } finally {
      state.loading = false;
      paint();
    }
  }

  container.addEventListener?.("click", (event) => {
    const tab = event.target?.closest?.("[data-radar-engine-tab]");
    if (tab && TABS.some(([id]) => id === tab.dataset.radarEngineTab)) {
      state.activeTab = tab.dataset.radarEngineTab;
      paint();
      return;
    }
    if (event.target?.closest?.("[data-radar-engine-refresh]")) void refresh();
  });

  return { showPage: () => refresh(), refresh, state };
}
