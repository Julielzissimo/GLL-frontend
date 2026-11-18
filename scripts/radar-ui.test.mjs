import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
const searchFeature = readFileSync(new URL("../web/radar-search.js", import.meta.url), "utf8");
const detailsFeature = readFileSync(new URL("../web/radar-details.js", import.meta.url), "utf8");
const preprocessedFeature = readFileSync(new URL("../web/radar-preprocessed.js", import.meta.url), "utf8");
const importFeature = readFileSync(new URL("../web/radar-import.js", import.meta.url), "utf8");

test("a interface pública mantém os filtros solicitados e fixa o Portal como plataforma elegível", () => {
  const searchForm = html.match(/<form id="radarSearchForm"[\s\S]*?<\/form>/u)?.[0];
  assert.ok(searchForm, "formulário de pesquisa do Radar presente");
  for (const id of [
    "radarTagInput", "radarModalityDetails", "radarUf", "radarMunicipality",
    "radarBidPhaseFrom", "radarBidPhaseTo", "radarSituation",
  ]) assert.match(searchForm, new RegExp(`id="${id}"`, "u"));
  assert.match(searchForm, /Portal de Compras Públicas/u);
  const platformSelect = searchForm.match(/<select id="radarPlatform"([^>]*)>([\s\S]*?)<\/select>/u);
  assert.ok(platformSelect, "campo da plataforma de disputa presente");
  assert.match(platformSelect[1], /\bdisabled\b/u);
  assert.match(platformSelect[2], /<option value="portal-de-compras-publicas" selected>Portal de Compras Públicas<\/option>/u);
  assert.doesNotMatch(searchForm, /radarPlatformHelp|Única plataforma exibida pelo Radar especializado; resultados confirmados pelo GLL Radar Engine\./u);
  assert.doesNotMatch(searchForm, /radar-platform-eligibility/u);
  assert.doesNotMatch(searchForm, /radarPlatformDetails|radarPlatforms|radarIncludeUnidentified/u);
  assert.doesNotMatch(detailsFeature, /new Option\(["']Não identificada["']/u);
  assert.match(html, /id="radarSortBy"/u);
  assert.match(html, /id="radarSortDirection"/u);
  assert.match(html, /id="radarPageSize"/u);
  assert.match(html, /id="radarPagination"/u);
});

test("a interface apresenta os indicadores de sincronização, cobertura, confirmação e resultado", () => {
  for (const id of [
    "radarOperationalSummary", "radarTotalFound", "radarTotalOpen",
    "radarLastSuccessfulSync", "radarCoverageValue", "radarConfirmationValue",
    "radarUpdateStateValue",
  ]) assert.match(html, new RegExp(`id="${id}"`, "u"));
  assert.match(searchFeature, /O contrato atual não expõe o horário do último lote do Engine/u);
  assert.match(searchFeature, /Coleta em andamento/u);
  assert.match(searchFeature, /Dados desatualizados/u);
  assert.match(searchFeature, /Erro de sincronização/u);
  assert.match(searchFeature, /Nenhum edital encontrado/u);
});

test("detalhes, favoritos e importação usam o cliente Supabase e preservam os controles da tela", () => {
  for (const id of ["radarDetailsView", "radarDetailsFavoriteButton", "radarDetailsRefreshButton", "radarDetailsContent"]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }
  assert.match(detailsFeature, /functions\.invoke\("radar-details"/u);
  assert.match(detailsFeature, /imports\.importSelected\(/u);
  assert.match(detailsFeature, /data-radar-import-start/u);
  assert.match(importFeature, /functions\.invoke\("radar-import"/u);
  assert.match(preprocessedFeature, /from\("radar_licitacoes"\)/u);
  assert.match(preprocessedFeature, /from\("radar_itens_sync"\)/u);
});

test("detalhes consultam documentos automaticamente e ocultam somente o título genérico Edital", () => {
  assert.match(detailsFeature, /await Promise\.all\(\[favoriteLoad, detailLoad\]\);\s*if \(state\.opened && currentId\(\) === id && state\.data\?\.documents\?\.status === "not_loaded"\) \{\s*void loadDocuments\(id\);/u);
  assert.doesNotMatch(detailsFeature, /data-radar-documents-refresh>Consultar documentos no PNCP/u);
  assert.match(detailsFeature, /data-radar-documents-refresh>Consultar novamente/u);
  assert.match(detailsFeature, /title\.trim\(\)\.toLocaleLowerCase\("pt-BR"\) === "edital" \? "" : `<strong>\$\{escapeHtml\(title\)\}<\/strong>`/u);
  assert.match(detailsFeature, /document\.publishedAt \? `<small>Publicado em/u);
});

test("pesquisa e detalhes não chamam diretamente PNCP, localhost ou IP privado", () => {
  const browserFlows = [searchFeature, detailsFeature, preprocessedFeature, importFeature].join("\n");
  assert.doesNotMatch(browserFlows, /fetch\s*\(\s*["'`]https?:\/\/(?:localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/iu);
  assert.doesNotMatch(browserFlows, /fetch\s*\(\s*["'`]https?:\/\/(?:www\.)?pncp\.gov\.br/iu);
});

test("o layout do resumo operacional se adapta a tablet e celular", () => {
  const styles = readFileSync(new URL("../web/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.radar-operational-summary\s*\{[^}]*repeat\(3/u);
  assert.match(styles, /\.radar-operational-summary\s*\{[^}]*repeat\(2/u);
  assert.match(styles, /\.radar-operational-summary\s*\{[^}]*minmax\(0,\s*1fr\)/u);
});
