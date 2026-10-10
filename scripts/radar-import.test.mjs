import assert from "node:assert/strict";
import test from "node:test";
import {
  createRadarImportService,
  normalizeSelectedRadarItemNumbers,
} from "../web/radar-import.js";
import {
  createRadarItemSelectionState,
  paginateRadarItems,
} from "../web/radar-details.js";

test("normaliza seleção de itens e rejeita vazios, repetidos e números inválidos", () => {
  assert.deepEqual(normalizeSelectedRadarItemNumbers([3, "1", 2]), ["3", "1", "2"]);
  assert.throws(() => normalizeSelectedRadarItemNumbers([]), /Selecione ao menos um item/);
  assert.throws(() => normalizeSelectedRadarItemNumbers([0]), /número de item inválido/);
  assert.throws(() => normalizeSelectedRadarItemNumbers([1, "1"]), /itens repetidos/);
});

test("seleção permanece ao navegar entre páginas e pode importar parte ou todos os itens elegíveis", () => {
  const items = Array.from({ length: 45 }, (_, index) => ({ number: index + 1 }));
  const selected = createRadarItemSelectionState();
  const firstPage = paginateRadarItems(items, 1, 20);
  assert.equal(firstPage.items.length, 20);
  selected.add(firstPage.items[2].number);
  const secondPage = paginateRadarItems(items, 2, 20);
  assert.equal(secondPage.page, 2);
  assert.equal(secondPage.items[0].number, 21);
  selected.add(secondPage.items[0].number);
  assert.deepEqual(selected.values(), ["3", "21"]);

  selected.selectAll(items, new Set(["1", "2"]));
  assert.equal(selected.size, 43);
  assert.equal(selected.has("1"), false);
  assert.equal(selected.has("45"), true);
  selected.clear();
  assert.equal(selected.size, 0);
});

test("serviço envia somente os itens selecionados à função autenticada", async () => {
  let invocation = null;
  const service = createRadarImportService({ getClient: () => ({
    functions: { invoke: async (...args) => {
      invocation = args;
      return { data: { ok: true, bid_id: "bid-1", created_items: 2 }, error: null };
    } },
  }) });
  const result = await service.importSelected("12345678000199-1-000001/2026", [2, 4]);
  assert.equal(result.bid_id, "bid-1");
  assert.equal(invocation[0], "radar-import");
  assert.deepEqual(invocation[1].body, {
    action: "import",
    numberControlPncp: "12345678000199-1-000001/2026",
    selectedItemNumbers: ["2", "4"],
  });
});

test("consulta vínculo e números de origem visíveis pela RLS", async () => {
  const dataByTable = {
    radar_importacoes: { data: { id: "import-1", bid_id: "bid-1" }, error: null },
    bids: { data: { id: "bid-1", edital_number: "12/2026", buyer_agency: "Órgão", status: "Em Analise" }, error: null },
    items: { data: [{ radar_numero_item_pncp: "1" }, { radar_numero_item_pncp: "2" }], error: null },
  };
  const client = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        maybeSingle: async () => dataByTable[table],
        then(resolve, reject) { return Promise.resolve(dataByTable[table]).then(resolve, reject); },
      };
      return query;
    },
  };
  const service = createRadarImportService({ getClient: () => client });
  const status = await service.loadImportStatus("12345678000199-1-000001/2026");
  assert.equal(status.bidId, "bid-1");
  assert.equal(status.editalNumber, "12/2026");
  assert.deepEqual([...status.itemNumbers], ["1", "2"]);
});
