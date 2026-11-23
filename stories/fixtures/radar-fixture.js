// Fictitious data for Storybook and browser tests only; never included in web/.
import { createRadarSearchFeature } from '../../web/radar-search.js';
import { createRadarDetailsFeature } from '../../web/radar-details.js';
import '../../web/radar-catalogs.js';
import '../../web/radar-import.js';

export async function mountRadarFixture(root, { role = 'Administrador', pending = false, itemCount = 45, previousImport = true, documentCount = 1, platformConflict = false } = {}) {
  root.classList.remove('hidden');
  window.GLL_CONFIG = { ...window.GLL_CONFIG, radarDocumentsFallbackEnabled: true };
  const calls = [];
  const favorites = new Set();
  const imported = new Set(['4']);
  const modalities = [
    { pncp_id: 6, name: 'Pregão - Eletrônico', is_active: true },
    { pncp_id: 8, name: 'Dispensa', is_active: true },
    { pncp_id: 9, name: 'Inexigibilidade', is_active: true },
    { pncp_id: 4, name: 'Concorrência - Eletrônica', is_active: true },
    { pncp_id: 1, name: 'Leilão - Eletrônico', is_active: false },
  ];
  const results = [1, 2].map((n) => ({
    numberControlPncp: `00000000000000-1-00000${n}/2026`, procurementNumber: `${n}`, year: 2026,
    object: `Objeto fictício ${n}: ` + 'Aquisição de materiais para as unidades administrativas, com entregas parceladas conforme especificações. '.repeat(5),
    agencyName: `Órgão fictício ${n}: ` + 'Secretaria de Administração, Educação e Desenvolvimento Institucional. '.repeat(3),
    municipalityName: 'Município fictício', municipalityIbgeId: 1, uf: 'ES', modalityId: 6,
    estimatedValue: 12345.67, proposalReceiptStatus: n === 1 ? 'open' : 'upcoming',
    bidPhaseStartAt: '2026-12-01T12:00:00Z', proposalsEndAt: '2026-12-01T11:59:00Z',
    platformName: 'Portal de Compras Públicas', platformStatus: 'identified',
    platformConfidence: 'low', platformClassificationMethod: 'pdf_text', platformEvidenceSource: 'edital_pdf',
    platformEvidence: [{ source: 'edital_pdf', document_title: 'Edital fictício', value_excerpt: 'Sessão pública fictícia', page: 1 }],
    platformConflict: platformConflict && n === 1,
    sourceUrl: 'https://pncp.gov.br/app/editais/00000000000000/2026/1',
  }));
  const itemRows = Array.from({ length: itemCount }, (_, i) => ({ numero_item: i + 1, descricao: `Item fictício ${i + 1} — material para teste de seleção e confirmação`, quantidade: 2.5, unidade_medida: 'UN', valor_unitario_estimado: 12.34, valor_total: 30.85 }));
  const documents = Array.from({ length: documentCount }, (_, index) => ({
    documentId: index + 1,
    title: index === 0 ? 'Edital fictício' : `Documento fictício ${index + 1}`,
    type: index === 0 ? 'Edital' : 'Anexo',
    url: `https://pncp.gov.br/documento-teste-${index + 1}.pdf`,
  }));
  const rows = results.map((r) => ({ numero_controle_pncp: r.numberControlPncp, numero_compra: r.procurementNumber, ano_compra: 2026, objeto_compra: r.object, nome_orgao: r.agencyName, modalidade_pncp_id: 6, uf: 'ES', municipio_ibge_id: 1, valor_estimado: r.estimatedValue, data_inicio_fase_lances: r.bidPhaseStartAt, data_fim_propostas: r.proposalsEndAt, plataforma_id: 'portal', plataforma_status: 'identified', plataforma_confianca: r.platformConfidence, plataforma_metodo_classificacao: r.platformClassificationMethod, plataforma_fonte_evidencia: r.platformEvidenceSource, plataforma_evidencia: r.platformEvidence, plataforma_conflito: r.platformConflict, link_sistema_origem: 'https://www.portaldecompraspublicas.com.br/', link_processo_eletronico: 'https://www.portaldecompraspublicas.com.br/processo/ficticio' }));
  let documentsFail = false;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) },
    from(table) {
      const filters = []; let single = false; let range = null; let inserted = null; let deleting = false;
      const query = {
        select() { return query; }, order() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        in(key, value) { filters.push([key, value]); return query; },
        range(a, b) { range = [a, b]; return query; },
        single() { single = true; return query; }, maybeSingle() { single = true; return query; },
        insert(value) { inserted = value; return query; }, delete() { deleting = true; return query; },
        then(resolve, reject) {
          if (inserted) favorites.add(inserted.numero_controle_pncp);
          if (deleting) favorites.delete(filters.find(([k]) => k === 'numero_controle_pncp')?.[1]);
          let data = {
            radar_catalog_modalities: modalities,
            radar_catalog_states: [{ ibge_id: 32, uf: 'ES', name: 'Espírito Santo' }],
            radar_catalog_municipalities: [{ ibge_id: 1, state_uf: 'ES', name: 'Município fictício' }],
            radar_configuracoes: [{ busca_periodo_padrao_dias: 15 }],
            radar_plataformas: [{ id: 'portal', nome: 'Portal de Compras Públicas', slug: 'portal-de-compras-publicas', ativo: true }],
            radar_plataforma_dominios: [], radar_plataforma_catalog_state: [{ versao: 1 }],
            radar_licitacoes: rows,
            radar_itens_sync: results.map((r) => ({ numero_controle_pncp: r.numberControlPncp, status: pending ? 'pending' : 'complete', disponibilidade_origem: pending ? 'unknown' : 'available', quantidade_itens: itemCount, quantidade_itens_esperada: itemCount, versao_sincronizacao: pending ? null : 'fixture-version' })),
            radar_itens: itemRows,
            radar_favoritos: [...favorites].map((id) => ({ numero_controle_pncp: id })),
            radar_importacoes: previousImport ? [{ id: 'import-1', bid_id: 'bid-1' }] : [],
            bids: [{ id: 'bid-1', edital_number: 'Teste 1', buyer_agency: 'Órgão fictício' }],
            items: [...imported].map((number) => ({ radar_numero_item_pncp: number })),
          }[table] || [];
          data = data.filter((row) => filters.every(([key, value]) => !(key in row) || (Array.isArray(value) ? value.includes(row[key]) : row[key] === value)));
          const count = data.length;
          if (range) data = data.slice(range[0], range[1] + 1);
          return Promise.resolve({ data: single ? data[0] || null : data, count, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    functions: { async invoke(name, { body }) {
      calls.push({ name, body });
      if (name === 'radar-search') return { data: { results, pagination: { page: body.page, pageSize: 50, totalCount: 100, hasMore: body.page < 2 }, coverage: { status: 'complete' }, metadata: {} } };
      if (name === 'radar-details') return documentsFail ? { error: new Error('Falha fictícia de documentos') } : { data: { status: 'available', numberControlPncp: body.numberControlPncp, documents: { status: 'available', documents } } };
      if (name === 'radar-import') {
        if (body.action === 'attach-documents') {
          const selectedDocumentIds = Array.isArray(body.selectedDocumentIds)
            ? body.selectedDocumentIds
            : documents.slice(0, 4).map((document) => document.documentId);
          return { data: { ok: true, document_attachments: {
            status: 'complete',
            attached_count: selectedDocumentIds.length,
            ignored_count: documents.length - selectedDocumentIds.length,
            selection_applied: Array.isArray(body.selectedDocumentIds),
          } } };
        }
        body.selectedItemNumbers?.forEach((n) => imported.add(String(n)));
        return { data: { ok: true, bid_id: 'bid-1', created_items: body.selectedItemNumbers?.length || 0 } };
      }
      return { data: { ok: true } };
    } },
  };
  let search;
  const details = createRadarDetailsFeature({ getClient: () => client, getUserRole: () => role, onFavoriteChanged: (id, value) => search.syncFavorite(id, value) });
  search = createRadarSearchFeature({ getClient: () => client, getUserRole: () => role, actions: {
    detailsEnabled: true, openCard: details.openCard, beforeResultsRender: details.detachCard,
    loadFavoriteIds: details.loadFavoriteIds, loadFavoritesPage: details.loadFavoritesPage,
    setFavorite: (r, value) => details.setFavorite(r.numberControlPncp, value),
  } });
  await search.showPage();
  return { calls, results, search, details, failDocuments(value = true) { documentsFail = value; } };
}
