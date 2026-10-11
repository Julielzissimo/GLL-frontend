import {
  canRequestRadarItemSyncUpdate,
  createRadarItemSyncPoller,
  isCompleteRadarItemSnapshot,
  radarItemSyncPresentation,
  retainCompleteRadarItemSnapshot,
  shouldPollRadarItemSync,
} from "./radar-item-sync.js";

const FAVORITE_METADATA_FIELDS = [
  "numero_controle_pncp",
  "numero_compra",
  "ano_compra",
  "cnpj_orgao",
  "nome_orgao",
  "codigo_unidade_administrativa",
  "nome_unidade_administrativa",
  "objeto_compra",
  "modalidade_pncp_id",
  "uf",
  "municipio_ibge_id",
  "valor_estimado",
  "data_publicacao",
  "data_inicio_propostas",
  "data_fim_propostas",
  "situacao_codigo",
  "situacao_nome",
  "data_atualizacao_fonte",
  "plataforma_id",
  "link_sistema_origem",
  "link_sistema_origem_manual",
  "plataforma_status",
  "plataforma_confianca",
  "plataforma_metodo_classificacao",
  "plataforma_fonte_evidencia",
  "plataforma_evidencia",
  "plataforma_conflito",
  "plataforma_confirmada_em",
].join(", ");

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const quantityFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 4,
});

function dateValue(value, formatter = dateTimeFormatter) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : formatter.format(date);
}

function platformStatusLabel(status) {
  if (status === "identified") return "Identificada";
  if (status === "unidentified") return "Não identificada";
  if (status === "link_not_informed") return "Link não informado pelo PNCP";
  return "Pendente de verificação";
}

function platformMethodLabel(method) {
  return ({
    manual_confirmed: "Confirmação manual por Administrador",
    source_domain: "Domínio da URL informada pelo PNCP",
    complementary_text: "Referência explícita no texto complementar do PNCP",
    user_name_hint: "Indício no nome informado pelo PNCP",
    ambiguous_reference: "Referência ambígua no texto do PNCP",
    domain_conflict: "Conflito entre domínios informados",
    source_conflict: "Conflito entre fontes do PNCP",
    pdf_context: "Instrução contextual do edital em PDF",
    pdf_conflict: "Conflito entre plataformas citadas no edital em PDF",
    pdf_no_match: "Edital consultado sem indicação contextual",
    pdf_no_text: "PDF digitalizado sem texto extraível",
    pdf_ambiguous_reference: "Menção sem contexto suficiente no edital",
    pdf_unavailable: "Documento indisponível no PNCP",
    pdf_invalid: "Arquivo PDF inválido",
    pdf_too_large: "Arquivo PDF acima do limite",
    pdf_page_limit: "Limite de páginas atingido",
    pdf_processing_limit: "Tempo máximo de leitura atingido",
    pdf_superseded_by_retification: "Menção substituída por retificação vigente",
    unmatched_domain: "Domínio sem correspondência no catálogo",
    invalid_url: "URL inválida ou insegura",
    missing_url: "O PNCP não informou uma URL",
    pncp_detail: "Detalhe consultado no PNCP",
  })[method] || (method ? String(method) : "Não informado");
}

function platformEvidenceSourceLabel(source) {
  return ({
    linkSistemaOrigem: "Link de origem do PNCP",
    informacaoComplementar: "Informação complementar do PNCP",
    objetoCompra: "Objeto da contratação",
    nomeComprador: "Nome informado pelo PNCP",
    manual: "Confirmação manual",
    editalPdf: "Edital em PDF do PNCP",
  })[source] || (source ? String(source) : "Fonte não informada");
}

function platformConfidenceLabel(confidence) {
  return ({ high: "Alta", medium: "Média", low: "Baixa" })[confidence] || "Não informada";
}

export function renderRadarPlatformEvidence(evidence) {
  const items = Array.isArray(evidence)
    ? evidence.filter((item) => item && typeof item === "object" && item.source === "editalPdf")
    : [];
  if (!items.length) return "";
  return "<ul class=\"radar-platform-evidence\">" + items.map((item) => {
    const excerpt = item.value_excerpt || item.matched_value || item.url;
    const documentTitle = item.document_title || "";
    const metadata = [
      item.document_id ? "Documento " + item.document_id : "",
      item.document_type || "",
      item.document_published_at ? "publicado em " + dateValue(item.document_published_at, dateFormatter) : "",
      item.page_number ? "página " + item.page_number : "",
      item.confidence ? "confiança " + platformConfidenceLabel(item.confidence).toLowerCase() : "",
      item.processed_at ? "processado em " + dateValue(item.processed_at) : "",
      item.document_version_hash ? "SHA-256 " + String(item.document_version_hash).slice(0, 16) : "",
      item.method ? platformMethodLabel(item.method) : "",
    ].filter(Boolean);
    const heading = documentTitle
      ? "<strong>" + escapeHtml(platformEvidenceSourceLabel(item.source)) + ": " + escapeHtml(documentTitle) + "</strong>"
      : "<strong>" + escapeHtml(platformEvidenceSourceLabel(item.source)) + ":</strong>";
    const metadataMarkup = metadata.length ? "<p>" + escapeHtml(metadata.join(" · ")) + "</p>" : "";
    const excerptMarkup = excerpt ? "<p>" + escapeHtml(excerpt) + "</p>" : "";
    return "<li>" + heading + metadataMarkup + excerptMarkup + "</li>";
  }).join("") + "</ul>";
}

function moneyValue(value) {
  if (value === null || value === undefined || value === "") return "Não informado";
  const number = Number(value);
  return Number.isFinite(number) ? moneyFormatter.format(number) : "Não informado";
}

export function formatRadarItemMoney(value, secret) {
  return secret ? "Orçamento sigiloso" : moneyValue(value);
}

export function createRadarItemSelectionState() {
  const selected = new Set();
  return Object.freeze({
    get size() { return selected.size; },
    has: (number) => selected.has(String(number)),
    add: (number) => selected.add(String(number)),
    delete: (number) => selected.delete(String(number)),
    clear: () => selected.clear(),
    values: () => [...selected],
    retain: (items, excluded = new Set()) => {
      const allowed = new Set((Array.isArray(items) ? items : [])
        .map((item) => String(item?.number ?? ""))
        .filter((number) => number && !excluded.has(number)));
      selected.forEach((number) => { if (!allowed.has(number)) selected.delete(number); });
    },
    selectAll: (items, excluded = new Set()) => {
      selected.clear();
      (Array.isArray(items) ? items : []).forEach((item) => {
        const number = String(item?.number ?? "");
        if (number && !excluded.has(number)) selected.add(number);
      });
    },
  });
}

export function paginateRadarItems(items, page = 1, pageSize = 20) {
  const allItems = Array.isArray(items) ? items : [];
  const size = Math.max(1, Math.floor(Number(pageSize) || 20));
  const pageCount = Math.max(1, Math.ceil(allItems.length / size));
  const currentPage = Math.min(pageCount, Math.max(1, Math.floor(Number(page) || 1)));
  return {
    items: allItems.slice((currentPage - 1) * size, currentPage * size),
    page: currentPage,
    pageCount,
  };
}

export function radarContractBudgetIsSecret(contract) {
  const code = Number(contract?.orcamentoSigilosoCodigo);
  if (code === 2 || code === 3) return true;
  return /parcialmente sigilosa|totalmente sigilosa/iu.test(String(contract?.orcamentoSigilosoDescricao || ""));
}

export function formatRadarContractEstimatedValue(contract) {
  return radarContractBudgetIsSecret(contract) ? "Orçamento sigiloso" : moneyValue(contract?.valorTotalEstimado);
}

export function validatedOfficialPncpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (url.hostname === "pncp.gov.br" || url.hostname.endsWith(".pncp.gov.br"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function validatedPlatformSourceUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function proposalStatus(startValue, endValue) {
  const start = startValue ? new Date(startValue).getTime() : NaN;
  const end = endValue ? new Date(endValue).getTime() : NaN;
  const now = Date.now();
  if (!Number.isFinite(end)) return "unknown";
  if (Number.isFinite(start) && now < start) return "upcoming";
  return now <= end ? "open" : "closed";
}

export function mapRadarFavoriteMetadata(row, platformNames = new Map()) {
  const numberControlPncp = String(row?.numero_controle_pncp || "");
  return {
    numberControlPncp,
    procurementNumber: row?.numero_compra || "",
    year: row?.ano_compra || "",
    agencyName: row?.nome_orgao || "",
    administrativeUnitName: row?.nome_unidade_administrativa || "",
    object: row?.objeto_compra || "",
    modalityId: row?.modalidade_pncp_id ?? null,
    uf: row?.uf || "",
    municipalityIbgeId: row?.municipio_ibge_id ?? null,
    estimatedValue: row?.valor_estimado ?? null,
    publishedAt: row?.data_publicacao || null,
    proposalsStartAt: row?.data_inicio_propostas || null,
    proposalsEndAt: row?.data_fim_propostas || null,
    administrativeSituationCode: row?.situacao_codigo || "",
    administrativeSituationName: row?.situacao_nome || "",
    proposalReceiptStatus: proposalStatus(row?.data_inicio_propostas, row?.data_fim_propostas),
    dataUpdatedAt: row?.data_atualizacao_fonte || null,
    sourceUrl: "",
    platformId: row?.plataforma_id || null,
    platformName: platformNames.get(row?.plataforma_id) || null,
    platformSourceUrl: row?.link_sistema_origem_manual || row?.link_sistema_origem || null,
    platformSourceUrlFromPncp: row?.link_sistema_origem || null,
    platformStatus: row?.plataforma_status || "pending_verification",
    platformConfidence: row?.plataforma_confianca || null,
    platformClassificationMethod: row?.plataforma_metodo_classificacao || null,
    platformEvidenceSource: row?.plataforma_fonte_evidencia || null,
    platformEvidence: Array.isArray(row?.plataforma_evidencia) ? row.plataforma_evidencia : [],
    platformConflict: row?.plataforma_conflito === true,
    platformConfirmedAt: row?.plataforma_confirmada_em || null,
  };
}

function clientUserId(client) {
  return client.auth.getUser().then(({ data, error }) => {
    if (error || !data?.user?.id) throw new Error("Entre novamente para acessar seus favoritos.");
    return data.user.id;
  });
}

export function createRadarFavoritesService({ getClient } = {}) {
  const favoriteIds = new Set();

  function client() {
    const value = getClient?.();
    if (!value) throw new Error("O Radar exige uma sessão autenticada no Supabase.");
    return value;
  }

  async function loadFavoriteIds(identifiers) {
    const ids = [...new Set((Array.isArray(identifiers) ? identifiers : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean))];
    if (!ids.length) return [];
    const { data, error } = await client().from("radar_favoritos")
      .select("numero_controle_pncp")
      .in("numero_controle_pncp", ids);
    if (error) throw new Error("Não foi possível consultar os favoritos desta conta.");
    ids.forEach((id) => favoriteIds.delete(id));
    (data || []).forEach((row) => favoriteIds.add(row.numero_controle_pncp));
    return (data || []).map((row) => row.numero_controle_pncp);
  }

  async function loadFavoritesPage({ page = 1, pageSize = 20 } = {}) {
    const currentPage = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const start = (currentPage - 1) * size;
    const { data: favoriteRows, error: favoritesError, count } = await client().from("radar_favoritos")
      .select("numero_controle_pncp, criado_em", { count: "exact" })
      .order("criado_em", { ascending: false })
      .range(start, start + size - 1);
    if (favoritesError) throw new Error("Não foi possível carregar os favoritos desta conta.");

    const rows = favoriteRows || [];
    const ids = rows.map((row) => row.numero_controle_pncp);
    const records = ids.length
      ? await client().from("radar_licitacoes").select(FAVORITE_METADATA_FIELDS).in("numero_controle_pncp", ids)
      : { data: [], error: null };
    if (records.error) throw new Error("Não foi possível carregar os dados das licitações favoritas.");
    const byId = new Map((records.data || []).map((row) => [row.numero_controle_pncp, row]));
    const platformIds = [...new Set((records.data || []).map((row) => row.plataforma_id).filter(Boolean))];
    const platforms = platformIds.length
      ? await client().from("radar_plataformas").select("id, nome").in("id", platformIds)
      : { data: [], error: null };
    const platformNames = new Map((platforms.data || []).map((platform) => [platform.id, platform.nome]));
    ids.forEach((id) => favoriteIds.add(id));
    const results = ids.map((id) => byId.get(id)
      ? mapRadarFavoriteMetadata(byId.get(id), platformNames)
      : { numberControlPncp: id, object: "Metadados temporariamente indisponíveis" });
    const totalCount = Number.isSafeInteger(count) ? count : rows.length;
    return {
      results,
      favoriteIds: ids,
      page: currentPage,
      pageSize: size,
      totalCount,
      hasMore: start + rows.length < totalCount,
    };
  }

  async function setFavorite(numberControlPncp, shouldFavorite) {
    const id = String(numberControlPncp || "").trim();
    if (!id) throw new Error("Identificador PNCP inválido.");
    const activeClient = client();
    const userId = await clientUserId(activeClient);
    if (shouldFavorite) {
      const { error } = await activeClient.from("radar_favoritos").insert({
        user_id: userId,
        numero_controle_pncp: id,
      });
      if (error && error.code !== "23505") throw new Error("Não foi possível favoritar esta licitação. Tente novamente.");
      favoriteIds.add(id);
      return true;
    }
    const { error } = await activeClient.from("radar_favoritos").delete()
      .eq("user_id", userId)
      .eq("numero_controle_pncp", id);
    if (error) throw new Error("Não foi possível remover esta licitação dos favoritos.");
    favoriteIds.delete(id);
    return false;
  }

  return Object.freeze({
    isFavorite: (id) => favoriteIds.has(String(id || "")),
    loadFavoriteIds,
    loadFavoritesPage,
    setFavorite,
    reset: () => favoriteIds.clear(),
  });
}

export function createRadarDetailsFeature({ getClient, getUserRole = () => null, toast = () => {}, onFavoriteChanged = () => {}, onClassificationChanged = () => {}, onOpenBid = () => {} } = {}) {
  const root = globalThis.document?.getElementById("radarSearchPage");
  const favorites = createRadarFavoritesService({ getClient });
  const imports = globalThis.window?.GLLRadarImport?.createRadarImportService({ getClient }) || null;
  const itemsPerPage = 20;
  const state = {
    current: null,
    data: null,
    opened: false,
    loading: false,
    notFound: false,
    error: "",
    favoriteError: false,
    requestId: 0,
    itemStatusRequestId: 0,
    documentRequestId: 0,
    historyEntry: false,
    itemsPage: 1,
    selectedItemNumbers: createRadarItemSelectionState(),
    importStatus: null,
    importStatusError: "",
    importFeedback: "",
    importFeedbackTone: "success",
    confirmingImport: false,
    importing: false,
    syncRequestInProgress: false,
    itemStatusCommunicationError: false,
    itemPollingLimitReached: false,
    lastImport: null,
    platformChoices: [],
  };

  const itemStatusPoller = createRadarItemSyncPoller({
    poll: () => refreshItemsStatus(currentId(), state.requestId),
    shouldContinue: () => state.opened && Boolean(state.data)
      && shouldPollRadarItemSync(state.data.items, state.data.itemSync),
    onError: () => {
      if (!state.opened || !state.data) return;
      state.itemStatusCommunicationError = true;
      render();
    },
    onWindowExpired: () => {
      if (!state.opened || !state.data) return;
      state.itemPollingLimitReached = true;
      render();
    },
  });

  function syncItemStatusPolling({ restart = false } = {}) {
    if (!state.opened || !state.data
      || !shouldPollRadarItemSync(state.data.items, state.data.itemSync)) {
      itemStatusPoller.stop();
      state.itemPollingLimitReached = false;
      return;
    }
    if (restart) {
      itemStatusPoller.stop();
      state.itemPollingLimitReached = false;
    }
    if (!state.itemPollingLimitReached) itemStatusPoller.start();
  }

  function captureFocusedDetailsControl(container) {
    const active = globalThis.document?.activeElement;
    if (!active || !container?.contains(active)) return null;
    if (active.id) return { type: "id", value: active.id };
    for (const attribute of [
      "data-radar-select-item",
      "data-radar-items-page",
      "data-radar-select-all",
      "data-radar-select-none",
      "data-radar-import-start",
      "data-radar-import-confirm",
      "data-radar-import-cancel",
      "data-radar-open-bid",
      "data-radar-item-sync-request",
      "data-radar-item-sync-watch",
    ]) {
      if (active.hasAttribute?.(attribute)) return { type: "attribute", attribute, value: active.getAttribute(attribute) };
    }
    return null;
  }

  function restoreFocusedDetailsControl(container, focusTarget) {
    if (!focusTarget || !container) return;
    let replacement = null;
    if (focusTarget.type === "id") replacement = container.querySelector(`#${globalThis.CSS?.escape?.(focusTarget.value) || focusTarget.value}`);
    else {
      replacement = [...container.querySelectorAll(`[${focusTarget.attribute}]`)]
        .find((element) => element.getAttribute(focusTarget.attribute) === focusTarget.value)
        || (focusTarget.attribute === "data-radar-items-page"
          ? container.querySelector("[data-radar-items-page]")
          : null);
    }
    if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
  }

  function byId(id) {
    return root?.querySelector(`#${id}`) || null;
  }

  function currentId() {
    return String(state.current?.numberControlPncp || state.current || "");
  }

  function identityIsValid(id) {
    return /^\d{14}-\d-\d{6}\/\d{4}$/u.test(id);
  }

  function updateUrl(id, { push = false } = {}) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("page", "radar-de-licitacoes");
    url.searchParams.set("radarDetail", id);
    const method = push ? "pushState" : "replaceState";
    window.history[method]({ ...(window.history.state || {}), radarDetail: id }, "", url);
  }

  function removeDetailFromUrl() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("radarDetail");
    window.history.replaceState({ ...(window.history.state || {}), radarDetail: null }, "", url);
  }

  function renderFeedback() {
    const feedback = byId("radarDetailsFeedback");
    if (!feedback) return;
    if (state.loading && !state.data) {
      feedback.hidden = false;
      feedback.dataset.tone = "info";
      feedback.innerHTML = '<span class="radar-spinner" aria-hidden="true"></span><span>Carregando dados do edital no Radar…</span>';
      return;
    }
    if (state.notFound) {
      feedback.hidden = false;
      feedback.dataset.tone = "warning";
      feedback.innerHTML = "<strong>Contratação não encontrada</strong><span>O PNCP não localizou esta contratação. Volte aos resultados e atualize a pesquisa.</span>";
      return;
    }
    if (state.error) {
      const oldDataDate = state.data?.retrievedAt ? dateValue(state.data.retrievedAt) : "";
      feedback.hidden = false;
      feedback.dataset.tone = state.data ? "warning" : "error";
      feedback.innerHTML = state.data
        ? `<strong>Atualização indisponível</strong><span>O Radar não respondeu. Os dados carregados em ${escapeHtml(oldDataDate)} permanecem visíveis; tente atualizar novamente.</span>`
        : `<strong>Detalhes do Radar indisponíveis</strong><span>${escapeHtml(state.error)} Tente atualizar os detalhes novamente.</span>`;
      if (state.favoriteError) {
        feedback.insertAdjacentHTML("beforeend", '<span>Também não foi possível consultar o estado dos seus favoritos.</span><button class="quiet-action compact-action" type="button" data-radar-favorite-retry>Atualizar favoritos</button>');
      }
      return;
    }
    if (state.favoriteError) {
      feedback.hidden = false;
      feedback.dataset.tone = "warning";
      feedback.innerHTML = '<strong>Favoritos indisponíveis</strong><span>Não foi possível consultar o estado dos seus favoritos. Tente novamente.</span><button class="quiet-action compact-action" type="button" data-radar-favorite-retry>Atualizar favoritos</button>';
      return;
    }
    feedback.hidden = true;
    feedback.replaceChildren();
  }

  function renderGeneral(contract, sources, platform = {}) {
    const organization = contract.orgaoEntidade?.razaoSocial
      || contract.orgaoEntidade?.nomeRazaoSocial
      || contract.nomeOrgao
      || "Não informado";
    const unit = contract.unidadeOrgao || contract.unidadeSubRogada || {};
    const estimatedValue = formatRadarContractEstimatedValue(contract);
    const values = [
      ["Identificador PNCP", contract.numeroControlePNCP || currentId()],
      ["Número da contratação", contract.numeroCompra],
      ["Órgão responsável", organization],
      ["Município e UF", [unit.municipioNome, unit.ufSigla].filter(Boolean).join(" / ")],
      ["Modalidade", contract.modalidadeNome],
      ["Objeto da contratação", contract.objetoCompra],
      ["Valor estimado", estimatedValue],
      ["Publicação no PNCP", dateValue(contract.dataPublicacaoPncp, dateFormatter)],
      ["Abertura das propostas", dateValue(contract.dataAberturaProposta)],
      ["Encerramento das propostas", dateValue(contract.dataEncerramentoProposta)],
      ["Última atualização no PNCP", dateValue(contract.dataAtualizacaoGlobal || contract.dataAtualizacao)],
      ["Situação", contract.situacaoCompraNome],
    ];
    const officialUrl = validatedOfficialPncpUrl(sources?.official);
    const platformStatus = platform.status === "identified"
      ? platform.name || "Plataforma identificada"
      : platformStatusLabel(platform.status);
    const platformUrl = validatedPlatformSourceUrl(platform.sourceUrl);
    const pncpPlatformUrl = validatedPlatformSourceUrl(platform.sourceUrlFromPncp || contract.linkSistemaOrigem);
    const processUrl = validatedPlatformSourceUrl(platform.processUrl || contract.linkProcessoEletronico);
    const evidence = Array.isArray(platform.evidence) ? platform.evidence.filter((item) => item && typeof item === "object") : [];
    const evidenceMarkup = renderRadarPlatformEvidence(evidence);
    const previousAutomatic = platform.previousAutomatic && typeof platform.previousAutomatic === "object"
      ? platform.previousAutomatic
      : null;
    const previousAutomaticMarkup = previousAutomatic
      ? `<p class="radar-platform-previous">Identificação automática anterior: <strong>${escapeHtml(previousAutomatic.name || platformStatusLabel(previousAutomatic.status))}</strong>${previousAutomatic.classifiedAt ? ` · ${escapeHtml(dateValue(previousAutomatic.classifiedAt))}` : ""}.</p>`
      : "";
    const confirmationMarkup = platform.confirmedAt
      ? `<p>Confirmação manual registrada em ${escapeHtml(dateValue(platform.confirmedAt))}.</p>`
      : "";
    return `<section class="section-band radar-detail-section" aria-labelledby="radarGeneralTitle">
      <div class="radar-detail-section-heading"><div><h2 id="radarGeneralTitle">Informações gerais</h2><p>Dados disponíveis no cache centralizado do Radar.</p></div></div>
      <dl class="radar-detail-grid">${values.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd${label === "Objeto da contratação" ? ' class="radar-detail-object"' : ""}>${escapeHtml(value || "Não informado")}</dd></div>`).join("")}</dl>
      <section class="radar-platform-detail" aria-labelledby="radarPlatformDetailTitle">
        <h3 id="radarPlatformDetailTitle">Plataforma de disputa</h3>
        <p><strong>${escapeHtml(platformStatus)}</strong></p>
        ${platformUrl && platform.sourceUrlManuallyConfirmed ? `<p>URL corrigida manualmente: <a href="${escapeHtml(platformUrl)}" target="_blank" rel="noopener noreferrer">Abrir URL corrigida <span aria-hidden="true">↗</span></a></p>` : ""}
        ${pncpPlatformUrl ? `<p>Link de origem informado pelo PNCP: <a href="${escapeHtml(pncpPlatformUrl)}" target="_blank" rel="noopener noreferrer">Abrir link do PNCP <span aria-hidden="true">↗</span></a></p>` : !platform.sourceUrlManuallyConfirmed ? "<p>O PNCP não informou um link de origem seguro para abrir.</p>" : ""}
        ${processUrl ? `<p>Link do processo eletrônico: <a href="${escapeHtml(processUrl)}" target="_blank" rel="noopener noreferrer">Abrir processo <span aria-hidden="true">↗</span></a></p>` : ""}
        <dl class="radar-platform-metadata">
          ${platform.evidenceSource ? `<div><dt>Fonte da identificação</dt><dd>${escapeHtml(platformEvidenceSourceLabel(platform.evidenceSource))}</dd></div>` : ""}
          ${platform.classifiedAt ? `<div><dt>Identificada em</dt><dd>${escapeHtml(dateValue(platform.classifiedAt))}</dd></div>` : ""}
        </dl>
        ${platform.conflict ? '<p class="radar-platform-conflict" role="status">As fontes consultadas indicam plataformas diferentes. Confira o edital antes de usar o link.</p>' : ""}
        ${evidenceMarkup ? `<div><strong>Evidências do edital</strong>${evidenceMarkup}</div>` : ""}
        ${previousAutomaticMarkup}${confirmationMarkup}
        <small>${platform.sourceUrlManuallyConfirmed ? "A correção manual foi registrada por um Administrador e fica preservada nas próximas sincronizações." : "A identificação automática corresponde aos dados disponíveis do PNCP; domínio e referências textuais não confirmam uma sessão efetiva de disputa."}</small>
      </section>
      ${officialUrl ? `<a class="quiet-action compact-action radar-official-link" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">Abrir contratação no PNCP <span aria-hidden="true">↗</span></a>` : ""}
    </section>`;
  }

  function renderItemSyncNotice(itemsState, itemSync = {}) {
    const presentation = radarItemSyncPresentation(itemsState, itemSync, {
      communicationError: state.itemStatusCommunicationError,
    });
    const canRequestUpdate = canRequestRadarItemSyncUpdate(itemsState, itemSync);
    const canResumePolling = state.itemPollingLimitReached && presentation.syncActive;
    if (!presentation.message && !presentation.runningMessage && !presentation.progress
      && !canRequestUpdate && !canResumePolling) return "";

    const tone = presentation.kind === "error" ? "error" : "info";
    const showSpinner = presentation.kind === "running"
      || (presentation.kind === "stale" && Boolean(presentation.runningMessage));
    return `<div class="radar-feedback" data-tone="${tone}">
      ${showSpinner ? '<span class="radar-spinner" aria-hidden="true"></span>' : ""}
      <div role="status" aria-live="polite"><span>${escapeHtml(presentation.message)}</span>${presentation.runningMessage ? `<span>${escapeHtml(presentation.runningMessage)}</span>` : ""}${presentation.progress ? `<small>${escapeHtml(presentation.progress)}</small>` : ""}</div>
      ${canResumePolling ? '<button class="quiet-action compact-action" type="button" data-radar-item-sync-watch>Continuar acompanhamento</button>' : ""}
      ${canRequestUpdate ? `<button class="quiet-action compact-action" type="button" data-radar-item-sync-request aria-disabled="${state.loading || state.syncRequestInProgress ? "true" : "false"}">${state.syncRequestInProgress ? "Solicitando atualização…" : "Solicitar nova atualização"}</button>` : ""}
    </div>`;
  }

  function renderItems(itemsState, itemSync = {}) {
    const hasSnapshot = isCompleteRadarItemSnapshot(itemsState);
    const statusNotice = renderItemSyncNotice(itemsState, itemSync);
    const heading = `<div class="radar-detail-section-heading"><div><h2 id="radarItemsTitle">Itens da contratação</h2></div></div>`;

    if (itemsState?.status === "not_published") {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">${heading}${statusNotice}</section>`;
    }
    if (itemsState?.status === "unavailable" || itemsState?.status === "pagination_error") {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">${heading}${statusNotice}</section>`;
    }
    if (hasSnapshot && !itemsState.items.length) {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">${heading}${statusNotice}</section>`;
    }
    if (!hasSnapshot) {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">${heading}${statusNotice}</section>`;
    }

    const secretCount = itemsState.items.filter((item) => item.budgetSecret).length;
    const page = paginateRadarItems(itemsState.items, state.itemsPage, itemsPerPage);
    state.itemsPage = page.page;
    return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">
      <div class="radar-detail-section-heading"><div><h2 id="radarItemsTitle">Itens da contratação</h2><p>${itemsState.items.length.toLocaleString("pt-BR")} itens carregados do cache.</p></div></div>
      ${statusNotice}
      ${secretCount ? `<p class="radar-feedback" data-tone="warning" role="status"><strong>Orçamento sigiloso</strong><span>O PNCP informou orçamento sigiloso em ${secretCount.toLocaleString("pt-BR")} ${secretCount === 1 ? "item" : "itens"}; valores não serão tratados como preço.</span></p>` : ""}
      ${renderItemTable(page.items, { selectable: true })}
      ${renderItemPagination(page.pageCount)}
    </section>`;
  }

  function renderImportPanel(itemsState) {
    const available = isCompleteRadarItemSnapshot(itemsState) && itemsState.items.length > 0;
    const body = available
      ? renderImportControls(itemsState.items)
      : `<p>${itemsState?.status === "pending"
        ? "A importação ficará disponível após a sincronização completa dos itens."
        : itemsState?.status === "not_published"
          ? "O PNCP ainda não disponibilizou itens para importação."
          : itemsState?.status === "available" && itemsState.complete === true
            ? "A sincronização confirmou que esta contratação não possui itens para importar."
            : itemsState?.status === "unavailable"
              ? "Os itens estão temporariamente indisponíveis no cache do Radar."
              : "A importação ficará disponível após a sincronização completa dos itens."}</p>`;
    return `<section class="section-band radar-detail-section" aria-labelledby="radarImportPanelTitle">
      <div class="radar-detail-section-heading"><div><h2 id="radarImportPanelTitle">Importação para o GLL</h2><p>Selecione os itens do edital para importar.</p></div></div>
      ${body}
    </section>`;
  }

  function renderItemTable(items, { selectable = false } = {}) {
    return `<div class="table-wrap radar-detail-items-wrap" role="region" tabindex="0" aria-label="Itens da contratação; use a rolagem horizontal para ver todas as colunas."><table class="radar-results-table radar-items-table">
      <caption class="sr-only">Itens da contratação retornados pelo PNCP</caption>
      <thead><tr>${selectable ? '<th scope="col">Importar</th>' : ""}<th scope="col">Item</th><th scope="col">Descrição</th><th scope="col" class="numeric">Quantidade</th><th scope="col">Unidade</th><th scope="col" class="numeric">Valor unitário estimado</th><th scope="col" class="numeric">Valor total</th><th scope="col">Situação</th><th scope="col">Critério de julgamento</th><th scope="col">Informação complementar</th></tr></thead>
      <tbody>${items.map((item) => `<tr>
        ${selectable ? renderItemSelection(item) : ""}
        <td>${escapeHtml(item.number)}</td>
        <td>${escapeHtml(item.description || "Não informado")}</td>
        <td class="numeric">${item.quantity === null || item.quantity === undefined ? "—" : escapeHtml(quantityFormatter.format(Number(item.quantity)))}</td>
        <td>${escapeHtml(item.unit || "—")}</td>
        <td class="numeric">${escapeHtml(formatRadarItemMoney(item.unitEstimatedValue, item.budgetSecret))}</td>
        <td class="numeric">${escapeHtml(formatRadarItemMoney(item.totalValue, item.budgetSecret))}</td>
        <td>${escapeHtml(item.situationName || "Não informado")}</td>
        <td>${escapeHtml(item.judgmentCriterion || "Não informado")}</td>
        <td>${escapeHtml(item.additionalInformation || "—")}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  }

  function renderItemSelection(item) {
    const number = String(item.number);
    const imported = Boolean(state.importStatus?.itemNumbers?.has(number));
    const selected = state.selectedItemNumbers.has(number);
    return `<td class="radar-item-selection"><label><input type="checkbox" data-radar-select-item="${escapeHtml(number)}" aria-label="Selecionar item ${escapeHtml(number)} para importar" ${selected ? "checked" : ""} ${imported || state.importing ? "disabled" : ""}/><span class="sr-only">Selecionar item ${escapeHtml(number)}</span></label>${imported ? '<small>Já no GLL</small>' : ""}</td>`;
  }

  function renderImportControls(items) {
    const eligibleItems = items.filter((item) => !state.importStatus?.itemNumbers?.has(String(item.number)));
    const imported = state.importStatus;
    const title = imported
      ? `Esta contratação já está vinculada ao edital ${escapeHtml(imported.editalNumber)}${imported.buyerAgency ? ` — ${escapeHtml(imported.buyerAgency)}` : ""}. Selecione outros itens para complementar sem alterar os que já estão no GLL.`
      : "Selecione somente os itens que deseja levar para o edital do GLL.";
    const count = state.selectedItemNumbers.size;
    const feedback = state.importFeedback
      ? `<p class="radar-feedback" data-tone="${escapeHtml(state.importFeedbackTone)}" role="status" aria-live="polite">${escapeHtml(state.importFeedback)}</p>`
      : "";
    const statusWarning = state.importStatusError
      ? `<p class="radar-feedback" data-tone="warning" role="status">O estado anterior da importação não pôde ser consultado. A gravação continuará protegida contra duplicidades.</p>`
      : "";
    const confirmation = state.confirmingImport
      ? `<div class="radar-import-confirmation" role="group" aria-label="Confirmar importação"><p>Confirme a importação de <strong>${count.toLocaleString("pt-BR")} ${count === 1 ? "item" : "itens"}</strong>${imported ? ` para o edital ${escapeHtml(imported.editalNumber)}` : " para um novo edital"}. Dados que o PNCP não fornece poderão ser completados no formulário do edital.</p><div class="radar-import-actions"><button class="primary-action compact-action" type="button" data-radar-import-confirm ${state.importing ? "disabled" : ""}>Confirmar importação</button><button class="quiet-action compact-action" type="button" data-radar-import-cancel ${state.importing ? "disabled" : ""}>Cancelar</button></div></div>`
      : "";
    const openBidId = state.lastImport?.bid_id || imported?.bidId;
    return `<div class="radar-import-controls">
      <p>${title}</p>
      <div class="radar-import-toolbar"><strong aria-live="polite">${count.toLocaleString("pt-BR")} ${count === 1 ? "item selecionado" : "itens selecionados"}</strong><div class="radar-import-actions">
        <button class="quiet-action compact-action" type="button" data-radar-select-all ${!eligibleItems.length || state.importing ? "disabled" : ""}>${imported ? "Selecionar itens ainda não importados" : "Selecionar todos os itens carregados"}</button>
        <button class="quiet-action compact-action" type="button" data-radar-select-none ${!count || state.importing ? "disabled" : ""}>Desmarcar seleção</button>
      </div></div>
      ${statusWarning}${feedback}${confirmation}
      ${!state.confirmingImport ? `<div class="radar-import-actions"><button class="primary-action compact-action" type="button" data-radar-import-start ${!count || state.importing ? "disabled" : ""}>${state.importing ? "Importando…" : imported ? "Complementar importação" : "Importar para o GLL"}</button>${openBidId ? `<button class="quiet-action compact-action" type="button" data-radar-open-bid="${escapeHtml(openBidId)}">Abrir edital no GLL</button>` : ""}</div>` : ""}
    </div>`;
  }

  function renderItemPagination(pageCount) {
    if (pageCount <= 1) return "";
    return `<nav class="radar-item-pagination" aria-label="Paginação dos itens da contratação"><button class="quiet-action compact-action" type="button" data-radar-items-page="${state.itemsPage - 1}" ${state.itemsPage <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${state.itemsPage.toLocaleString("pt-BR")} de ${pageCount.toLocaleString("pt-BR")}</span><button class="quiet-action compact-action" type="button" data-radar-items-page="${state.itemsPage + 1}" ${state.itemsPage >= pageCount ? "disabled" : ""}>Próxima</button></nav>`;
  }

  function renderDocuments(documentsState) {
    if (documentsState?.status === "pending") {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarDocumentsTitle">
        <div class="radar-detail-section-heading"><div><h2 id="radarDocumentsTitle">Documentos do edital</h2><p>Carregando documentos do PNCP separadamente dos itens.</p></div></div>
        <button class="quiet-action compact-action" type="button" data-radar-documents-refresh>Atualizar documentos</button>
      </section>`;
    }
    if (documentsState?.status === "unavailable") {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarDocumentsTitle">
        <div class="radar-detail-section-heading"><div><h2 id="radarDocumentsTitle">Documentos do edital</h2><p>Os documentos estão indisponíveis no PNCP neste momento.</p></div></div>
        <button class="quiet-action compact-action" type="button" data-radar-documents-refresh>Atualizar documentos</button>
      </section>`;
    }
    if (!documentsState || documentsState.status === "not_published" || !documentsState.documents?.length) {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarDocumentsTitle">
        <div class="radar-detail-section-heading"><div><h2 id="radarDocumentsTitle">Documentos do edital</h2><p>Nenhum documento foi publicado para esta contratação.</p></div></div>
      </section>`;
    }
    return `<section class="section-band radar-detail-section" aria-labelledby="radarDocumentsTitle">
      <div class="radar-detail-section-heading"><div><h2 id="radarDocumentsTitle">Documentos do edital</h2></div></div>
      <ul class="radar-document-list">${documentsState.documents.map((document) => {
        const officialUrl = validatedOfficialPncpUrl(document.url);
        return `<li><div><strong>${escapeHtml(document.title || "Documento sem título")}</strong><span>${escapeHtml(document.type || "Tipo não informado")}</span>${document.publishedAt ? `<small>Publicado em ${escapeHtml(dateValue(document.publishedAt, dateFormatter))}</small>` : ""}</div>${officialUrl ? `<a class="quiet-action compact-action" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">Baixar <span aria-hidden="true">↗</span></a>` : `<span class="radar-document-url">${escapeHtml(document.url || "URL não informada")}</span>`}</li>`;
      }).join("")}</ul>
    </section>`;
  }

  function render() {
    const listView = byId("radarListView");
    const detailView = byId("radarDetailsView");
    const content = byId("radarDetailsContent");
    const back = byId("radarDetailsBackButton");
    const refresh = byId("radarDetailsRefreshButton");
    const favorite = byId("radarDetailsFavoriteButton");
    if (!detailView || !content) return;
    detailView.hidden = !state.opened;
    if (listView) listView.hidden = state.opened;
    if (!state.opened) return;

    const id = currentId();
    const heading = byId("radarDetailsTitle");
    if (heading) heading.textContent = state.data?.contract?.numeroCompra
      ? `Detalhes — ${state.data.contract.numeroCompra}`
      : "Detalhes da contratação";
    if (back) back.disabled = state.loading && !state.data;
    if (refresh) {
      refresh.disabled = state.loading;
      refresh.innerHTML = state.loading
        ? '<span class="radar-spinner" aria-hidden="true"></span> Atualizando…'
        : '<span aria-hidden="true">↻</span> Atualizar dados';
    }
    if (favorite) {
      const isFavorite = favorites.isFavorite(id);
      favorite.textContent = isFavorite ? "Desfavoritar" : "Favoritar";
      favorite.setAttribute("aria-pressed", String(isFavorite));
      favorite.disabled = state.favoriteError || !id || (state.loading && !state.data);
    }
    renderFeedback();

    if (state.notFound) {
      content.innerHTML = "";
      return;
    }
    if (!state.data) {
      content.innerHTML = state.loading
        ? '<div class="radar-loading" role="status"><span class="radar-spinner" aria-hidden="true"></span><span>Carregando detalhes e itens do Radar…</span></div>'
        : "";
      return;
    }
    const focusTarget = captureFocusedDetailsControl(content);
    const loadedAt = dateTimeFormatter.format(new Date(state.data.retrievedAt));
    content.innerHTML = `<p class="radar-detail-source">Fonte: Dados centralizados no Radar · Consulta realizada em ${escapeHtml(loadedAt)}.</p>
      <div class="radar-detail-layout">
        <main class="radar-detail-main">${renderGeneral(state.data.contract, state.data.sources, state.data.platform)}${renderItems(state.data.items, state.data.itemSync)}</main>
        <aside class="radar-detail-aside">${renderDocuments(state.data.documents)}${renderImportPanel(state.data.items)}</aside>
      </div>`;
    restoreFocusedDetailsControl(content, focusTarget);
  }

  async function loadDocuments(numberControlPncp = currentId(), detailsRequestId = state.requestId) {
    if (!identityIsValid(numberControlPncp)) return;
    const documentRequestId = ++state.documentRequestId;
    if (state.data && currentId() === numberControlPncp) {
      state.data = { ...state.data, documents: { status: "pending", documents: [], errorCode: null } };
      render();
    }
    let documentsState;
    try {
      const { data, error } = await getClient().functions.invoke("radar-details", {
        body: { action: "documents", numberControlPncp },
      });
      if (detailsRequestId !== state.requestId || documentRequestId !== state.documentRequestId) return;
      if (error) {
        let responseBody = null;
        try { responseBody = await error.context?.json?.(); } catch { /* Response bodies may already be consumed. */ }
        throw new Error(responseBody?.error || "Não foi possível consultar os documentos do PNCP.");
      }
      if (!data || data.status !== "available" || !data.documents) {
        throw new Error("O PNCP retornou uma resposta incompatível com o contrato de documentos.");
      }
      documentsState = data.documents;
    } catch {
      documentsState = { status: "unavailable", documents: [], errorCode: "DOCUMENTS_UPSTREAM_UNAVAILABLE" };
    }
    if (detailsRequestId !== state.requestId || documentRequestId !== state.documentRequestId || !state.data) return;
    state.data = { ...state.data, documents: documentsState };
    render();
  }

  async function loadMetadata(numberControlPncp = currentId(), detailsRequestId = state.requestId) {
    if (!identityIsValid(numberControlPncp)) return;
    try {
      const { data, error } = await getClient().functions.invoke("radar-details", {
        body: { action: "metadata", numberControlPncp },
      });
      if (error || !data || data.status !== "available" || !data.contract) return;
      if (detailsRequestId !== state.requestId || !state.data || currentId() !== numberControlPncp) return;
      state.data = {
        ...state.data,
        contract: { ...state.data.contract, ...data.contract },
        platform: data.platform || state.data.platform,
        metadataRetrievedAt: data.retrievedAt || null,
      };
      render();
    } catch {
      // The central contract and cached items remain usable when PNCP metadata is unavailable.
    }
  }

  async function refreshItemsStatus(numberControlPncp = currentId(), detailsRequestId = state.requestId) {
    if (!identityIsValid(numberControlPncp)) return;
    const itemStatusRequestId = ++state.itemStatusRequestId;
    try {
      const { data, error } = await getClient().functions.invoke("radar-details", {
        body: { action: "sync-status", numberControlPncp },
      });
      const isCurrent = detailsRequestId === state.requestId
        && itemStatusRequestId === state.itemStatusRequestId
        && state.opened && state.data && currentId() === numberControlPncp;
      if (!isCurrent) return;
      if (error || !data || data.status !== "available" || !Array.isArray(data.items?.items)
        || !data.itemSync || typeof data.itemSync !== "object") {
        state.itemStatusCommunicationError = true;
        render();
        return;
      }
      const safeItems = retainCompleteRadarItemSnapshot(state.data.items, data.items);
      state.data = { ...state.data, items: safeItems, itemSync: data.itemSync };
      state.selectedItemNumbers.retain(safeItems.items, state.importStatus?.itemNumbers || new Set());
      state.itemStatusCommunicationError = false;
      state.itemPollingLimitReached = false;
      syncItemStatusPolling();
      render();
    } catch {
      if (detailsRequestId !== state.requestId || !state.opened || currentId() !== numberControlPncp) return;
      state.itemStatusCommunicationError = true;
      render();
    }
  }

  async function refresh({ loadExtras = true } = {}) {
    const id = currentId();
    if (!identityIsValid(id)) {
      state.error = "O identificador PNCP desta licitação é inválido.";
      state.loading = false;
      render();
      return;
    }
    itemStatusPoller.stop();
    state.itemStatusRequestId += 1;
    state.itemStatusCommunicationError = false;
    state.itemPollingLimitReached = false;
    const requestId = ++state.requestId;
    state.loading = true;
    state.error = "";
    state.notFound = false;
    render();
    try {
      const { data, error } = await getClient().functions.invoke("radar-details", {
        body: { action: "details", numberControlPncp: id },
      });
      if (requestId !== state.requestId) return;
      if (error) {
        let responseBody = null;
        try { responseBody = await error.context?.json?.(); } catch { /* Response bodies may already be consumed. */ }
        if (responseBody?.status === "not_found") {
          state.notFound = true;
          state.data = null;
          return;
        }
        throw new Error(responseBody?.error || "Não foi possível consultar os detalhes centralizados no Radar.");
      }
      if (!data || data.status !== "available" || !data.contract
        || !Array.isArray(data.items?.items) || !data.itemSync || !data.documents) {
        if (data?.status === "not_found") {
          state.notFound = true;
          state.data = null;
          return;
        }
        throw new Error("O Radar retornou uma resposta incompatível com o contrato de detalhes.");
      }
      const safeItems = retainCompleteRadarItemSnapshot(state.data?.items, data.items);
      state.data = { ...data, items: safeItems };
      state.selectedItemNumbers.retain(safeItems.items, state.importStatus?.itemNumbers || new Set());
      state.error = "";
      state.notFound = false;
      state.itemStatusCommunicationError = Boolean(data.itemSync.errorCode === "ITEMS_SYNC_QUEUE_FAILED"
        || data.itemSync.errorCode === "ITEMS_PERSISTENCE_FAILED");
      syncItemStatusPolling({ restart: true });
      render();
      if (loadExtras) {
        void loadDocuments(id, requestId);
        void loadMetadata(id, requestId);
      }
      if (imports) {
        try {
          state.importStatus = await imports.loadImportStatus(id);
          state.importStatusError = "";
          state.selectedItemNumbers.retain(state.data?.items?.items, state.importStatus?.itemNumbers || new Set());
        } catch {
          state.importStatus = null;
          state.importStatusError = "Não foi possível consultar o estado anterior da importação.";
        }
        if (requestId !== state.requestId) return;
      }
    } catch (error) {
      if (requestId === state.requestId) state.error = error instanceof Error ? error.message : "Não foi possível atualizar os detalhes.";
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        render();
      }
    }
  }

  async function requestItemSync() {
    const id = currentId();
    if (!state.opened || !identityIsValid(id) || state.loading || state.syncRequestInProgress
      || !canRequestRadarItemSyncUpdate(state.data?.items, state.data?.itemSync)) return;

    state.syncRequestInProgress = true;
    state.itemStatusCommunicationError = false;
    state.itemPollingLimitReached = false;
    render();
    try {
      await refresh({ loadExtras: false });
    } finally {
      if (state.opened && currentId() === id) {
        state.syncRequestInProgress = false;
        if (state.error) state.itemStatusCommunicationError = true;
        render();
      }
    }
  }

  async function openPlatformConfirmation() {
    if (getUserRole() !== "Administrador" || !state.data?.platform) return;
    const dialog = byId("radarPlatformConfirmDialog");
    const select = byId("radarPlatformConfirmSelect");
    const summary = byId("radarPlatformConfirmSummary");
    const error = byId("radarPlatformConfirmError");
    const status = byId("radarPlatformConfirmStatus");
    if (!dialog || !select || !summary || !error || !status) return;
    error.textContent = "";
    status.hidden = true;
    status.replaceChildren();
    const currentPlatform = state.data.platform;
    const currentName = currentPlatform.name || platformStatusLabel(currentPlatform.status);
    const originalLink = validatedPlatformSourceUrl(currentPlatform.sourceUrlFromPncp);
    summary.textContent = `Identificação atual: ${currentName}.${originalLink ? " O link do PNCP será mantido separado da URL corrigida." : " O PNCP não informou um link de origem seguro."}`;
    const closeButtons = dialog.querySelectorAll("[data-radar-platform-dialog-close]");
    closeButtons.forEach((button) => { button.disabled = false; });
    const urlInput = byId("radarPlatformConfirmUrl");
    if (urlInput) urlInput.value = "";
    select.replaceChildren(new Option("Não identificada", ""));
    const submitButton = dialog.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    status.hidden = false;
    status.dataset.tone = "info";
    status.textContent = "Carregando plataformas ativas…";
    try {
      const { data, error: queryError } = await getClient().from("radar_plataformas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (queryError) throw new Error("Não foi possível carregar o catálogo de plataformas.");
      state.platformChoices = (Array.isArray(data) ? data : []).filter((item) => typeof item.id === "string" && typeof item.nome === "string");
      state.platformChoices.forEach((item) => select.add(new Option(item.nome, item.id)));
      if (currentPlatform.status === "identified" && currentPlatform.id
        && state.platformChoices.some((item) => item.id === currentPlatform.id)) select.value = currentPlatform.id;
      status.hidden = true;
      if (submitButton) submitButton.disabled = false;
    } catch (loadError) {
      status.dataset.tone = "error";
      status.textContent = loadError instanceof Error ? loadError.message : "Não foi possível carregar o catálogo de plataformas.";
    }
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }

  async function submitPlatformConfirmation(event) {
    event.preventDefault();
    if (getUserRole() !== "Administrador") {
      byId("radarPlatformConfirmError").textContent = "Somente Administradores podem confirmar uma plataforma.";
      return;
    }
    const dialog = byId("radarPlatformConfirmDialog");
    const select = byId("radarPlatformConfirmSelect");
    const urlInput = byId("radarPlatformConfirmUrl");
    const error = byId("radarPlatformConfirmError");
    const status = byId("radarPlatformConfirmStatus");
    const submitButton = dialog?.querySelector('button[type="submit"]');
    const platformId = String(select?.value || "") || null;
    const sourceUrlInput = String(urlInput?.value || "").trim();
    const sourceUrl = sourceUrlInput ? validatedPlatformSourceUrl(sourceUrlInput) : null;
    error.textContent = "";
    if (sourceUrlInput && !sourceUrl) {
      error.textContent = "Informe uma URL HTTPS válida, sem credenciais.";
      urlInput?.focus();
      return;
    }
    if (sourceUrlInput.length > 2048) {
      error.textContent = "A URL deve ter até 2.048 caracteres.";
      urlInput?.focus();
      return;
    }
    if (platformId && !state.platformChoices.some((item) => item.id === platformId)) {
      error.textContent = "Selecione uma plataforma ativa do catálogo.";
      select?.focus();
      return;
    }
    if (!state.current || !identityIsValid(currentId())) {
      error.textContent = "A identificação PNCP desta licitação é inválida.";
      return;
    }
    if (submitButton) submitButton.disabled = true;
    dialog?.querySelectorAll("[data-radar-platform-dialog-close]").forEach((button) => { button.disabled = true; });
    status.hidden = false;
    status.dataset.tone = "info";
    status.textContent = "Salvando confirmação…";
    try {
      const body = {
        action: "confirm_platform",
        numberControlPncp: currentId(),
        platformId,
        status: platformId ? "identified" : "unidentified",
        origin: "radar_details_ui",
        observation: "Confirmação individual no detalhamento do Radar.",
        ...(sourceUrl ? { sourceUrl } : {}),
      };
      const { data, error: functionError } = await getClient().functions.invoke("radar-collector", { body });
      if (functionError) {
        let message = "Não foi possível salvar a confirmação.";
        try {
          const response = await functionError.context?.json?.();
          if (typeof response?.error === "string") message = response.error;
        } catch { /* A resposta pode já ter sido consumida pelo cliente. */ }
        throw new Error(message);
      }
      if (data?.ok !== true) throw new Error("O Radar não confirmou a gravação da classificação.");
      dialog?.close();
      toast("Plataforma confirmada e registrada no Radar.", "success");
      const identifier = currentId();
      await refresh();
      onClassificationChanged(identifier);
    } catch (saveError) {
      status.dataset.tone = "error";
      status.textContent = saveError instanceof Error ? saveError.message : "Não foi possível salvar a confirmação.";
      if (submitButton) submitButton.disabled = false;
      dialog?.querySelectorAll("[data-radar-platform-dialog-close]").forEach((button) => { button.disabled = false; });
    }
  }

  async function setCurrentFavorite() {
    const id = currentId();
    const nextValue = !favorites.isFavorite(id);
    try {
      await favorites.setFavorite(id, nextValue);
      state.favoriteError = false;
      onFavoriteChanged(id, nextValue);
      toast(nextValue ? "Licitação adicionada aos favoritos." : "Licitação removida dos favoritos.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível atualizar o favorito.", "error");
    }
    render();
  }

  async function executeImport() {
    if (!imports || !isCompleteRadarItemSnapshot(state.data?.items) || !state.data.items.items.length) {
      state.importFeedback = "Atualize os itens completos do PNCP antes de importar.";
      state.importFeedbackTone = "warning";
      render();
      return;
    }
    const procurementId = currentId();
    const selected = state.selectedItemNumbers.values();
    if (!selected.length) return;
    state.importing = true;
    state.confirmingImport = false;
    state.importFeedback = "";
    render();
    try {
      const result = await imports.importSelected(procurementId, selected);
      if (currentId() !== procurementId) {
        toast("A importação foi concluída. Abra novamente os detalhes para consultar o edital.", "success");
        return;
      }
      state.lastImport = result;
      state.selectedItemNumbers.clear();
      const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
      const importedCount = Number(result.created_items || 0);
      const existingCount = Number(result.already_imported_items || 0);
      const summary = result.created_bid
        ? `Edital criado no GLL com ${importedCount} ${importedCount === 1 ? "item" : "itens"}.`
        : `Importação complementada com ${importedCount} ${importedCount === 1 ? "novo item" : "novos itens"}.`;
      const repeated = existingCount ? ` ${existingCount} ${existingCount === 1 ? "item já estava importado" : "itens já estavam importados"}.` : "";
      const conflicted = conflicts.length ? ` ${conflicts.length} ${conflicts.length === 1 ? "item não foi incluído porque já existe no edital ou no orçamento vinculado" : "itens não foram incluídos porque já existem no edital ou no orçamento vinculado"}; nenhum dado manual foi alterado.` : "";
      state.importFeedback = `${summary}${repeated}${conflicted}`;
      state.importFeedbackTone = conflicts.length ? "warning" : "success";
      try {
        state.importStatus = await imports.loadImportStatus(procurementId);
        state.importStatusError = "";
      } catch {
        state.importStatusError = "Não foi possível atualizar o estado da importação.";
      }
      toast(state.importFeedback, state.importFeedbackTone);
    } catch (error) {
      state.importFeedback = error instanceof Error ? error.message : "Não foi possível concluir a importação.";
      state.importFeedbackTone = "warning";
      toast(state.importFeedback, "error");
    } finally {
      if (currentId() === procurementId) {
        state.importing = false;
        render();
      }
    }
  }

  function closeView({ updateHistory = true } = {}) {
    itemStatusPoller.stop();
    state.itemStatusRequestId += 1;
    state.opened = false;
    state.loading = false;
    state.itemPollingLimitReached = false;
    state.requestId += 1;
    if (updateHistory) {
      if (state.historyEntry && typeof window !== "undefined"
        && new URL(window.location.href).searchParams.get("radarDetail") === currentId()) {
        state.historyEntry = false;
        window.history.back();
      } else {
        removeDetailFromUrl();
      }
    }
    state.historyEntry = false;
    render();
  }

  async function open(result, { pushHistory = true } = {}) {
    const id = typeof result === "string" ? result : String(result?.numberControlPncp || "");
    if (!identityIsValid(id)) {
      toast("Esta contratação não tem um identificador PNCP válido.", "error");
      return;
    }
    itemStatusPoller.stop();
    state.itemStatusRequestId += 1;
    state.itemStatusCommunicationError = false;
    state.itemPollingLimitReached = false;
    state.syncRequestInProgress = false;
    const keepSelection = currentId() === id;
    state.current = typeof result === "string" ? id : result;
    state.data = null;
    state.error = "";
    state.notFound = false;
    state.favoriteError = false;
    state.importStatus = null;
    state.importStatusError = "";
    state.importFeedback = "";
    state.confirmingImport = false;
    state.importing = false;
    state.lastImport = null;
    state.platformChoices = [];
    if (!keepSelection) {
      state.itemsPage = 1;
      state.selectedItemNumbers.clear();
    }
    state.opened = true;
    state.historyEntry = pushHistory;
    if (pushHistory) updateUrl(id, { push: true });
    render();
    const favoriteLoad = favorites.loadFavoriteIds([id]).catch(() => {
      state.favoriteError = true;
    });
    const detailLoad = refresh();
    await Promise.all([favoriteLoad, detailLoad]);
    render();
  }

  function syncRoute() {
    if (typeof window === "undefined") return;
    const id = new URL(window.location.href).searchParams.get("radarDetail");
    if (id) {
      if (state.opened && currentId() === id) return;
      void open(id, { pushHistory: false });
    } else if (state.opened) {
      closeView({ updateHistory: false });
    }
  }

  function reset() {
    itemStatusPoller.stop();
    state.requestId += 1;
    state.itemStatusRequestId += 1;
    state.documentRequestId += 1;
    state.current = null;
    state.data = null;
    state.opened = false;
    state.loading = false;
    state.itemStatusCommunicationError = false;
    state.itemPollingLimitReached = false;
    state.syncRequestInProgress = false;
    state.notFound = false;
    state.error = "";
    state.favoriteError = false;
    state.importStatus = null;
    state.importStatusError = "";
    state.importFeedback = "";
    state.confirmingImport = false;
    state.importing = false;
    state.lastImport = null;
    state.selectedItemNumbers.clear();
    state.itemsPage = 1;
    state.historyEntry = false;
    favorites.reset();
    removeDetailFromUrl();
    render();
  }

  function bind() {
    if (!root || root.dataset.radarDetailsBound === "true") return;
    root.dataset.radarDetailsBound = "true";
    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-radar-platform-confirm]")) {
        void openPlatformConfirmation();
      } else if (event.target.closest("[data-radar-platform-dialog-close]")) {
        byId("radarPlatformConfirmDialog")?.close();
      } else if (event.target.closest("#radarDetailsBackButton")) {
        closeView();
      } else if (event.target.closest("[data-radar-documents-refresh]")) {
        void loadDocuments(currentId(), state.requestId);
      } else if (event.target.closest("[data-radar-item-sync-request]")) {
        void requestItemSync();
      } else if (event.target.closest("[data-radar-item-sync-watch]")) {
        state.itemPollingLimitReached = false;
        syncItemStatusPolling({ restart: true });
        render();
      } else if (event.target.closest("#radarDetailsRefreshButton")) {
        void refresh();
      } else if (event.target.closest("[data-radar-details-refresh]")) {
        void refresh({ loadExtras: false });
      } else if (event.target.closest("#radarDetailsFavoriteButton")) {
        void setCurrentFavorite();
      } else if (event.target.closest("[data-radar-favorite-retry]")) {
        const id = currentId();
        void favorites.loadFavoriteIds([id]).then(() => {
          state.favoriteError = false;
          render();
        }).catch((error) => {
          toast(error instanceof Error ? error.message : "Não foi possível consultar os favoritos.", "error");
        });
      } else if (event.target.closest("[data-radar-select-all]")) {
        state.selectedItemNumbers.selectAll(
          state.data?.items?.items || [],
          state.importStatus?.itemNumbers || new Set(),
        );
        render();
      } else if (event.target.closest("[data-radar-select-none]")) {
        state.selectedItemNumbers.clear();
        state.confirmingImport = false;
        render();
      } else if (event.target.closest("[data-radar-import-start]")) {
        state.confirmingImport = true;
        render();
        byId("radarDetailsContent")?.querySelector("[data-radar-import-confirm]")?.focus();
      } else if (event.target.closest("[data-radar-import-confirm]")) {
        void executeImport();
      } else if (event.target.closest("[data-radar-import-cancel]")) {
        state.confirmingImport = false;
        render();
        byId("radarDetailsContent")?.querySelector("[data-radar-import-start]")?.focus();
      } else if (event.target.closest("[data-radar-open-bid]")) {
        const bidId = event.target.closest("[data-radar-open-bid]").dataset.radarOpenBid;
        if (bidId) Promise.resolve(onOpenBid(bidId)).catch((error) => {
          toast(error instanceof Error ? error.message : "Não foi possível abrir o edital no GLL.", "error");
        });
      } else if (event.target.closest("[data-radar-items-page]")) {
        const nextPage = Number(event.target.closest("[data-radar-items-page]").dataset.radarItemsPage);
        state.itemsPage = paginateRadarItems(state.data?.items?.items, nextPage, itemsPerPage).page;
        render();
        const pageCount = Math.ceil((state.data?.items?.items || []).length / itemsPerPage);
        const focusPage = state.itemsPage < pageCount ? state.itemsPage + 1 : state.itemsPage - 1;
        byId("radarDetailsContent")?.querySelector(`[data-radar-items-page="${focusPage}"]`)?.focus();
      }
    });
    root.addEventListener("change", (event) => {
      const checkbox = event.target.closest?.("[data-radar-select-item]");
      if (!checkbox) return;
      const number = String(checkbox.dataset.radarSelectItem || "");
      if (checkbox.checked) state.selectedItemNumbers.add(number);
      else state.selectedItemNumbers.delete(number);
      render();
      [...(byId("radarDetailsContent")?.querySelectorAll("[data-radar-select-item]") || [])]
        .find((input) => input.dataset.radarSelectItem === number)?.focus();
    });
    root.addEventListener("submit", (event) => {
      if (!event.target.matches?.("#radarPlatformConfirmForm")) return;
      void submitPlatformConfirmation(event);
    });
    if (typeof window !== "undefined") window.addEventListener("popstate", syncRoute);
  }

  bind();
  return Object.freeze({
    open,
    refresh,
    close: closeView,
    syncRoute,
    loadFavoriteIds: favorites.loadFavoriteIds,
    loadFavoritesPage: favorites.loadFavoritesPage,
    setFavorite: favorites.setFavorite,
    isFavorite: favorites.isFavorite,
    resetFavorites: favorites.reset,
    refreshCurrent: () => state.opened ? refresh() : Promise.resolve(),
    reset,
  });
}

if (typeof window !== "undefined") {
  window.GLLRadarDetails = Object.freeze({ createRadarDetailsFeature });
}
