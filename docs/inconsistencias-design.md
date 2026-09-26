# Inventário e inconsistências visuais do GLL

Levantamento inicial do frontend estático em `web/index.html`, `web/app.js` e `web/styles.css`. Este documento registra diferenças observadas; ele não define mudanças visuais automáticas.

## Arquitetura analisada

- SPA estática em HTML, CSS e JavaScript, sem framework de componentes.
- Roteamento por query string (`?page=...`) com History API.
- Autenticação Supabase nos ambientes publicados e IndexedDB no modo local.
- Papéis centralizados em `Administrador` e `Analista`.
- Gerenciamento de usuários já restrito a Administrador; a mesma função `isCurrentUserAdmin()` foi reutilizada no Design System.
- Configurações composta por cards `section-band` em `settings-grid`.
- GitHub Pages publica somente o conteúdo gerado de `web/`.

## Padrões existentes

- Cores predominantes: azul primário, sidebar azul-marinho, fundos cinza-azulados, superfícies brancas e estados success/warning/danger/info.
- Tipografia: Inter com fallbacks Segoe UI e Arial; corpo majoritariamente entre 12 e 15 px.
- Controles: altura mínima próxima de 38–40 px, raio mais frequente de 8 px.
- Containers: `section-band`, cards de status, painéis, tabelas roláveis e dialogs nativos.
- Ações: `primary-action`, `quiet-action`, `danger-action`, `text-action`, `icon-button` e variantes compactas.
- Formulários: labels envolvendo inputs, grids responsivos e mensagens `form-error`.
- Feedback: pills de status, toast, empty state e loading modal bloqueante.
- Layout: sidebar + topbar, page heading, áreas de conteúdo e breakpoints principais em 980, 720 e 620 px.
- Ícones: glifos Unicode incorporados ao HTML; não há biblioteca de ícones formal.

## Inconsistências encontradas

### Duas definições de tema

O arquivo possuía dois blocos `:root`: um tema anterior verde-azulado e o GLL 2.0 azul que prevalecia por cascata. A duplicidade foi removida e o tema vigente virou token canônico. Aliases legados preservam o resultado visual.

### Cores hardcoded

O inventário encontrou cerca de 210 expressões de cor únicas entre hex e rgba no CSS legado. Há famílias azuis muito próximas (`#1472e6`, `#176fe8`, `#0867d4`, `#234fa9`), além de brancos e cinzas duplicados. Muitas pertencem a áreas específicas, gradientes e estados de tabelas.

Decisão: não substituir em massa nesta etapa. Os tokens semânticos cobrem os usos novos e a migração dos valores legados ocorrerá por componente, com validação visual.

### Border radius

Foram encontrados 21 valores/expressões diferentes. Os mais frequentes são 8 px, pill, 50%, 10 px, 12 px e 14 px; também existem 6, 7, 9, 11, 18, 20 e 22 px.

Decisão: a escala oficial cobre 6, 8, 10, 14, 20 e pill. Valores legados fora da escala foram mantidos quando a intenção visual não era inequívoca.

### Tipografia

Foram encontrados 24 valores/expressões de `font-size`, com grande concentração em 12 e 13 px, mas variações de 10 a 30 px e títulos fluidos com `clamp()`.

Decisão: documentar a escala oficial e preservar títulos especiais/hero até uma revisão contextual.

### Altura e padding de botões

Há botões padrão, compactos, ícones quadrados, tabs e ações específicas com alturas/paddings distintos. Algumas diferenças são funcionais; outras parecem históricas.

Decisão: componentes novos usam os tokens de controle. As variantes existentes continuam até serem migradas com regressão visual comparada.

### Badges e tags

`status-pill`, `user-role-pill`, `current-user-pill`, `supplier-tag` e badges de cards resolvem necessidades semelhantes com APIs e medidas diferentes.

Decisão: Badge e Tag do catálogo estabelecem semântica comum. A consolidação de cada uso legado fica para alterações futuras, sem alterar telas agora.

### Modais

Existem dialogs com larguras e estruturas diferentes (`quotation-item-modal`, `supplier-modal`, `blocking-loading-modal` e confirmações). Parte da variação corresponde ao conteúdo; não há escala nomeada de tamanhos.

Decisão: documentar confirmação e loading já usados. Uma escala de modal só deve ser criada após comparar todos os fluxos em tela real.

### Ícones

Glifos Unicode são simples e não aumentam dependências, mas variam de aparência conforme plataforma e fonte.

Decisão: catalogar os glifos atuais como estado oficial provisório. Uma futura biblioteca SVG deve ser avaliada como mudança visual deliberada.

### Componentes duplicados

Os seguintes grupos são candidatos fortes à consolidação gradual:

- ações primária/secundária/destrutiva em várias telas;
- campos com label, ajuda e erro;
- pills de status e papéis;
- cards/painéis de conteúdo;
- empty states de listas e detalhes;
- barras de filtros;
- cabeçalhos de página/seção;
- dialogs de confirmação;
- tabelas roláveis e suas ações por linha.

## Itens não encontrados como padrão recorrente

Não havia implementação reutilizável clara de Tooltip, Pagination ou Breadcrumb interativo. Criá-los sem uso real contrariaria a regra de evitar componentes especulativos. Eles permanecem no backlog do Design System para quando uma funcionalidade concreta exigir.
