const DEFAULT_PERIOD_DAYS = 30;
const MAX_TAGS = 25;
const MAX_TAG_LENGTH = 200;
const PAGE_SIZES = [20, 50, 100];
const RECEIPT_STATUS_LABELS = Object.freeze({
  open: "Recebendo propostas",
  upcoming: "Propostas futuras",
  closed: "Propostas encerradas",
  unknown: "Prazo não informado",
});
const SEARCH_SORTS = Object.freeze({
  publishedAt: "Data de publicação",
  proposalEndsAt: "Encerramento das propostas",
  updatedAt: "Atualização no PNCP",
  estimatedValue: "Valor estimado",
  organizationName: "Órgão responsável",
  object: "Objeto da contratação",
  situationCode: "Situação",
});

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function normalizeTag(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function tagIdentity(value) {
  return normalizeTag(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function parseRadarTags(value) {
  const tags = [];
  const identities = new Set();
  for (const candidate of String(value ?? "").split(/[,;\n\r]+/u)) {
    const tag = normalizeTag(candidate);
    const identity = tagIdentity(tag);
    if (!tag || identities.has(identity)) continue;
    identities.add(identity);
    tags.push(tag);
  }
  if (tags.length > MAX_TAGS) throw new RangeError(`Use no máximo ${MAX_TAGS} termos por pesquisa.`);
  if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    throw new RangeError(`Cada termo pode ter até ${MAX_TAG_LENGTH} caracteres.`);
  }
  return tags;
}

export function radarDefaultPeriodDates(days, today = todayInSaoPaulo()) {
  const periodDays = Number(days);
  if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 365) {
    throw new RangeError("O período padrão deve ficar entre 1 e 365 dias.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(today)) throw new TypeError("A data atual deve usar o formato AAAA-MM-DD.");
  const end = new Date(`${today}T00:00:00.000Z`);
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== today) {
    throw new TypeError("A data atual é inválida.");
  }
  end.setUTCDate(end.getUTCDate() - periodDays + 1);
  return { publishedFrom: end.toISOString().slice(0, 10), publishedTo: today };
}

function normalizedModalityIds(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0))];
}

export function buildRadarSearchPayload(filters, { page = 1, refreshCoverage = false, activeModalities = [] } = {}) {
  const tags = parseRadarTags(filters.tags);
  const activeIds = normalizedModalityIds(activeModalities);
  const selectedIds = filters.modalities === null
    ? []
    : normalizedModalityIds(filters.modalities);
  const useEveryActiveModality = filters.modalities === null
    || selectedIds.length === activeIds.length;
  const payload = {
    action: "search",
    proposalReceiptState: filters.proposalReceiptState || "open",
    page: Number(page),
    pageSize: Number(filters.pageSize || 20),
    sortBy: filters.sortBy || "publishedAt",
    sortDirection: filters.sortDirection || "desc",
    refreshCoverage: refreshCoverage === true,
  };
  if (tags.length) payload.tags = tags;
  if (!useEveryActiveModality && selectedIds.length) payload.modalities = selectedIds;
  if (Array.isArray(filters.platformIds)) {
    const platformIds = [...new Set(filters.platformIds.map((id) => String(id).toLowerCase()))];
    if (platformIds.length || filters.includeUnidentified === true) payload.platformIds = platformIds;
  }
  if (filters.includeUnidentified === true) payload.includeUnidentified = true;
  if (filters.uf) payload.uf = String(filters.uf).trim().toUpperCase();
  if (filters.municipalityIbgeId && filters.uf) payload.municipalityIbgeId = Number(filters.municipalityIbgeId);
  if (filters.publishedFrom) payload.publishedFrom = filters.publishedFrom;
  if (filters.publishedTo) payload.publishedTo = filters.publishedTo;
  return payload;
}

export function radarEmptyResultState(coverage) {
  if (coverage?.complete === true || coverage?.status === "complete") {
    return {
      kind: "complete-empty",
      title: "Nenhuma licitação encontrada",
      description: "A cobertura está completa para o escopo pesquisado. Ajuste os filtros para ampliar a busca.",
    };
  }
  if (coverage?.status === "not_collected") {
    return {
      kind: "not-collected",
      title: "Este período ainda não foi coletado",
      description: "Não há resultados indexados para este escopo. Solicite uma atualização para iniciar a coleta.",
    };
  }
  if (coverage?.status === "failed") {
    return {
      kind: "sync-failed",
      title: "A sincronização falhou",
      description: "A cobertura não foi concluída. Tente atualizar novamente antes de avaliar os resultados.",
    };
  }
  return {
    kind: "partial-empty",
    title: "Nenhum resultado visível na cobertura atual",
    description: "A coleta está incompleta ou desatualizada. Ainda não é possível concluir que não existam licitações neste período.",
  };
}

export function validatedPncpSourceUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "pncp.gov.br" || url.username || url.password) return null;
    if (!url.pathname.startsWith("/app/")) return null;
    return url.toString();
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

function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(now);
}

function formatDate(value) {
  if (!value) return "—";
  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(raw)
    ? new Date(`${raw}T12:00:00-03:00`)
    : new Date(raw);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function readErrorStatus(error) {
  return Number(error?.status || error?.context?.status || 0) || null;
}

async function describeFunctionError(error, fallback) {
  const status = readErrorStatus(error);
  let responseMessage = "";
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      responseMessage = typeof body?.error === "string" ? body.error : "";
    } catch {
      // O erro HTTP também pode conter uma resposta que não seja JSON.
    }
  }
  if (status === 503) return { kind: "unavailable", message: responseMessage || "O serviço do Radar está temporariamente indisponível. Tente novamente em alguns minutos." };
  if (status === 401 || status === 403) return { kind: "access", message: responseMessage || "Sua sessão não tem acesso ao Radar. Entre novamente ou fale com um Administrador." };
  if (error?.name === "FunctionsFetchError" || error?.name === "FunctionsRelayError" || error instanceof TypeError) {
    return { kind: "connection", message: "Não foi possível conectar ao Radar. Verifique sua conexão e tente novamente." };
  }
  return { kind: "error", message: responseMessage || error?.message || fallback };
}

function clampPeriodDays(value) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 365 ? days : DEFAULT_PERIOD_DAYS;
}

function currentFiltersFromInputs(root, tags, modalities, platformIds) {
  return {
    tags,
    modalities,
    uf: root.querySelector("#radarUf")?.value || "",
    municipalityIbgeId: root.querySelector("#radarMunicipality")?.value || "",
    platformIds,
    includeUnidentified: root.querySelector("#radarIncludeUnidentified")?.checked === true,
    publishedFrom: root.querySelector("#radarPublishedFrom")?.value || "",
    publishedTo: root.querySelector("#radarPublishedTo")?.value || "",
    proposalReceiptState: root.querySelector("#radarSituation")?.value || "open",
    pageSize: root.querySelector("#radarPageSize")?.value || 20,
    sortBy: root.querySelector("#radarSortBy")?.value || "publishedAt",
    sortDirection: root.querySelector("#radarSortDirection")?.value || "desc",
  };
}

/**
 * @typedef {Object} RadarResultActionHandlers
 * @property {(result: Object) => void} [onOpenDetails] Opens the on-demand detail view.
 * @property {(identifiers: string[]) => Promise<string[]>} [loadFavoriteIds] Loads the current user's state for result rows.
 * @property {(options: Object) => Promise<Object>} [loadFavoritesPage] Loads one page of the current user's favorites.
 * @property {(result: Object, shouldFavorite: boolean) => Promise<boolean>} [setFavorite] Persists the current user's favorite state.
 * @property {(identifier: string) => boolean} [isFavorite] Reads the favorite state held by the feature.
 * @property {(identifier: string, isFavorite: boolean) => void} [onFavoriteChanged] Keeps the search view in sync with details.
 */

/**
 * Owns the authenticated Radar search page. The optional action callbacks let
 * Fase 6 attach details and favorites without displaying inactive controls.
 * @param {{getClient: () => Object|null, getUserRole?: () => string|null, toast?: (message: string, tone?: string) => void, actions?: RadarResultActionHandlers}} options
 */
export function createRadarSearchFeature({ getClient, getUserRole = () => null, toast = () => {}, actions = {} }) {
  const root = globalThis.document?.getElementById("radarSearchPage");
  const state = {
    bound: false,
    initialized: false,
    loadingCatalogs: false,
    catalogsLoaded: false,
    catalogsError: "",
    defaultPeriodDays: DEFAULT_PERIOD_DAYS,
    modalities: [],
    states: [],
    municipalities: [],
    platforms: [],
    platformDomains: [],
    platformCatalogVersion: 1,
    municipalityNames: new Map(),
    municipalityLoadId: 0,
    selectedModalities: null,
    selectedPlatformIds: null,
    tags: [],
    results: [],
    favoriteIds: new Set(),
    favoriteState: "idle",
    favoritesResults: [],
    favoritesPagination: null,
    favoritesPage: 1,
    favoritesLoading: false,
    favoritesError: "",
    favoriteUpdatingIds: new Set(),
    view: "search",
    coverage: null,
    pagination: null,
    collectionTask: null,
    queriedAt: null,
    dataUpdatedAt: null,
    hasSearched: false,
    searching: false,
    updating: false,
    error: null,
  };

  function client() {
    const value = getClient?.();
    if (!value) throw new Error("O Radar exige uma sessão autenticada no ambiente Supabase.");
    return value;
  }

  function byId(id) {
    return root?.querySelector(`#${id}`) || null;
  }

  function announce(message) {
    const status = byId("radarAnnouncement");
    if (status) status.textContent = message;
  }

  function setCatalogFeedback() {
    const target = byId("radarCatalogFeedback");
    if (!target) return;
    if (state.loadingCatalogs) {
      target.hidden = false;
      target.dataset.tone = "info";
      target.innerHTML = '<span class="radar-spinner" aria-hidden="true"></span><span>Carregando modalidades, estados e configurações do Radar…</span>';
      return;
    }
    if (state.catalogsError) {
      target.hidden = false;
      target.dataset.tone = "error";
      target.innerHTML = `<span>${escapeHtml(state.catalogsError)}</span><button class="quiet-action compact-action" type="button" data-radar-action="reload-catalogs">Tentar novamente</button>`;
      return;
    }
    target.hidden = true;
    target.replaceChildren();
  }

  function renderModalityOptions() {
    const list = byId("radarModalities");
    if (!list) return;
    const selected = state.selectedModalities === null
      ? new Set(state.modalities.map((item) => Number(item.pncp_id)))
      : new Set(state.selectedModalities);
    list.innerHTML = state.modalities.map((item) => `
      <label class="radar-modality-option">
        <input type="checkbox" name="radarModality" value="${escapeHtml(item.pncp_id)}"${selected.has(Number(item.pncp_id)) ? " checked" : ""} />
        <span>${escapeHtml(item.name)}</span>
      </label>`).join("");
    updateModalitySummary();
  }

  function updateModalitySummary() {
    const summary = byId("radarModalitySummary");
    const selectedCount = state.selectedModalities === null
      ? state.modalities.length
      : state.selectedModalities.length;
    const allSelected = state.modalities.length > 0 && selectedCount === state.modalities.length;
    if (summary) summary.textContent = allSelected
      ? `Todas as modalidades ativas (${state.modalities.length})`
      : selectedCount === 0
        ? "Nenhuma modalidade selecionada"
        : `${selectedCount} de ${state.modalities.length} selecionadas`;
    const toggle = byId("radarModalityToggle");
    if (toggle) {
      toggle.textContent = allSelected ? "Desmarcar todas" : "Marcar todas";
      toggle.disabled = state.modalities.length === 0;
    }
  }

  function updatePlatformSummary() {
    const summary = byId("radarPlatformSummary");
    if (!summary) return;
    if (state.selectedPlatformIds === null) {
      summary.textContent = "Todas as plataformas";
      return;
    }
    const selected = state.platforms.filter((platform) => state.selectedPlatformIds.includes(platform.id));
    const names = selected.map((platform) => platform.nome);
    const includeUnknown = byId("radarIncludeUnidentified")?.checked === true;
    if (!names.length && includeUnknown) summary.textContent = "Somente não identificadas";
    else if (!names.length) summary.textContent = "Todas as plataformas";
    else if (names.length <= 2) summary.textContent = names.join(", ");
    else summary.textContent = `${names.length} plataformas${includeUnknown ? " e não identificadas" : ""}`;
    if (names.length <= 2 && includeUnknown && names.length) summary.textContent += " + não identificadas";
  }

  function renderPlatformOptions() {
    const list = byId("radarPlatforms");
    if (!list) return;
    const search = String(byId("radarPlatformSearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
    const active = state.platforms.filter((platform) => platform.ativo);
    const selected = state.selectedPlatformIds === null
      ? new Set(active.map((platform) => platform.id))
      : new Set(state.selectedPlatformIds);
    const visible = active.filter((platform) => !search || platform.nome.toLocaleLowerCase("pt-BR").includes(search));
    list.innerHTML = visible.length ? visible.map((platform) => `
      <label class="radar-modality-option">
        <input type="checkbox" name="radarPlatform" value="${escapeHtml(platform.id)}"${selected.has(platform.id) ? " checked" : ""} />
        <span>${escapeHtml(platform.nome)}</span>
      </label>`).join("") : '<p class="radar-empty-state">Nenhuma plataforma corresponde à pesquisa.</p>';
    updatePlatformSummary();
  }

  function renderPlatformAdmin() {
    const target = byId("radarPlatformAdminList");
    const platformSelect = byId("radarPlatformDomainPlatform");
    if (platformSelect) {
      const current = platformSelect.value;
      platformSelect.innerHTML = state.platforms.map((platform) => `<option value="${escapeHtml(platform.id)}">${escapeHtml(platform.nome)}${platform.ativo ? "" : " (inativa)"}</option>`).join("");
      if (state.platforms.some((platform) => platform.id === current)) platformSelect.value = current;
    }
    if (!target) return;
    target.innerHTML = state.platforms.map((platform) => {
      const domains = state.platformDomains.filter((domain) => domain.plataforma_id === platform.id);
      return `<article class="radar-platform-admin-entry"><div><strong>${escapeHtml(platform.nome)}</strong><small>${escapeHtml(platform.slug)} · ${platform.ativo ? "Ativa" : "Inativa"}</small>${platform.descricao ? `<small>${escapeHtml(platform.descricao)}</small>` : ""}</div><div class="radar-row-actions"><button class="quiet-action compact-action" type="button" data-platform-edit="${escapeHtml(platform.id)}">Editar</button><button class="quiet-action compact-action" type="button" data-platform-toggle="${escapeHtml(platform.id)}" aria-pressed="${platform.ativo}">${platform.ativo ? "Desativar" : "Ativar"}</button></div>${domains.length ? `<ul>${domains.map((domain) => `<li><code>${escapeHtml(domain.dominio)}</code> · ${domain.ativo ? "Ativo" : "Inativo"}${domain.incluir_subdominios ? " · inclui subdomínios" : ""}<button class="quiet-action compact-action" type="button" data-domain-edit="${escapeHtml(domain.id)}">Editar regra</button><button class="quiet-action compact-action" type="button" data-domain-toggle="${escapeHtml(domain.id)}" aria-pressed="${domain.ativo}">${domain.ativo ? "Desativar" : "Ativar"}</button></li>`).join("")}</ul>` : "<small>Sem domínios cadastrados.</small>"}</article>`;
    }).join("");
  }

  async function loadPlatformCatalog() {
    const currentClient = client();
    const [platformResult, domainResult, versionResult] = await Promise.all([
      currentClient.from("radar_plataformas").select("id, nome, slug, descricao, ativo").order("nome"),
      currentClient.from("radar_plataforma_dominios").select("id, plataforma_id, dominio, incluir_subdominios, ativo").order("dominio"),
      currentClient.from("radar_plataforma_catalog_state").select("versao").eq("id", true).single(),
    ]);
    if (platformResult.error || domainResult.error || versionResult.error) throw new Error("Não foi possível carregar o catálogo de plataformas.");
    state.platforms = platformResult.data || [];
    state.platformDomains = domainResult.data || [];
    state.platformCatalogVersion = Number(versionResult.data?.versao || 1);
    renderPlatformOptions();
    renderPlatformAdmin();
  }

  async function loadPlatformMetrics() {
    const target = byId("radarPlatformMetrics");
    if (!target || getUserRole?.() !== "Administrador") return;
    try {
      const { data, error } = await client().functions.invoke("radar-catalogs", { body: { action: "platform_metrics" } });
      if (error) throw error;
      const metrics = data?.metrics;
      if (!metrics) throw new Error("Métricas indisponíveis.");
      target.textContent = `Catálogo: ${metrics.platforms} plataformas, ${metrics.domains} domínios. Licitações: ${Number(metrics.classified).toLocaleString("pt-BR")} identificadas, ${Number(metrics.unidentified).toLocaleString("pt-BR")} sem correspondência, ${Number(metrics.linkNotInformed).toLocaleString("pt-BR")} sem link, ${Number(metrics.pendingVerification).toLocaleString("pt-BR")} pendentes. Armazenamento da tabela: ${Number(metrics.storageBytes).toLocaleString("pt-BR")} bytes.`;
    } catch {
      target.textContent = "Não foi possível carregar as métricas neste momento.";
    }
  }

  function renderStateOptions() {
    const select = byId("radarUf");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">Brasil inteiro</option>' + state.states.map((item) =>
      `<option value="${escapeHtml(item.uf)}">${escapeHtml(item.name)} (${escapeHtml(item.uf)})</option>`).join("");
    if (state.states.some((item) => item.uf === previous)) select.value = previous;
  }

  function renderMunicipalityOptions({ loading = false, error = "" } = {}) {
    const select = byId("radarMunicipality");
    const help = byId("radarMunicipalityHelp");
    if (!select) return;
    const uf = byId("radarUf")?.value || "";
    select.disabled = !uf || loading || Boolean(error);
    select.innerHTML = `<option value="">${loading ? "Carregando municípios…" : error ? "Municípios indisponíveis" : uf ? "Todos os municípios" : "Selecione uma UF primeiro"}</option>`
      + state.municipalities.map((item) => `<option value="${escapeHtml(item.ibge_id)}">${escapeHtml(item.name)}</option>`).join("");
    if (help) help.textContent = error || (uf ? "Opcional; limita a busca a esta cidade." : "Escolha uma UF para habilitar este campo.");
  }

  function renderTags() {
    const list = byId("radarTagList");
    if (!list) return;
    list.innerHTML = state.tags.map((tag, index) => `
      <li class="radar-tag">
        <span>${escapeHtml(tag)}</span>
        <button type="button" data-radar-remove-tag="${index}" aria-label="Remover termo ${escapeHtml(tag)}">×</button>
      </li>`).join("");
    const describedBy = byId("radarTagInput");
    if (describedBy) describedBy.setAttribute("aria-describedby", state.tags.length ? "radarTagsHelp radarTagList" : "radarTagsHelp");
  }

  function applyDefaultPeriod() {
    const dates = radarDefaultPeriodDates(state.defaultPeriodDays);
    byId("radarPublishedFrom").value = dates.publishedFrom;
    byId("radarPublishedTo").value = dates.publishedTo;
    byId("radarDateError").textContent = "";
  }

  async function loadMunicipalities(uf) {
    const loadId = ++state.municipalityLoadId;
    state.municipalities = [];
    renderMunicipalityOptions({ loading: true });
    if (!uf) {
      renderMunicipalityOptions();
      return;
    }
    try {
      const catalogService = window.GLLRadarCatalogs.createRadarCatalogsService(client());
      const municipalities = await catalogService.listMunicipalitiesByUf(uf);
      if (loadId !== state.municipalityLoadId) return;
      state.municipalities = municipalities;
      renderMunicipalityOptions();
    } catch (error) {
      if (loadId !== state.municipalityLoadId) return;
      renderMunicipalityOptions({ error: error?.message || "Não foi possível carregar os municípios desta UF." });
    }
  }

  async function loadCatalogs() {
    if (state.loadingCatalogs) return;
    state.loadingCatalogs = true;
    state.catalogsError = "";
    setCatalogFeedback();
    try {
      const currentClient = client();
      const service = window.GLLRadarCatalogs.createRadarCatalogsService(currentClient);
      const [modalitiesResult, statesResult, settingsResult, platformCatalogResult] = await Promise.allSettled([
        service.listModalities(),
        service.listStates(),
        currentClient.from("radar_configuracoes")
          .select("busca_periodo_padrao_dias")
          .eq("id", 1)
          .single(),
        loadPlatformCatalog(),
      ]);
      if (modalitiesResult.status === "rejected") throw modalitiesResult.reason;
      if (statesResult.status === "rejected") throw statesResult.reason;
      if (platformCatalogResult.status === "rejected") throw platformCatalogResult.reason;
      state.modalities = modalitiesResult.value;
      state.states = statesResult.value;
      if (settingsResult.status === "fulfilled" && !settingsResult.value.error) {
        state.defaultPeriodDays = clampPeriodDays(settingsResult.value.data?.busca_periodo_padrao_dias);
      } else {
        state.defaultPeriodDays = DEFAULT_PERIOD_DAYS;
      }
      state.catalogsLoaded = true;
      state.initialized = true;
      renderModalityOptions();
      renderPlatformOptions();
      renderPlatformAdmin();
      renderStateOptions();
      if (!byId("radarPublishedFrom").value && !byId("radarPublishedTo").value) applyDefaultPeriod();
      await loadMunicipalities(byId("radarUf").value);
      void loadPlatformMetrics();
    } catch (error) {
      state.catalogsError = error?.message || "Não foi possível carregar os filtros do Radar.";
      state.initialized = true;
    } finally {
      state.loadingCatalogs = false;
      setCatalogFeedback();
      updateSearchAvailability();
    }
  }

  function updateSearchAvailability() {
    const disabled = state.searching || state.loadingCatalogs || !state.catalogsLoaded;
    const searchButton = byId("radarSearchButton");
    if (searchButton) searchButton.disabled = disabled;
    root?.setAttribute("aria-busy", String(state.searching || state.loadingCatalogs));
  }

  function renderCoverage() {
    const target = byId("radarCoverageFeedback");
    if (!target) return;
    if (state.view === "favorites") {
      target.hidden = true;
      target.replaceChildren();
      return;
    }
    const coverage = state.coverage;
    if (state.searching) {
      target.hidden = false;
      target.dataset.tone = "info";
      target.innerHTML = '<span class="radar-spinner" aria-hidden="true"></span><span>Pesquisando no índice de contratações do Radar…</span>';
      return;
    }
    if (state.error) {
      target.hidden = false;
      target.dataset.tone = state.error.kind === "unavailable" || state.error.kind === "connection" || state.error.kind === "access" ? "error" : "warning";
      target.textContent = state.error.message;
      return;
    }
    if (!state.hasSearched) {
      target.hidden = true;
      target.replaceChildren();
      return;
    }
    let tone = "success";
    let title = "Cobertura completa";
    let description = "O Radar consultou o escopo completo para os filtros atuais.";
    if (coverage?.status === "partial") {
      if (!state.collectionTask || !["queued", "running", "partial"].includes(state.collectionTask.status)) {
        target.hidden = true;
        target.replaceChildren();
        return;
      }
    } else if (coverage?.status === "stale") {
      tone = "warning";
      title = "Cobertura desatualizada";
      description = "Os resultados disponíveis podem não incluir as atualizações mais recentes do PNCP.";
    } else if (coverage?.status === "not_collected") {
      tone = "info";
      title = "Período ainda não coletado";
      description = "Não há cobertura confirmada para todo o escopo pesquisado.";
    } else if (coverage?.status === "failed") {
      tone = "error";
      title = "Falha de sincronização";
      description = "A coleta não concluiu o escopo solicitado. Os registros atuais podem estar incompletos.";
    }
    if (state.collectionTask && ["queued", "running", "partial"].includes(state.collectionTask.status)) {
      tone = "info";
      title = "Atualização em andamento";
      description = state.collectionTask.status === "queued"
        ? "A solicitação entrou na fila do Radar. A tabela mostra os dados já indexados e pode ser consultada novamente."
        : "O Radar está atualizando este escopo. A tabela mostra os dados já indexados e pode ser consultada novamente.";
    } else if (state.collectionTask?.status === "failed") {
      tone = "error";
      title = "Falha de sincronização";
      description = "O Radar não concluiu a atualização solicitada. Os resultados atuais podem estar incompletos.";
    } else if (state.collectionTask?.status === "complete") {
      tone = "success";
      title = "Atualização concluída";
      description = "A coleta solicitada foi concluída para este escopo.";
    }
    const coverageTime = coverage?.updatedAt ? ` Última cobertura: ${formatDateTime(coverage.updatedAt)}.` : "";
    target.hidden = false;
    target.dataset.tone = tone;
    target.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(description + coverageTime)}</span>`;
  }

  function resolveModalityName(id) {
    return state.modalities.find((item) => Number(item.pncp_id) === Number(id))?.name || (id ? `Modalidade ${id}` : "—");
  }

  function resolveMunicipalityName(result) {
    if (result.municipalityName) return result.municipalityName;
    if (result.municipalityIbgeId === null || result.municipalityIbgeId === undefined || result.municipalityIbgeId === "") {
      return "Município não informado";
    }
    const id = Number(result.municipalityIbgeId);
    return state.municipalityNames.get(id) || (Number.isSafeInteger(id) ? `IBGE ${id}` : "Município não informado");
  }

  function renderResultActions(result) {
    const buttons = [];
    if (typeof actions.setFavorite === "function") {
      const favorite = state.favoriteIds.has(result.numberControlPncp);
      const updating = state.favoriteUpdatingIds.has(result.numberControlPncp);
      const unavailable = state.favoriteState === "error";
      const loading = state.favoriteState === "loading";
      const label = unavailable ? "Favorito indisponível" : loading ? "Carregando…" : updating ? "Atualizando…" : favorite ? "Desfavoritar" : "Favoritar";
      const symbol = loading || updating ? "…" : favorite ? "★" : "☆";
      buttons.push(`<button type="button" class="icon-button radar-favorite-action${favorite ? " is-favorited" : ""}" data-radar-favorite="${escapeHtml(result.numberControlPncp)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-pressed="${favorite}"${updating || unavailable || loading ? " disabled" : ""}><span aria-hidden="true">${symbol}</span></button>`);
    }
    const sourceUrl = validatedPncpSourceUrl(result.sourceUrl);
    if (sourceUrl) buttons.push(`<a class="quiet-action compact-action radar-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">PNCP <span aria-hidden="true">↗</span></a>`);
    if (typeof actions.onOpenDetails === "function") {
      buttons.push(`<button type="button" class="primary-action compact-action" data-radar-detail="${escapeHtml(result.numberControlPncp)}">Ver itens</button>`);
    }
    return buttons.length ? `<div class="radar-row-actions">${buttons.join("")}</div>` : '<span class="radar-no-actions" aria-label="Ações disponíveis na Fase 6">Disponível na Fase 6</span>';
  }

  function renderResultCard(result) {
    const object = String(result.object || "Objeto não informado");
    const excerpt = object.length > 220 ? `${object.slice(0, 217).trimEnd()}…` : object;
    const number = result.procurementNumber || result.numberControlPncp || "—";
    const year = result.year ? `/${escapeHtml(result.year)}` : "";
    const receipt = RECEIPT_STATUS_LABELS[result.proposalReceiptStatus] || RECEIPT_STATUS_LABELS.unknown;
    const municipality = `${escapeHtml(resolveMunicipalityName(result))}${result.uf ? ` - ${escapeHtml(result.uf)}` : ""}`;
    const administrative = result.administrativeUnitName && result.administrativeUnitName !== result.agencyName
      ? `<small>${escapeHtml(result.administrativeUnitName)}</small>` : "";
    return `<article class="radar-result-card">
      <div class="radar-result-card-heading">
        <div><p class="radar-result-number"><strong>Edital ${escapeHtml(number)}${year}</strong><span>PNCP ${escapeHtml(result.numberControlPncp || "—")}</span></p><h3>${escapeHtml(excerpt)}</h3>${object.length > 220 ? `<details class="radar-object-details"><summary>Ver objeto completo</summary><p>${escapeHtml(object)}</p></details>` : ""}</div>
        <span class="radar-receipt-status" data-status="${escapeHtml(result.proposalReceiptStatus || "unknown")}">${escapeHtml(receipt)}</span>
      </div>
      <dl class="radar-result-fields">
        <div><dt>Município - UF</dt><dd>${municipality}</dd></div>
        <div><dt>Órgão responsável</dt><dd>${escapeHtml(result.agencyName || result.administrativeUnitName || "Órgão não informado")}${administrative}</dd></div>
        <div><dt>Modalidade</dt><dd>${escapeHtml(resolveModalityName(result.modalityId))}</dd></div>
        <div><dt>Abertura das propostas</dt><dd>${escapeHtml(formatDateTime(result.proposalsStartAt))}</dd></div>
        <div><dt>Encerramento das propostas</dt><dd>${escapeHtml(formatDateTime(result.proposalsEndAt))}</dd></div>
        <div><dt>Publicação no PNCP</dt><dd>${escapeHtml(formatDate(result.publishedAt))}</dd></div>
      </dl>
      <div class="radar-result-card-footer"><div class="radar-result-value"><small>Valor estimado</small><strong>${escapeHtml(formatMoney(result.estimatedValue))}</strong></div>${renderResultActions(result)}</div>
    </article>`;
  }

  function renderPagination() {
    const target = byId("radarPagination");
    if (!target) return;
    if (state.view === "favorites") {
      const pagination = state.favoritesPagination;
      if (!pagination || pagination.totalCount <= pagination.pageSize) {
        target.hidden = true;
        target.replaceChildren();
        return;
      }
      const pages = Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize));
      target.hidden = false;
      target.innerHTML = `
        <span>Página ${pagination.page} de ${pages} <small>${pagination.totalCount.toLocaleString("pt-BR")} favoritos.</small></span>
        <div class="button-row">
          <button class="quiet-action compact-action" type="button" data-radar-favorites-page="${pagination.page - 1}"${pagination.page <= 1 || state.favoritesLoading ? " disabled" : ""}>Anterior</button>
          <button class="quiet-action compact-action" type="button" data-radar-favorites-page="${pagination.page + 1}"${!pagination.hasMore || state.favoritesLoading ? " disabled" : ""}>Próxima</button>
        </div>`;
      return;
    }
    if (!state.hasSearched || !state.pagination) {
      target.hidden = true;
      target.replaceChildren();
      return;
    }
    const page = Number(state.pagination.page || 1);
    const totalCount = Number.isSafeInteger(state.pagination.totalCount) ? state.pagination.totalCount : null;
    const pages = totalCount === null ? null : Math.max(1, Math.ceil(totalCount / Number(state.pagination.pageSize || 20)));
    const label = pages === null ? `Página ${page}` : `Página ${page} de ${pages}`;
    const more = totalCount === null
      ? (state.pagination.hasMore ? "Há mais resultados indexados." : "Fim dos resultados indexados.")
      : `${totalCount.toLocaleString("pt-BR")} resultados.`;
    target.hidden = false;
    target.innerHTML = `
      <span>${escapeHtml(label)} <small>${escapeHtml(more)}</small></span>
      <div class="button-row">
        <button class="quiet-action compact-action" type="button" data-radar-page="${page - 1}"${page <= 1 || state.searching ? " disabled" : ""}>Anterior</button>
        <button class="quiet-action compact-action" type="button" data-radar-page="${page + 1}"${!state.pagination.hasMore || state.searching ? " disabled" : ""}>Próxima</button>
      </div>`;
  }

  function renderResults() {
    const target = byId("radarResultsContent");
    const count = byId("radarResultsCount");
    if (!target) return;
    const favoritesView = state.view === "favorites";
    const rows = favoritesView ? state.favoritesResults : state.results;
    const searchForm = byId("radarSearchForm");
    const workbench = byId("radarWorkbench");
    const filterRail = byId("radarFilterRail");
    const platformAdminSettings = byId("radarPlatformAdminSettings");
    const resultControls = root?.querySelector(".radar-results-controls");
    workbench?.classList.toggle("is-favorites", favoritesView);
    if (filterRail) filterRail.hidden = favoritesView;
    if (searchForm) searchForm.hidden = favoritesView;
    if (platformAdminSettings) platformAdminSettings.hidden = favoritesView || getUserRole?.() !== "Administrador";
    if (resultControls) resultControls.hidden = favoritesView;
    byId("radarSearchViewButton")?.setAttribute("aria-pressed", String(!favoritesView));
    byId("radarFavoritesViewButton")?.setAttribute("aria-pressed", String(favoritesView));
    const title = byId("radarResultsTitle");
    if (title) title.textContent = favoritesView ? "Favoritos" : "Resultados";
    if (favoritesView) {
      if (state.favoritesLoading && !rows.length) {
        if (count) count.textContent = "Carregando favoritos…";
        target.innerHTML = '<div class="radar-loading" role="status"><span class="radar-spinner" aria-hidden="true"></span><span>Carregando seus favoritos…</span></div>';
        renderPagination();
        renderCoverage();
        return;
      }
      if (state.favoritesError) {
        if (count) count.textContent = "Não foi possível carregar os favoritos.";
        target.innerHTML = `<div class="radar-feedback" data-tone="error" role="alert"><strong>Favoritos indisponíveis</strong><span>${escapeHtml(state.favoritesError)}</span><button class="quiet-action compact-action" type="button" data-radar-action="reload-favorites">Tentar novamente</button></div>`;
        renderPagination();
        renderCoverage();
        return;
      }
      if (!rows.length) {
        if (count) count.textContent = "0 licitações favoritas.";
        target.innerHTML = '<div class="empty-state radar-empty-state"><span class="radar-empty-icon" aria-hidden="true">☆</span><strong>Você ainda não tem favoritos</strong><p>Pesquise uma contratação e use “Favoritar” para guardá-la nesta conta.</p></div>';
        renderPagination();
        renderCoverage();
        return;
      }
      const total = Number(state.favoritesPagination?.totalCount ?? rows.length);
      if (count) count.textContent = `${total.toLocaleString("pt-BR")} licitações favoritas nesta conta.`;
      target.innerHTML = `<div class="radar-result-list">${rows.map(renderResultCard).join("")}</div>`;
      renderPagination();
      renderCoverage();
      return;
    }
    if (!state.hasSearched && !state.searching) {
      if (count) count.textContent = "Configure os filtros para iniciar uma pesquisa.";
      target.innerHTML = '<div class="empty-state radar-empty-state"><span class="radar-empty-icon" aria-hidden="true">⌕</span><strong>Pesquise contratações do PNCP</strong><p>O Radar pesquisa somente o objeto da contratação. Você pode informar mais de um termo; qualquer termo pode corresponder.</p></div>';
      renderPagination();
      renderCoverage();
      return;
    }
    if (state.searching && !rows.length) {
      if (count) count.textContent = "A pesquisa está em andamento.";
      target.innerHTML = '<div class="radar-loading" role="status"><span class="radar-spinner" aria-hidden="true"></span><span>Consultando o índice do Radar…</span></div>';
      renderPagination();
      renderCoverage();
      return;
    }
    if (!rows.length) {
      const empty = radarEmptyResultState(state.coverage);
      if (count) count.textContent = "Nenhum registro nesta página.";
      target.innerHTML = `<div class="empty-state radar-empty-state" data-empty-kind="${empty.kind}"><span class="radar-empty-icon" aria-hidden="true">◇</span><strong>${escapeHtml(empty.title)}</strong><p>${escapeHtml(empty.description)}</p></div>`;
      renderPagination();
      renderCoverage();
      return;
    }
    if (count) {
      count.textContent = state.pagination?.totalCount === null || state.pagination?.totalCount === undefined
      ? `${rows.length.toLocaleString("pt-BR")} resultados nesta página; total ainda não confirmado.`
        : `${Number(state.pagination.totalCount).toLocaleString("pt-BR")} licitações encontradas.`;
    }
    target.innerHTML = `<div class="radar-result-list">${rows.map(renderResultCard).join("")}</div>`;
    renderPagination();
    renderCoverage();
  }

  function readForm() {
    return currentFiltersFromInputs(root, state.tags, state.selectedModalities, state.selectedPlatformIds);
  }

  function collectPendingTags() {
    const input = byId("radarTagInput");
    const error = byId("radarTagsError");
    const typed = input?.value || "";
    if (!typed.trim()) return true;
    let newTags;
    try {
      newTags = parseRadarTags(typed);
      const merged = parseRadarTags([...state.tags, ...newTags].join("\n"));
      state.tags = merged;
      input.value = "";
      error.textContent = "";
      renderTags();
      return true;
    } catch (tagError) {
      error.textContent = tagError.message;
      input.setAttribute("aria-invalid", "true");
      return false;
    }
  }

  function validateDates() {
    const from = byId("radarPublishedFrom");
    const to = byId("radarPublishedTo");
    const error = byId("radarDateError");
    from.removeAttribute("aria-invalid");
    to.removeAttribute("aria-invalid");
    if (from.value && to.value && from.value > to.value) {
      const message = "A data inicial deve ser igual ou anterior à data final.";
      from.setAttribute("aria-invalid", "true");
      to.setAttribute("aria-invalid", "true");
      error.textContent = message;
      return false;
    }
    error.textContent = "";
    return true;
  }

  async function loadMunicipalityLabels(results) {
    const ids = [...new Set(results.map((result) => Number(result.municipalityIbgeId)).filter((id) => Number.isSafeInteger(id) && id > 0))];
    if (!ids.length) {
      state.municipalityNames = new Map();
      return;
    }
    try {
      const result = await client().from("radar_catalog_municipalities")
        .select("ibge_id, name")
        .eq("is_active", true)
        .in("ibge_id", ids);
      if (!result.error) {
        state.municipalityNames = new Map((result.data || []).map((row) => [Number(row.ibge_id), row.name]));
      }
    } catch {
      // A falha no rótulo do município não deve invalidar os resultados da busca.
    }
  }

  async function loadFavoritesPage(page = 1) {
    state.view = "favorites";
    state.favoritesPage = Math.max(1, Number(page) || 1);
    state.favoritesLoading = true;
    state.favoritesError = "";
    renderResults();
    try {
      if (typeof actions.loadFavoritesPage !== "function") {
        throw new Error("O serviço de favoritos não está disponível.");
      }
      const result = await actions.loadFavoritesPage({ page: state.favoritesPage, pageSize: 20 });
      state.favoritesResults = Array.isArray(result?.results) ? result.results : [];
      state.favoriteIds = new Set(Array.isArray(result?.favoriteIds) ? result.favoriteIds : []);
      state.favoritesPagination = {
        page: Number(result?.page || state.favoritesPage),
        pageSize: Number(result?.pageSize || 20),
        totalCount: Number(result?.totalCount || 0),
        hasMore: result?.hasMore === true,
      };
      state.favoritesPage = state.favoritesPagination.page;
      if (!state.favoritesResults.length && state.favoritesPage > 1
        && state.favoritesPagination.totalCount <= (state.favoritesPage - 1) * state.favoritesPagination.pageSize) {
        return await loadFavoritesPage(state.favoritesPage - 1);
      }
    } catch (error) {
      state.favoritesError = error instanceof Error ? error.message : "Não foi possível carregar os favoritos.";
      state.favoritesResults = [];
      state.favoritesPagination = null;
    } finally {
      state.favoritesLoading = false;
      renderResults();
    }
  }

  function showSearchView() {
    state.view = "search";
    state.favoritesError = "";
    renderResults();
  }

  async function toggleFavorite(result) {
    const id = String(result?.numberControlPncp || "");
    if (!id || typeof actions.setFavorite !== "function" || state.favoriteUpdatingIds.has(id)) return;
    const shouldFavorite = !state.favoriteIds.has(id);
    state.favoriteUpdatingIds.add(id);
    renderResults();
    try {
      const isFavorite = await actions.setFavorite(result, shouldFavorite);
      if (isFavorite) state.favoriteIds.add(id);
      else state.favoriteIds.delete(id);
      toast(isFavorite ? "Licitação adicionada aos favoritos." : "Licitação removida dos favoritos.", "success");
      if (state.view === "favorites" && !isFavorite) await loadFavoritesPage(state.favoritesPage);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível atualizar o favorito.", "error");
    } finally {
      state.favoriteUpdatingIds.delete(id);
      renderResults();
    }
  }

  function syncFavorite(identifier, isFavorite) {
    const id = String(identifier || "");
    if (!id) return;
    if (isFavorite) state.favoriteIds.add(id);
    else state.favoriteIds.delete(id);
    if (state.view === "favorites" && !isFavorite) {
      void loadFavoritesPage(state.favoritesPage);
      return;
    }
    renderResults();
  }

  async function runSearch({ page = 1, refreshCoverage = false } = {}) {
    if (!state.catalogsLoaded) {
      await loadCatalogs();
      if (!state.catalogsLoaded) return;
    }
    if (!collectPendingTags() || !validateDates()) return;
    const filters = readForm();
    let payload;
    try {
      payload = buildRadarSearchPayload(filters, {
        page,
        refreshCoverage,
        activeModalities: state.modalities.map((item) => item.pncp_id),
      });
    } catch (error) {
      const tagError = byId("radarTagsError");
      tagError.textContent = error.message;
      return;
    }
    state.searching = true;
    state.updating = refreshCoverage;
    state.error = null;
    updateSearchAvailability();
    renderCoverage();
    renderResults();
    announce(refreshCoverage ? "Atualização da cobertura solicitada." : "Pesquisa do Radar iniciada.");
    try {
      const { data, error } = await client().functions.invoke("radar-search", { body: payload });
      if (error) throw error;
      if (!data || !Array.isArray(data.results) || !data.pagination || !data.coverage) {
        throw new Error("O Radar retornou uma resposta incompatível com o contrato de pesquisa.");
      }
      state.results = data.results;
      state.coverage = data.coverage;
      state.pagination = data.pagination;
      state.collectionTask = data.collectionTask || null;
      state.queriedAt = data.metadata?.queriedAt || null;
      state.dataUpdatedAt = data.metadata?.dataUpdatedAt || data.coverage.updatedAt || null;
      state.hasSearched = true;
      await loadMunicipalityLabels(state.results);
      if (typeof actions.loadFavoriteIds === "function") {
        state.favoriteState = "loading";
        renderResults();
        try {
          const identifiers = state.results.map((result) => result.numberControlPncp).filter(Boolean);
          state.favoriteIds = new Set(await actions.loadFavoriteIds(identifiers));
          state.favoriteState = "ready";
        } catch {
          state.favoriteState = "error";
        }
      } else {
        state.favoriteState = "error";
      }
      if (refreshCoverage && data.collectionTask) {
        toast("A atualização da cobertura foi solicitada.", "info");
      }
    } catch (error) {
      state.error = await describeFunctionError(error, "Não foi possível pesquisar as licitações agora.");
      if (!state.hasSearched) state.results = [];
    } finally {
      state.searching = false;
      state.updating = false;
      updateSearchAvailability();
      renderCoverage();
      renderResults();
    }
  }

  function setPlatformAdminStatus(message) {
    const target = byId("radarPlatformAdminStatus");
    if (target) target.textContent = message;
  }

  function resetPlatformForm() {
    byId("radarPlatformId").value = "";
    byId("radarPlatformName").value = "";
    byId("radarPlatformSlug").value = "";
    byId("radarPlatformDescription").value = "";
    byId("radarPlatformActive").checked = true;
  }

  function resetPlatformDomainForm() {
    byId("radarPlatformDomainId").value = "";
    byId("radarPlatformDomainName").value = "";
    byId("radarPlatformIncludeSubdomains").checked = false;
    byId("radarPlatformDomainActive").checked = true;
  }

  async function savePlatformForm(event) {
    event.preventDefault();
    if (getUserRole?.() !== "Administrador") return setPlatformAdminStatus("Somente Administradores podem alterar o catálogo.");
    setPlatformAdminStatus("Salvando plataforma…");
    try {
      const { data, error } = await client().functions.invoke("radar-catalogs", { body: {
        action: "platform_save",
        id: byId("radarPlatformId").value || undefined,
        name: byId("radarPlatformName").value,
        slug: byId("radarPlatformSlug").value,
        description: byId("radarPlatformDescription").value,
        active: byId("radarPlatformActive").checked,
      } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Não foi possível salvar a plataforma.");
      await loadPlatformCatalog();
      resetPlatformForm();
      setPlatformAdminStatus("Plataforma salva. Os registros anteriores foram marcados para reclassificação em lotes.");
      await loadPlatformMetrics();
    } catch (error) {
      const described = await describeFunctionError(error, "Não foi possível salvar a plataforma.");
      setPlatformAdminStatus(described.message);
    }
  }

  async function savePlatformDomainForm(event) {
    event.preventDefault();
    if (getUserRole?.() !== "Administrador") return setPlatformAdminStatus("Somente Administradores podem alterar o catálogo.");
    setPlatformAdminStatus("Salvando domínio…");
    try {
      const { data, error } = await client().functions.invoke("radar-catalogs", { body: {
        action: "domain_save",
        id: byId("radarPlatformDomainId").value || undefined,
        platformId: byId("radarPlatformDomainPlatform").value,
        domain: byId("radarPlatformDomainName").value,
        includeSubdomains: byId("radarPlatformIncludeSubdomains").checked,
        active: byId("radarPlatformDomainActive").checked,
      } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Não foi possível salvar o domínio.");
      await loadPlatformCatalog();
      resetPlatformDomainForm();
      setPlatformAdminStatus("Regra de domínio salva. Os registros anteriores foram marcados para reclassificação em lotes.");
      await loadPlatformMetrics();
    } catch (error) {
      const described = await describeFunctionError(error, "Não foi possível salvar o domínio.");
      setPlatformAdminStatus(described.message);
    }
  }

  async function reclassifyPlatformBatch() {
    const button = byId("radarPlatformReclassify");
    if (getUserRole?.() !== "Administrador") return setPlatformAdminStatus("Somente Administradores podem reclassificar licitações.");
    const batchSize = Number(byId("radarPlatformBatchSize")?.value || 250);
    const maxPncpLookups = Number(byId("radarPlatformPncpLookups")?.value || 0);
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500 || !Number.isInteger(maxPncpLookups) || maxPncpLookups < 0 || maxPncpLookups > 5) {
      return setPlatformAdminStatus("Informe um lote entre 1 e 500 e até 5 consultas PNCP.");
    }
    if (button) button.disabled = true;
    setPlatformAdminStatus("Processando reclassificação…");
    try {
      const { data, error } = await client().functions.invoke("radar-collector", {
        body: { action: "reclassify_platforms", batchSize, maxPncpLookups },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Não foi possível executar a reclassificação.");
      setPlatformAdminStatus(`Lote processado: ${Number(data.processed).toLocaleString("pt-BR")}; classificadas: ${Number(data.classified).toLocaleString("pt-BR")}; não identificadas: ${Number(data.unidentified).toLocaleString("pt-BR")}; consultas PNCP enfileiradas: ${Number(data.pncpRequestsQueued).toLocaleString("pt-BR")}; ainda com link para reclassificar: ${Number(data.remainingWithUrl).toLocaleString("pt-BR")}; sem link pendente: ${Number(data.remainingWithoutUrl).toLocaleString("pt-BR")}.`);
      await loadPlatformMetrics();
    } catch (error) {
      const described = await describeFunctionError(error, "Não foi possível executar a reclassificação.");
      setPlatformAdminStatus(described.message);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function togglePlatformActive(id) {
    const platform = state.platforms.find((item) => item.id === id);
    if (!platform) return;
    const { data, error } = await client().functions.invoke("radar-catalogs", { body: {
      action: "platform_save", id: platform.id, name: platform.nome, slug: platform.slug,
      description: platform.descricao || "", active: !platform.ativo,
    } });
    if (error || !data?.ok) throw error || new Error(data?.error || "Não foi possível alterar a plataforma.");
    await loadPlatformCatalog();
    await loadPlatformMetrics();
  }

  async function togglePlatformDomainActive(id) {
    const domain = state.platformDomains.find((item) => item.id === id);
    if (!domain) return;
    const { data, error } = await client().functions.invoke("radar-catalogs", { body: {
      action: "domain_save", id: domain.id, platformId: domain.plataforma_id, domain: domain.dominio,
      includeSubdomains: domain.incluir_subdominios, active: !domain.ativo,
    } });
    if (error || !data?.ok) throw error || new Error(data?.error || "Não foi possível alterar a regra.");
    await loadPlatformCatalog();
    await loadPlatformMetrics();
  }

  function editPlatform(id) {
    const platform = state.platforms.find((item) => item.id === id);
    if (!platform) return;
    byId("radarPlatformId").value = platform.id;
    byId("radarPlatformName").value = platform.nome;
    byId("radarPlatformSlug").value = platform.slug;
    byId("radarPlatformDescription").value = platform.descricao || "";
    byId("radarPlatformActive").checked = platform.ativo;
    byId("radarPlatformName").focus();
  }

  function editPlatformDomain(id) {
    const domain = state.platformDomains.find((item) => item.id === id);
    if (!domain) return;
    byId("radarPlatformDomainId").value = domain.id;
    byId("radarPlatformDomainPlatform").value = domain.plataforma_id;
    byId("radarPlatformDomainName").value = domain.dominio;
    byId("radarPlatformIncludeSubdomains").checked = domain.incluir_subdominios;
    byId("radarPlatformDomainActive").checked = domain.ativo;
    byId("radarPlatformDomainName").focus();
  }

  function resetFilters() {
    state.tags = [];
    state.selectedModalities = null;
    state.selectedPlatformIds = null;
    byId("radarIncludeUnidentified").checked = false;
    state.results = [];
    state.coverage = null;
    state.pagination = null;
    state.collectionTask = null;
    state.hasSearched = false;
    state.error = null;
    if (byId("radarTagInput")) byId("radarTagInput").value = "";
    if (byId("radarUf")) byId("radarUf").value = "";
    if (byId("radarSituation")) byId("radarSituation").value = "open";
    if (byId("radarPageSize")) byId("radarPageSize").value = "20";
    if (byId("radarSortBy")) byId("radarSortBy").value = "publishedAt";
    if (byId("radarSortDirection")) byId("radarSortDirection").value = "desc";
    renderTags();
    renderModalityOptions();
    renderPlatformOptions();
    renderStateOptions();
    renderMunicipalityOptions();
    byId("radarTagsError").textContent = "";
    byId("radarDateError").textContent = "";
    applyDefaultPeriod();
    renderCoverage();
    renderResults();
  }

  function bind() {
    if (!root || state.bound) return;
    state.bound = true;
    root.addEventListener("submit", (event) => {
      if (event.target?.id === "radarSearchForm") {
        event.preventDefault();
        void runSearch({ page: 1 });
      } else if (event.target?.id === "radarPlatformForm") {
        void savePlatformForm(event);
      } else if (event.target?.id === "radarPlatformDomainForm") {
        void savePlatformDomainForm(event);
      }
    });
    root.addEventListener("click", (event) => {
      const target = event.target.closest("[data-radar-action], [data-radar-remove-tag], [data-radar-page], [data-radar-favorites-page], [data-radar-detail], [data-radar-favorite], [data-platform-edit], [data-platform-toggle], [data-domain-edit], [data-domain-toggle]");
      if (!target) return;
      if (target.dataset.radarRemoveTag !== undefined) {
        const index = Number(target.dataset.radarRemoveTag);
        state.tags.splice(index, 1);
        renderTags();
        byId("radarTagInput").focus();
      } else if (target.dataset.radarPage !== undefined) {
        const page = Number(target.dataset.radarPage);
        if (page >= 1 && page !== Number(state.pagination?.page)) void runSearch({ page });
      } else if (target.dataset.radarFavoritesPage !== undefined) {
        const page = Number(target.dataset.radarFavoritesPage);
        if (page >= 1 && page !== state.favoritesPage) void loadFavoritesPage(page);
      } else if (target.dataset.radarAction === "add-tag") {
        collectPendingTags();
        byId("radarTagInput").focus();
      } else if (target.dataset.radarAction === "clear") {
        resetFilters();
      } else if (target.dataset.radarAction === "reload-catalogs") {
        state.catalogsLoaded = false;
        void loadCatalogs();
      } else if (target.dataset.radarAction === "toggle-modalities") {
        const selectedCount = state.selectedModalities === null
          ? state.modalities.length
          : state.selectedModalities.length;
        state.selectedModalities = selectedCount === state.modalities.length ? [] : null;
        renderModalityOptions();
      } else if (target.dataset.radarAction === "reset-platform-form") {
        resetPlatformForm();
      } else if (target.dataset.radarAction === "reset-domain-form") {
        resetPlatformDomainForm();
      } else if (target.dataset.radarAction === "reclassify-platforms") {
        void reclassifyPlatformBatch();
      } else if (target.dataset.radarAction === "refresh-platform-metrics") {
        void loadPlatformMetrics();
      } else if (target.dataset.radarAction === "refresh") {
        void runSearch({ page: 1, refreshCoverage: true });
      } else if (target.dataset.radarAction === "show-search") {
        showSearchView();
      } else if (target.dataset.radarAction === "show-favorites") {
        void loadFavoritesPage(1);
      } else if (target.dataset.radarAction === "reload-favorites") {
        void loadFavoritesPage(state.favoritesPage);
      } else if (target.dataset.radarDetail && typeof actions.onOpenDetails === "function") {
        const result = state.results.find((item) => item.numberControlPncp === target.dataset.radarDetail);
        const favoriteResult = state.view === "favorites"
          ? state.favoritesResults.find((item) => item.numberControlPncp === target.dataset.radarDetail)
          : null;
        if (result || favoriteResult) actions.onOpenDetails(result || favoriteResult);
      } else if (target.dataset.radarFavorite && typeof actions.setFavorite === "function") {
        const result = [...state.results, ...state.favoritesResults]
          .find((item) => item.numberControlPncp === target.dataset.radarFavorite);
        if (result) void toggleFavorite(result);
      } else if (target.dataset.platformEdit) {
        editPlatform(target.dataset.platformEdit);
      } else if (target.dataset.platformToggle) {
        void togglePlatformActive(target.dataset.platformToggle).catch((error) => setPlatformAdminStatus(error?.message || "Não foi possível alterar a plataforma."));
      } else if (target.dataset.domainEdit) {
        editPlatformDomain(target.dataset.domainEdit);
      } else if (target.dataset.domainToggle) {
        void togglePlatformDomainActive(target.dataset.domainToggle).catch((error) => setPlatformAdminStatus(error?.message || "Não foi possível alterar a regra."));
      }
    });
    root.addEventListener("change", (event) => {
      if (event.target?.id === "radarUf") {
        void loadMunicipalities(event.target.value);
      } else if (event.target?.matches('input[name="radarModality"]')) {
        const selected = state.selectedModalities === null
          ? new Set(state.modalities.map((item) => Number(item.pncp_id)))
          : new Set(state.selectedModalities);
        const modalityId = Number(event.target.value);
        if (event.target.checked) selected.add(modalityId);
        else selected.delete(modalityId);
        state.selectedModalities = selected.size === state.modalities.length ? null : [...selected];
        updateModalitySummary();
      } else if (event.target?.matches('input[name="radarPlatform"]')) {
        const activePlatforms = state.platforms.filter((platform) => platform.ativo);
        const selected = state.selectedPlatformIds === null
          ? new Set(activePlatforms.map((platform) => platform.id))
          : new Set(state.selectedPlatformIds);
        if (event.target.checked) selected.add(event.target.value);
        else selected.delete(event.target.value);
        const includeUnknown = byId("radarIncludeUnidentified")?.checked === true;
        state.selectedPlatformIds = selected.size === activePlatforms.length || (selected.size === 0 && !includeUnknown)
          ? null
          : [...selected];
        updatePlatformSummary();
      } else if (event.target?.id === "radarIncludeUnidentified") {
        if (!event.target.checked && state.selectedPlatformIds?.length === 0) state.selectedPlatformIds = null;
        updatePlatformSummary();
      } else if (event.target?.id === "radarPageSize" && state.hasSearched) {
        void runSearch({ page: 1 });
      } else if (["radarSortBy", "radarSortDirection"].includes(event.target?.id) && state.hasSearched) {
        void runSearch({ page: 1 });
      }
    });
    byId("radarPlatformSearch")?.addEventListener("input", renderPlatformOptions);
    byId("radarTagInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        collectPendingTags();
      } else if (event.key === "Backspace" && !event.target.value && state.tags.length) {
        state.tags.pop();
        renderTags();
      }
    });
    byId("radarTagInput")?.addEventListener("input", () => {
      byId("radarTagInput").removeAttribute("aria-invalid");
      byId("radarTagsError").textContent = "";
    });
    byId("radarSearchButton")?.addEventListener("click", () => {
      if (byId("radarSearchForm").requestSubmit) return;
      void runSearch({ page: 1 });
    });
  }

  bind();

  return Object.freeze({
    async showPage() {
      if (!state.catalogsLoaded && !state.loadingCatalogs) await loadCatalogs();
      else setCatalogFeedback();
      renderCoverage();
      renderResults();
      actions.syncDetailRoute?.();
    },
    syncFavorite,
    reset() {
      state.initialized = false;
      state.catalogsLoaded = false;
      state.loadingCatalogs = false;
      state.catalogsError = "";
      state.modalities = [];
      state.states = [];
      state.municipalities = [];
      state.platforms = [];
      state.platformDomains = [];
      state.platformCatalogVersion = 1;
      state.municipalityNames.clear();
      state.municipalityLoadId += 1;
      state.selectedModalities = null;
      state.selectedPlatformIds = null;
      state.tags = [];
      state.results = [];
      state.favoriteIds.clear();
      state.favoriteState = "idle";
      state.favoritesResults = [];
      state.favoritesPagination = null;
      state.favoritesPage = 1;
      state.favoritesLoading = false;
      state.favoritesError = "";
      state.favoriteUpdatingIds.clear();
      state.view = "search";
      actions.resetDetails?.();
      state.coverage = null;
      state.pagination = null;
      state.collectionTask = null;
      state.queriedAt = null;
      state.dataUpdatedAt = null;
      state.hasSearched = false;
      state.searching = false;
      state.updating = false;
      state.error = null;
      root?.querySelector("#radarSearchForm")?.reset();
      renderTags();
      renderResults();
      setCatalogFeedback();
      updateSearchAvailability();
    },
  });
}

if (typeof window !== "undefined") {
  window.GLLRadarSearch = Object.freeze({ createRadarSearchFeature });
}
