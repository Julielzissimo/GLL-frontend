(function initializeGllDesignSystem(global) {
  const icon = (content) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
  const ICONS = Object.freeze({
    layoutDashboard: icon('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
    briefcaseBusiness: icon('<path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/>'),
    clipboardList: icon('<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>'),
    fileText: icon('<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5M10 9H8M16 13H8M16 17H8"/>'),
    fileCheck2: icon('<path d="M10.5 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v6M14 2v5a1 1 0 0 0 1 1h5m-6 12 2 2 4-4"/>'),
    package: icon('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73zM12 22V12m-8.71-5L12 12l8.71-5M7.5 4.27l9 5.15"/>'),
    lucideUsers: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-17.872a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>'),
    settings2: icon('<path d="M14 17H5M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>'),
    bookOpen: icon('<path d="M12 5v16M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4-2z"/>'),
    menu: icon('<path d="M4 5h16M4 12h16M4 19h16"/>'),
    chevronRight: icon('<path d="m9 18 6-6-6-6"/>'),
    chevronDown: icon('<path d="m6 9 6 6 6-6"/>'),
    circleHelp: icon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>'),
    bell: icon('<path d="M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>'),
    search: icon('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>'),
    home: icon('<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>'),
    bids: icon('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
    quotation: icon('<path d="M4 19V5m0 14h16M8 15l4-4 3 2 5-7"/>'),
    suppliers: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4v4H7zm6 0h4m-4 4h4M7 15h10"/>'),
    users: icon('<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1zm13-9a3 3 0 1 0-1-5.8M18 14a5 5 0 0 1 3 5v1h-3"/>'),
    settings: icon('<circle cx="12" cy="12" r="3"/><path d="m19 14 .8.8-1.5 2.6-1.2-.4a6.8 6.8 0 0 1-1.5.8l-.2 1.3h-3l-.2-1.3a6.8 6.8 0 0 1-1.5-.8l-1.2.4L8 14.8l.8-.8a6 6 0 0 1 0-1.7l-.8-.8 1.5-2.6 1.2.4a6.8 6.8 0 0 1 1.5-.8l.2-1.3h3l.2 1.3a6.8 6.8 0 0 1 1.5.8l1.2-.4 1.5 2.6-.8.8a6 6 0 0 1 0 1.7z"/>'),
    add: icon('<path d="M12 5v14M5 12h14"/>'),
    back: icon('<path d="m15 18-6-6 6-6M9 12h11"/>'),
    forward: icon('<path d="m9 18 6-6-6-6M4 12h11"/>'),
    close: icon('<path d="m6 6 12 12M18 6 6 18"/>'),
    logout: icon('<path d="M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>'),
    success: icon('<path d="m5 12 4 4L19 6"/>'),
    warning: icon('<path d="M12 9v4m0 3h.01"/><path d="m10.3 3.8-8 14A1.5 1.5 0 0 0 3.6 20h16.8a1.5 1.5 0 0 0 1.3-2.2l-8-14a1.9 1.9 0 0 0-3.4 0Z"/>'),
    error: icon('<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'),
    info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>'),
    document: icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>'),
    empty: icon('<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>'),
  });

  const STATUS_TONES = Object.freeze({ "Em Analise": "analysis", Descartada: "discarded", Aprovada: "approved", Faturado: "billed", Disputada: "disputed", Desclassificado: "rejected", Reprovada: "rejected" });

  const TOAST_CATALOG = Object.freeze([
    { tone: "success", messages: ["Login realizado.", "Base inicial restaurada.", "Orçamento vinculado ao edital.", "Edital salvo.", "Download do edital iniciado.", "Arquivo removido.", "Edital excluído da visualização. Os dados foram preservados.", "Item salvo.", "Item excluído.", "Documento salvo.", "Documento excluído.", "Falha salva.", "Falha excluída.", "Fornecedor salvo com sucesso.", "Produto do fornecedor salvo.", "Produto excluído.", "Orçamento criado. Cadastre o primeiro item.", "Orçamento salvo e vinculado ao edital.", "Orçamento salvo.", "Orçamento excluído da visualização. Os dados foram preservados.", "Item do orçamento cadastrado.", "Item do orçamento atualizado.", "Atribuições do analista atualizadas.", "Dados da empresa salvos.", "Configurações de Declarações salvas.", "Declaração adicionada à biblioteca.", "Declaração atualizada.", "Declaração excluída da biblioteca.", "Rascunho salvo.", "Proposta finalizada.", "Proposta Comercial criada.", "Valor Final atualizado no orçamento e registrado no histórico.", "PDF gerado e registrado no histórico.", "Download iniciado: {quantidade} item/itens.", "{nome do arquivo PDF} gerado e registrado no histórico."] },
    { tone: "success", messages: ["Item marcado como vencido.", "Marcação de item vencido removida."] },
    { tone: "warning", messages: ["Link removido. Salve o edital para confirmar.", "Selecione um edital para baixar os itens.", "Selecione um orçamento para baixar os itens.", "Selecione um edital.", "Selecione um item.", "Selecione um documento.", "Selecione uma falha.", "Este edital está faturado e disponível apenas para visualização.", "No modo local, gere novamente o PDF para baixá-lo."] },
    { tone: "danger", messages: ["Analista não encontrado na organização.", "Não foi possível concluir a operação. Tente novamente.", "{error.message}"] },
  ]);

  const DIALOG_CATALOG = Object.freeze([
    { id: "logoutConfirmModal", area: "Confirmação", title: "Deseja sair do sistema?", description: "Confirma o encerramento da sessão neste dispositivo.", actions: ["Cancelar", "Sair"] },
    { id: "bidQuotationModal", area: "Editais / orçamentos", title: "Localizar orçamento", description: "Filtrar por ID e órgão e escolher uma linha da tabela de resultados.", actions: ["Fechar", "Selecionar orçamento"] },
    { id: "quotationItemModal", area: "Editais / orçamentos", title: "Cadastrar item", description: "Descrição, modelo, marca, fornecedores, especificações e valores do item.", actions: ["Excluir item", "Limpar", "Cadastrar"] },
    { id: "quotationItemDiscardModal", area: "Confirmação", title: "Descartar alterações?", description: "Existem alterações não cadastradas neste item. Se sair agora, o conteúdo preenchido será perdido.", actions: ["Continuar editando", "Descartar alterações"] },
    { id: "userAssignmentsModal", area: "Usuários", title: "Configurar acessos", description: "Configuração do analista e lista de editais e orçamentos atribuíveis.", actions: ["Cancelar", "Salvar atribuições"] },
    { id: "supplierModal", area: "Fornecedores", title: "Novo fornecedor", description: "Nome, site, contato e tags de produtos.", actions: ["Cancelar", "Salvar fornecedor"] },
    { id: "supplierProductModal", area: "Fornecedores", title: "Cadastrar produto", description: "Produto, SKU, modelo, fabricante, tags, preço, cadastro e especificações técnicas.", actions: ["Excluir produto", "Limpar", "Cadastrar"] },
    { id: "declarationTemplateModal", area: "Declarações", title: "Nova declaração", description: "Biblioteca de declarações com escopo, edital opcional, título e conteúdo com variáveis.", actions: ["Excluir", "Cancelar", "Salvar declaração"] },
    { id: "declarationPreviewModal", area: "Declarações", title: "Conferir documento", description: "Pré-visualização do documento PDF A4.", actions: ["Voltar à edição", "Gerar PDF"] },
    { id: "declarationValidationModal", area: "Validação", title: "Não foi possível gerar a declaração", description: "Lista as informações usadas no documento que ainda não foram preenchidas.", actions: ["Entendi"] },
    { id: "deleteBidModal", area: "Confirmação", title: "Excluir edital?", description: "O edital deixará de aparecer no sistema, mas os dados permanecerão preservados.", actions: ["Cancelar", "Excluir Edital"] },
    { id: "deleteBidAttachmentModal", area: "Confirmação", title: "Remover arquivo?", description: "Deseja remover este arquivo do edital? Esta ação não poderá ser desfeita.", actions: ["Cancelar", "Remover arquivo"] },
    { id: "blockingLoadingModal", area: "Processamento", title: "Processando…", description: "Aguarde a conclusão da operação. Não feche nem atualize esta página.", actions: [] },
    { id: "newCommercialProposalDialog", area: "Propostas comerciais", title: "Nova Proposta Comercial", description: "Selecione um edital com orçamento vinculado. Se já houver proposta, ela será aberta para edição.", actions: ["Cancelar", "Criar proposta"] },
    { id: "commercialProposalPreviewDialog", area: "Propostas comerciais", title: "Proposta Comercial", description: "Pré-visualização do PDF da proposta.", actions: ["Fechar", "Baixar PDF"] },
    { id: "commercialCustomColumnDialog", area: "Propostas comerciais", title: "Coluna personalizada", description: "Reutilizar ou criar coluna, definir nome, largura e opção de reutilização.", actions: ["Cancelar", "Adicionar"] },
    { id: "commercialProposalDiscardDialog", area: "Confirmação", title: "Descartar alterações?", description: "Há alterações não salvas nesta proposta. Se você sair agora, elas serão perdidas.", actions: ["Continuar editando", "Descartar alterações"] },
  ]);

  const TOKENS = Object.freeze({
    colors: [
      ["ink", "--gll-ink", "Texto principal"],
      ["ink-soft", "--gll-ink-soft", "Texto auxiliar e metadados"],
      ["forest", "--gll-forest", "Navegação e ações principais"],
      ["forest-hover", "--gll-forest-hover", "Hover das ações principais"],
      ["accent", "--gll-accent", "Acento âmbar"],
      ["canvas", "--gll-canvas", "Fundo geral da aplicação"],
      ["paper", "--gll-paper", "Cards, tabelas e diálogos"],
      ["paper-muted", "--gll-paper-muted", "Superfícies secundárias"],
      ["line", "--gll-line", "Divisórias e bordas"],
      ["line-strong", "--gll-line-strong", "Contornos de controles"],
      ["success", "--gll-success", "Confirmações e estados positivos"],
      ["success-bg", "--gll-success-bg", "Superfície de sucesso"],
      ["warning", "--gll-warning", "Atenção e pendências"],
      ["warning-bg", "--gll-warning-bg", "Superfície de aviso"],
      ["danger", "--gll-danger", "Erros e ações destrutivas"],
      ["danger-bg", "--gll-danger-bg", "Superfície de erro"],
      ["info", "--gll-info", "Informação"],
      ["info-bg", "--gll-info-bg", "Superfície informativa"],
      ["selection", "--gll-selection-bg", "Seleção de navegação e opções"],
      ["focus", "--gll-focus", "Foco de teclado"],
    ],
    spacing: ["1", "2", "3", "4", "6", "8", "12"],
    radius: ["sm", "md", "lg"],
    shadows: ["sm", "md", "overlay"],
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function statusTone(status) {
    return STATUS_TONES[status] || "neutral";
  }

  function iconMarkup(nameOrGlyph) {
    return ICONS[nameOrGlyph] || `<span aria-hidden="true">${escapeHtml(nameOrGlyph)}</span>`;
  }

  function button({ label = "Ação", variant = "primary", disabled = false, loading = false, icon = "" } = {}) {
    const className = variant === "danger" ? "danger-action" : variant === "secondary" ? "quiet-action" : variant === "ghost" ? "text-action" : "primary-action";
    return `<button class="${className}" type="button"${disabled || loading ? " disabled" : ""}${loading ? ' aria-busy="true"' : ""}>${loading ? '<span class="ds-spinner" aria-hidden="true"></span>' : icon ? iconMarkup(icon) : ""}${escapeHtml(loading ? "Carregando…" : label)}</button>`;
  }

  function badge({ label = "Status", tone = "neutral" } = {}) {
    return `<span class="ds-badge ds-badge-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
  }

  function statusBadge({ status = "Em Analise", label = status } = {}) {
    const tone = statusTone(status);
    return `<span class="status-pill ${tone}">${escapeHtml(label)}</span>`;
  }

  function toast({ message = "Mensagem do sistema.", tone = "success", dismissible = true } = {}) {
    const iconName = tone === "danger" || tone === "error" ? "error" : tone === "warning" ? "warning" : tone === "info" ? "info" : "success";
    return `<div class="ds-toast ds-toast-${escapeHtml(tone)}" role="${tone === "danger" || tone === "error" ? "alert" : "status"}" aria-live="${tone === "danger" || tone === "error" ? "assertive" : "polite"}">${iconMarkup(iconName)}<span>${escapeHtml(message)}</span>${dismissible ? `<button class="ds-toast-close" type="button" aria-label="Fechar mensagem">${iconMarkup("close")}</button>` : ""}</div>`;
  }

  function tag({ label = "Tag", removable = false } = {}) {
    return `<span class="supplier-tag">${escapeHtml(label)}${removable ? `<button type="button" aria-label="Remover tag">${iconMarkup("close")}</button>` : ""}</span>`;
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
    return `<div class="empty-state ds-empty-state">${iconMarkup("empty")}<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>${action ? button({ label: action }) : ""}</div>`;
  }

  function loading({ label = "Carregando dados…" } = {}) {
    return `<div class="ds-loading" role="status"><span class="ds-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></div>`;
  }

  function skeleton() {
    return '<div class="ds-skeleton" aria-label="Conteúdo carregando"><span></span><span></span><span></span></div>';
  }

  function pageHeader({ eyebrow = "GESTÃO", title = "Título da página", description = "Descrição objetiva da área.", action = "Nova ação" } = {}) {
    return `<div class="page-heading"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action ? button({ label: action, icon: "add" }) : ""}</div>`;
  }

  function tabs() {
    return '<div class="tabs" role="tablist" aria-label="Exemplo de abas"><button class="tab active" type="button" role="tab" aria-selected="true">Visão geral</button><button class="tab" type="button" role="tab" aria-selected="false">Documentos</button><button class="tab" type="button" role="tab" aria-selected="false">Histórico</button></div>';
  }

  function table() {
    return '<div class="table-wrap"><table><thead><tr><th>Edital</th><th>Órgão</th><th>Status</th></tr></thead><tbody><tr><td>PE 014/2026</td><td>Prefeitura Municipal</td><td>' + badge({ label: "Em análise", tone: "warning" }) + '</td></tr><tr><td>PE 021/2026</td><td>Secretaria de Saúde</td><td>' + badge({ label: "Aprovada", tone: "success" }) + '</td></tr></tbody></table></div>';
  }

  let dialogPreviewSequence = 0;
  function dialogPreview({ title = "Confirmar alteração?", description = "Revise os dados antes de continuar.", size = "md", actions = ["Cancelar", "Confirmar"], destructive = false } = {}) {
    const titleId = `ds-dialog-title-${++dialogPreviewSequence}`;
    const actionMarkup = actions.map((label, index) => `<button class="${index === actions.length - 1 ? destructive ? "danger-action" : "primary-action" : "quiet-action"}" type="button">${escapeHtml(label)}</button>`).join("");
    return `<div class="ds-modal-preview"><article class="ds-modal-card ds-dialog-${escapeHtml(size)}" aria-labelledby="${titleId}"><span class="eyebrow">DIÁLOGO · ${escapeHtml(size.toUpperCase())}</span><h3 id="${titleId}">${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><div class="button-row end">${actionMarkup}</div></article></div>`;
  }

  const COMPONENTS = Object.freeze({ button, badge, statusBadge, toast, tag, formField, select, textarea, checkbox, radio, switchControl, card, alert, emptyState, loading, skeleton, pageHeader, tabs, table, modal: dialogPreview, dialogPreview });

  global.document?.querySelectorAll?.("[data-gll-icon]").forEach((element) => {
    element.innerHTML = iconMarkup(element.dataset.gllIcon);
  });

  function tokenValue(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function foundationsMarkup() {
    const colors = TOKENS.colors.map(([name, variable, usage]) => `<article class="ds-color-card"><span data-color="${name}" aria-hidden="true"></span><strong>${name}</strong><code>${variable}</code><small>${escapeHtml(tokenValue(variable))}</small><p>${escapeHtml(usage)}</p></article>`).join("");
    const spacing = TOKENS.spacing.map((name) => `<div class="ds-scale-row"><code>--gll-space-${name}</code><span data-space="${name}" aria-hidden="true"></span><small>${escapeHtml(tokenValue(`--gll-space-${name}`))}</small></div>`).join("");
    const radius = TOKENS.radius.map((name) => `<div class="ds-radius-sample" data-radius="${name}"><code>${name}</code></div>`).join("");
    const shadows = TOKENS.shadows.map((name) => `<div class="ds-shadow-sample" data-shadow="${name}"><code>shadow-${name}</code></div>`).join("");
    const icons = Object.entries(ICONS).map(([name, markup]) => `<div class="ds-icon-sample">${markup}<code>${name}</code></div>`).join("");
    return `
      <section class="ds-doc-section" id="ds-colors"><div class="ds-section-heading"><span class="eyebrow">FOUNDATIONS</span><h2>Cores</h2><p>Paleta semântica do GLL, igual à referência validada no protótipo.</p></div><div class="ds-color-grid">${colors}</div></section>
      <section class="ds-doc-section" id="ds-typography"><div class="ds-section-heading"><h2>Tipografia</h2><p>IBM Plex Sans, IBM Plex Serif e IBM Plex Mono. Texto principal de 16 px.</p></div><div class="ds-type-stack"><h1>Heading 1 · IBM Plex Serif</h1><h2>Heading 2 · IBM Plex Serif</h2><h3>Heading 3 · IBM Plex Serif</h3><p>Body · 16 px / line-height 1.5 — textos de interface e conteúdo.</p><label>Label · 13 px / semibold</label><small>Caption · 12 px — metadados e ajuda contextual.</small><code>Monospace · IBM Plex Mono</code></div></section>
      <section class="ds-doc-section" id="ds-spacing"><div class="ds-section-heading"><h2>Espaçamento</h2><p>Escala base de 4 px para composições previsíveis.</p></div><div class="ds-scale-list">${spacing}</div></section>
      <section class="ds-doc-section" id="ds-radius"><div class="ds-section-heading"><h2>Radius</h2></div><div class="ds-sample-grid">${radius}</div></section>
      <section class="ds-doc-section" id="ds-shadows"><div class="ds-section-heading"><h2>Sombras</h2></div><div class="ds-sample-grid">${shadows}</div></section>
      <section class="ds-doc-section" id="ds-icons"><div class="ds-section-heading"><h2>Ícones</h2><p>Coleção SVG central com tamanho e traço consistentes. Ícones decorativos usam <code>aria-hidden</code>.</p></div><div class="ds-icon-grid">${icons}</div></section>`;
  }

  function componentsMarkup() {
    return `
      <section class="ds-doc-section" id="ds-buttons"><div class="ds-section-heading"><span class="eyebrow">COMPONENTS</span><h2>Button e IconButton</h2></div><div class="ds-preview-row">${button({ label: "Primário" })}${button({ label: "Secundário", variant: "secondary" })}${button({ label: "Ghost", variant: "ghost" })}${button({ label: "Excluir", variant: "danger" })}${button({ label: "Desabilitado", disabled: true })}${button({ loading: true })}${button({ label: "Nova licitação", icon: "add" })}<button class="icon-button" type="button" aria-label="Configurações">${ICONS.settings}</button></div></section>
      <section class="ds-doc-section" id="ds-fields"><div class="ds-section-heading"><h2>Campos de formulário</h2></div><div class="ds-form-showcase">${formField({ id: "ds-name", label: "Órgão comprador", placeholder: "Pesquisar órgão…", helper: "Informe o nome oficial." })}${formField({ id: "ds-error", label: "Número do edital", value: "14/2026", error: "Já existe um edital com este número." })}${select({ id: "ds-select", label: "Status", options: ["Em análise", "Aprovada", "Descartada"] })}${textarea({ id: "ds-textarea", label: "Observações", helper: "Até 500 caracteres." })}</div><div class="ds-preview-row">${checkbox({ id: "ds-check", label: "Item ganho", checked: true })}${radio({ id: "ds-radio-1", label: "Pregão eletrônico", checked: true })}${radio({ id: "ds-radio-2", label: "Concorrência" })}${switchControl({ id: "ds-switch", label: "Notificações", checked: true })}</div></section>
      <section class="ds-doc-section" id="ds-status"><div class="ds-section-heading"><h2>Status do edital, Tag e Alert</h2><p>As seis situações usam um mapa central e mantêm o rótulo junto à cor.</p></div><div class="ds-preview-row">${["Em Analise", "Aprovada", "Descartada", "Faturado", "Disputada", "Desclassificado"].map((status) => statusBadge({ status, label: status === "Em Analise" ? "Em análise" : status })).join("")}${tag({ label: "papelaria" })}</div><div class="ds-stack">${alert({ title: "Informação", message: "Os dados foram atualizados.", tone: "info" })}${alert({ title: "Atenção", message: "Revise os campos pendentes.", tone: "warning" })}${alert({ title: "Erro", message: "Não foi possível salvar.", tone: "danger" })}</div></section>
      <section class="ds-doc-section" id="ds-toasts"><div class="ds-section-heading"><h2>Toast</h2><p>Mensagens curtas com tom semântico e leitura acessível.</p></div><div class="ds-toast-stack">${toast({ message: "Edital salvo.", tone: "success" })}${toast({ message: "Link removido. Salve o edital para confirmar.", tone: "warning" })}${toast({ message: "Não foi possível concluir a operação. Tente novamente.", tone: "danger" })}</div><details class="ds-copy-catalog"><summary>Catálogo de mensagens atuais</summary>${TOAST_CATALOG.map(({ tone, messages }) => `<div class="ds-copy-group"><strong>${escapeHtml(tone)}</strong><ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul></div>`).join("")}</details></section>
      <section class="ds-doc-section" id="ds-containers"><div class="ds-section-heading"><h2>Card, EmptyState, Loading e Skeleton</h2></div><div class="ds-sample-grid">${card({ title: "Próximas sessões", body: "Licitações ordenadas pela data da sessão.", action: "Ver todas" })}${emptyState({})}</div><div class="ds-preview-row">${loading({})}${skeleton()}</div></section>`;
  }

  function patternsMarkup() {
    return `
      <section class="ds-doc-section" id="ds-page-header"><div class="ds-section-heading"><span class="eyebrow">PATTERNS</span><h2>Page Header</h2></div><div class="ds-pattern-frame">${pageHeader({})}</div></section>
      <section class="ds-doc-section" id="ds-tabs"><div class="ds-section-heading"><h2>Tabs</h2></div>${tabs()}</section>
      <section class="ds-doc-section" id="ds-table"><div class="ds-section-heading"><h2>Tabela e status</h2></div>${table()}</section>
      <section class="ds-doc-section" id="ds-modal"><div class="ds-section-heading"><h2>Diálogos</h2><p>Escala de tamanhos e inventário dos diálogos nativos atuais.</p></div><div class="ds-dialog-examples">${dialogPreview({ title: "Excluir edital?", description: "O edital deixará de aparecer no sistema, mas seus dados permanecerão preservados.", size: "sm", actions: ["Cancelar", "Excluir Edital"], destructive: true })}${dialogPreview({ title: "Novo fornecedor", description: "Formulário com nome, site, contato e tags de produtos.", size: "md", actions: ["Cancelar", "Salvar fornecedor"] })}${dialogPreview({ title: "Conferir documento", description: "Pré-visualização do PDF antes de gerar.", size: "xl", actions: ["Voltar à edição", "Gerar PDF"] })}</div><details class="ds-copy-catalog"><summary>Inventário dos ${DIALOG_CATALOG.length} diálogos</summary><div class="ds-dialog-catalog">${DIALOG_CATALOG.map((item) => `<article><span>${escapeHtml(item.area)}</span><strong>${escapeHtml(item.title)}</strong><code>${escapeHtml(item.id)}</code><p>${escapeHtml(item.description)}</p><small>Ações: ${escapeHtml(item.actions.join(" · ") || "Sem ação; estado ocupado")}</small></article>`).join("")}</div></details></section>`;
  }

  function mountCatalog(container) {
    if (!container || container.dataset.mounted === "true") return;
    container.innerHTML = `<div class="ds-catalog-layout"><nav class="ds-catalog-nav" aria-label="Seções do Design System"><strong>Foundations</strong><a href="#ds-colors">Cores</a><a href="#ds-typography">Tipografia</a><a href="#ds-spacing">Espaçamento</a><a href="#ds-radius">Radius</a><a href="#ds-shadows">Sombras</a><a href="#ds-icons">Ícones</a><strong>Components</strong><a href="#ds-buttons">Botões</a><a href="#ds-fields">Formulários</a><a href="#ds-status">Status</a><a href="#ds-toasts">Toast</a><a href="#ds-containers">Containers</a><strong>Patterns</strong><a href="#ds-page-header">Page Header</a><a href="#ds-tabs">Tabs</a><a href="#ds-table">Tabelas</a><a href="#ds-modal">Diálogos</a></nav><div class="ds-catalog-content">${foundationsMarkup()}${componentsMarkup()}${patternsMarkup()}</div></div>`;
    container.dataset.mounted = "true";
  }

  global.GLLDesignSystem = Object.freeze({ ICONS, TOKENS, COMPONENTS, STATUS_TONES, TOAST_CATALOG, DIALOG_CATALOG, statusTone, iconMarkup, mountCatalog, foundationsMarkup, componentsMarkup, patternsMarkup });
})(window);
