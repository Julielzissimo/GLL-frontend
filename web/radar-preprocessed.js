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
    dataInicioFaseLances: row.data_inicio_fase_lances ?? null,
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
} = {}) {
  function client() {
    const value = getClient?.();
    if (!value?.functions?.invoke) throw new Error("O Radar exige uma sessão autenticada no Supabase.");
    return value;
  }

  async function loadSnapshot(numberControlPncp, knownVersion = null) {
    const { data, error } = await client().functions.invoke("radar-details", {
      body: { action: "preprocessed", numberControlPncp, knownVersion },
    });
    if (error) throw new Error("Não foi possível carregar os dados armazenados no Radar.");
    return data;
  }

  async function load(numberControlPncp, { knownVersion = null } = {}) {
    const snapshot = await loadSnapshot(numberControlPncp, knownVersion);
    if (snapshot?.status === "not_found") return { status: "not_found" };
    if (snapshot?.status !== "available" || !snapshot.procurement) {
      throw new Error("Não foi possível carregar o edital armazenado no Radar.");
    }
    const row = snapshot.procurement;
    const syncRow = snapshot.sync || null;
    const itemSync = mapRadarPreprocessedSync(syncRow);
    const version = itemSync.publishedVersion;
    const items = Array.isArray(snapshot.items)
      ? snapshot.items.map(mapRadarPreprocessedItem)
      : version ? null : [];
    if (version && Array.isArray(items) && items.length !== itemSync.publishedItemCount) {
      throw new Error("A quantidade de itens publicada não corresponde ao cache visível para esta sessão.");
    }
    const mapped = mapRadarPreprocessedContract(row, {
      modalityName: snapshot.modalityName,
      municipalityName: snapshot.municipalityName,
      platformName: snapshot.platformName,
    });
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
    const snapshot = await loadSnapshot(numberControlPncp, knownVersion);
    if (snapshot?.status === "not_found") return { status: "not_found" };
    if (snapshot?.status !== "available") throw new Error("Não foi possível consultar o estado dos itens no Radar.");
    const itemSync = mapRadarPreprocessedSync(snapshot.sync || null);
    const version = itemSync.publishedVersion;
    const items = Array.isArray(snapshot.items) ? snapshot.items.map(mapRadarPreprocessedItem) : version ? null : [];
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
