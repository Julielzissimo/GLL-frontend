import { createRadarEngineAdminFeature } from "../../web/radar-engine-admin.js";

export default {
  title: "Patterns/Radar Engine Administration",
  tags: ["autodocs"],
};

const metrics = {
  schemaVersion: "1.0",
  generatedAt: "2026-10-18T12:00:00+00:00",
  metrics: [
    {
      name: "gll_radar_tenders_discovered",
      type: "gauge",
      help: "Synthetic Storybook fixture.",
      samples: [{ name: "gll_radar_tenders_discovered", labels: {}, value: 128 }],
    },
    {
      name: "gll_radar_tenders_published",
      type: "counter",
      help: "Synthetic Storybook fixture.",
      samples: [{ name: "gll_radar_tenders_published_total", labels: {}, value: 34 }],
    },
    {
      name: "gll_radar_queue_jobs",
      type: "gauge",
      help: "Synthetic Storybook fixture.",
      samples: [
        { name: "gll_radar_queue_jobs", labels: { kind: "collect_pncp", status: "queued" }, value: 4 },
        { name: "gll_radar_queue_jobs", labels: { kind: "collect_pncp", status: "running" }, value: 2 },
        { name: "gll_radar_queue_jobs", labels: { kind: "collect_pncp", status: "succeeded" }, value: 81 },
        { name: "gll_radar_queue_jobs", labels: { kind: "collect_pncp", status: "failed" }, value: 1 },
      ],
    },
    {
      name: "gll_radar_scheduled_task_last_execution_timestamp_seconds",
      type: "gauge",
      help: "Synthetic Storybook fixture.",
      samples: [{
        name: "gll_radar_scheduled_task_last_execution_timestamp_seconds",
        labels: { task: "collection" },
        value: 1792320000,
      }],
    },
    {
      name: "gll_radar_scheduled_task_execution_overdue",
      type: "gauge",
      help: "Synthetic Storybook fixture.",
      samples: [{ name: "gll_radar_scheduled_task_execution_overdue", labels: { task: "collection" }, value: 0 }],
    },
    {
      name: "gll_radar_job_processing_duration_seconds",
      type: "histogram",
      help: "Synthetic Storybook fixture.",
      samples: [
        { name: "gll_radar_job_processing_duration_seconds_sum", labels: { kind: "collect_pncp", outcome: "succeeded" }, value: 43 },
        { name: "gll_radar_job_processing_duration_seconds_count", labels: { kind: "collect_pncp", outcome: "succeeded" }, value: 10 },
      ],
    },
  ],
};

function renderDashboard(metricsProvider) {
  const page = document.createElement("section");
  page.className = "users-page radar-engine-admin-page";
  const feature = createRadarEngineAdminFeature({ container: page, metricsProvider });
  void feature.showPage();
  return page;
}

export const IntegrationPending = {
  name: "Integração protegida pendente",
  render: () => renderDashboard(),
};

export const MetricsAvailable = {
  name: "Métricas agregadas disponíveis",
  render: () => renderDashboard({
    async load() {
      return { live: { status: "ok" }, ready: { status: "ok" }, metrics };
    },
  }),
};
