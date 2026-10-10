import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRadarSearchPayload,
  parseRadarTags,
  radarDefaultPeriodDates,
  radarEmptyResultState,
  validatedPncpSourceUrl,
} from "../web/radar-search.js";

test("normaliza termos de objeto, remove duplicatas sem acentos e mantém frases para OU", () => {
  assert.deepEqual(parseRadarTags("  aquisição de computadores,\nAQUISICAO de computadores; ar condicionado  "), [
    "aquisição de computadores",
    "ar condicionado",
  ]);
});

test("respeita os limites documentados de tags da pesquisa", () => {
  assert.throws(() => parseRadarTags(Array.from({ length: 26 }, (_, index) => `termo ${index}`).join(",")), /no máximo 25/);
  assert.throws(() => parseRadarTags("x".repeat(201)), /até 200 caracteres/);
});

test("envia filtros aceitos pelo motor, omite modalidades quando todas estão ativas e preserva paginação e atualização", () => {
  const activeModalities = [1, 3, 5];
  const all = buildRadarSearchPayload({
    tags: ["ar condicionado", "mobiliário"],
    modalities: null,
    uf: "",
    municipalityIbgeId: "",
    publishedFrom: "2026-10-01",
    publishedTo: "2026-10-10",
    proposalReceiptState: "open",
    pageSize: 50,
    sortBy: "publishedAt",
    sortDirection: "desc",
  }, { page: 2, refreshCoverage: true, activeModalities });

  assert.deepEqual(all, {
    action: "search",
    proposalReceiptState: "open",
    page: 2,
    pageSize: 50,
    sortBy: "publishedAt",
    sortDirection: "desc",
    refreshCoverage: true,
    tags: ["ar condicionado", "mobiliário"],
    publishedFrom: "2026-10-01",
    publishedTo: "2026-10-10",
  });
  assert.equal("descricao" in all, false);
});

test("envia modalidade parcial, UF e município somente quando relacionados", () => {
  const payload = buildRadarSearchPayload({
    tags: [],
    modalities: [5],
    uf: "sp",
    municipalityIbgeId: "3550308",
    proposalReceiptState: "closed",
    pageSize: 20,
  }, { activeModalities: [1, 3, 5] });
  assert.deepEqual(payload.modalities, [5]);
  assert.equal(payload.uf, "SP");
  assert.equal(payload.municipalityIbgeId, 3550308);
  assert.equal(payload.proposalReceiptState, "closed");
});

test("gera período inclusivo compartilhado no fuso de São Paulo e valida limites", () => {
  assert.deepEqual(radarDefaultPeriodDates(30, "2026-10-10"), {
    publishedFrom: "2026-09-11",
    publishedTo: "2026-10-10",
  });
  assert.throws(() => radarDefaultPeriodDates(0, "2026-10-10"), /entre 1 e 365/);
});

test("não declara ausência definitiva quando a cobertura está parcial ou não coletada", () => {
  assert.equal(radarEmptyResultState({ status: "partial", complete: false }).kind, "partial-empty");
  assert.equal(radarEmptyResultState({ status: "not_collected", complete: false }).kind, "not-collected");
  assert.equal(radarEmptyResultState({ status: "complete", complete: true }).kind, "complete-empty");
});

test("só aceita link HTTPS da origem oficial PNCP em caminho de aplicação", () => {
  assert.equal(validatedPncpSourceUrl("https://pncp.gov.br/app/editais/12345678000199/2026/1"), "https://pncp.gov.br/app/editais/12345678000199/2026/1");
  assert.equal(validatedPncpSourceUrl("http://pncp.gov.br/app/editais/1"), null);
  assert.equal(validatedPncpSourceUrl("https://pncp.gov.br.evil.example/app/editais/1"), null);
  assert.equal(validatedPncpSourceUrl("https://pncp.gov.br/manual/1"), null);
});
