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

function proposalStatus(startValue, endValue) {
  const start = startValue ? new Date(startValue).getTime() : NaN;
  const end = endValue ? new Date(endValue).getTime() : NaN;
  const now = Date.now();
  if (!Number.isFinite(end)) return "unknown";
  if (Number.isFinite(start) && now < start) return "upcoming";
  return now <= end ? "open" : "closed";
}

export function mapRadarFavoriteMetadata(row) {
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
    ids.forEach((id) => favoriteIds.add(id));
    const results = ids.map((id) => byId.get(id)
      ? mapRadarFavoriteMetadata(byId.get(id))
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

export function createRadarDetailsFeature({ getClient, toast = () => {}, onFavoriteChanged = () => {} } = {}) {
  const root = globalThis.document?.getElementById("radarSearchPage");
  const favorites = createRadarFavoritesService({ getClient });
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

  function renderGeneral(contract, sources) {
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
    return `<section class="section-band radar-detail-section" aria-labelledby="radarGeneralTitle">
      <div class="radar-detail-section-heading"><div><h2 id="radarGeneralTitle">Informações gerais</h2><p>Dados consultados diretamente no PNCP.</p></div></div>
      <dl class="radar-detail-grid">${values.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd${label === "Objeto da contratação" ? ' class="radar-detail-object"' : ""}>${escapeHtml(value || "Não informado")}</dd></div>`).join("")}</dl>
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
    const secretCount = itemsState.items.filter((item) => item.budgetSecret).length;
    return `<section class="section-band radar-detail-section" aria-labelledby="radarItemsTitle">
      <div class="radar-detail-section-heading"><div><h2 id="radarItemsTitle">Itens da contratação</h2><p>${itemsState.items.length.toLocaleString("pt-BR")} itens consultados em ${Number(itemsState.pagesLoaded || 1).toLocaleString("pt-BR")} ${itemsState.pagesLoaded === 1 ? "página" : "páginas"} do PNCP.</p></div></div>
      ${secretCount ? `<p class="radar-feedback" data-tone="warning" role="status"><strong>Orçamento sigiloso</strong><span>O PNCP informou orçamento sigiloso em ${secretCount.toLocaleString("pt-BR")} ${secretCount === 1 ? "item" : "itens"}; valores não serão tratados como preço.</span></p>` : ""}
      ${renderItemTable(itemsState.items)}
    </section>`;
  }

  function renderItemTable(items) {
    return `<div class="table-wrap radar-detail-items-wrap" role="region" tabindex="0" aria-label="Itens da contratação; use a rolagem horizontal para ver todas as colunas."><table class="radar-results-table radar-items-table">
      <caption class="sr-only">Itens da contratação retornados pelo PNCP</caption>
      <thead><tr><th scope="col">Item</th><th scope="col">Descrição</th><th scope="col" class="numeric">Quantidade</th><th scope="col">Unidade</th><th scope="col" class="numeric">Valor unitário estimado</th><th scope="col" class="numeric">Valor total</th><th scope="col">Situação</th><th scope="col">Critério de julgamento</th><th scope="col">Informação complementar</th></tr></thead>
      <tbody>${items.map((item) => `<tr>
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

  function renderDocuments(documentsState) {
    if (documentsState?.status === "unavailable") {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarDocumentsTitle">
        <div class="radar-detail-section-heading"><div><h2 id="radarDocumentsTitle">Documentos oficiais</h2><p>Os documentos estão indisponíveis no PNCP neste momento.</p></div></div>
        <button class="quiet-action compact-action" type="button" data-radar-details-refresh>Atualizar documentos</button>
      </section>`;
    }
    if (!documentsState || documentsState.status === "not_published" || !documentsState.documents?.length) {
      return `<section class="section-band radar-detail-section" aria-labelledby="radarDocumentsTitle">
        <div class="radar-detail-section-heading"><div><h2 id="radarDocumentsTitle">Documentos oficiais</h2><p>Nenhum documento foi publicado para esta contratação.</p></div></div>
      </section>`;
    }
    return `<section class="section-band radar-detail-section" aria-labelledby="radarDocumentsTitle">
      <div class="radar-detail-section-heading"><div><h2 id="radarDocumentsTitle">Documentos oficiais</h2><p>Os arquivos permanecem no PNCP e não são baixados nem armazenados pelo GLL.</p></div></div>
      <ul class="radar-document-list">${documentsState.documents.map((document) => {
        const officialUrl = validatedOfficialPncpUrl(document.url);
        return `<li><div><strong>${escapeHtml(document.title || "Documento sem título")}</strong><span>${escapeHtml(document.type || "Tipo não informado")}</span>${document.publishedAt ? `<small>Publicado em ${escapeHtml(dateValue(document.publishedAt, dateFormatter))}</small>` : ""}</div>${officialUrl ? `<a class="quiet-action compact-action" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">Acessar documento <span aria-hidden="true">↗</span></a>` : `<span class="radar-document-url">${escapeHtml(document.url || "URL não informada")}</span>`}</li>`;
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
      ${renderGeneral(state.data.contract, state.data.sources)}
      ${renderItems(state.data.items)}
      ${renderDocuments(state.data.documents)}`;
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
    state.current = typeof result === "string" ? id : result;
    state.data = null;
    state.error = "";
    state.notFound = false;
    state.favoriteError = false;
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
      }
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
