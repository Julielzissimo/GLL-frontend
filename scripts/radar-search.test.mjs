import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRadarDetailsHref,
  buildRadarOpenProposalCountPayload,
  buildRadarSearchPayload,
  defaultRadarModalityIds,
  parseRadarTags,
  radarDefaultPeriodDates,
  radarEmptyResultState,
  radarOperationalStatus,
  radarPlatformConfirmation,
  radarPlatformSummary,
  validatedPncpSourceUrl,
  validatedPlatformSourceUrl,
} from "../web/radar-search.js";

test("monta a rota de detalhes do Radar sem reaproveitar filtros ou fragmentos da guia atual", () => {
  const href = buildRadarDetailsHref(
    "12345678000199-1-000079/2026",
    "https://gll.example/homolog/?page=home&licitacao=42#section",
  );
  const url = new URL(href);
  assert.equal(url.origin, "https://gll.example");
  assert.equal(url.pathname, "/homolog/");
  assert.equal(url.searchParams.get("page"), "radar-de-licitacoes");
  assert.equal(url.searchParams.get("radarDetail"), "12345678000199-1-000079/2026");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["page", "radarDetail"]);
  assert.equal(url.hash, "");
});

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

test("seleciona por padrão apenas Pregão - Eletrônico, Dispensa e Inexigibilidade pelos IDs PNCP", () => {
  assert.deepEqual(defaultRadarModalityIds([
    { pncp_id: 7, name: "Pregão - Presencial" },
    { pncp_id: 6, name: "Pregão - Eletrônico" },
    { pncp_id: 8, name: "Dispensa" },
    { pncp_id: 9, name: "Inexigibilidade" },
    { pncp_id: 18, name: "Pregão - Eletrônico Internacional" },
  ]), [6, 8, 9]);
  assert.deepEqual(defaultRadarModalityIds([
    { pncp_id: 6, name: "Pregão - Eletrônico" },
  ]), [6]);
});

test("envia somente as modalidades permitidas mesmo quando todas estão selecionadas", () => {
  const activeModalities = [1, 6, 8, 9, 18];
  const all = buildRadarSearchPayload({
    tags: ["ar condicionado", "mobiliário"],
    modalities: null,
    uf: "",
    municipalityIbgeId: "",
    bidPhaseFrom: "2026-10-01",
    bidPhaseTo: "2026-10-10",
    proposalReceiptState: "open",
    pageSize: 50,
    sortBy: "publishedAt",
    sortDirection: "desc",
  }, { page: 2, refreshCoverage: true, activeModalities });

  assert.deepEqual(all, {
    action: "search",
    dateFilterMode: "bid_phase",
    proposalReceiptState: "open",
    page: 2,
    pageSize: 50,
    sortBy: "publishedAt",
    sortDirection: "desc",
    refreshCoverage: true,
    tags: ["ar condicionado", "mobiliário"],
    modalities: [6, 8, 9],
    bidPhaseFrom: "2026-10-01",
    bidPhaseTo: "2026-10-10",
  });
  assert.equal("descricao" in all, false);
});

test("envia modalidade parcial permitida, UF e município somente quando relacionados", () => {
  const payload = buildRadarSearchPayload({
    tags: [],
    modalities: [8],
    uf: "sp",
    municipalityIbgeId: "3550308",
    proposalReceiptState: "closed",
    pageSize: 20,
  }, { activeModalities: [6, 8, 9] });
  assert.deepEqual(payload.modalities, [8]);
  assert.equal(payload.uf, "SP");
  assert.equal(payload.municipalityIbgeId, 3550308);
  assert.equal(payload.proposalReceiptState, "closed");
});

test("ignora seleções legadas de plataforma e nunca amplia a pesquisa pública", () => {
  const payload = buildRadarSearchPayload({
    tags: ["computador"],
    platformIds: ["legacy-platform-a", "legacy-platform-b"],
    includeUnidentified: true,
  });
  assert.equal("platformIds" in payload, false);
  assert.equal("includeUnidentified" in payload, false);
  assert.deepEqual(payload.tags, ["computador"]);
  assert.deepEqual(payload.modalities, [6, 8, 9]);
});

test("não amplia pesquisas com modalidades externas ou nenhuma modalidade selecionada", () => {
  assert.throws(() => buildRadarSearchPayload({
    modalities: [7],
  }, { activeModalities: [6, 8, 9] }), /modalidade/u);
  assert.throws(() => buildRadarSearchPayload({
    modalities: [],
  }, { activeModalities: [6, 8, 9] }), /modalidade/u);
});

test("preserva filtros oficiais e paginação sem enviar seletor de plataforma", () => {
  const payload = buildRadarSearchPayload({
    tags: ["computador"],
    modalities: [6],
    uf: "ES",
    municipalityIbgeId: "3205309",
    platformIds: ["legacy-platform"],
    includeUnidentified: true,
    bidPhaseFrom: "2026-10-01",
    bidPhaseTo: "2026-10-10",
    proposalReceiptState: "open",
  }, { page: 3, activeModalities: [1, 6] });
  assert.equal(payload.page, 3);
  assert.equal(payload.dateFilterMode, "bid_phase");
  assert.equal("platformIds" in payload, false);
  assert.equal("includeUnidentified" in payload, false);
  assert.equal(payload.uf, "ES");
  assert.equal(payload.municipalityIbgeId, 3205309);
  assert.deepEqual(payload.tags, ["computador"]);
  assert.deepEqual(payload.modalities, [6]);
  assert.equal(payload.bidPhaseFrom, "2026-10-01");
  assert.equal(payload.bidPhaseTo, "2026-10-10");
});

test("resume o estado da plataforma nos cards de resultados sem exibir confiança", () => {
  assert.deepEqual(radarPlatformSummary({ platformStatus: "identified", platformName: "Licitanet" }), {
    label: "Licitanet", note: "",
  });
  assert.deepEqual(radarPlatformSummary({ platformStatus: "identified", platformName: "Licitanet", platformConfidence: "low" }), {
    label: "Licitanet", note: "",
  });
  assert.deepEqual(radarPlatformSummary({ platformStatus: "identified", platformConflict: true }), {
    label: "Plataforma identificada", note: "Fontes divergentes; confira o edital.",
  });
  assert.equal(radarPlatformSummary({ platformStatus: "unidentified" }).label, "Não identificada");
  assert.equal(radarPlatformSummary({ platformStatus: "link_not_informed" }).label, "Link da plataforma não informado");
});

test("gera período inclusivo compartilhado no fuso de São Paulo e valida limites", () => {
  assert.deepEqual(radarDefaultPeriodDates(30, "2026-10-10"), {
    bidPhaseFrom: "2026-09-11",
    bidPhaseTo: "2026-10-10",
  });
  assert.throws(() => radarDefaultPeriodDates(0, "2026-10-10"), /entre 1 e 365/);
});

test("não declara ausência definitiva quando a cobertura está parcial ou não coletada", () => {
  assert.equal(radarEmptyResultState({ status: "partial", complete: false }).kind, "partial-empty");
  assert.equal(radarEmptyResultState({ status: "not_collected", complete: false }).kind, "not-collected");
  assert.equal(radarEmptyResultState({ status: "unconfirmed", complete: false }).kind, "coverage-unconfirmed-empty");
  assert.equal(radarEmptyResultState({ status: "complete", complete: true }).kind, "complete-empty");
  assert.equal(radarEmptyResultState({ status: "failed" }).title, "Erro de sincronização");
  assert.equal(radarEmptyResultState({ status: "stale" }).title, "Dados desatualizados");
});

test("calcula o total de editais recebendo propostas pela API para o mesmo escopo", () => {
  const filters = {
    tags: ["notebook"],
    modalities: [6],
    uf: "SP",
    municipalityIbgeId: "3550308",
    bidPhaseFrom: "2026-10-01",
    bidPhaseTo: "2026-10-31",
    proposalReceiptState: "all",
    pageSize: 50,
    sortBy: "publishedAt",
    sortDirection: "desc",
  };
  const countPayload = buildRadarOpenProposalCountPayload(filters, { activeModalities: [1, 6] });
  assert.equal(countPayload.proposalReceiptState, "open");
  assert.equal(countPayload.page, 1);
  assert.equal(countPayload.pageSize, 50);
  assert.equal(countPayload.refreshCoverage, false);
  assert.equal(countPayload.uf, "SP");
  assert.equal(countPayload.municipalityIbgeId, 3550308);
  assert.deepEqual(countPayload.modalities, [6]);
  assert.equal(buildRadarOpenProposalCountPayload({ ...filters, proposalReceiptState: "open" }), null);
});

test("distingue estado vazio, coleta ativa, dados desatualizados, indisponibilidade e erro de sincronização", () => {
  assert.equal(radarOperationalStatus({ coverage: { status: "complete" }, totalCount: 0 }).kind, "none-found");
  assert.equal(radarOperationalStatus({ coverage: { status: "partial" }, collectionTask: { status: "running" } }).kind, "collection-running");
  assert.equal(radarOperationalStatus({ coverage: { status: "stale" } }).kind, "stale");
  assert.equal(radarOperationalStatus({ coverage: { status: "not_collected" } }).kind, "collection-unavailable");
  assert.equal(radarOperationalStatus({ coverage: { status: "unconfirmed" } }).kind, "coverage-unconfirmed");
  assert.equal(radarOperationalStatus({ coverage: { status: "failed" } }).kind, "sync-error");
  assert.equal(radarOperationalStatus({ error: { kind: "connection" } }).kind, "collection-unavailable");
});

test("apresenta o Portal e a fonte e método retornados pela sincronização", () => {
  assert.deepEqual(radarPlatformConfirmation({
    platformClassificationMethod: "source_domain",
    platformEvidenceSource: "linkSistemaOrigem",
  }), {
    platform: "Portal de Compras Públicas",
    method: "Domínio da URL de origem",
    source: "Link de origem do PNCP",
  });
  assert.equal(radarPlatformConfirmation({}).platform, "Portal de Compras Públicas");
});

test("só aceita link HTTPS da origem oficial PNCP em caminho de aplicação", () => {
  assert.equal(validatedPncpSourceUrl("https://pncp.gov.br/app/editais/12345678000199/2026/1"), "https://pncp.gov.br/app/editais/12345678000199/2026/1");
  assert.equal(validatedPncpSourceUrl("http://pncp.gov.br/app/editais/1"), null);
  assert.equal(validatedPncpSourceUrl("https://pncp.gov.br.evil.example/app/editais/1"), null);
  assert.equal(validatedPncpSourceUrl("https://pncp.gov.br/manual/1"), null);
});

test("links da plataforma aceitam HTTPS seguro e rejeitam protocolos e credenciais perigosos", () => {
  assert.equal(validatedPlatformSourceUrl("https://licitanet.com.br/processo?id=4"), "https://licitanet.com.br/processo?id=4");
  assert.equal(validatedPlatformSourceUrl("http://licitanet.com.br/processo"), null);
  assert.equal(validatedPlatformSourceUrl("javascript:alert(1)"), null);
  assert.equal(validatedPlatformSourceUrl("https://user:pass@licitanet.com.br/"), null);
});
