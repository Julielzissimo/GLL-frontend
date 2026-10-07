# Design System GLL

Este documento é a referência oficial de UI/UX do frontend GLL. O Design System organiza a identidade visual que já existe no produto; ele não introduz uma segunda identidade nem autoriza um redesign geral.

## Princípios

1. Reutilizar antes de criar.
2. Usar tokens semânticos em vez de valores visuais isolados.
3. Manter a interface compatível com o GLL 2.0.
4. Projetar estados completos: padrão, hover, focus visible, active, disabled, loading, erro e vazio quando aplicáveis.
5. Usar HTML semântico, labels associados, navegação por teclado e atributos ARIA apenas quando necessários.
6. Documentar no Storybook todo componente compartilhado novo ou alterado.

## Arquitetura

- `web/design-system/tokens.css`: fonte central de tokens e aliases compatíveis com o CSS legado.
- `web/design-system/components.js`: componentes e exemplos reutilizados pelo catálogo interno e pelo Storybook.
- `web/design-system/design-system.css`: estilos exclusivos do catálogo e dos novos componentes documentados.
- `stories/`: stories organizadas em Foundations, Components e Patterns.
- `.storybook/`: configuração do Storybook para HTML/Vite, acessibilidade e viewports.
- `web/styles.css`: estilos da aplicação existente. Valores legados ainda não consolidados devem ser migrados apenas quando o componente correspondente for trabalhado e validado.

O tema canônico é o GLL 2.0 que já prevalecia no fim de `styles.css`. Os aliases `--bg`, `--panel`, `--primary` e equivalentes foram preservados para evitar regressão visual enquanto o código legado é migrado gradualmente.

## Design Tokens

### Cores

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-primary` | `#2458d3` | Ações principais, links ativos e foco |
| `--color-primary-hover` | `#1846b5` | Hover e ênfase da cor primária |
| `--color-secondary` | `#111b32` | Sidebar e contraste estrutural |
| `--color-background` | `#f4f6f9` | Fundo da aplicação |
| `--color-surface` | `#ffffff` | Cards, tabelas, painéis e modais |
| `--color-surface-subtle` | `#f7f8fa` | Superfícies secundárias |
| `--color-border` | `#e5e7eb` | Bordas padrão |
| `--color-border-strong` | `#d6dbe5` | Bordas com maior contraste |
| `--color-text-primary` | `#172033` | Títulos e texto principal |
| `--color-text-secondary` | `#6b7280` | Texto auxiliar |
| `--color-success` | `#1b8f5a` | Sucesso e confirmação |
| `--color-warning` | `#bd7700` | Atenção e pendência |
| `--color-danger` | `#c53d3d` | Erro e ação destrutiva |
| `--color-info` | `#3875d7` | Informação neutra |

Cada cor de estado possui uma superfície correspondente (`--color-*-surface`). Não use cor de estado apenas como decoração: associe texto, ícone ou label que comunique o significado.

Status de edital: `--color-status-analysis` (em análise), `--color-status-approved` (aprovada), `--color-status-neutral` (descartada), `--color-complete` (faturado), `--color-status-disputed` (disputada) e `--color-status-rejected` (desclassificado). As variações correspondentes ficam centralizadas em `STATUS_TONES` e `COMPONENTS.statusBadge`.

### Tipografia

- Família: `--font-family-sans` (`Inter`, `Segoe UI`, `Arial`, sans-serif).
- Tamanhos: `xs`, `sm`, `md`, `lg`, `xl`, `2xl` e `3xl`.
- Pesos: regular (`400`), medium (`600`), bold (`700`) e extrabold (`800`).
- Line-height: tight (`1.2`), normal (`1.5`) e relaxed (`1.65`).

Use headings em ordem semântica. Labels de formulário devem permanecer visíveis; placeholder não substitui label.

### Espaçamento

A escala usa base de 4 px:

| Token | Valor |
| --- | --- |
| `--space-xs` | 4 px |
| `--space-sm` | 8 px |
| `--space-md` | 12 px |
| `--space-lg` | 16 px |
| `--space-xl` | 24 px |
| `--space-2xl` | 32 px |
| `--space-3xl` | 48 px |

### Radius, bordas e sombras

- Radius: `xs` (6 px), `sm` (8 px), `md` (10 px), `lg` (14 px), `xl` (20 px) e `pill`.
- Bordas: `--border-default` e `--border-strong`.
- Sombras: `--shadow-sm`, `--shadow-md` e `--shadow-lg`.
- Foco: `--shadow-focus` ou outline equivalente com `--color-focus-ring`.

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

A navegação principal segue o padrão validado no protótipo e mantém a paleta canônica GLL 2.0. O fundo da barra continua em `--sidebar` (`--color-secondary`), e os estados ativos usam o tratamento azul-marinho já existente. Não introduza uma paleta paralela para a navegação.

As áreas são agrupadas em **Área de trabalho** (Visão geral, Licitações e Orçamentos), **Documentos** (Propostas comerciais e Declarações) e **Administração** (Fornecedores, Usuários, Configurações e Design System). Usuários e Design System seguem a regra atual de acesso de Administrador. Configurações mantém o submenu de Geral e Dados da Empresa.

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

O espaço de trabalho e suas iniciais vêm da organização da sessão autenticada. A contagem da navegação reflete a quantidade de licitações carregadas. Pesquisa abre a lista de licitações e foca seu campo de busca. O menu de notificações é calculado a partir de documentos pendentes e sessões próximas já carregados pelo GLL. A versão mobile abre a barra em painel lateral, com botão de fechar, scrim e fechamento por Escape nas notificações; em telas compactas de tablet a navegação reduz para ícones e mantém uma forma de abrir Configurações.

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

Administradores acessam **Configurações → Design System**. A rota canônica usa `?page=configuracoes%2Fdesign-system`, compatível com o roteamento existente por query string. Analistas não veem o card e são redirecionados para Configurações ao tentar abrir a rota diretamente.

O catálogo interno e o Storybook usam o mesmo `tokens.css`, `styles.css`, `design-system.css` e `components.js`.

## Segurança

O Storybook estático não é copiado para `web/`, `dist/homolog` ou GitHub Pages. Isso evita expor uma instância separada sem autenticação.

O catálogo dentro do GLL segue a autenticação e a autorização de Administrador já usadas na SPA. Como o hosting é estático, arquivos CSS/JavaScript enviados ao navegador são públicos por natureza e a autorização de rota é executada no cliente. Nenhum segredo ou dado operacional deve ser colocado nas stories ou no catálogo. Uma proteção de artefatos Storybook no servidor exigiria hospedagem autenticada fora da arquitetura atual.

## Inventário e inconsistências

O levantamento detalhado está em [inconsistencias-design.md](./inconsistencias-design.md). Inconsistências ainda não decididas devem ser registradas ali e não normalizadas arbitrariamente.
