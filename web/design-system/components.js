(function initializeGllDesignSystem(global) {
  const ICONS = Object.freeze({
    home: "⌂",
    bids: "▤",
    quotation: "▧",
    suppliers: "▦",
    users: "♙",
    settings: "⚙",
    add: "＋",
    back: "←",
    forward: "→",
    close: "×",
    logout: "↪",
    success: "✓",
    warning: "!",
  });

  const TOKENS = Object.freeze({
    colors: [
      ["primary", "--color-primary", "Ações principais, links ativos e foco"],
      ["secondary", "--color-secondary", "Navegação principal e contraste estrutural"],
      ["background", "--color-background", "Fundo global da aplicação"],
      ["surface", "--color-surface", "Cards, painéis, tabelas e modais"],
      ["border", "--color-border", "Divisórias e contornos padrão"],
      ["text-primary", "--color-text-primary", "Títulos e conteúdo principal"],
      ["text-secondary", "--color-text-secondary", "Textos auxiliares e legendas"],
      ["success", "--color-success", "Confirmação e status positivos"],
      ["warning", "--color-warning", "Atenção e pendências"],
      ["danger", "--color-danger", "Erros e ações destrutivas"],
      ["info", "--color-info", "Informações e status neutros"],
    ],
    spacing: ["xs", "sm", "md", "lg", "xl", "2xl", "3xl"],
    radius: ["xs", "sm", "md", "lg", "xl", "pill"],
    shadows: ["sm", "md", "lg"],
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function button({ label = "Ação", variant = "primary", disabled = false, loading = false, icon = "" } = {}) {
    const className = variant === "danger" ? "danger-action" : variant === "secondary" ? "quiet-action" : variant === "ghost" ? "text-action" : "primary-action";
    return `<button class="${className}" type="button"${disabled || loading ? " disabled" : ""}${loading ? ' aria-busy="true"' : ""}>${loading ? '<span class="ds-spinner" aria-hidden="true"></span>' : icon ? `<span aria-hidden="true">${escapeHtml(icon)}</span>` : ""}${escapeHtml(loading ? "Carregando…" : label)}</button>`;
  }

  function badge({ label = "Status", tone = "neutral" } = {}) {
    return `<span class="ds-badge ds-badge-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
  }

  function tag({ label = "Tag", removable = false } = {}) {
    return `<span class="supplier-tag">${escapeHtml(label)}${removable ? '<button type="button" aria-label="Remover tag">×</button>' : ""}</span>`;
  }

  function formField({ id = "field", label = "Campo", type = "text", placeholder = "", value = "", helper = "", error = "", disabled = false } = {}) {
    const describedBy = error ? `${id}-error` : helper ? `${id}-help` : "";
    return `<label class="ds-form-field" for="${escapeHtml(id)}"><span>${escapeHtml(label)}</span><input id="${escapeHtml(id)}" type="${escapeHtml(type)}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}"${describedBy ? ` aria-describedby="${escapeHtml(describedBy)}"` : ""}${error ? ' aria-invalid="true"' : ""}${disabled ? " disabled" : ""} />${error ? `<small id="${escapeHtml(id)}-error" class="ds-field-error">${escapeHtml(error)}</small>` : helper ? `<small id="${escapeHtml(id)}-help" class="ds-field-help">${escapeHtml(helper)}</small>` : ""}</label>`;
  }

  function select({ id = "select", label = "Seleção", options = ["Opção 1", "Opção 2"], disabled = false } = {}) {
    return `<label class="ds-form-field" for="${escapeHtml(id)}"><span>${escapeHtml(label)}</span><select id="${escapeHtml(id)}"${disabled ? " disabled" : ""}>${options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  }

  function textarea({ id = "textarea", label = "Descrição", value = "", helper = "" } = {}) {
    return `<label class="ds-form-field" for="${escapeHtml(id)}"><span>${escapeHtml(label)}</span><textarea id="${escapeHtml(id)}" rows="4">${escapeHtml(value)}</textarea>${helper ? `<small class="ds-field-help">${escapeHtml(helper)}</small>` : ""}</label>`;
  }

  function checkbox({ id = "checkbox", label = "Selecionar", checked = false, disabled = false } = {}) {
    return `<label class="check-line" for="${escapeHtml(id)}"><input id="${escapeHtml(id)}" type="checkbox"${checked ? " checked" : ""}${disabled ? " disabled" : ""} /><span>${escapeHtml(label)}</span></label>`;
  }

  function radio({ name = "choice", id = "radio", label = "Opção", checked = false } = {}) {
    return `<label class="check-line" for="${escapeHtml(id)}"><input id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="radio"${checked ? " checked" : ""} /><span>${escapeHtml(label)}</span></label>`;
  }

  function switchControl({ id = "switch", label = "Ativar recurso", checked = false } = {}) {
    return `<label class="ds-switch" for="${escapeHtml(id)}"><input id="${escapeHtml(id)}" type="checkbox" role="switch"${checked ? " checked" : ""} /><span aria-hidden="true"></span><strong>${escapeHtml(label)}</strong></label>`;
  }

  function card({ title = "Título do card", body = "Conteúdo do card.", action = "" } = {}) {
    return `<article class="section-band ds-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p>${action ? button({ label: action, variant: "secondary" }) : ""}</article>`;
  }

  function alert({ title = "Atenção", message = "Mensagem do sistema.", tone = "info" } = {}) {
    return `<div class="ds-alert ds-alert-${escapeHtml(tone)}" role="${tone === "danger" ? "alert" : "status"}"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
  }

  function emptyState({ title = "Nenhum registro", message = "Os itens aparecerão aqui quando forem cadastrados.", action = "Cadastrar" } = {}) {
    return `<div class="empty-state ds-empty-state"><span aria-hidden="true">◇</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>${action ? button({ label: action }) : ""}</div>`;
  }

  function loading({ label = "Carregando dados…" } = {}) {
    return `<div class="ds-loading" role="status"><span class="ds-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></div>`;
  }

  function skeleton() {
    return '<div class="ds-skeleton" aria-label="Conteúdo carregando"><span></span><span></span><span></span></div>';
  }

  function pageHeader({ eyebrow = "GESTÃO", title = "Título da página", description = "Descrição objetiva da área.", action = "Nova ação" } = {}) {
    return `<div class="page-heading"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action ? button({ label: action, icon: ICONS.add }) : ""}</div>`;
  }

  function tabs() {
    return '<div class="tabs" role="tablist" aria-label="Exemplo de abas"><button class="tab active" type="button" role="tab" aria-selected="true">Visão geral</button><button class="tab" type="button" role="tab" aria-selected="false">Documentos</button><button class="tab" type="button" role="tab" aria-selected="false">Histórico</button></div>';
  }

  function table() {
    return '<div class="table-wrap"><table><thead><tr><th>Edital</th><th>Órgão</th><th>Status</th></tr></thead><tbody><tr><td>PE 014/2026</td><td>Prefeitura Municipal</td><td>' + badge({ label: "Em análise", tone: "warning" }) + '</td></tr><tr><td>PE 021/2026</td><td>Secretaria de Saúde</td><td>' + badge({ label: "Aprovada", tone: "success" }) + '</td></tr></tbody></table></div>';
  }

  function modal() {
    return `<div class="ds-modal-preview"><div class="ds-modal-card" role="dialog" aria-modal="true" aria-labelledby="ds-modal-title"><h2 id="ds-modal-title">Confirmar alteração?</h2><p>Revise os dados antes de continuar.</p><div class="button-row end">${button({ label: "Cancelar", variant: "secondary" })}${button({ label: "Confirmar" })}</div></div></div>`;
  }

  const COMPONENTS = Object.freeze({ button, badge, tag, formField, select, textarea, checkbox, radio, switchControl, card, alert, emptyState, loading, skeleton, pageHeader, tabs, table, modal });

  function tokenValue(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function foundationsMarkup() {
    const colors = TOKENS.colors.map(([name, variable, usage]) => `<article class="ds-color-card"><span data-color="${name}" aria-hidden="true"></span><strong>${name}</strong><code>${variable}</code><small>${escapeHtml(tokenValue(variable))}</small><p>${escapeHtml(usage)}</p></article>`).join("");
    const spacing = TOKENS.spacing.map((name) => `<div class="ds-scale-row"><code>--space-${name}</code><span data-space="${name}" aria-hidden="true"></span><small>${escapeHtml(tokenValue(`--space-${name}`))}</small></div>`).join("");
    const radius = TOKENS.radius.map((name) => `<div class="ds-radius-sample" data-radius="${name}"><code>${name}</code></div>`).join("");
    const shadows = TOKENS.shadows.map((name) => `<div class="ds-shadow-sample" data-shadow="${name}"><code>shadow-${name}</code></div>`).join("");
    const icons = Object.entries(ICONS).map(([name, glyph]) => `<div class="ds-icon-sample"><span aria-hidden="true">${glyph}</span><code>${name}</code></div>`).join("");
    return `
      <section class="ds-doc-section" id="ds-colors"><div class="ds-section-heading"><span class="eyebrow">FOUNDATIONS</span><h2>Cores</h2><p>Paleta semântica oficial extraída da interface GLL 2.0.</p></div><div class="ds-color-grid">${colors}</div></section>
      <section class="ds-doc-section" id="ds-typography"><div class="ds-section-heading"><h2>Tipografia</h2><p>Inter quando disponível, com Segoe UI e Arial como fallbacks.</p></div><div class="ds-type-stack"><h1>Heading 1 · 32 px</h1><h2>Heading 2 · 24 px</h2><h3>Heading 3 · 20 px</h3><p>Body · 14 px / line-height 1.5 — textos de interface e conteúdo.</p><label>Label · 13 px / semibold</label><small>Caption · 12 px — metadados e ajuda contextual.</small></div></section>
      <section class="ds-doc-section" id="ds-spacing"><div class="ds-section-heading"><h2>Espaçamento</h2><p>Escala base de 4 px para composições previsíveis.</p></div><div class="ds-scale-list">${spacing}</div></section>
      <section class="ds-doc-section" id="ds-radius"><div class="ds-section-heading"><h2>Radius</h2></div><div class="ds-sample-grid">${radius}</div></section>
      <section class="ds-doc-section" id="ds-shadows"><div class="ds-section-heading"><h2>Sombras</h2></div><div class="ds-sample-grid">${shadows}</div></section>
      <section class="ds-doc-section" id="ds-icons"><div class="ds-section-heading"><h2>Ícones</h2><p>Conjunto atual de glifos funcionais. Ícones decorativos usam <code>aria-hidden</code>.</p></div><div class="ds-icon-grid">${icons}</div></section>`;
  }

  function componentsMarkup() {
    return `
      <section class="ds-doc-section" id="ds-buttons"><div class="ds-section-heading"><span class="eyebrow">COMPONENTS</span><h2>Button e IconButton</h2></div><div class="ds-preview-row">${button({ label: "Primário" })}${button({ label: "Secundário", variant: "secondary" })}${button({ label: "Ghost", variant: "ghost" })}${button({ label: "Excluir", variant: "danger" })}${button({ label: "Desabilitado", disabled: true })}${button({ loading: true })}${button({ label: "Nova licitação", icon: ICONS.add })}<button class="icon-button" type="button" aria-label="Configurações">${ICONS.settings}</button></div></section>
      <section class="ds-doc-section" id="ds-fields"><div class="ds-section-heading"><h2>Campos de formulário</h2></div><div class="ds-form-showcase">${formField({ id: "ds-name", label: "Órgão comprador", placeholder: "Pesquisar órgão…", helper: "Informe o nome oficial." })}${formField({ id: "ds-error", label: "Número do edital", value: "14/2026", error: "Já existe um edital com este número." })}${select({ id: "ds-select", label: "Status", options: ["Em análise", "Aprovada", "Descartada"] })}${textarea({ id: "ds-textarea", label: "Observações", helper: "Até 500 caracteres." })}</div><div class="ds-preview-row">${checkbox({ id: "ds-check", label: "Item ganho", checked: true })}${radio({ id: "ds-radio-1", label: "Pregão eletrônico", checked: true })}${radio({ id: "ds-radio-2", label: "Concorrência" })}${switchControl({ id: "ds-switch", label: "Notificações", checked: true })}</div></section>
      <section class="ds-doc-section" id="ds-status"><div class="ds-section-heading"><h2>Badge, Tag e Alert</h2></div><div class="ds-preview-row">${badge({ label: "Neutro" })}${badge({ label: "Sucesso", tone: "success" })}${badge({ label: "Atenção", tone: "warning" })}${badge({ label: "Erro", tone: "danger" })}${badge({ label: "Informação", tone: "info" })}${tag({ label: "papelaria" })}</div><div class="ds-stack">${alert({ title: "Informação", message: "Os dados foram atualizados.", tone: "info" })}${alert({ title: "Atenção", message: "Revise os campos pendentes.", tone: "warning" })}${alert({ title: "Erro", message: "Não foi possível salvar.", tone: "danger" })}</div></section>
      <section class="ds-doc-section" id="ds-containers"><div class="ds-section-heading"><h2>Card, EmptyState, Loading e Skeleton</h2></div><div class="ds-sample-grid">${card({ title: "Próximas sessões", body: "Licitações ordenadas pela data da sessão.", action: "Ver todas" })}${emptyState({})}</div><div class="ds-preview-row">${loading({})}${skeleton()}</div></section>`;
  }

  function patternsMarkup() {
    return `
      <section class="ds-doc-section" id="ds-page-header"><div class="ds-section-heading"><span class="eyebrow">PATTERNS</span><h2>Page Header</h2></div><div class="ds-pattern-frame">${pageHeader({})}</div></section>
      <section class="ds-doc-section" id="ds-tabs"><div class="ds-section-heading"><h2>Tabs</h2></div>${tabs()}</section>
      <section class="ds-doc-section" id="ds-table"><div class="ds-section-heading"><h2>Tabela e status</h2></div>${table()}</section>
      <section class="ds-doc-section" id="ds-modal"><div class="ds-section-heading"><h2>Diálogo de confirmação</h2></div>${modal()}</section>`;
  }

  function mountCatalog(container) {
    if (!container || container.dataset.mounted === "true") return;
    container.innerHTML = `<div class="ds-catalog-layout"><nav class="ds-catalog-nav" aria-label="Seções do Design System"><strong>Foundations</strong><a href="#ds-colors">Cores</a><a href="#ds-typography">Tipografia</a><a href="#ds-spacing">Espaçamento</a><a href="#ds-radius">Radius</a><a href="#ds-shadows">Sombras</a><a href="#ds-icons">Ícones</a><strong>Components</strong><a href="#ds-buttons">Botões</a><a href="#ds-fields">Formulários</a><a href="#ds-status">Status</a><a href="#ds-containers">Containers</a><strong>Patterns</strong><a href="#ds-page-header">Page Header</a><a href="#ds-tabs">Tabs</a><a href="#ds-table">Tabelas</a><a href="#ds-modal">Diálogos</a></nav><div class="ds-catalog-content">${foundationsMarkup()}${componentsMarkup()}${patternsMarkup()}</div></div>`;
    container.dataset.mounted = "true";
  }

  global.GLLDesignSystem = Object.freeze({ ICONS, TOKENS, COMPONENTS, mountCatalog, foundationsMarkup, componentsMarkup, patternsMarkup });
})(window);
