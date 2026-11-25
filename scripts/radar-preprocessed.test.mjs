import assert from "node:assert/strict";
import test from "node:test";
import {
  createRadarPreprocessedService,
  mapRadarPreprocessedContract,
  mapRadarPreprocessedItem,
} from "../web/radar-preprocessed.js";
import { radarItemSyncPresentation, shouldPollRadarItemSync } from "../web/radar-item-sync.js";

const procurementId = "88768080000170-1-000478/2026";
const publishedVersion = "00000000-0000-4000-8000-000000000001";
const platformId = "10000000-0000-4000-8000-000000000001";

function createSupabaseMock({ procurement = null, sync = null, items = [] } = {}) {
  const calls = [];
  const client = {
    functions: {
      async invoke(name, { body }) {
        calls.push({ name, body });
        return {
          data: procurement ? {
            status: "available",
            procurement,
            sync,
            modalityName: "Pregão eletrônico",
            municipalityName: "São Gabriel",
            platformName: "Licitanet",
            items: sync?.versao_sincronizacao && body.knownVersion === sync.versao_sincronizacao
              ? null
              : sync?.versao_sincronizacao ? items : [],
          } : { status: "not_found" },
          error: null,
        };
      },
    },
  };
  return { client, calls };
}

function sampleProcurement(overrides = {}) {
  return {
    numero_controle_pncp: procurementId,
    numero_compra: "61/2026",
    ano_compra: 2026,
    sequencial_compra: 478,
    cnpj_orgao: "88768080000170",
    nome_orgao: "Município de São Gabriel",
    codigo_unidade_administrativa: "1",
    nome_unidade_administrativa: "Prefeitura Municipal",
    objeto_compra: "Aquisição de veículo",
    modalidade_pncp_id: 6,
    uf: "RS",
    municipio_ibge_id: 4318309,
    valor_estimado: 151956.67,
    data_publicacao: "2026-09-04T12:04:06Z",
    data_inicio_propostas: "2026-09-04T13:00:00Z",
    data_fim_propostas: "2026-09-28T08:00:00Z",
    situacao_codigo: "1",
    situacao_nome: "Divulgada no PNCP",
    data_atualizacao_fonte: "2026-10-08T11:40:14Z",
    sincronizado_em: "2026-10-11T12:00:00Z",
    link_sistema_origem: "https://licitacao.example/processo",
    link_sistema_origem_manual: null,
    plataforma_id: platformId,
    plataforma_status: "identified",
    plataforma_metodo_classificacao: "source_domain",
    plataforma_classificada_em: "2026-10-10T12:00:00Z",
    plataforma_catalogo_versao: "catalog-v1",
    plataforma_confianca: "high",
    plataforma_fonte_evidencia: "linkSistemaOrigem",
    plataforma_evidencia: [{ source: "linkSistemaOrigem", value_excerpt: "licitacao.example" }],
    plataforma_conflito: false,
    plataforma_confirmada_por: null,
    plataforma_confirmada_em: null,
    plataforma_confirmacao_origem: null,
    ...overrides,
  };
}

function sampleSync(overrides = {}) {
  return {
    numero_controle_pncp: procurementId,
    status: "complete",
    disponibilidade_origem: "items_available",
    ultima_tentativa_em: "2026-10-11T12:00:00Z",
    ultima_sincronizacao_completa_em: "2026-10-11T12:00:00Z",
    proxima_atualizacao_permitida_em: "2026-10-12T12:00:00Z",
    quantidade_itens: 2,
    quantidade_itens_esperada: 2,
    paginas_processadas: 2,
    paginas_totais: 2,
    pagina_checkpoint: 2,
    codigo_erro: null,
    versao_sincronizacao: publishedVersion,
    tarefa_id: "task-1",
    ...overrides,
  };
}

function sampleItems() {
  return [
    {
      numero_controle_pncp: procurementId,
      versao_sincronizacao: publishedVersion,
      numero_item: 1,
      descricao: "Veículo utilitário",
      quantidade: 1,
      unidade_medida: "Unidade",
      valor_unitario_estimado: 151956.67,
      valor_total: 151956.67,
      situacao_codigo: "1",
      situacao_nome: "Em andamento",
      criterio_julgamento: "Menor preço",
      informacao_complementar: "Entrega em até 10 dias",
      orcamento_sigiloso: false,
      dados_origem: { pagina: 1 },
    },
    {
      numero_controle_pncp: procurementId,
      versao_sincronizacao: publishedVersion,
      numero_item: 2,
      descricao: "Revisão inicial",
      quantidade: 1,
      unidade_medida: "Serviço",
      valor_unitario_estimado: 0,
      valor_total: 0,
      situacao_codigo: "1",
      situacao_nome: "Em andamento",
      criterio_julgamento: "Menor preço",
      informacao_complementar: "",
      orcamento_sigiloso: true,
      dados_origem: { pagina: 2 },
    },
  ];
}

test("carrega edital, plataforma e itens publicados pelo Edge Function do Neon", async () => {
  const mock = createSupabaseMock({
    procurement: sampleProcurement(),
    sync: sampleSync(),
    items: sampleItems(),
  });
  const service = createRadarPreprocessedService({ getClient: () => mock.client, pageSize: 1, maxItems: 10 });

  const result = await service.load(procurementId);

  assert.equal(result.status, "available");
  assert.equal(result.contract.modalidadeNome, "Pregão eletrônico");
  assert.equal(result.contract.unidadeOrgao.municipioNome, "São Gabriel");
  assert.equal(result.platform.name, "Licitanet");
  assert.equal(result.platform.status, "identified");
  assert.equal(result.retrievedAt, "2026-10-11T12:00:00Z");
  assert.equal(result.sources.official, "https://pncp.gov.br/app/editais/88768080000170/2026/478");
  assert.equal(result.items.status, "available");
  assert.deepEqual(result.items.items.map((item) => item.number), [1, 2]);
  assert.equal(result.items.items[1].budgetSecret, true);
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].name, "radar-details");
  assert.equal(mock.calls[0].body.action, "preprocessed");
  assert.equal(mock.calls[0].body.numberControlPncp, procurementId);
});

test("não expõe linhas parciais sem versão publicada e informa o progresso", async () => {
  const mock = createSupabaseMock({
    procurement: sampleProcurement(),
    sync: sampleSync({
      status: "partial",
      versao_sincronizacao: null,
      quantidade_itens: 0,
      quantidade_itens_esperada: 5,
      paginas_processadas: 2,
      paginas_totais: 4,
      pagina_checkpoint: 2,
    }),
    items: sampleItems(),
  });
  const service = createRadarPreprocessedService({ getClient: () => mock.client });
  const result = await service.load(procurementId);

  assert.equal(result.items.status, "pending");
  assert.deepEqual(result.items.items, []);
  assert.equal(result.itemSync.status, "partial");
  assert.equal(result.itemSync.expectedItemCount, 5);
  assert.equal(result.itemSync.pagesProcessed, 2);
  assert.equal(mock.calls.some((call) => call.body.action !== "preprocessed"), false);
  const presentation = radarItemSyncPresentation(result.items, result.itemSync);
  assert.equal(presentation.kind, "running");
  assert.match(presentation.message, /parcial/u);
  assert.equal(shouldPollRadarItemSync(result.items, result.itemSync), true);
});

test("cache sem estado de sincronização não inicia polling automático", async () => {
  const mock = createSupabaseMock({ procurement: sampleProcurement() });
  const service = createRadarPreprocessedService({ getClient: () => mock.client });
  const result = await service.load(procurementId);

  assert.equal(result.itemSync.status, "not_started");
  assert.equal(result.items.status, "pending");
  assert.equal(radarItemSyncPresentation(result.items, result.itemSync).kind, "not-cached");
  assert.equal(shouldPollRadarItemSync(result.items, result.itemSync), false);
});

test("uma versão já carregada atualiza apenas o estado e não repete a paginação", async () => {
  const mock = createSupabaseMock({ procurement: sampleProcurement(), sync: sampleSync(), items: sampleItems() });
  const service = createRadarPreprocessedService({ getClient: () => mock.client });

  const result = await service.loadItemSyncSnapshot(procurementId, { knownVersion: publishedVersion });

  assert.equal(result.version, publishedVersion);
  assert.equal(result.items, null);
  assert.equal(mock.calls.some((call) => call.body.action !== "preprocessed"), false);
  assert.equal(mock.calls.length, 1);
});

test("sinaliza incompatibilidade entre o contador publicado e os itens lidos no Neon", async () => {
  const mock = createSupabaseMock({ procurement: sampleProcurement(), sync: sampleSync(), items: sampleItems().slice(0, 1) });
  const service = createRadarPreprocessedService({ getClient: () => mock.client });

  await assert.rejects(service.load(procurementId), /não corresponde ao cache visível/u);
});

test("mapeia plataforma sem confirmação e mantém orçamento sigiloso dos itens", () => {
  const sessionStart = "2026-10-08T11:00:00Z";
  const mapped = mapRadarPreprocessedContract(sampleProcurement({
    plataforma_id: null,
    plataforma_status: "pending_verification",
    data_inicio_fase_lances: sessionStart,
  }));
  assert.equal(mapped.platform.status, "unidentified");
  assert.equal(mapped.platform.name, null);
  assert.equal(mapped.contract.dataInicioFaseLances, sessionStart);
  const item = mapRadarPreprocessedItem(sampleItems()[1]);
  assert.equal(item.budgetSecret, true);
  assert.equal(item.totalValue, 0);
});

test("retorna não encontrado pelo Edge Function sem consultar itens", async () => {
  const mock = createSupabaseMock();
  const service = createRadarPreprocessedService({ getClient: () => mock.client });

  assert.deepEqual(await service.load(procurementId), { status: "not_found" });
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].name, "radar-details");
});
