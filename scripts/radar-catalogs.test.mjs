import assert from "node:assert/strict";
import test from "node:test";
import { createRadarCatalogsService } from "../web/radar-catalogs.js";

function mockSupabase({ rows = [], error = null } = {}) {
  const calls = [];
  const client = {
    calls,
    invocations: [],
    from(table) {
      const call = { table, select: null, filters: [], orders: [] };
      calls.push(call);
      const query = {
        select(columns) { call.select = columns; return query; },
        eq(column, value) { call.filters.push([column, value]); return query; },
        order(column, options) { call.orders.push([column, options]); return query; },
        then(resolve, reject) { return Promise.resolve({ data: rows, error }).then(resolve, reject); },
      };
      return query;
    },
    functions: {
      async invoke(name, options) {
        client.invocations.push({ name, options });
        return { data: { ok: true }, error };
      },
    },
  };
  return client;
}

test("modalidades, estados e municípios são consultados no banco com estado ativo", async () => {
  const client = mockSupabase({ rows: [{ pncp_id: 999, name: "Modalidade dinâmica" }] });
  const service = createRadarCatalogsService(client);

  assert.deepEqual(await service.listModalities(), [{ pncp_id: 999, name: "Modalidade dinâmica" }]);
  assert.deepEqual(await service.listStates(), [{ pncp_id: 999, name: "Modalidade dinâmica" }]);
  assert.deepEqual(await service.listMunicipalitiesByUf("sp"), [{ pncp_id: 999, name: "Modalidade dinâmica" }]);

  assert.deepEqual(client.calls.map(({ table }) => table), [
    "radar_catalog_modalities",
    "radar_catalog_states",
    "radar_catalog_municipalities",
  ]);
  assert.ok(client.calls.every(({ filters }) => filters.some(([column, value]) => column === "is_active" && value === true)));
  assert.ok(client.calls[2].filters.some(([column, value]) => column === "state_uf" && value === "SP"));
});

test("UF e endpoint inválidos são rejeitados antes de consultar o banco", async () => {
  const client = mockSupabase();
  const service = createRadarCatalogsService(client);

  await assert.rejects(service.listMunicipalitiesByUf("Sao Paulo"), /UF válida/);
  await assert.rejects(service.listParameters(""), /identificador de endpoint válido/);
  assert.equal(client.calls.length, 0);
});

test("metadados de endpoints e parâmetros vêm das tabelas de contrato", async () => {
  const client = mockSupabase({ rows: [{ id: "pncp-proposta.dataFinal", parameter_name: "dataFinal" }] });
  const service = createRadarCatalogsService(client);

  assert.deepEqual(await service.listEndpoints(), [{ id: "pncp-proposta.dataFinal", parameter_name: "dataFinal" }]);
  await service.listParameters("pncp-proposta");
  assert.equal(client.calls[0].table, "radar_api_endpoints");
  assert.equal(client.calls[1].table, "radar_api_parameters");
  assert.ok(client.calls[1].filters.some(([column, value]) => column === "endpoint_id" && value === "pncp-proposta"));
});

test("sincronização no frontend só é oferecida a Administrador e usa a Edge Function autenticada", async () => {
  const analystClient = mockSupabase();
  const analystService = createRadarCatalogsService(analystClient, { currentUserRole: "Analista" });
  await assert.rejects(analystService.syncCatalogs(), /Somente um Administrador/);
  assert.equal(analystClient.invocations.length, 0);

  const adminClient = mockSupabase();
  const adminService = createRadarCatalogsService(adminClient, { currentUserRole: "Administrador" });
  assert.deepEqual(await adminService.syncCatalogs(), { ok: true });
  assert.deepEqual(adminClient.invocations, [{ name: "radar-catalogs", options: { body: { action: "sync" } } }]);
});

test("falhas de consulta e sincronização são propagadas para a camada chamadora", async () => {
  const client = mockSupabase({ error: new Error("RLS bloqueou a consulta") });
  const service = createRadarCatalogsService(client, { currentUserRole: "Administrador" });
  await assert.rejects(service.listModalities(), /RLS bloqueou a consulta/);
  await assert.rejects(service.syncCatalogs(), /RLS bloqueou a consulta/);
});
