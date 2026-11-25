import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { radarDisputePortalUrl } from "../web/radar-search.js";

const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
const appFeature = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");
const searchFeature = readFileSync(new URL("../web/radar-search.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../web/styles.css", import.meta.url), "utf8");
const detailsFeature = readFileSync(new URL("../web/radar-details.js", import.meta.url), "utf8");
const preprocessedFeature = readFileSync(new URL("../web/radar-preprocessed.js", import.meta.url), "utf8");
const importFeature = readFileSync(new URL("../web/radar-import.js", import.meta.url), "utf8");
const designSystem = readFileSync(new URL("../web/design-system/components.js", import.meta.url), "utf8");
const radarStory = readFileSync(new URL("../stories/patterns/Radar.stories.js", import.meta.url), "utf8");

test("o Portal de Disputa aparece entre Dados e PNCP nos cards do Radar, não em Licitações", () => {
  const actionsRenderer = searchFeature.match(/function renderResultActions\(result\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(actionsRenderer, "renderizador das ações dos cards do Radar presente");
  assert.match(actionsRenderer, /radar-dispute-portal-link[^>]*>Portal de Disputa/u);
  assert.match(actionsRenderer, /\[\["data", "Dados"\], \["portal", "Portal de Disputa"\], \["pncp", "PNCP"\]/u);
  assert.doesNotMatch(html, /<th scope="col">Portal de Disputa<\/th>/u);
  assert.doesNotMatch(appFeature, /data-bid-portal|bidDisputePortalUrl|openBidDisputePortal/u);
});

test("o Portal de Disputa usa o link do Radar ou busca pelo processo e órgão", () => {
  assert.equal(
    radarDisputePortalUrl({ platformSourceUrl: "https://operacao.portaldecompraspublicas.com.br/18/processo/123" }),
    "https://operacao.portaldecompraspublicas.com.br/18/processo/123",
  );
  const fallback = new URL(radarDisputePortalUrl({
    procurementNumber: "5/2026",
    agencyName: "Fundo Municipal de Assistência Social de Sapé",
  }));
  assert.equal(fallback.origin, "https://www.portaldecompraspublicas.com.br");
  assert.equal(fallback.pathname, "/processos");
  assert.equal(fallback.searchParams.get("processo"), "5/2026");
  assert.equal(fallback.searchParams.get("orgao"), "Fundo Municipal de Assistência Social de Sapé");
  const invalidLinkFallback = radarDisputePortalUrl({
    platformSourceUrl: "http://inseguro.example.com",
    procurementNumber: "5/2026",
  });
  assert.equal(invalidLinkFallback.startsWith("https://www.portaldecompraspublicas.com.br/processos?"), true);
});

test("a ação Itens expande o collapse no card sem navegar para outra página", () => {
  const actionsRenderer = searchFeature.match(/function renderResultActions\(result\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(actionsRenderer, "renderizador das ações dos cards do Radar presente");
  assert.match(actionsRenderer, /<button class="primary-action compact-action" type="button" data-radar-card-view="items"[\s\S]*?aria-expanded="false" aria-controls="radarDetailsView">/u);
  assert.doesNotMatch(actionsRenderer, /buildRadarDetailsHref|target="_blank"[^>]*aria-label="Ver itens em uma nova guia"/u);
  assert.match(detailsFeature, /inlineExpanded = sameCard \? !inlineExpanded : true/u);
  assert.match(detailsFeature, /card\.append\(detailViewNode\)/u);
  assert.match(detailsFeature, /new URL\(window\.location\.href\)\.searchParams\.get\("radarDetail"\)/u);
  assert.match(searchFeature, /actions\.syncDetailRoute\?\.\(\)/u);
});

test("os cards do Radar exibem a data explícita da fase de lances como Data da Disputa", () => {
  const resultCard = searchFeature.match(/function renderResultCard\(result\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(resultCard, "renderizador dos cards de resultados presente");
  assert.match(resultCard, /<dt>Data da Disputa<\/dt>/u);
  assert.match(resultCard, /result\.bidPhaseStartAt/u);
  assert.match(resultCard, /Não confirmada/u);
  assert.doesNotMatch(resultCard, /Publicação no PNCP/u);
});

test("a listagem ordena pelas disputas mais recentes e permite expandir o órgão responsável", () => {
  const resultCard = searchFeature.match(/function renderResultCard\(result\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(resultCard, "renderizador dos cards de resultados presente");
  assert.match(html, /option value="bidPhaseStartAt" selected>Data da Disputa/u);
  assert.match(html, /option value="desc" selected>Mais recente \/ maior primeiro/u);
  assert.match(searchFeature, /sortDirection: filters\.sortDirection \|\| "desc"/u);
  assert.match(searchFeature, /sortDirection: root\.querySelector\("#radarSortDirection"\)\?\.value \|\| "desc"/u);
  assert.match(searchFeature, /byId\("radarSortDirection"\)\.value = "desc"/u);
  assert.match(resultCard, /class="radar-organization-field"/u);
  assert.match(searchFeature, /data-radar-organization-toggle/u);
  assert.match(resultCard, /data-radar-organization-toggle aria-expanded="false"/u);
  assert.match(searchFeature, /aria-expanded="false"/u);
  assert.match(styles, /\.radar-organization-toggle\.is-truncated[^}]*-webkit-line-clamp: 2/u);
  assert.match(resultCard, /radarPlatformSummary\(result\)/u);
  assert.match(resultCard, /platform\.label/u);
  assert.match(resultCard, /platform\.note \? `<small class="radar-platform-card-note" role="status">/u);
  assert.doesNotMatch(resultCard, /platform\.(?:source|method|confidence)/u);
});

test("os detalhes exibem Data da Disputa e removem os campos operacionais antigos", () => {
  const renderGeneral = detailsFeature.match(/function renderGeneral\(contract, sources, platform = \{\}, catalogSource = "local"\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(renderGeneral, "renderizador dos detalhes gerais presente");
  assert.match(renderGeneral, /\["Data da Disputa", dateValue\(contract\.dataInicioFaseLances\)\]/u);
  assert.doesNotMatch(renderGeneral, /Atualização dos dados no Radar/u);
  assert.doesNotMatch(renderGeneral, /\["Situação", contract\.situacaoCompraNome\]/u);
});

test("o detalhe da plataforma preserva classificação, links e conflitos sem evidências ou método", () => {
  const renderGeneral = detailsFeature.match(/function renderGeneral\(contract, sources, platform = \{\}, catalogSource = "local"\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(renderGeneral, "renderizador dos detalhes gerais presente");
  assert.match(renderGeneral, /platformStatus/u);
  assert.match(renderGeneral, /platform\.sourceUrl/u);
  assert.match(renderGeneral, /platform\.conflict/u);
  assert.doesNotMatch(renderGeneral, /platform\.(?:evidence|method|confidence)|Evidências do edital|Fonte da identificação|Confiança|Método de confirmação|Identificação automática anterior|Confirmar plataforma/u);
  assert.doesNotMatch(detailsFeature, /modalView === "platform"|data-radar-platform-confirm/u);
});

test("a interface pública mantém os filtros solicitados e fixa o Portal como plataforma elegível", () => {
  const searchForm = html.match(/<form id="radarSearchForm"[\s\S]*?<\/form>/u)?.[0];
  assert.ok(searchForm, "formulário de pesquisa do Radar presente");
  for (const id of [
    "radarTagInput", "radarProcurementNumber", "radarModalityDetails", "radarUf", "radarMunicipality",
    "radarBidPhaseFrom", "radarBidPhaseTo", "radarSituation",
  ]) assert.match(searchForm, new RegExp(`id="${id}"`, "u"));
  assert.match(searchForm, /<label for="radarProcurementNumber">Número do Edital/u);
  assert.match(searchForm, /placeholder="Ex\.: 15\/2026" aria-describedby="radarProcurementNumberHelp"/u);
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

test("detalhes, favoritos e importação usam Edge Functions e preservam os controles da tela", () => {
  for (const id of ["radarDetailsView", "radarDetailsFavoriteButton", "radarDetailsContent"]) {
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
  assert.match(preprocessedFeature, /functions\.invoke\("radar-details"/u);
  assert.doesNotMatch(preprocessedFeature, /\.from\("radar_(licitacoes|itens_sync|itens)"\)/u);
  assert.doesNotMatch(detailsFeature, /\.from\("radar_licitacoes"\)/u);
  assert.match(searchFeature, /action: "item-counts"/u);
  assert.match(searchFeature, /action: "municipality-labels"/u);
  assert.doesNotMatch(searchFeature, /\.from\("radar_(itens_sync|catalog_municipalities)"\)/u);
});

test("dados de produção são identificados como somente leitura e não permitem importação", () => {
  assert.match(detailsFeature, /Dados de produção; esta sessão tem acesso somente de leitura\./u);
  assert.match(detailsFeature, /selectable: !isRadarCatalogReadOnly\(catalogSource\)/u);
  assert.match(detailsFeature, /if \(isRadarCatalogReadOnly\(catalogSource\)\)/u);
  assert.doesNotMatch(detailsFeature, /createRadarPreprocessedService/u);
  assert.match(searchFeature, /state\.catalogSource === "production"/u);
  assert.match(searchFeature, /if \(state\.view !== "favorites" && isRadarCatalogReadOnly\(state\.catalogSource\)\)/u);
});

test("a confirmação do Radar permite escolher até quatro documentos e anexá-los ao edital", () => {
  assert.match(html, /id="radarImportConfirmDocuments"/u);
  assert.match(html, /id="radarImportConfirmButton"[^>]*data-radar-import-confirm/u);
  assert.match(detailsFeature, /function renderImportDocumentSelection()/u);
  assert.match(detailsFeature, /Há \$\{documents\.length\.toLocaleString\("pt-BR"\)\} documentos disponíveis/u);
  assert.match(detailsFeature, /data-radar-import-document=/u);
  assert.match(detailsFeature, /imports\.attachDocuments\(procurementId, selectedDocumentIds\)/u);
  assert.match(importFeature, /function normalizeSelectedRadarDocumentIds/u);
  assert.match(importFeature, /selectedDocumentIds = normalizeSelectedRadarDocumentIds/u);
  assert.match(styles, /\.radar-import-document-list[^}]+overflow-y: auto/u);
  assert.match(designSystem, /permite escolher até quatro documentos do edital/u);
  assert.match(radarStory, /SelecaoDeDocumentosDoEdital/u);
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
