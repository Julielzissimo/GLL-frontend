export default {
  title: "Patterns/Radar de Licitações",
  tags: ["autodocs"],
};

const frame = (content) => `<main class="users-page radar-page">${content}</main>`;

export const PesquisaInicial = {
  name: "Pesquisa inicial",
  render: () => frame(`
    <div class="page-heading radar-page-heading"><div><span class="eyebrow">OPORTUNIDADES DO PNCP</span><h1>Radar de Licitações</h1><p>Pesquise contratações pelo objeto, com cobertura nacional e filtros oficiais do Radar.</p></div></div>
    <form class="section-band radar-search-form">
      <div class="radar-section-heading"><h2>Pesquisar contratações</h2><p>Os termos são combinados com OU e consultados somente em <code>objetoCompra</code>.</p></div>
      <div class="radar-filter-grid">
        <div class="radar-tag-field"><label for="storyRadarObject">Objeto da contratação</label><div class="radar-tag-entry"><input id="storyRadarObject" placeholder="Ex.: aquisição de computadores" /><button class="quiet-action compact-action" type="button">Adicionar termo</button></div><small>Pressione Enter ou separe termos por vírgula. Até 25 termos, combinados com OU.</small></div>
        <details class="radar-modality-filter"><summary><span>Modalidades</span><strong>Todas as modalidades ativas</strong></summary><div class="radar-modality-menu"><button class="quiet-action compact-action radar-modality-bulk-action" type="button">Desmarcar todas</button><div class="radar-modality-list" role="group" aria-label="Modalidades ativas"><label class="radar-modality-option"><input type="checkbox" checked /><span>Pregão eletrônico</span></label><label class="radar-modality-option"><input type="checkbox" checked /><span>Concorrência</span></label></div></div></details>
        <label>Estado<select><option>Brasil inteiro</option><option>São Paulo (SP)</option></select></label>
        <label>Município<select disabled><option>Selecione uma UF primeiro</option></select></label>
        <details class="radar-modality-filter"><summary><span>Plataforma de disputa</span><strong>Licitanet</strong></summary><div class="radar-modality-menu"><button class="quiet-action compact-action" type="button">Todas as plataformas</button><label>Pesquisar plataformas<input type="search" /></label><div class="radar-modality-list" role="group" aria-label="Plataformas de disputa ativas"><label class="radar-modality-option"><input type="checkbox" checked /><span>Licitanet</span></label><label class="radar-modality-option"><input type="checkbox" /><span>Portal de Compras Públicas</span></label></div><label class="radar-modality-option"><input type="checkbox" /><span>Incluir licitações sem plataforma</span></label><small>O filtro é aplicado antes da paginação.</small></div></details>
        <label>Publicação a partir de<input type="date" value="2026-09-11" /></label>
        <label>Publicação até<input type="date" value="2026-10-10" /></label>
        <label>Situação das propostas<select><option>Recebendo propostas</option></select></label>
      </div>
      <div class="radar-form-footer"><div class="button-row end"><button class="quiet-action" type="button">Limpar filtros</button><button class="primary-action" type="button">Pesquisar</button></div></div>
    </form>
    <div class="empty-state radar-empty-state"><span class="radar-empty-icon" aria-hidden="true">⌕</span><strong>Pesquise contratações do PNCP</strong><p>O Radar consulta somente o objeto da contratação. Você pode informar mais de um termo; qualquer termo pode corresponder.</p></div>`),
};

export const CoberturaParcial = {
  name: "Resultado vazio sem informativo de cobertura parcial",
  render: () => frame(`
    <section class="section-band radar-results-panel">
      <div class="radar-results-heading"><div><h2>Resultados</h2><p>Nenhum registro nesta página.</p></div></div>
      <div class="empty-state radar-empty-state" data-empty-kind="partial-empty"><span class="radar-empty-icon" aria-hidden="true">◇</span><strong>Nenhum resultado visível na cobertura atual</strong><p>A coleta está incompleta ou desatualizada. Ainda não é possível concluir que não existam licitações neste período.</p></div>
    </section>`),
};

export const Resultados = {
  name: "Resultados em cartões informativos",
  render: () => frame(`
    <section class="section-band radar-results-panel">
      <div class="radar-results-heading"><div><h2>Resultados</h2><p>20 licitações encontradas.</p></div><div class="radar-results-controls"><label>Ordenar por<select><option>Data de publicação</option></select></label><label>Resultados por página<select><option>20</option></select></label></div></div>
      <div class="radar-feedback" data-tone="success" role="status"><strong>Cobertura completa</strong><span>O Radar consultou o escopo completo para os filtros atuais. Última cobertura: 10/10/2026, 15:30.</span></div>
      <div class="radar-result-list"><article class="radar-result-card"><div class="radar-result-card-heading"><div><p class="radar-result-number">Edital 90012/2026</p><h3>Aquisição de equipamentos de informática para as unidades de atendimento da rede municipal</h3></div><span class="radar-receipt-status" data-status="open">Recebendo propostas</span></div><dl class="radar-result-fields"><div><dt>Município - UF</dt><dd>Campinas - SP</dd></div><div><dt>Abertura das propostas</dt><dd>04/10/2026, 09:00</dd></div><div><dt>Encerramento das propostas</dt><dd>20/10/2026, 12:00</dd></div><div><dt>Órgão responsável</dt><dd>Secretaria Municipal de Saúde<small>Unidade de Compras</small></dd></div><div><dt>Modalidade</dt><dd>Pregão eletrônico</dd></div><div><dt>Plataforma de disputa</dt><dd><a href="https://licitanet.com.br" target="_blank" rel="noopener noreferrer">Licitanet ↗</a></dd></div><div><dt>Valor estimado</dt><dd>R$ 184.500,00</dd></div><div><dt>Publicação no PNCP</dt><dd>04/10/2026</dd></div><div><dt>Situação no PNCP</dt><dd>Divulgada no PNCP</dd></div></dl><div class="radar-result-card-footer"><small>Identificador PNCP: 123456780001992026000079</small><div class="radar-row-actions"><button class="quiet-action compact-action" type="button">Ver itens</button><button class="quiet-action compact-action" type="button" aria-pressed="false">Favoritar</button><a class="quiet-action compact-action" href="https://pncp.gov.br" target="_blank" rel="noopener noreferrer">PNCP ↗</a></div></div></article></div>
      <nav class="radar-pagination" aria-label="Paginação dos resultados do Radar"><span>Página 1 de 1 <small>20 resultados.</small></span><div class="button-row"><button class="quiet-action compact-action" type="button" disabled>Anterior</button><button class="quiet-action compact-action" type="button" disabled>Próxima</button></div></nav>
    </section>`),
};

export const Favoritos = {
  name: "Favoritos da conta",
  render: () => frame(`
    <section class="section-band radar-results-panel">
      <div class="radar-results-heading"><div><h2>Licitações favoritas</h2><p>2 oportunidades salvas nesta conta.</p></div><button class="quiet-action compact-action" type="button">Voltar à pesquisa</button></div>
      <div class="radar-feedback" data-tone="info" role="status"><strong>Seus favoritos</strong><span>Esta lista é privada e vinculada à sua conta GLL.</span></div>
      <div class="radar-result-list"><article class="radar-result-card"><div class="radar-result-card-heading"><div><p class="radar-result-number">Edital 61/2026</p><h3>Aquisição de veículo</h3></div><span class="radar-receipt-status" data-status="upcoming">Propostas futuras</span></div><dl class="radar-result-fields"><div><dt>Município - UF</dt><dd>São Gabriel - RS</dd></div><div><dt>Abertura das propostas</dt><dd>12/10/2026, 09:00</dd></div><div><dt>Encerramento das propostas</dt><dd>20/10/2026, 09:00</dd></div><div><dt>Órgão responsável</dt><dd>Município de São Gabriel</dd></div><div><dt>Modalidade</dt><dd>Pregão eletrônico</dd></div><div><dt>Valor estimado</dt><dd>—</dd></div></dl><div class="radar-result-card-footer"><small>Identificador PNCP: 88768080000170-1-000478/2026</small><div class="radar-row-actions"><button class="quiet-action compact-action" type="button">Ver itens</button><button class="quiet-action compact-action" type="button" aria-pressed="true">Desfavoritar</button></div></div></article></div>
      <nav class="radar-pagination" aria-label="Paginação dos favoritos"><span>Página 1 de 1 <small>1 favorito.</small></span><div class="button-row"><button class="quiet-action compact-action" type="button" disabled>Anterior</button><button class="quiet-action compact-action" type="button" disabled>Próxima</button></div></nav>
    </section>`),
};

export const DetalhesDaContratacao = {
  name: "Detalhes com orçamento sigiloso",
  render: () => frame(`
    <section class="radar-detail-page">
      <div class="page-heading radar-page-heading"><div><span class="eyebrow">OPORTUNIDADE DO PNCP</span><h1>Detalhes — 61/2026</h1><p>Fonte: API oficial do PNCP · Consulta realizada em 10/10/2026, 15:30.</p></div><div class="button-row"><button class="quiet-action" type="button">Voltar aos resultados</button><button class="quiet-action" type="button" aria-pressed="true">Desfavoritar</button><button class="quiet-action" type="button">↻ Atualizar dados</button></div></div>
      <section class="section-band radar-detail-section"><div class="radar-detail-section-heading"><div><h2>Informações gerais</h2><p>Dados consultados diretamente no PNCP.</p></div></div><dl class="radar-detail-grid"><div><dt>Identificador PNCP</dt><dd>88768080000170-1-000478/2026</dd></div><div><dt>Número da contratação</dt><dd>61/2026</dd></div><div><dt>Órgão responsável</dt><dd>Município de São Gabriel</dd></div><div><dt>Município e UF</dt><dd>São Gabriel / RS</dd></div><div><dt>Modalidade</dt><dd>Pregão eletrônico</dd></div><div><dt>Valor estimado</dt><dd>Orçamento sigiloso</dd></div><div><dt>Situação</dt><dd>Divulgada no PNCP</dd></div></dl><section class="radar-platform-detail" aria-labelledby="storyRadarPlatformTitle"><h3 id="storyRadarPlatformTitle">Plataforma de disputa</h3><p><strong>Licitanet</strong></p><p>Link de origem informado pelo PNCP: <a href="https://licitanet.com.br" target="_blank" rel="noopener noreferrer">Acessar plataforma ↗</a></p><small>A identificação automática corresponde ao domínio da URL. Ela não confirma que o endereço seja a sessão efetiva de disputa.</small></section><a class="quiet-action compact-action radar-official-link" href="https://pncp.gov.br/app/editais/88768080000170/2026/478" target="_blank" rel="noopener noreferrer">Abrir contratação no PNCP ↗</a></section>
      <section class="section-band radar-detail-section"><div class="radar-detail-section-heading"><div><h2>Itens da contratação</h2><p>3 itens consultados em 2 páginas do PNCP.</p></div></div><p class="radar-feedback" data-tone="warning" role="status"><strong>Orçamento sigiloso</strong><span>Os valores não serão tratados como preço.</span></p><div class="table-wrap radar-detail-items-wrap" role="region" tabindex="0" aria-label="Itens da contratação"><table class="radar-results-table radar-items-table"><caption class="sr-only">Itens da contratação retornados pelo PNCP</caption><thead><tr><th scope="col">Item</th><th scope="col">Descrição</th><th scope="col">Quantidade</th><th scope="col">Unidade</th><th scope="col">Valor unitário estimado</th><th scope="col">Valor total</th><th scope="col">Situação</th><th scope="col">Critério</th><th scope="col">Informação complementar</th></tr></thead><tbody><tr><td>1</td><td>Veículo utilitário</td><td>1</td><td>Unidade</td><td>Orçamento sigiloso</td><td>Orçamento sigiloso</td><td>Em andamento</td><td>Menor preço</td><td>Entrega em até 10 dias</td></tr></tbody></table></div></section>
      <section class="section-band radar-detail-section"><div class="radar-detail-section-heading"><div><h2>Documentos do edital</h2></div></div><ul class="radar-document-list"><li><div><strong>Termo de Referência</strong><span>Outros Documentos</span><small>Publicado em 01/10/2026</small></div><a class="quiet-action compact-action" href="https://pncp.gov.br/pncp-api/v1/orgaos/88768080000170/compras/2026/478/arquivos/1" target="_blank" rel="noopener noreferrer">Baixar ↗</a></li></ul></section>
    </section>`),
};
