import assert from "node:assert/strict";
import test from "node:test";
import {
  createRadarFavoritesService,
  formatRadarContractEstimatedValue,
  formatRadarItemMoney,
  mapRadarFavoriteMetadata,
  radarContractBudgetIsSecret,
  radarItemSyncMessage,
  radarItemsPendingMessage,
  renderRadarPlatformEvidence,
  validatedOfficialPncpUrl,
  validatedPlatformSourceUrl,
} from "../web/radar-details.js";

const procurementId = "88768080000170-1-000478/2026";

test("distingue sincronização pendente de edital sem itens publicados", () => {
  assert.match(radarItemsPendingMessage({ status: "pending" }), /sincronização dos itens foi solicitada/u);
  assert.match(radarItemsPendingMessage({ status: "processing" }), /em andamento/u);
  assert.doesNotMatch(radarItemsPendingMessage({ status: "pending" }), /não há itens publicados/u);
});

test("informa que a versão completa do cache continua disponível durante falha ou atualização", () => {
  assert.match(radarItemSyncMessage({ status: "processing" }, true), /última versão completa/u);
  assert.match(radarItemSyncMessage({ status: "failed" }, true), /falhou/u);
  assert.equal(radarItemSyncMessage({ status: "processing" }, false), "");
});

function createSupabaseMock({ initialFavorites = {}, userId = "user-a", metadata = [] } = {}) {
  const favorites = new Map(Object.entries(initialFavorites).map(([owner, ids]) => [owner, new Set(ids)]));
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from(table) {
      const query = {
        table,
        action: "select",
        identifiers: null,
        ownerFilter: null,
        rangeValue: null,
        select() { return this; },
        in(_column, identifiers) { this.identifiers = identifiers; return this; },
        order() { return this; },
        range(start, end) { this.rangeValue = [start, end]; return this; },
        eq(column, value) { if (column === "user_id") this.ownerFilter = value; return this; },
        insert(record) { this.action = "insert"; this.record = record; return this; },
        delete() { this.action = "delete"; return this; },
        then(resolve, reject) {
          calls.push({ table: this.table, action: this.action, record: this.record, ownerFilter: this.ownerFilter });
          const ownFavorites = favorites.get(userId) || new Set();
          let result = { data: [], error: null, count: 0 };
          if (this.table === "radar_favoritos" && this.action === "insert") {
            const { user_id: owner, numero_controle_pncp: id } = this.record;
            const owned = favorites.get(owner) || new Set();
            favorites.set(owner, owned);
            if (owned.has(id)) result = { data: null, error: { code: "23505" } };
            else { owned.add(id); result = { data: null, error: null }; }
          } else if (this.table === "radar_favoritos" && this.action === "delete") {
            if (this.ownerFilter === userId) ownFavorites.delete(this.identifiers || procurementId);
            result = { data: null, error: null };
          } else if (this.table === "radar_favoritos" && this.identifiers) {
            result = { data: [...ownFavorites].filter((id) => this.identifiers.includes(id)).map((id) => ({ numero_controle_pncp: id })), error: null };
          } else if (this.table === "radar_favoritos") {
            const ids = [...ownFavorites];
            const [start = 0, end = ids.length - 1] = this.rangeValue || [];
            const data = ids.slice(start, end + 1).map((id) => ({ numero_controle_pncp: id, criado_em: "2026-10-10T10:00:00Z" }));
            result = { data, count: ids.length, error: null };
          } else if (this.table === "radar_licitacoes") {
            result = { data: metadata.filter((row) => this.identifiers.includes(row.numero_controle_pncp)), error: null };
          }
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, calls, favorites };
}

test("oculta valores zero de contratação e item quando o PNCP marca orçamento sigiloso", () => {
  assert.equal(radarContractBudgetIsSecret({ orcamentoSigilosoCodigo: 3 }), true);
  assert.equal(radarContractBudgetIsSecret({ orcamentoSigilosoCodigo: 1 }), false);
  assert.equal(formatRadarContractEstimatedValue({ orcamentoSigilosoCodigo: 3, valorTotalEstimado: 0 }), "Orçamento sigiloso");
  assert.equal(formatRadarContractEstimatedValue({ orcamentoSigilosoCodigo: 1, valorTotalEstimado: 0 }), "R$ 0,00");
  assert.equal(formatRadarItemMoney(0, true), "Orçamento sigiloso");
  assert.equal(formatRadarItemMoney(0, false), "R$ 0,00");
});

test("valida link seguro da plataforma sem substituir o link oficial do PNCP", () => {
  assert.equal(validatedPlatformSourceUrl("https://portal.example/processo"), "https://portal.example/processo");
  assert.equal(validatedPlatformSourceUrl("http://portal.example/processo"), null);
  assert.equal(validatedPlatformSourceUrl("javascript:alert(1)"), null);
  assert.equal(validatedOfficialPncpUrl("https://pncp.gov.br/app/editais/123"), "https://pncp.gov.br/app/editais/123");
});

test("preserva metadados da licitação ao montar a visualização de favoritos", () => {
  const result = mapRadarFavoriteMetadata({
    numero_controle_pncp: procurementId,
    numero_compra: "61/2026",
    ano_compra: 2026,
    nome_orgao: "Município de São Gabriel",
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
  });
  assert.equal(result.numberControlPncp, procurementId);
  assert.equal(result.agencyName, "Município de São Gabriel");
  assert.equal(result.modalityId, 6);
  assert.equal(result.municipalityIbgeId, 4318309);
  assert.equal(result.estimatedValue, 151956.67);
  assert.equal(result.administrativeSituationName, "Divulgada no PNCP");
});

test("mapeia a identificação e a URL corrigida nos metadados dos favoritos", () => {
  const result = mapRadarFavoriteMetadata({
    numero_controle_pncp: procurementId,
    plataforma_id: "10000000-0000-4000-8000-000000000001",
    link_sistema_origem: "https://pncp.gov.br/origem",
    link_sistema_origem_manual: "https://licitacao.example/processo",
    plataforma_status: "identified",
    plataforma_confianca: "high",
    plataforma_metodo_classificacao: "manual_confirmed",
    plataforma_fonte_evidencia: "manual",
    plataforma_evidencia: [{ source: "manual", value_excerpt: "Conferido no edital" }],
    plataforma_conflito: false,
    plataforma_confirmada_em: "2026-10-11T12:00:00Z",
  }, new Map([["10000000-0000-4000-8000-000000000001", "Licitanet"]]));
  assert.equal(result.platformName, "Licitanet");
  assert.equal(result.platformSourceUrl, "https://licitacao.example/processo");
  assert.equal(result.platformSourceUrlFromPncp, "https://pncp.gov.br/origem");
  assert.equal(result.platformConfidence, "high");
  assert.equal(result.platformClassificationMethod, "manual_confirmed");
  assert.deepEqual(result.platformEvidence, [{ source: "manual", value_excerpt: "Conferido no edital" }]);
  assert.equal(result.platformConfirmedAt, "2026-10-11T12:00:00Z");
});

test("aceita links oficiais PNCP HTTPS e rejeita host parecido ou protocolo inseguro", () => {
  assert.equal(validatedOfficialPncpUrl("https://pncp.gov.br/pncp-api/arquivo/1"), "https://pncp.gov.br/pncp-api/arquivo/1");
  assert.equal(validatedOfficialPncpUrl("https://api.pncp.gov.br/arquivo/1"), "https://api.pncp.gov.br/arquivo/1");
  assert.equal(validatedOfficialPncpUrl("http://pncp.gov.br/arquivo/1"), null);
  assert.equal(validatedOfficialPncpUrl("https://pncp.gov.br.evil.example/arquivo/1"), null);
});

test("detalhes da evidência PDF mostram documento, versão, página, método e trecho escapado", () => {
  const html = renderRadarPlatformEvidence([{
    source: "editalPdf",
    platform_name: "Licitanet",
    document_title: "Edital <atual>",
    document_id: 42,
    document_type: "Edital",
    document_published_at: "2026-10-11T12:00:00Z",
    document_version_hash: "a".repeat(64),
    page_number: 3,
    method: "pdf_context",
    confidence: "high",
    processed_at: "2026-10-11T12:05:00Z",
    value_excerpt: "A sessão pública será realizada na plataforma <Licitanet>.",
  }]);
  assert.match(html, /Edital &lt;atual&gt;/);
  assert.match(html, /Documento 42/);
  assert.match(html, /página 3/);
  assert.match(html, /SHA-256 a{16}/);
  assert.match(html, /Instrução contextual do edital em PDF/);
  assert.match(html, /plataforma &lt;Licitanet&gt;/);
  assert.doesNotMatch(html, /<Licitanet>/);
});

test("detalhes mostram limitações de digitalização mesmo sem trecho extraído", () => {
  const html = renderRadarPlatformEvidence([{
    source: "editalPdf",
    document_title: "Edital digitalizado",
    document_id: 9,
    method: "pdf_no_text",
    confidence: "low",
    processed_at: "2026-10-11T12:05:00Z",
  }]);
  assert.match(html, /PDF digitalizado sem texto extraível/);
  assert.match(html, /Documento 9/);
});

test("persiste favoritos com identidade do usuário autenticado e mantém usuários isolados", async () => {
  const userA = createSupabaseMock({ userId: "user-a" });
  const serviceA = createRadarFavoritesService({ getClient: () => userA.client });
  assert.equal(await serviceA.setFavorite(procurementId, true), true);
  assert.equal(await serviceA.setFavorite(procurementId, true), true);
  assert.deepEqual([...userA.favorites.get("user-a")], [procurementId]);
  assert.equal(await serviceA.setFavorite(procurementId, false), false);
  assert.deepEqual([...userA.favorites.get("user-a")], []);
  assert.equal(await serviceA.setFavorite(procurementId, true), true);
  assert.deepEqual([...userA.favorites.get("user-a")], [procurementId]);

  const userB = createSupabaseMock({ userId: "user-b", initialFavorites: { "user-a": [procurementId] } });
  const serviceB = createRadarFavoritesService({ getClient: () => userB.client });
  assert.deepEqual(await serviceB.loadFavoriteIds([procurementId]), []);
  assert.equal(await serviceB.setFavorite(procurementId, false), false);
  assert.deepEqual([...userB.favorites.get("user-a")], [procurementId]);
  assert.deepEqual([...userB.favorites.get("user-b") || []], []);
  assert.equal(userB.calls.at(-1).ownerFilter, "user-b");
});

test("carrega a página de favoritos sem gravar os metadados consultados", async () => {
  const metadata = [{ numero_controle_pncp: procurementId, objeto_compra: "Compra" }];
  const mock = createSupabaseMock({ initialFavorites: { "user-a": [procurementId] }, metadata });
  const service = createRadarFavoritesService({ getClient: () => mock.client });
  const page = await service.loadFavoritesPage({ page: 1, pageSize: 20 });
  assert.deepEqual(page.favoriteIds, [procurementId]);
  assert.equal(page.results[0].object, "Compra");
  assert.equal(page.totalCount, 1);
  assert.equal(mock.calls.filter((call) => call.action === "insert").length, 0);
  assert.equal(mock.calls.filter((call) => call.action === "delete").length, 0);
});
