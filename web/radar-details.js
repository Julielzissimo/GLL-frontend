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
  "plataforma_status",
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
    platformSourceUrl: row?.link_sistema_origem || null,
    platformStatus: row?.plataforma_status || "pending_verification",
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

export function createRadarDetailsFeature({ getClient, toast = () => {}, onFavoriteChanged = () => {}, onOpenBid = () => {} } = {}) {
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
    historyEntry: false,
    itemsPage: 1,
    selectedItemNumbers: createRadarItemSelectionState(),
    importStatus: null,
    importStatusError: "",
    importFeedback: "",
    importFeedbackTone: "success",
    confirmingImport: false,
    importing: false,
    lastImport: null,
  };

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
      feedback.innerHTML = '<span class="radar-spinner" aria-hidden="true"></span><span>Consultando contratação, itens e documentos no PNCP…</span>';
      return;
    }
    if (state.notFound) {
      feedback.hidden = false;
      feedback.dataset.tone = "warning";
      feedback.innerHTML = "<strong>Contratação não encontrada</strong><span>O PNCP não localizou esta contratação. Volte aos resultados e atualize a pesquisa.</span>";
      return;
    }
    if (state.error) {
      const oldDataDate = state.data?.retrievedAt ? dateTimeFormatter.format(new Date(state.data.retrievedAt)) : "";
      feedback.hidden = false;
      feedback.dataset.tone = state.data ? "warning" : "error";
      feedback.innerHTML = state.data
        ? `<strong>Atualização indisponível</strong><span>O PNCP não respondeu. Os dados carregados em ${escapeHtml(oldDataDate)} permanecem visíveis; tente atualizar novamente.</span>`
        : `<strong>PNCP indisponível</strong><span>${escapeHtml(state.error)} Tente atualizar os detalhes novamente.</span>`;
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
      : platform.status === "pending_verification" ? "Pendente de verificação" : "Não identificada";
    const platformUrl = validatedPlatformSourceUrl(platform.sourceUrl || contract.linkSistemaOrigem);
    return `<section class="section-band radar-detail-section" aria-labelledby="radarGeneralTitle">
      <div class="radar-detail-section-heading"><div><h2 id="radarGeneralTitle">Informações gerais</h2><p>Dados consultados diretamente no PNCP.</p></div></div>
      <dl class="radar-detail-grid">${values.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd${label === "Objeto da contratação" ? ' class="radar-detail-object"' : ""}>${escapeHtml(value || "Não informado")}</dd></div>`).join("")}</dl>
      <section class="radar-platform-detail" aria-labelledby="radarPlatformDetailTitle">
        <h3 id="radarPlatformDetailTitle">Plataforma de disputa</h3>
        <p><strong>${escapeHtml(platformStatus)}</strong></p>
        ${platformUrl ? `<p>Link de origem informado pelo PNCP: <a href="${escapeHtml(platformUrl)}" target="_blank" rel="noopener noreferrer">Acessar plataforma <span aria-hidden="true">↗</span></a></p>` : "<p>O PNCP não informou um link de origem seguro para abrir.</p>"}
        <small>A identificação automática corresponde ao domínio da URL. Ela não confirma que o endereço seja a sessão efetiva de disputa.</small>
      </section>
      ${officialUrl ? `<a class="quiet-action compact-action radar-official-link" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">Abrir contratação no PNCP <span aria-hidden="true">↗</span></a>` : ""}
    </section>`;
  }

  function renderItems(itemsState) {
    if (itemsState?.status === "unavailable" || itemsState?.status === "pagination_error") {
      const label = itemsState.status === "pagination_error" ? "Não foi possível concluir a paginação dos itens." : "Os itens estão indisponíveis no PNCP neste momento.";
      return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">
        <div class="radar-detail-section-heading"><div><h2 id="radarItemsTitle">Itens da contratação</h2><p>${escapeHtml(label)}</p></div></div>
        ${itemsState.items?.length ? renderItemTable(itemsState.items) : ""}
        <button class="quiet-action compact-action" type="button" data-radar-details-refresh>Atualizar itens</button>
      </section>`;
    }
    if (!itemsState || itemsState.status === "not_published" || !itemsState.items?.length) {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">
        <div class="radar-detail-section-heading"><div><h2 id="radarItemsTitle">Itens da contratação</h2><p>O PNCP não publicou itens para esta contratação.</p></div></div>
      </section>`;
    }
    if (itemsState.status !== "available" || itemsState.complete !== true) {
      const label = itemsState.status === "pagination_error"
        ? "A paginação não foi concluída; atualize os itens antes de importar."
        : "A importação ficará disponível quando o PNCP retornar todos os itens.";
      return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">
        <div class="radar-detail-section-heading"><div><h2 id="radarItemsTitle">Itens da contratação</h2><p>${escapeHtml(label)}</p></div></div>
        ${itemsState.items?.length ? renderItemTable(itemsState.items, { selectable: false }) : ""}
      </section>`;
    }
    const secretCount = itemsState.items.filter((item) => item.budgetSecret).length;
    const page = paginateRadarItems(itemsState.items, state.itemsPage, itemsPerPage);
    state.itemsPage = page.page;
    return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">
      <div class="radar-detail-section-heading"><div><h2 id="radarItemsTitle">Itens da contratação</h2><p>${itemsState.items.length.toLocaleString("pt-BR")} itens consultados em ${Number(itemsState.pagesLoaded || 1).toLocaleString("pt-BR")} ${itemsState.pagesLoaded === 1 ? "página" : "páginas"} do PNCP.</p></div></div>
      ${secretCount ? `<p class="radar-feedback" data-tone="warning" role="status"><strong>Orçamento sigiloso</strong><span>O PNCP informou orçamento sigiloso em ${secretCount.toLocaleString("pt-BR")} ${secretCount === 1 ? "item" : "itens"}; valores não serão tratados como preço.</span></p>` : ""}
      ${renderItemTable(page.items, { selectable: true })}
      ${renderItemPagination(page.pageCount)}
    </section>`;
  }

  function renderImportPanel(itemsState) {
    const available = itemsState?.status === "available" && itemsState.complete === true && itemsState.items?.length;
    const body = available
      ? renderImportControls(itemsState.items)
      : `<p>${itemsState?.status === "not_published" || !itemsState?.items?.length
        ? "O PNCP não publicou itens disponíveis para importação nesta contratação."
        : "A importação ficará disponível quando o PNCP retornar todos os itens da contratação."}</p>`;
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
    if (documentsState?.status === "unavailable") {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarDocumentsTitle">
        <div class="radar-detail-section-heading"><div><h2 id="radarDocumentsTitle">Documentos do edital</h2><p>Os documentos estão indisponíveis no PNCP neste momento.</p></div></div>
        <button class="quiet-action compact-action" type="button" data-radar-details-refresh>Atualizar documentos</button>
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
        ? '<div class="radar-loading" role="status"><span class="radar-spinner" aria-hidden="true"></span><span>Carregando detalhes, itens e documentos do PNCP…</span></div>'
        : "";
      return;
    }
    const loadedAt = dateTimeFormatter.format(new Date(state.data.retrievedAt));
    content.innerHTML = `<p class="radar-detail-source">Fonte: <a href="${escapeHtml(state.data.sources.detail)}" target="_blank" rel="noopener noreferrer">API oficial do PNCP</a> · Consulta realizada em ${escapeHtml(loadedAt)}.</p>
      <div class="radar-detail-layout">
        <main class="radar-detail-main">${renderGeneral(state.data.contract, state.data.sources, state.data.platform)}${renderItems(state.data.items)}</main>
        <aside class="radar-detail-aside">${renderDocuments(state.data.documents)}${renderImportPanel(state.data.items)}</aside>
      </div>`;
  }

  async function refresh() {
    const id = currentId();
    if (!identityIsValid(id)) {
      state.error = "O identificador PNCP desta licitação é inválido.";
      state.loading = false;
      render();
      return;
    }
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
        throw new Error(responseBody?.error || "Não foi possível consultar os detalhes no PNCP.");
      }
      if (!data || data.status !== "available" || !data.contract || !data.items || !data.documents) {
        if (data?.status === "not_found") {
          state.notFound = true;
          state.data = null;
          return;
        }
        throw new Error("O PNCP retornou uma resposta incompatível com o contrato de detalhes.");
      }
      state.data = data;
      state.error = "";
      state.notFound = false;
      if (imports) {
        try {
          state.importStatus = await imports.loadImportStatus(id);
          state.importStatusError = "";
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
    if (!imports || !state.data?.items?.complete || state.data.items.status !== "available") {
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
    state.opened = false;
    state.loading = false;
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
    state.requestId += 1;
    state.current = null;
    state.data = null;
    state.opened = false;
    state.loading = false;
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
      if (event.target.closest("#radarDetailsBackButton")) {
        closeView();
      } else if (event.target.closest("#radarDetailsRefreshButton") || event.target.closest("[data-radar-details-refresh]")) {
        void refresh();
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
    reset,
  });
}

if (typeof window !== "undefined") {
  window.GLLRadarDetails = Object.freeze({ createRadarDetailsFeature });
}
