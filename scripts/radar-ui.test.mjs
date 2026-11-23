import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
const searchFeature = readFileSync(new URL("../web/radar-search.js", import.meta.url), "utf8");
const detailsFeature = readFileSync(new URL("../web/radar-details.js", import.meta.url), "utf8");
const preprocessedFeature = readFileSync(new URL("../web/radar-preprocessed.js", import.meta.url), "utf8");
const importFeature = readFileSync(new URL("../web/radar-import.js", import.meta.url), "utf8");
const designSystem = readFileSync(new URL("../web/design-system/components.js", import.meta.url), "utf8");
const radarStory = readFileSync(new URL("../stories/patterns/Radar.stories.js", import.meta.url), "utf8");

test("os cards do Radar exibem a data explícita da fase de lances como Data da Disputa", () => {
  const resultCard = searchFeature.match(/function renderResultCard\(result\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(resultCard, "renderizador dos cards de resultados presente");
  assert.match(resultCard, /<dt>Data da Disputa<\/dt>/u);
  assert.match(resultCard, /result\.bidPhaseStartAt/u);
  assert.match(resultCard, /Não confirmada/u);
  assert.doesNotMatch(resultCard, /Publicação no PNCP/u);
});

test("os detalhes exibem Data da Disputa e removem os campos operacionais antigos", () => {
  const renderGeneral = detailsFeature.match(/function renderGeneral\(contract, sources, platform = \{\}\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(renderGeneral, "renderizador dos detalhes gerais presente");
  assert.match(renderGeneral, /\["Data da Disputa", dateValue\(contract\.dataInicioFaseLances\)\]/u);
  assert.doesNotMatch(renderGeneral, /Atualização dos dados no Radar/u);
  assert.doesNotMatch(renderGeneral, /\["Situação", contract\.situacaoCompraNome\]/u);
});

test("a interface pública mantém os filtros solicitados e fixa o Portal como plataforma elegível", () => {
  const searchForm = html.match(/<form id="radarSearchForm"[\s\S]*?<\/form>/u)?.[0];
  assert.ok(searchForm, "formulário de pesquisa do Radar presente");
  for (const id of [
    "radarTagInput", "radarModalityDetails", "radarUf", "radarMunicipality",
    "radarBidPhaseFrom", "radarBidPhaseTo", "radarSituation",
  ]) assert.match(searchForm, new RegExp(`id="${id}"`, "u"));
  assert.match(searchForm, /id="radarModalityHelp"/u);
  assert.match(searchForm, /id="radarModalityError"/u);
  assert.match(searchFeature, /name="radarModality"[^>]* disabled/u);
  assert.match(searchFeature, /if \(!availableIds\.has\(modalityId\)\)/u);
  assert.match(searchForm, /<label for="radarBidPhaseFrom">Fase de lances a partir de/u);
  assert.match(searchForm, /<label for="radarBidPhaseTo">Fase de lances até/u);
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

test("a interface omite o resumo operacional e não exibe o aviso normal de cobertura", () => {
  for (const id of [
    "radarOperationalSummary", "radarTotalFound", "radarTotalOpen",
    "radarLastSuccessfulSync", "radarCoverageValue", "radarConfirmationValue",
    "radarUpdateStateValue",
  ]) assert.doesNotMatch(html, new RegExp(`id="${id}"`, "u"));
  assert.doesNotMatch(html, /radar-operational-summary|radar-operational-card/u);
  assert.doesNotMatch(searchFeature, /function renderOperationalSummary/u);
  const coverageRenderer = searchFeature.match(/function renderCoverage\(\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(coverageRenderer, "o feedback de pesquisa continua implementado");
  assert.match(coverageRenderer, /state\.searching/u);
  assert.match(coverageRenderer, /state\.error/u);
  assert.doesNotMatch(coverageRenderer, /radarOperationalStatus|coverageTime|state\.coverage/u);
  assert.match(searchFeature, /Nenhum edital encontrado/u);
});

test("detalhes, favoritos e importação usam o cliente Supabase e preservam os controles da tela", () => {
  for (const id of ["radarDetailsView", "radarDetailsFavoriteButton", "radarDetailsRefreshButton", "radarDetailsContent"]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }
  assert.match(detailsFeature, /functions\.invoke\("radar-details"/u);
  assert.match(detailsFeature, /imports\.importSelected\(/u);
  assert.match(detailsFeature, /data-radar-import-start/u);
  assert.match(html, /<dialog id="radarImportConfirmDialog"[^>]+aria-labelledby="radarImportConfirmTitle"[^>]+aria-describedby="radarImportConfirmSummary"/u);
  assert.match(detailsFeature, /function openImportConfirmationDialog\(\)/u);
  assert.match(detailsFeature, /dialog\.showModal\(\)/u);
  assert.match(detailsFeature, /data-radar-import-confirm/u);
  assert.match(detailsFeature, /data-radar-import-cancel/u);
  assert.doesNotMatch(detailsFeature, /radar-import-confirmation" role="group"/u);
  assert.match(designSystem, /id: "radarImportConfirmDialog", area: "Radar"/u);
  assert.match(radarStory, /name: "Confirmação do cadastro do edital"/u);
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
