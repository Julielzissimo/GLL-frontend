const PROCUREMENT_FIELDS = [
  "numero_controle_pncp",
  "numero_compra",
  "ano_compra",
  "sequencial_compra",
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
  "sincronizado_em",
  "link_sistema_origem",
  "link_sistema_origem_manual",
  "link_sistema_origem_manual_confirmado_por",
  "link_sistema_origem_manual_confirmado_em",
  "link_processo_eletronico",
  "plataforma_id",
  "plataforma_status",
  "plataforma_metodo_classificacao",
  "plataforma_classificada_em",
  "plataforma_catalogo_versao",
  "plataforma_confianca",
  "plataforma_fonte_evidencia",
  "plataforma_evidencia",
  "plataforma_conflito",
  "plataforma_confirmada_por",
  "plataforma_confirmada_em",
  "plataforma_confirmacao_origem",
].join(", ");

const SYNC_FIELDS = [
  "status",
  "disponibilidade_origem",
  "ultima_tentativa_em",
  "ultima_sincronizacao_completa_em",
  "proxima_atualizacao_permitida_em",
  "quantidade_itens",
  "quantidade_itens_esperada",
  "paginas_processadas",
  "paginas_totais",
  "pagina_checkpoint",
  "codigo_erro",
  "versao_sincronizacao",
  "tarefa_id",
].join(", ");

const ITEM_FIELDS = [
  "numero_item",
  "descricao",
  "quantidade",
  "unidade_medida",
  "valor_unitario_estimado",
  "valor_total",
  "situacao_codigo",
  "situacao_nome",
  "criterio_julgamento",
  "informacao_complementar",
  "orcamento_sigiloso",
  "dados_origem",
].join(", ");

const DEFAULT_ITEM_PAGE_SIZE = 1000;
const DEFAULT_MAX_ITEMS = 20_000;

function controlIdParts(value) {
  const match = /^(\d{14})-\d-(\d{6})\/(\d{4})$/u.exec(String(value || ""));
  if (!match) return null;
  return { cnpj: match[1], sequencial: Number(match[2]), year: Number(match[3]) };
}

export function mapRadarPreprocessedItem(row) {
  return {
    number: Number(row?.numero_item),
    description: row?.descricao ?? "",
    quantity: row?.quantidade ?? null,
    unit: row?.unidade_medida ?? "",
    unitEstimatedValue: row?.valor_unitario_estimado ?? null,
    totalValue: row?.valor_total ?? null,
    situationCode: row?.situacao_codigo ?? null,
    situationName: row?.situacao_nome ?? "",
    judgmentCriterion: row?.criterio_julgamento ?? "",
    additionalInformation: row?.informacao_complementar ?? "",
    budgetSecret: row?.orcamento_sigiloso === true,
    source: row?.dados_origem && typeof row.dados_origem === "object" ? row.dados_origem : {},
  };
}

export function mapRadarPreprocessedSync(row) {
  if (!row) {
    return {
      status: "not_started",
      complete: false,
      retrievedAt: null,
      lastAttemptAt: null,
      pagesLoaded: 0,
      totalItems: null,
      errorCode: null,
      refreshQueued: false,
      sourceAvailability: "unknown",
      pageCheckpoint: 0,
      pagesProcessed: 0,
      pagesTotal: null,
      expectedItemCount: null,
      publishedItemCount: 0,
      taskId: null,
      retryAt: null,
      completeSnapshotAvailable: false,
      publishedVersion: null,
    };
  }

  const publishedVersion = typeof row.versao_sincronizacao === "string" ? row.versao_sincronizacao : null;
  const publishedCount = Number(row.quantidade_itens ?? 0);
  const sourceAvailability = row.disponibilidade_origem ?? "unknown";
  const complete = Boolean(publishedVersion) || sourceAvailability === "no_items_confirmed";
  return {
    status: row.status ?? "pending",
    complete,
    retrievedAt: row.ultima_sincronizacao_completa_em ?? null,
    lastAttemptAt: row.ultima_tentativa_em ?? null,
    pagesLoaded: Number(row.paginas_processadas ?? row.pagina_checkpoint ?? 0),
    totalItems: sourceAvailability === "no_items_confirmed"
      ? 0
      : publishedVersion
        ? publishedCount
        : row.quantidade_itens_esperada ?? null,
    errorCode: row.codigo_erro ?? null,
    refreshQueued: false,
    sourceAvailability,
    pageCheckpoint: Number(row.pagina_checkpoint ?? 0),
    pagesProcessed: Number(row.paginas_processadas ?? 0),
    pagesTotal: row.paginas_totais ?? null,
    expectedItemCount: row.quantidade_itens_esperada ?? null,
    publishedItemCount: publishedCount,
    taskId: row.tarefa_id ?? null,
    retryAt: row.proxima_atualizacao_permitida_em ?? null,
    completeSnapshotAvailable: Boolean(publishedVersion),
    publishedVersion,
  };
}

export function mapRadarPreprocessedContract(row, {
  modalityName = null,
  municipalityName = null,
  platformName = null,
} = {}) {
  const sourceUrl = row.link_sistema_origem ?? null;
  const contract = {
    numeroControlePNCP: row.numero_controle_pncp,
    numeroCompra: row.numero_compra ?? null,
    anoCompra: row.ano_compra ?? null,
    sequencialCompra: row.sequencial_compra ?? null,
    orgaoEntidade: {
      cnpj: row.cnpj_orgao ?? null,
      razaoSocial: row.nome_orgao ?? null,
      nomeRazaoSocial: row.nome_orgao ?? null,
    },
    unidadeOrgao: {
      codigoUnidade: row.codigo_unidade_administrativa ?? null,
      nomeUnidade: row.nome_unidade_administrativa ?? null,
      ufSigla: row.uf ?? null,
      codigoIbge: row.municipio_ibge_id === null || row.municipio_ibge_id === undefined
        ? null
        : String(row.municipio_ibge_id),
      municipioNome: municipalityName,
    },
    nomeOrgao: row.nome_orgao ?? null,
    nomeUnidadeAdministrativa: row.nome_unidade_administrativa ?? null,
    codigoModalidadeContratacao: row.modalidade_pncp_id ?? null,
    modalidadeId: row.modalidade_pncp_id ?? null,
    modalidadeNome: modalityName,
    objetoCompra: row.objeto_compra ?? null,
    valorTotalEstimado: row.valor_estimado ?? null,
    dataPublicacaoPncp: row.data_publicacao ?? null,
    dataAberturaProposta: row.data_inicio_propostas ?? null,
    dataEncerramentoProposta: row.data_fim_propostas ?? null,
    situacaoCompraId: row.situacao_codigo ?? null,
    situacaoCompraNome: row.situacao_nome ?? null,
    dataAtualizacaoGlobal: row.data_atualizacao_fonte ?? null,
    dataAtualizacao: row.data_atualizacao_fonte ?? null,
    linkSistemaOrigem: sourceUrl,
    linkProcessoEletronico: row.link_processo_eletronico ?? null,
  };
  const idParts = controlIdParts(row.numero_controle_pncp);
  const platformIdentified = row.plataforma_status === "identified" && Boolean(row.plataforma_id);
  return {
    contract,
    retrievedAt: row.sincronizado_em ?? row.data_atualizacao_fonte ?? null,
    dataUpdatedAt: row.data_atualizacao_fonte ?? row.sincronizado_em ?? null,
    sources: {
      official: idParts
        ? `https://pncp.gov.br/app/editais/${idParts.cnpj}/${idParts.year}/${idParts.sequencial}`
        : null,
    },
    platform: {
      id: row.plataforma_id ?? null,
      name: platformIdentified ? platformName : null,
      status: platformIdentified ? "identified" : "unidentified",
      sourceUrl: row.link_sistema_origem_manual || sourceUrl,
      sourceUrlFromPncp: sourceUrl,
      sourceUrlManuallyConfirmed: Boolean(row.link_sistema_origem_manual),
      sourceUrlConfirmedBy: row.link_sistema_origem_manual_confirmado_por ?? null,
      sourceUrlConfirmedAt: row.link_sistema_origem_manual_confirmado_em ?? null,
      processUrl: row.link_processo_eletronico ?? null,
      method: row.plataforma_metodo_classificacao ?? null,
      confidence: row.plataforma_confianca ?? null,
      evidenceSource: row.plataforma_fonte_evidencia ?? null,
      evidence: Array.isArray(row.plataforma_evidencia) ? row.plataforma_evidencia : [],
      conflict: row.plataforma_conflito === true,
      catalogVersion: row.plataforma_catalogo_versao ?? null,
      confirmedBy: row.plataforma_confirmada_por ?? null,
      confirmedAt: row.plataforma_confirmada_em ?? null,
      confirmationOrigin: row.plataforma_confirmacao_origem ?? null,
    },
  };
}

function itemStateFor(sync, items) {
  if (sync.publishedVersion) return { status: "available", items, pagesLoaded: null, complete: true, errorCode: null };
  if (sync.sourceAvailability === "no_items_confirmed") {
    return { status: "available", items: [], pagesLoaded: null, complete: true, errorCode: null };
  }
  if (sync.sourceAvailability === "not_published") {
    return { status: "not_published", items: [], pagesLoaded: 0, complete: false, errorCode: null };
  }
  if (sync.status === "failed") {
    return { status: "unavailable", items: [], pagesLoaded: sync.pageCheckpoint, complete: false, errorCode: sync.errorCode };
  }
  return { status: "pending", items: [], pagesLoaded: sync.pageCheckpoint, complete: false, errorCode: sync.errorCode };
}

export function createRadarPreprocessedService({
  getClient,
  pageSize = DEFAULT_ITEM_PAGE_SIZE,
  maxItems = DEFAULT_MAX_ITEMS,
} = {}) {
  function client() {
    const value = getClient?.();
    if (!value) throw new Error("O Radar exige uma sessão autenticada no Supabase.");
    return value;
  }

  async function loadProcurement(numberControlPncp) {
    const { data, error } = await client().from("radar_licitacoes")
      .select(PROCUREMENT_FIELDS)
      .eq("numero_controle_pncp", numberControlPncp)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar o edital armazenado no Radar.");
    return data || null;
  }

  async function loadSync(numberControlPncp) {
    const { data, error } = await client().from("radar_itens_sync")
      .select(SYNC_FIELDS)
      .eq("numero_controle_pncp", numberControlPncp)
      .maybeSingle();
    if (error) throw new Error("Não foi possível consultar o estado dos itens no Radar.");
    return data || null;
  }

  async function loadItemRows(numberControlPncp, version) {
    const size = Math.max(1, Math.min(1000, Math.floor(Number(pageSize) || DEFAULT_ITEM_PAGE_SIZE)));
    const max = Math.max(size, Math.floor(Number(maxItems) || DEFAULT_MAX_ITEMS));
    const rows = [];
    let offset = 0;
    let total = null;
    do {
      const { data, error, count } = await client().from("radar_itens")
        .select(ITEM_FIELDS, { count: "exact" })
        .eq("numero_controle_pncp", numberControlPncp)
        .eq("versao_sincronizacao", version)
        .order("numero_item", { ascending: true })
        .range(offset, offset + size - 1);
      if (error) throw new Error("Não foi possível carregar os itens publicados no cache do Radar.");
      const batch = Array.isArray(data) ? data : [];
      if (Number.isSafeInteger(count)) total = count;
      rows.push(...batch);
      if (rows.length > max || (total !== null && total > max)) {
        throw new Error("A contratação excede o limite de itens que o Radar pode exibir de uma vez.");
      }
      if (total !== null && rows.length >= total) break;
      if (batch.length < size) {
        if (total !== null && rows.length < total) {
          throw new Error("A leitura paginada dos itens do Radar retornou uma página incompleta.");
        }
        break;
      }
      offset += batch.length;
      if (offset >= max && total === null) {
        throw new Error("A contratação excede o limite de itens que o Radar pode exibir de uma vez.");
      }
    } while (true);
    return rows.map(mapRadarPreprocessedItem);
  }

  async function loadCatalogValue(table, key, value, columns, resultColumn) {
    if (value === null || value === undefined || value === "") return null;
    const { data, error } = await client().from(table).select(columns).eq(key, value).maybeSingle();
    if (error) return null;
    return typeof data?.[resultColumn] === "string" ? data[resultColumn] : null;
  }

  async function load(numberControlPncp, { knownVersion = null } = {}) {
    const row = await loadProcurement(numberControlPncp);
    if (!row) return { status: "not_found" };

    const [syncRow, modalityName, municipalityName, platformName] = await Promise.all([
      loadSync(numberControlPncp),
      loadCatalogValue("radar_catalog_modalities", "pncp_id", row.modalidade_pncp_id, "name", "name"),
      loadCatalogValue("radar_catalog_municipalities", "ibge_id", row.municipio_ibge_id, "name", "name"),
      loadCatalogValue("radar_plataformas", "id", row.plataforma_id, "nome", "nome"),
    ]);
    const itemSync = mapRadarPreprocessedSync(syncRow);
    const version = itemSync.publishedVersion;
    const items = version && version !== knownVersion
      ? await loadItemRows(numberControlPncp, version)
      : version
        ? null
        : [];
    if (version && Array.isArray(items) && items.length !== itemSync.publishedItemCount) {
      throw new Error("A quantidade de itens publicada não corresponde ao cache visível para esta sessão.");
    }
    const mapped = mapRadarPreprocessedContract(row, { modalityName, municipalityName, platformName });
    const result = {
      status: "available",
      ...mapped,
      itemSync,
      version,
      items: items === null ? null : itemStateFor(itemSync, items),
    };
    return result;
  }

  async function loadItemSyncSnapshot(numberControlPncp, { knownVersion = null } = {}) {
    const itemSync = mapRadarPreprocessedSync(await loadSync(numberControlPncp));
    const version = itemSync.publishedVersion;
    const items = version && version !== knownVersion
      ? await loadItemRows(numberControlPncp, version)
      : version
        ? null
        : [];
    if (version && Array.isArray(items) && items.length !== itemSync.publishedItemCount) {
      throw new Error("A quantidade de itens publicada não corresponde ao cache visível para esta sessão.");
    }
    return {
      status: "available",
      itemSync,
      version,
      items: items === null ? null : itemStateFor(itemSync, items),
    };
  }

  return Object.freeze({ load, loadItemSyncSnapshot });
}
