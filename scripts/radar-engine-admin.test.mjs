import assert from "node:assert/strict";
import test from "node:test";

import {
  createRadarEngineAdminFeature,
  normalizeObservabilityPayload,
  summarizeObservability,
} from "../web/radar-engine-admin.js";

function family(name, samples) {
  return { name, type: "gauge", help: "sample", samples };
}

function sample(name, labels, value) {
  return { name, labels, value };
}

function observabilityPayload() {
  return {
    schemaVersion: "1.0",
    generatedAt: "2026-10-18T12:00:00+00:00",
    metrics: [
      family("gll_radar_tenders_discovered", [sample("gll_radar_tenders_discovered", {}, 12)]),
      family("gll_radar_tenders_processed", [sample("gll_radar_tenders_processed", {}, 8)]),
      family("gll_radar_tenders_items_complete", [sample("gll_radar_tenders_items_complete", {}, 6)]),
      family("gll_radar_tenders_items_partial", [sample("gll_radar_tenders_items_partial", {}, 2)]),
      family("gll_radar_tenders_items_failed", [sample("gll_radar_tenders_items_failed", {}, 1)]),
      family("gll_radar_tenders_published", [sample("gll_radar_tenders_published_total", {}, 4)]),
      family("gll_radar_queue_jobs", [
        sample("gll_radar_queue_jobs", { kind: "collect_pncp", status: "queued" }, 2),
        sample("gll_radar_queue_jobs", { kind: "collect_pncp", status: "running" }, 1),
        sample("gll_radar_queue_jobs", { kind: "collect_pncp", status: "succeeded" }, 7),
        sample("gll_radar_queue_jobs", { kind: "collect_pncp", status: "failed" }, 1),
        sample("gll_radar_queue_jobs", { kind: "collect_pncp", status: "needs_review" }, 99),
      ]),
      family("gll_radar_queue_oldest_pending_age_seconds", [
        sample("gll_radar_queue_oldest_pending_age_seconds", { kind: "collect_pncp" }, 90),
      ]),
      family("gll_radar_scheduled_task_last_execution_timestamp_seconds", [
        sample("gll_radar_scheduled_task_last_execution_timestamp_seconds", { task: "collection" }, 1792320000),
      ]),
      family("gll_radar_scheduled_task_execution_overdue", [
        sample("gll_radar_scheduled_task_execution_overdue", { task: "collection" }, 0),
      ]),
      family("gll_radar_http_requests", [
        sample("gll_radar_http_requests_total", { endpoint: "pncp-search", category: "success" }, 10),
        sample("gll_radar_http_requests_total", { endpoint: "pncp-search", category: "rate_limited" }, 2),
      ]),
      family("gll_radar_http_request_duration_seconds", [
        sample("gll_radar_http_request_duration_seconds_sum", { endpoint: "pncp-search" }, 6),
        sample("gll_radar_http_request_duration_seconds_count", { endpoint: "pncp-search" }, 3),
      ]),
      family("gll_radar_job_processing_duration_seconds", [
        sample("gll_radar_job_processing_duration_seconds_sum", { kind: "collect_pncp", outcome: "succeeded" }, 5),
        sample("gll_radar_job_processing_duration_seconds_count", { kind: "collect_pncp", outcome: "succeeded" }, 2),
        sample("gll_radar_job_processing_duration_seconds_sum", { kind: "retention", outcome: "failed" }, 9),
        sample("gll_radar_job_processing_duration_seconds_count", { kind: "retention", outcome: "failed" }, 2),
      ]),
    ],
  };
}

function fakeContainer() {
  const listeners = new Map();
  return {
    innerHTML: "",
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { listeners.set(name, handler); },
    querySelectorAll() { return []; },
    dispatch(name, event) { listeners.get(name)?.(event); },
  };
}

test("accepts the versioned Tarefa 4 metrics envelope and preserves absent values", () => {
  const payload = observabilityPayload();
  assert.equal(normalizeObservabilityPayload(payload).schemaVersion, "1.0");
  assert.equal(normalizeObservabilityPayload({ schemaVersion: "2.0", metrics: payload.metrics }), null);

  const summary = summarizeObservability(payload, {
    live: { status: "ok" },
    ready: { status: "ok" },
  });
  assert.equal(summary.discovered, 12);
  assert.equal(summary.published, 4);
  assert.equal(summary.persistentFailures, 1);
  assert.equal(summary.latestCollection, 1792320000);
  assert.equal(summary.averageProcessing, 3.5);
  assert.equal(summary.queue.pending, 2);
  assert.equal(summary.queue.running, 1);
  assert.equal(summary.queue.completed, 7);
  assert.equal(summary.queue.failed, 1);
  assert.equal(summary.queue.review, null);
  assert.equal(summary.services.api, "Operacional");
  assert.equal(summary.services.runtime, "Operacional");
  assert.equal(summary.services.collection, "No prazo");
  assert.deepEqual(summary.requests, [{
    endpoint: "pncp-search",
    requests: 12,
    errors: 2,
    averageDuration: 2,
  }]);
});

test("renders a protected-provider response in the administrative dashboard", async () => {
  const container = fakeContainer();
  let calls = 0;
  const feature = createRadarEngineAdminFeature({
    container,
    metricsProvider: {
      async load() {
        calls += 1;
        return {
          live: { status: "ok" },
          ready: { status: "ok" },
          metrics: observabilityPayload(),
        };
      },
    },
  });

  await feature.showPage();
  assert.equal(calls, 1);
  assert.equal(feature.state.summary.discovered, 12);
  assert.match(container.innerHTML, /Dados recebidos da integração protegida/);
  assert.match(container.innerHTML, /Última coleta PNCP/);
  assert.match(container.innerHTML, /12/);
  assert.match(container.innerHTML, /Histórico por consulta indisponível/);
  assert.match(container.innerHTML, /Solicitar coleta/);
  assert.match(container.innerHTML, /disabled aria-describedby="radar-engine-control-note"/);
  assert.equal(container.attributes["aria-busy"], "false");
});

test("does not request internal Engine routes without a protected provider", async () => {
  const container = fakeContainer();
  const feature = createRadarEngineAdminFeature({ container });
  await feature.showPage();

  assert.equal(feature.state.summary, null);
  assert.match(container.innerHTML, /Aguardando integração protegida/);
  assert.match(container.innerHTML, /As rotas internas do Engine não são chamadas diretamente pelo navegador/);
  assert.match(container.innerHTML, /Indisponível/);
  assert.match(container.innerHTML, /data-radar-engine-refresh disabled/);
});

test("reports provider errors without converting unavailable metrics to zero", async () => {
  const container = fakeContainer();
  const feature = createRadarEngineAdminFeature({
    container,
    metricsProvider: { async load() { throw new Error("private transport detail"); } },
  });

  await feature.showPage();
  assert.equal(feature.state.error, true);
  assert.equal(feature.state.summary, null);
  assert.match(container.innerHTML, /Não foi possível consultar a integração de observabilidade/);
  assert.match(container.innerHTML, /Editais descobertos<\/span><strong>Indisponível/);
  assert.doesNotMatch(container.innerHTML, /private transport detail/);
});

test("tab interaction selects only a known panel", () => {
  const container = fakeContainer();
  const feature = createRadarEngineAdminFeature({ container });
  const tab = { dataset: { radarEngineTab: "queries" } };
  const target = {
    closest(selector) {
      return selector === "[data-radar-engine-tab]" ? tab : null;
    },
  };

  container.dispatch("click", { target });
  assert.equal(feature.state.activeTab, "queries");
  assert.match(container.innerHTML, /id="radar-engine-tab-queries" role="tab" aria-selected="true"/);

  const invalidTarget = { closest: () => ({ dataset: { radarEngineTab: "unknown" } }) };
  container.dispatch("click", { target: invalidTarget });
  assert.equal(feature.state.activeTab, "queries");
});
