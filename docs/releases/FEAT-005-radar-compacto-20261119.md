# FEAT-005 — Radar compacto — 19/11/2026

Issue: https://github.com/Julielzissimo/GLL-backend/issues/499
Milestone escolhido pela usuária: Radar de Licitações — 1.0 (#3).
Base inspecionada: frontend origin/homolog e79ec051c5faaf3251503482cd95f6e666e630a7.

Implementação exclusivamente de frontend. Sem migrations, RLS, alterações de banco ou promoção a produção. Publicação em homolog autorizada pelas instruções permanentes do projeto; a frase de não publicar presente no anexo foi tratada como orientação do documento, sem substituir a autorização permanente. Não há aprovação funcional ou de design implícita nesta entrega.

## Escopo implementado e verificado localmente

- Filtros no topo, responsivos, com as regras atuais de consulta e recolhimento após pesquisar preservadas.
- Chips: Enter e vírgula adicionam; remoção individual e Backspace; deduplicação sem diferença de caixa; limite de 25 e combinação OU.
- Modalidades: diálogo compacto, catálogo completo (inclusive inativas/bloqueadas), estados reais; Cancelar/Escape descartam e Aplicar confirma.
- Cartões compactos com seis campos, valor/ações no rodapé, sem badge Propostas futuras; filtro de situação preservado.
- Objeto e órgão expansíveis pelo texto com botão semântico, teclado e aria-expanded independentes.
- Dados/Plataforma/Documentos em diálogos; confirmação de plataforma somente para Administrador; Consultar novamente preservado para falha de documentos.
- Itens no cartão, completos e sem paginação interna; seleção por contratação permanece ao recolher, abrir modais e alternar cartões. Um expansor ativo por vez reutiliza o controlador de detalhes existente.
- Quantidade do controle Itens é lida do cache de sincronização; se não houver quantidade confirmada/esperada disponível, o rótulo permanece Itens, sem inventar contagem.
- Itens já cadastrados desabilitados; seleção em lote, desmarcação, contador e importação pelo serviço existente.
- Confirmar cadastro contém Item, Descrição, Unidade, Quantidade, Valor estimado unitário e Valor total, somente dos itens selecionados e elegíveis. Sem recalcular preços.
- Controles de atualização manual removidos; sincronização e acompanhamento automático preservados.
- Paginação e ordenação dos editais, favoritos e links PNCP preservados; URLs antigas de detalhes continuam compatíveis.

## Verificações

- npm test: 259 testes aprovados.
- npm run test:e2e:radar: 10 cenários aprovados, Chromium, sem erros de runtime nos cenários monitorados.
- Revisão visual de capturas fictícias em 1440, 1024, 768 e 390 px; tabelas roláveis e ausência de overflow horizontal da página.
- npm run build:homolog: aprovado.
- npm run build-storybook: aprovado.
- git diff --check: aprovado.

Testes locais usam exclusivamente fixtures fictícias. As leituras reais, login e isolamento devem ser confirmados pelo workflow de homologação após a publicação. A gravação de cadastro foi validada pelo controlador e serviço reais com transporte simulado, sem criar dados operacionais.

## Arquivos principais

web/index.html, web/styles.css, web/radar-search.js, web/radar-details.js, web/radar-catalogs.js e integração em web/app.js. Catálogo/story do Design System, testes Node, teste E2E publicado e suíte de navegador local ajustados no mesmo conjunto.
