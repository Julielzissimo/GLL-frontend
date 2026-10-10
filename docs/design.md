# Design System GLL

Este documento é a referência oficial de UI/UX do frontend GLL. O Design System aplica à interface real a identidade visual aprovada no protótipo, preservando as rotas, os dados, as permissões e os fluxos existentes.

## Princípios

1. Reutilizar antes de criar.
2. Usar tokens semânticos em vez de valores visuais isolados.
3. Manter a interface compatível com o GLL 2.0.
4. Projetar estados completos: padrão, hover, focus visible, active, disabled, loading, erro e vazio quando aplicáveis.
5. Usar HTML semântico, labels associados, navegação por teclado e atributos ARIA apenas quando necessários.
6. Documentar no Storybook todo componente compartilhado novo ou alterado.

## Arquitetura

- `web/design-system/tokens.css`: fonte central de tokens e aliases compatíveis com o CSS legado.
- `web/design-system/prototype-theme.css`: adaptação dos componentes HTML atuais à linguagem visual aprovada; é carregado no produto e no Storybook.
- `web/design-system/components.js`: componentes e exemplos reutilizados pelo catálogo interno e pelo Storybook.
- `web/design-system/design-system.css`: estilos exclusivos do catálogo e dos novos componentes documentados.
- `stories/`: stories organizadas em Foundations, Components e Patterns.
- `.storybook/`: configuração do Storybook para HTML/Vite, acessibilidade e viewports.
- `web/styles.css`: estrutura e estilos específicos das páginas. A camada compatível aplica o mesmo tema aos componentes compartilhados sem alterar seus comportamentos.

`--gll-*` é a fonte canônica de cor, tipografia, escala, forma e elevação. Os aliases existentes (`--bg`, `--panel`, `--primary` e equivalentes) apontam para esses tokens para manter as telas atuais compatíveis.

## Design Tokens

### Cores

| Token | Valor | Uso |
| --- | --- | --- |
| `--gll-ink` | `#182923` | Texto principal |
| `--gll-ink-soft` | `#4c5d55` | Texto auxiliar e metadados |
| `--gll-forest` | `#183d35` | Navegação e ações principais |
| `--gll-forest-hover` | `#28564a` | Hover das ações principais |
| `--gll-accent` | `#b57b43` | Acento âmbar |
| `--gll-canvas` | `#f5f3ed` | Fundo da aplicação |
| `--gll-paper` | `#fffefa` | Cards, tabelas, painéis e diálogos |
| `--gll-paper-muted` | `#efeee7` | Superfícies secundárias |
| `--gll-line` | `#d9dcd2` | Divisórias e bordas |
| `--gll-line-strong` | `#b8c2b5` | Contornos de controles |
| `--gll-success` / `--gll-success-bg` | `#256a4f` / `#e4f1e8` | Sucesso e confirmação |
| `--gll-warning` / `--gll-warning-bg` | `#895a1a` / `#f6ebd5` | Atenção e pendência |
| `--gll-danger` / `--gll-danger-bg` | `#9c4c42` / `#f7e9e5` | Erro e ação destrutiva |
| `--gll-info` / `--gll-info-bg` | `#35647c` / `#e6eef1` | Informação |
| `--gll-selection-bg` | `#e8eee4` | Navegação e opções selecionadas |
| `--gll-focus` | `#ad7237` | Foco de teclado |

Os tons auxiliares da navegação (texto `#edf3ea`, texto secundário `#a9c0b2`, divisória branca translúcida) também estão centralizados em `tokens.css`. Cada cor de estado tem uma superfície correspondente. Associe o estado a um rótulo legível.

Status de edital: `--color-status-analysis` (em análise), `--color-status-approved` (aprovada), `--color-status-neutral` (descartada), `--color-complete` (faturado), `--color-status-disputed` (disputada) e `--color-status-rejected` (desclassificado). As variações correspondentes ficam centralizadas em `STATUS_TONES` e `COMPONENTS.statusBadge`.

### Tipografia

- Família: IBM Plex Sans para interface, IBM Plex Serif para títulos e IBM Plex Mono para dados numéricos. Os arquivos OFL locais estão em `web/assets/fonts/`.
- Texto principal: 16 px; ações e campos: 14 px; labels: 13 px; ajuda e legenda: 12 px.
- Pesos: regular (`400`), medium (`500`), semibold (`600`) e bold (`700`).
- Line-height: tight (`1.2`), normal (`1.5`) e relaxed (`1.65`).

Use headings em ordem semântica. Labels de formulário devem permanecer visíveis; placeholder não substitui label.

### Espaçamento

A escala usa base de 4 px:

| Token | Valor |
| --- | --- |
| `--gll-space-1` | 4 px |
| `--gll-space-2` | 8 px |
| `--gll-space-3` | 12 px |
| `--gll-space-4` | 16 px |
| `--gll-space-6` | 24 px |
| `--gll-space-8` | 32 px |
| `--gll-space-12` | 48 px |

### Radius, bordas e sombras

- Radius oficial: `sm` (4 px), `md` (8 px) e `lg` (12 px). `pill` é reservado a avatares e indicadores circulares.
- Bordas: `--border-default` e `--border-strong`.
- Sombras: `--gll-shadow-sm` (2 px / 8 px / 5%), `--gll-shadow-md` (14 px / 34 px / 12%) e `--gll-shadow-overlay` (30 px / 70 px / 22%).
- Sidebar: 258 px. Controles principais: altura mínima de 44 px.
- Foco: contorno âmbar com `--gll-focus`.

### Z-index

Use apenas a escala: `base`, `sticky`, `menu`, `dropdown`, `overlay`, `modal`, `toast` e `tooltip`. Novos valores isolados precisam de justificativa documentada.

## Componentes oficiais

O catálogo inicial documenta componentes que já aparecem no GLL ou representam padrões recorrentes:

- Button e IconButton;
- Input, Textarea, Select e FormField;
- Checkbox, Radio e Switch;
- Badge e Tag;
- Badge de status com mapa semântico centralizado;
- Card e Alert;
- Toast com tons semânticos e inventário das mensagens em uso;
- EmptyState, Loading e Skeleton;
- PageHeader e Tabs;
- Table;
- Dialog de confirmação com escala de tamanhos e inventário dos diálogos em uso.

Os novos estados de edital usam `STATUS_TONES` em `components.js`; a cor sempre acompanha um rótulo legível. Toasts e diálogos em uso devem ser registrados nos catálogos `TOAST_CATALOG` e `DIALOG_CATALOG` e exibidos tanto no Design System interno quanto nas stories. Ao alterar qualquer componente compartilhado, atualize sua story na mesma mudança.

Diálogos usam `--dialog-width-sm`, `--dialog-width-md`, `--dialog-width-lg` e `--dialog-width-xl`, além de `--dialog-shadow`; formulários e conteúdo longo podem escolher o tamanho pela tarefa, preservando a escala comum.

As factories em `components.js` usam as classes reais da aplicação (`primary-action`, `quiet-action`, `danger-action`, `section-band`, `page-heading`, `tabs`, `table-wrap` etc.). Não mantenha uma cópia visual separada nas stories.

Tooltip, Dropdown, Pagination e filtros compostos continuam como padrões candidatos. Breadcrumb já aparece na navegação de documentos e configurações; mantenha sua apresentação curta e ligada ao caminho da página. Esses padrões devem ser consolidados quando houver uso recorrente, sem criar componentes apenas para preencher o catálogo.

## Navegação principal

A navegação principal usa fundo verde floresta (`--gll-forest`) e texto claro. O item ativo tem fundo verde claro (`--gll-selection-bg`) e texto verde floresta; o hover usa uma superfície branca translúcida. A seleção, os botões, os campos, os badges e os estados de feedback usam os mesmos tokens semânticos.

A marca no cabeçalho da sidebar usa o SVG `web/assets/gll-selo-integridade.svg`, com as cores de navegação já definidas em `tokens.css`. Quando a sidebar se reduz a ícones em tablets, use `web/assets/gll-selo-integridade-marca.svg`; ambos mantêm a ação do botão de voltar à visão geral e não substituem os ícones de navegação do registro central.

As áreas são agrupadas em **Área de trabalho** (Visão geral, Licitações e Orçamentos), **Documentos** (Propostas comerciais e Declarações) e **Administração** (Fornecedores, Usuários, Configurações e Design System). Usuários e Design System seguem a regra atual de acesso de Administrador. Configurações mantém o submenu de Geral e Dados da Empresa.

A marca da barra lateral usa o lockup vetorial `web/assets/gll-brand.svg` e, na navegação compacta, o emblema `web/assets/gll-mark.svg`. A aba do navegador usa o mesmo selo de integridade em `web/assets/favicon.svg`, com PNG e ICO como alternativas para navegadores compatíveis.

| Área | Ícone Lucide usado | Chave centralizada |
| --- | --- | --- |
| Visão geral | Layout Dashboard | `layoutDashboard` |
| Licitações | Briefcase Business | `briefcaseBusiness` |
| Orçamentos | Clipboard List | `clipboardList` |
| Propostas comerciais | File Text | `fileText` |
| Declarações | File Check 2 | `fileCheck2` |
| Fornecedores | Package | `package` |
| Usuários | Users | `lucideUsers` |
| Configurações | Settings 2 | `settings2` |
| Design System | Book Open | `bookOpen` |
| Abrir menu | Menu | `menu` |
| Breadcrumb | Chevron Right | `chevronRight` |
| Notificações | Bell | `bell` |
| Pesquisa | Search | `search` |
| Fechar menu / expandir workspace | X / Chevron Down | `close` / `chevronDown` |

Todos os SVGs são fornecidos pelo registro central `GLLDesignSystem.ICONS` em `web/design-system/components.js`; não se adicionam dependências ou desenhos de ícone avulsos. A story [Navigation.stories.js](../stories/patterns/Navigation.stories.js) registra os grupos, os ícones e o estado ativo.

O espaço de trabalho e suas iniciais vêm da organização da sessão autenticada. A navegação não apresenta uma contagem numérica junto a Licitações. Pesquisa abre a lista de licitações e foca seu campo de busca. O menu de notificações é calculado a partir de documentos pendentes e sessões próximas já carregados pelo GLL. A versão mobile abre a barra em painel lateral, com botão de fechar, scrim e fechamento por Escape nas notificações; em telas compactas de tablet a navegação reduz para ícones e mantém uma forma de abrir Configurações.

## Regras de estado e interação

- Hover não pode ser o único indicador de uma ação.
- Focus visible deve permanecer perceptível em controles, links e elementos com `tabindex`.
- Disabled deve usar o atributo nativo e não apenas uma aparência esmaecida.
- Loading deve comunicar `aria-busy` ou `role="status"` e impedir envio duplicado quando aplicável.
- Erros de campo devem usar `aria-invalid` e `aria-describedby`.
- Modais reais devem manter foco, fechar por uma ação clara e usar `aria-labelledby`/`aria-describedby`.
- Tabelas largas permanecem dentro de um container rolável no mobile.

## Criação de componentes e interfaces

Antes de implementar:

1. Procure um componente ou pattern equivalente no Storybook.
2. Use os tokens existentes.
3. Preserve as classes e a linguagem visual do GLL quando modificar uma tela legada.
4. Crie API pequena, sem variantes hipotéticas.
5. Inclua stories dos estados realmente usados.
6. Valide desktop (1440 × 900), tablet (768 × 1024) e mobile (390 × 844).
7. Execute testes, build da aplicação e build do Storybook.

## Storybook local

Instale as dependências e inicie o catálogo:

```powershell
npm install
npm run storybook
```

O endereço padrão é `http://localhost:6006`.

Para gerar o build estático local:

```powershell
npm run build-storybook
```

A saída `storybook-static/` é ignorada pelo Git e não é publicada pelo workflow do GitHub Pages.

## Acesso dentro do GLL

Em homologação, Administradores acessam **Configurações → Design System**. A rota canônica usa `?page=configuracoes%2Fdesign-system`, compatível com o roteamento existente por query string. Analistas não veem o card e são redirecionados para Configurações ao tentar abrir a rota diretamente. Em produção, `designSystemEnabled: false` oculta o atalho e o card e redireciona tentativas de abrir a rota para a página inicial.

O catálogo interno e o Storybook usam o mesmo `tokens.css`, `styles.css`, `design-system.css` e `components.js`.

## Segurança

O Storybook estático não é copiado para `web/`, `dist/homolog` ou GitHub Pages. Isso evita expor uma instância separada sem autenticação.

O catálogo dentro do GLL segue a autenticação e a autorização de Administrador já usadas na SPA. Como o hosting é estático, arquivos CSS/JavaScript enviados ao navegador são públicos por natureza e a autorização de rota é executada no cliente. Nenhum segredo ou dado operacional deve ser colocado nas stories ou no catálogo. Uma proteção de artefatos Storybook no servidor exigiria hospedagem autenticada fora da arquitetura atual.

## Inventário e inconsistências

O levantamento detalhado está em [inconsistencias-design.md](./inconsistencias-design.md). Inconsistências ainda não decididas devem ser registradas ali e não normalizadas arbitrariamente.
