const DEFAULT_ALERT_DAYS = 30;
const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const DOCUMENT_STATUS_FILTERS = Object.freeze([
  ["all", "Todas as situações"],
  ["valid", "Válidos"],
  ["near-expiry", "Próximos do vencimento"],
  ["due-today", "Vencendo hoje"],
  ["expired", "Vencidos"],
  ["no-expiry", "Sem vencimento"],
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const result = Date.UTC(year, month - 1, day);
  const parsed = new Date(result);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return result;
}

export function todayInSaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

export function daysUntilExpiration(expiresOn, today = todayInSaoPaulo()) {
  const expiry = parseDateOnly(expiresOn);
  const current = parseDateOnly(today);
  if (expiry === null || current === null) return null;
  return Math.round((expiry - current) / 86_400_000);
}

export function getDocumentStatus(document, alertDays = DEFAULT_ALERT_DAYS, today = todayInSaoPaulo()) {
  if (!document?.expiresOn) {
    return { key: "no-expiry", label: "Sem vencimento", daysRemaining: null };
  }

  const daysRemaining = daysUntilExpiration(document.expiresOn, today);
  if (daysRemaining === null) {
    return { key: "no-expiry", label: "Sem vencimento informado", daysRemaining: null };
  }
  if (daysRemaining < 0) {
    const daysLate = Math.abs(daysRemaining);
    return {
      key: "expired",
      label: "Vencido há " + daysLate + (daysLate === 1 ? " dia" : " dias"),
      daysRemaining,
    };
  }
  if (daysRemaining === 0) return { key: "due-today", label: "Vence hoje", daysRemaining };
  if (daysRemaining === 1) return { key: "near-expiry", label: "Vence amanhã", daysRemaining };
  if (daysRemaining <= Number(alertDays)) {
    return { key: "near-expiry", label: "Faltam " + daysRemaining + " dias para vencer", daysRemaining };
  }
  return { key: "valid", label: "Válido", daysRemaining };
}

export function countDocumentStatuses(documents, alertDays = DEFAULT_ALERT_DAYS, today = todayInSaoPaulo()) {
  const counts = { total: documents.length, valid: 0, nearExpiry: 0, expired: 0 };
  for (const document of documents) {
    const status = getDocumentStatus(document, alertDays, today);
    if (status.key === "valid" || status.key === "no-expiry") counts.valid += 1;
    if (status.key === "near-expiry" || status.key === "due-today") counts.nearExpiry += 1;
    if (status.key === "expired") counts.expired += 1;
  }
  return counts;
}

export function filterOrganizationDocuments(documents, options = {}) {
  const query = String(options.query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
  const today = options.today || todayInSaoPaulo();
  const alertDays = Number(options.alertDays ?? DEFAULT_ALERT_DAYS);
  const statusFilter = options.status || "all";
  const sortDirection = options.sortDirection === "desc" ? -1 : 1;

  return documents
    .map((document) => ({ document, status: getDocumentStatus(document, alertDays, today) }))
    .filter(({ document, status }) => {
      const matchesTitle = !query || String(document.title || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .includes(query);
      return matchesTitle && (statusFilter === "all" || status.key === statusFilter);
    })
    .sort((left, right) => {
      const leftExpiry = left.document.expiresOn || "";
      const rightExpiry = right.document.expiresOn || "";
      if (!leftExpiry && !rightExpiry) return String(left.document.title).localeCompare(String(right.document.title), "pt-BR");
      if (!leftExpiry) return 1;
      if (!rightExpiry) return -1;
      return leftExpiry.localeCompare(rightExpiry) * sortDirection;
    });
}

export function getDocumentSelectionState(documentIds, selectedDocumentIds) {
  const selected = selectedDocumentIds instanceof Set
    ? selectedDocumentIds
    : new Set(Array.from(selectedDocumentIds || [], String));
  const ids = Array.from(documentIds || [], String);
  const selectedCount = ids.filter((id) => selected.has(id)).length;
  return {
    selectedCount,
    checked: ids.length > 0 && selectedCount === ids.length,
    indeterminate: selectedCount > 0 && selectedCount < ids.length,
  };
}

export function updateDocumentSelection(selectedDocumentIds, documentIds, checked) {
  const selected = new Set(Array.from(selectedDocumentIds || [], String));
  for (const id of Array.from(documentIds || [], String)) {
    if (checked) selected.add(id);
    else selected.delete(id);
  }
  return selected;
}

export function reconcileDocumentSelection(selectedDocumentIds, documents) {
  const eligibleIds = new Set((documents || []).map((document) => String(document.id)));
  return new Set(Array.from(selectedDocumentIds || [], String).filter((id) => eligibleIds.has(id)));
}

export function validateDocumentFields({ mode, title, file, expiresOn, noExpiration }) {
  if (mode === "create" && !String(title || "").trim()) return "Informe o título do documento.";
  if ((mode === "create" || mode === "replace") && (!file || !Number(file.size))) return "Selecione um arquivo.";
  if (!noExpiration && parseDateOnly(expiresOn) === null) return "Informe uma data de validade ou marque “Sem vencimento”.";
  return "";
}

export function validateAlertDays(value, limits = {}) {
  if (value === "" || value === null || value === undefined) return "Informe a antecedência em dias.";
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return "Informe um número inteiro de dias.";
  const min = limits.min !== null && limits.min !== undefined && Number.isFinite(Number(limits.min)) ? Number(limits.min) : 0;
  const max = limits.max !== null && limits.max !== undefined && Number.isFinite(Number(limits.max)) ? Number(limits.max) : null;
  if (parsed < min) return "Informe pelo menos " + min + " dias.";
  if (max !== null && parsed > max) return "Informe no máximo " + max + " dias.";
  return "";
}

function formatDate(value) {
  if (!parseDateOnly(value)) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: BUSINESS_TIME_ZONE })
    .format(new Date(value + "T12:00:00-03:00"));
}

/**
 * Frontend contract for the Kit de Documentos data layer.
 *
 * @typedef {Object} OrganizationDocument
 * @property {string} id Stable document identity.
 * @property {string} title Display title.
 * @property {string} fileName Current file name.
 * @property {string|null} expiresOn Calendar date (YYYY-MM-DD), or null.
 * @property {number} [version] Current version for optimistic replacement.
 *
 * @typedef {Object} OrganizationDocumentSettings
 * @property {number} alertDays Saved notice lead time; defaults to 30.
 * @property {number} [minAlertDays] Inclusive lower bound accepted by the backend.
 * @property {number} [maxAlertDays] Inclusive upper bound accepted by the backend.
 *
 * @typedef {Object} OrganizationDocumentsGateway
 * @property {() => Promise<OrganizationDocument[]>} listDocuments
 * @property {() => Promise<OrganizationDocument[]>} listExpiringDocuments
 * @property {() => Promise<Array<Object>>} listNotifications
 * @property {() => Promise<OrganizationDocumentSettings>} getSettings
 * @property {(input: {title: string, file: File, expiresOn: string|null}) => Promise<OrganizationDocument>} createDocument
 * @property {(input: {documentId: string, expectedVersion?: number, file: File, expiresOn: string|null}) => Promise<OrganizationDocument>} replaceDocument
 * @property {(input: {documentId: string, expectedVersion?: number, expiresOn: string|null}) => Promise<OrganizationDocument>} updateValidity
 * @property {(input: {alertDays: number}) => Promise<OrganizationDocumentSettings>} saveAlertDays
 * @property {(input: {documentId: string}) => Promise<Blob>} downloadDocument
 * @property {(input: {documentIds: string[]}) => Promise<{blob: Blob, fileName: string}>} downloadDocumentsZip
 */
export function createOrganizationDocumentsFeature({
  getApi,
  isAdmin = () => false,
  canManageDocuments = () => true,
  onAlertsChanged = () => undefined,
  toast = () => undefined,
}) {
  const root = globalThis.document?.getElementById("organizationDocumentsRoot");
  const state = {
    loaded: false,
    loading: false,
    error: "",
    documents: [],
    selectedDocumentIds: new Set(),
    settings: { alertDays: DEFAULT_ALERT_DAYS },
    settingsFeedback: "",
    settingsFeedbackTone: "",
    query: "",
    status: "all",
    sortDirection: "asc",
    activeDocument: null,
    pendingReplacement: null,
    pendingFocusDocumentId: null,
    busy: "",
  };
  let bound = false;

  function api() {
    const value = getApi?.();
    if (!value) throw new Error("A integração do Kit de Documentos ainda não está disponível neste ambiente.");
    return value;
  }

  function canManageSettings() {
    return Boolean(isAdmin());
  }

  function notifyAlertsChanged() {
    Promise.resolve(onAlertsChanged()).catch(() => undefined);
  }

  function focusPendingDocument() {
    if (!state.pendingFocusDocumentId || !root) return;
    const row = [...root.querySelectorAll("[data-document-id]")]
      .find((candidate) => String(candidate.dataset.documentId) === String(state.pendingFocusDocumentId));
    if (!row) return;
    state.pendingFocusDocumentId = null;
    row.scrollIntoView?.({ behavior: "smooth", block: "center" });
    row.querySelector('[data-action="view"]')?.focus({ preventScroll: true });
  }

  function renderSettings() {
    const settings = state.settings || { alertDays: DEFAULT_ALERT_DAYS };
    const alertDays = settings.alertDays !== null && Number.isSafeInteger(Number(settings.alertDays)) ? Number(settings.alertDays) : DEFAULT_ALERT_DAYS;
    const min = settings.minAlertDays !== null && settings.minAlertDays !== undefined && Number.isFinite(Number(settings.minAlertDays)) ? ' min="' + escapeHtml(settings.minAlertDays) + '"' : "";
    const max = settings.maxAlertDays !== null && settings.maxAlertDays !== undefined && Number.isFinite(Number(settings.maxAlertDays)) ? ' max="' + escapeHtml(settings.maxAlertDays) + '"' : "";
    const disabled = !canManageSettings() || state.busy === "settings";
    return '<section class="section-band organization-documents-settings" aria-labelledby="organizationDocumentsSettingsTitle">'
      + '<div><span class="eyebrow">PREFERÊNCIAS DA ORGANIZAÇÃO</span><h2 id="organizationDocumentsSettingsTitle">Alertas de vencimento</h2>'
      + '<p>Defina com quantos dias de antecedência os documentos entram na lista de atenção.</p></div>'
      + '<form data-form="alert-settings" class="organization-documents-settings-form">'
      + '<label for="organizationDocumentsAlertDays">Antecedência do alerta</label>'
      + '<div class="organization-documents-settings-control"><div class="organization-documents-settings-days">'
      + '<input id="organizationDocumentsAlertDays" data-alert-days type="number" inputmode="numeric" step="1" value="' + escapeHtml(alertDays) + '"' + min + max + (disabled ? " disabled" : "") + ' aria-describedby="organizationDocumentsAlertHelp" />'
      + '<span>dias antes do vencimento</span></div>'
      + '<button class="quiet-action" type="submit"' + (disabled ? " disabled" : "") + (state.busy === "settings" ? ' aria-busy="true"' : "") + '>Salvar configuração</button></div>'
      + '<small id="organizationDocumentsAlertHelp">' + (canManageSettings() ? "Esta configuração vale para toda a organização." : "Somente usuários autorizados podem alterar esta configuração.") + '</small>'
      + (state.settingsFeedback ? '<p class="organization-documents-feedback" role="status" data-tone="' + escapeHtml(state.settingsFeedbackTone) + '">' + escapeHtml(state.settingsFeedback) + '</p>' : "")
      + '</form></section>';
  }

  function renderSummary() {
    const counts = countDocumentStatuses(state.documents, state.settings.alertDays);
    return '<div class="organization-documents-summary" aria-label="Resumo dos documentos">'
      + summaryCard("Total de documentos", counts.total, "total")
      + summaryCard("Documentos válidos", counts.valid, "valid")
      + summaryCard("Próximos do vencimento", counts.nearExpiry, "near")
      + summaryCard("Documentos vencidos", counts.expired, "expired")
      + '</div>';
  }

  function summaryCard(label, value, tone) {
    return '<article class="organization-documents-summary-card" data-tone="' + tone + '"><span>' + escapeHtml(label) + '</span><strong>' + value + '</strong></article>';
  }

  function renderFilters() {
    const statusOptions = DOCUMENT_STATUS_FILTERS.map(([key, label]) => '<option value="' + key + '"' + (state.status === key ? " selected" : "") + '>' + label + '</option>').join("");
    return '<div class="organization-documents-filters">'
      + '<label class="organization-documents-search"><span>Pesquisar por título</span><input type="search" data-search value="' + escapeHtml(state.query) + '" autocomplete="off" /></label>'
      + '<label><span>Filtrar por situação</span><select data-status-filter>' + statusOptions + '</select></label>'
      + '<label><span>Ordenar por vencimento</span><select data-sort-direction aria-label="Ordenar documentos por vencimento">'
      + '<option value="asc"' + (state.sortDirection === "asc" ? " selected" : "") + '>Mais próximo primeiro</option>'
      + '<option value="desc"' + (state.sortDirection === "desc" ? " selected" : "") + '>Mais distante primeiro</option></select></label>'
      + '</div>';
  }

  function renderList() {
    const filtered = getFilteredDocuments();
    const visibleIds = filtered.map(({ document }) => String(document.id));
    const selection = getDocumentSelectionState(visibleIds, state.selectedDocumentIds);
    const selectionActions = renderSelectionActions();
    const resultsLabel = filtered.length + (filtered.length === 1 ? " documento" : " documentos");
    const count = '<p class="organization-documents-results" role="status" aria-live="polite">' + resultsLabel + '</p>';
    if (!state.documents.length) {
      return selectionActions + count + renderEmptyState(
        "Nenhum documento cadastrado",
        "Cadastre os documentos da empresa para acompanhar as respectivas datas de validade.",
        canManageDocuments(),
      );
    }
    if (!filtered.length) {
      return selectionActions + count + renderEmptyState("Nenhum documento encontrado", "Altere a pesquisa ou o filtro de situação para ver outros documentos.");
    }
    const rows = filtered.map(({ document, status }) => renderDocumentRow(document, status)).join("");
    const selectAll = renderSelectionCheckbox({
      id: "organizationDocumentsSelectAll",
      label: "Selecionar todos",
      ariaLabel: "Selecionar todos os documentos exibidos",
      dataAttribute: "data-select-all",
      checked: selection.checked,
      disabled: state.busy === "bulk-download",
      hideLabel: true,
    });
    return selectionActions + count + '<div class="table-wrap organization-documents-table-wrap"><table class="organization-documents-table">'
      + '<caption class="sr-only">Documentos cadastrados pela organização</caption><thead><tr>'
      + '<th scope="col" class="organization-documents-selection-column">' + selectAll + '</th>'
      + '<th scope="col">Documento</th><th scope="col">Validade</th><th scope="col">Situação</th><th scope="col">Ações</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function getFilteredDocuments() {
    return filterOrganizationDocuments(state.documents, {
      query: state.query,
      status: state.status,
      sortDirection: state.sortDirection,
      alertDays: state.settings.alertDays,
    });
  }

  function renderSelectionCheckbox({ id, label, ariaLabel, dataAttribute, checked, disabled, hideLabel = false }) {
    const factory = globalThis.window?.GLLDesignSystem?.COMPONENTS?.checkbox;
    let checkbox = factory?.({ id, label, checked, disabled })
      || '<label class="check-line" for="' + escapeHtml(id) + '"><input id="' + escapeHtml(id) + '" type="checkbox"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + ' /><span>' + escapeHtml(label) + '</span></label>';
    checkbox = checkbox
      .replace('<label class="check-line"', '<label class="check-line organization-documents-selection-checkbox"')
      .replace('<input ', '<input ' + dataAttribute + ' aria-label="' + escapeHtml(ariaLabel) + '"');
    if (hideLabel) checkbox = checkbox.replace('<span>', '<span class="sr-only">');
    return checkbox;
  }

  function renderSelectionActions() {
    const count = state.selectedDocumentIds.size;
    if (!count) return "";
    const busy = state.busy === "bulk-download";
    const label = "Baixar selecionados (.zip)";
    const buttonFactory = globalThis.window?.GLLDesignSystem?.COMPONENTS?.button;
    let downloadButton = buttonFactory?.({ label, loading: busy })
      || '<button class="primary-action" type="button"' + (busy ? ' disabled aria-busy="true"' : '') + '>'
        + (busy ? "Preparando download…" : escapeHtml(label)) + '</button>';
    downloadButton = downloadButton.replace("<button ", '<button data-action="download-selected" ');
    if (busy) downloadButton = downloadButton.replace("Carregando…", "Preparando download…");
    let clearButton = buttonFactory?.({ label: "Limpar seleção", variant: "secondary", disabled: busy })
      || '<button class="quiet-action" type="button"' + (busy ? " disabled" : "") + '>Limpar seleção</button>';
    clearButton = clearButton.replace("<button ", '<button data-action="clear-selection" ');
    return '<div class="organization-documents-selection-actions" role="group" aria-label="Ações para documentos selecionados">'
      + '<p aria-live="polite">' + count + (count === 1 ? " documento selecionado" : " documentos selecionados") + '</p>'
      + '<div>' + clearButton + downloadButton + '</div></div>';
  }

  function renderDocumentRow(document, status) {
    const title = String(document.title || "Documento sem título");
    const fileName = String(document.fileName || "Arquivo sem nome");
    const documentId = escapeHtml(document.id);
    const manageActions = canManageDocuments()
      ? '<button class="quiet-action compact-action" type="button" data-action="replace" data-document-id="' + documentId + '" aria-label="Substituir documento ' + escapeHtml(title) + '">Substituir</button>'
        + '<button class="quiet-action compact-action" type="button" data-action="edit-validity" data-document-id="' + documentId + '" aria-label="Editar validade de ' + escapeHtml(title) + '">Editar validade</button>'
      : "";
    const selected = state.selectedDocumentIds.has(String(document.id));
    const selectionCheckbox = renderSelectionCheckbox({
      id: "organizationDocumentSelect-" + documentId,
      label: "Selecionar documento " + title,
      ariaLabel: "Selecionar documento " + title,
      dataAttribute: 'data-select-document="' + documentId + '"',
      checked: selected,
      disabled: state.busy === "bulk-download",
      hideLabel: true,
    });
    return '<tr data-document-id="' + documentId + '"><td class="organization-documents-selection-column">' + selectionCheckbox + '</td>'
      + '<th scope="row"><strong>' + escapeHtml(title) + '</strong><span class="organization-documents-file-name">' + escapeHtml(fileName) + '</span></th>'
      + '<td>' + (document.expiresOn ? escapeHtml(formatDate(document.expiresOn)) : "—") + '</td>'
      + '<td>' + renderStatusBadge(status) + '</td>'
      + '<td><div class="organization-documents-row-actions">'
      + '<button class="quiet-action compact-action" type="button" data-action="view" data-document-id="' + documentId + '" aria-label="Visualizar documento ' + escapeHtml(title) + '">Visualizar</button>'
      + '<button class="quiet-action compact-action" type="button" data-action="download" data-document-id="' + documentId + '" aria-label="Baixar documento ' + escapeHtml(title) + '">Baixar</button>'
      + manageActions + '</div></td></tr>';
  }

  function createActionButton(action, label, icon = "add") {
    const factory = globalThis.window?.GLLDesignSystem?.COMPONENTS?.button;
    const component = factory?.({ label, icon });
    if (component) return component.replace("<button ", '<button data-action="' + escapeHtml(action) + '" aria-haspopup="dialog" ');
    return '<button class="primary-action" type="button" data-action="' + escapeHtml(action) + '" aria-haspopup="dialog">' + escapeHtml(label) + '</button>';
  }

  function renderEmptyState(title, message, showCreateAction = false) {
    const factory = globalThis.window?.GLLDesignSystem?.COMPONENTS?.emptyState;
    const component = factory?.({ title, message, action: "" });
    if (component) {
      return component
        .replace('class="empty-state ds-empty-state"', 'class="empty-state ds-empty-state organization-documents-empty" role="status"')
        .replace("</div>", (showCreateAction ? createActionButton("create", "Cadastrar documento") : "") + "</div>");
    }
    return '<div class="empty-state organization-documents-empty" role="status"><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(message) + '</p>'
      + (showCreateAction ? createActionButton("create", "Cadastrar documento") : "") + '</div>';
  }

  function renderStatusBadge(status) {
    const tone = status.key === "valid" ? "success"
      : status.key === "near-expiry" ? "warning"
        : status.key === "expired" ? "danger" : "info";
    const semanticTone = status.key === "due-today" ? "danger" : tone;
    const factory = globalThis.window?.GLLDesignSystem?.COMPONENTS?.badge;
    const badge = factory?.({ label: status.label, tone: semanticTone });
    if (badge) return '<span class="organization-documents-status" data-status="' + escapeHtml(status.key) + '">' + badge + '</span>';
    return '<span class="ds-badge ds-badge-' + semanticTone + ' organization-documents-status" data-status="' + escapeHtml(status.key) + '">' + escapeHtml(status.label) + '</span>';
  }

  function renderLoading() {
    const factory = globalThis.window?.GLLDesignSystem?.COMPONENTS?.skeleton;
    const skeleton = factory?.() || '<div class="ds-skeleton" aria-label="Conteúdo carregando"><span></span><span></span><span></span></div>';
    return '<div class="organization-documents-loading" role="status" aria-busy="true" aria-label="Carregando documentos">'
      + '<div class="organization-documents-skeleton">' + skeleton + '</div>'
      + '<div class="organization-documents-skeleton">' + skeleton + '</div>'
      + '<div class="organization-documents-skeleton">' + skeleton + '</div></div>';
  }

  function renderError() {
    return '<div class="section-band organization-documents-error" role="alert"><strong>Não foi possível carregar os documentos.</strong>'
      + '<p>' + escapeHtml(state.error) + '</p><button class="quiet-action" type="button" data-action="retry">Tentar novamente</button></div>';
  }

  function renderDialogs() {
    return '<dialog class="organization-documents-dialog" data-dialog="create" aria-labelledby="organizationDocumentCreateTitle" aria-describedby="organizationDocumentCreateDescription">'
      + '<form data-form="create-document"><div class="organization-documents-dialog-heading"><h2 id="organizationDocumentCreateTitle">Cadastrar documento</h2>'
      + '<button class="icon-button modal-close-button" type="button" data-action="close-dialog" aria-label="Fechar cadastro">×</button></div>'
      + '<p id="organizationDocumentCreateDescription">Adicione o arquivo e informe sua validade.</p>'
      + '<label for="organizationDocumentTitle">Título do documento</label><input id="organizationDocumentTitle" data-field="title" required maxlength="160" autocomplete="off" />'
      + '<label for="organizationDocumentFile">Arquivo</label><input id="organizationDocumentFile" data-field="file" type="file" required aria-describedby="organizationDocumentFileHelp" />'
      + '<small id="organizationDocumentFileHelp">Os formatos e limites aceitos seguem a política de armazenamento da organização.</small>'
      + renderExpirationFields("organizationDocumentCreate")
      + '<p class="form-error organization-documents-form-error" data-form-error role="alert"></p>'
      + '<div class="button-row end"><button class="quiet-action" type="button" data-action="close-dialog">Cancelar</button><button class="primary-action" type="submit">Cadastrar</button></div></form></dialog>'
      + '<dialog class="organization-documents-dialog" data-dialog="replace" aria-labelledby="organizationDocumentReplaceTitle" aria-describedby="organizationDocumentReplaceDescription">'
      + '<form data-form="replace-document"><div class="organization-documents-dialog-heading"><h2 id="organizationDocumentReplaceTitle">Substituir documento</h2>'
      + '<button class="icon-button modal-close-button" type="button" data-action="close-dialog" aria-label="Fechar substituição">×</button></div>'
      + '<p id="organizationDocumentReplaceDescription">O título e a identidade deste cadastro serão mantidos.</p>'
      + '<p class="organization-documents-current-title"><strong data-replace-title></strong></p>'
      + '<label for="organizationDocumentReplacementFile">Novo arquivo</label><input id="organizationDocumentReplacementFile" data-field="file" type="file" required aria-describedby="organizationDocumentReplacementFileHelp" />'
      + '<small id="organizationDocumentReplacementFileHelp">O arquivo atual será substituído após sua confirmação.</small>'
      + renderExpirationFields("organizationDocumentReplace")
      + '<p class="form-error organization-documents-form-error" data-form-error role="alert"></p>'
      + '<div class="button-row end"><button class="quiet-action" type="button" data-action="close-dialog">Cancelar</button><button class="primary-action" type="submit">Continuar</button></div></form></dialog>'
      + '<dialog class="organization-documents-dialog" data-dialog="edit-validity" aria-labelledby="organizationDocumentEditTitle" aria-describedby="organizationDocumentEditDescription">'
      + '<form data-form="edit-validity"><div class="organization-documents-dialog-heading"><h2 id="organizationDocumentEditTitle">Editar validade</h2>'
      + '<button class="icon-button modal-close-button" type="button" data-action="close-dialog" aria-label="Fechar edição">×</button></div>'
      + '<p id="organizationDocumentEditDescription">Atualize a data sem substituir o arquivo.</p>'
      + '<p class="organization-documents-current-title"><strong data-edit-title></strong></p>'
      + renderExpirationFields("organizationDocumentEdit")
      + '<p class="form-error organization-documents-form-error" data-form-error role="alert"></p>'
      + '<div class="button-row end"><button class="quiet-action" type="button" data-action="close-dialog">Cancelar</button><button class="primary-action" type="submit">Salvar validade</button></div></form></dialog>'
      + '<dialog class="organization-documents-dialog organization-documents-confirm-dialog" data-dialog="replace-confirm" aria-labelledby="organizationDocumentConfirmTitle" aria-describedby="organizationDocumentConfirmDescription">'
      + '<div><h2 id="organizationDocumentConfirmTitle">Confirmar substituição</h2><p id="organizationDocumentConfirmDescription">O arquivo atual será substituído no mesmo cadastro. O título será preservado.</p>'
      + '<p><strong data-confirm-document-title></strong></p><p data-confirm-document-file></p><p data-confirm-document-expiry></p>'
      + '<p class="form-error organization-documents-form-error" data-form-error role="alert"></p>'
      + '<div class="button-row end"><button class="quiet-action" type="button" data-action="cancel-replacement">Cancelar</button><button class="primary-action" type="button" data-action="confirm-replacement">Confirmar substituição</button></div></div></dialog>';
  }

  function renderExpirationFields(prefix) {
    return '<div class="organization-documents-expiration-field"><label for="' + prefix + 'Expiry">Data de validade</label>'
      + '<input id="' + prefix + 'Expiry" data-field="expires-on" type="date" required />'
      + '<label class="organization-documents-no-expiry" for="' + prefix + 'NoExpiry"><input id="' + prefix + 'NoExpiry" data-field="no-expiration" type="checkbox" />Sem vencimento</label></div>';
  }

  function render() {
    if (!root) return;
    const heading = '<div class="page-heading organization-documents-heading"><div><span class="eyebrow">DOCUMENTOS</span>'
      + '<h1 id="organizationDocumentsTitle">Kit de Documentos</h1>'
      + '<p>Cadastre, consulte e acompanhe a validade dos documentos da empresa.</p></div>'
      + (canManageDocuments() ? createActionButton("create", "Cadastrar documento") : "")
      + '</div>';
    const settings = state.loaded ? renderSettings() : "";
    const body = state.loading ? renderLoading() : state.error ? renderError()
      : renderSummary() + '<section class="section-band organization-documents-list" aria-labelledby="organizationDocumentsListTitle">'
        + '<div class="organization-documents-list-heading"><div><h2 id="organizationDocumentsListTitle">Documentos cadastrados</h2>'
        + '<p>Consulte a validade e abra as ações de cada arquivo.</p></div></div>'
        + renderFilters() + '<div data-list-content>' + renderList() + '</div></section>';
    root.innerHTML = heading + settings + body + renderDialogs();
    syncSelectionControls();
  }

  function updateList() {
    if (!root || !state.loaded || state.loading || state.error) return;
    const summary = root.querySelector(".organization-documents-summary");
    if (summary) summary.outerHTML = renderSummary();
    const content = root.querySelector("[data-list-content]");
    if (content) content.innerHTML = renderList();
    syncSelectionControls();
  }

  function syncSelectionControls() {
    const selectAll = root?.querySelector("[data-select-all]");
    if (!selectAll) return;
    const visibleIds = getFilteredDocuments().map(({ document }) => String(document.id));
    selectAll.indeterminate = getDocumentSelectionState(visibleIds, state.selectedDocumentIds).indeterminate;
  }

  function openDialog(name) {
    const dialog = root?.querySelector('[data-dialog="' + name + '"]');
    if (dialog && !dialog.open) dialog.showModal();
    return dialog;
  }

  function closeDialog(name) {
    const dialog = root?.querySelector('[data-dialog="' + name + '"]');
    if (dialog?.open) dialog.close();
  }

  function setFormError(form, message) {
    const target = form?.querySelector("[data-form-error]");
    if (target) target.textContent = message || "";
    form?.querySelectorAll("[data-field]").forEach((field) => field.removeAttribute("aria-invalid"));
  }

  function reportDocumentValidationError(form, message) {
    setFormError(form, message);
    const field = message.includes("título") ? form?.querySelector('[data-field="title"]')
      : message.includes("arquivo") ? form?.querySelector('[data-field="file"]')
        : message.includes("data de validade") ? form?.querySelector('[data-field="expires-on"]') : null;
    field?.setAttribute("aria-invalid", "true");
    field?.focus();
  }

  function setButtonBusy(button, label, busy) {
    if (!button) return;
    if (busy) {
      button.dataset.idleLabel = button.textContent;
      button.textContent = label;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      return;
    }
    button.textContent = button.dataset.idleLabel || button.textContent;
    delete button.dataset.idleLabel;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }

  function readExpirationFields(form) {
    const noExpiration = Boolean(form.querySelector('[data-field="no-expiration"]')?.checked);
    return {
      noExpiration,
      expiresOn: noExpiration ? null : (form.querySelector('[data-field="expires-on"]')?.value || ""),
    };
  }

  function syncExpirationFields(form) {
    const toggle = form.querySelector('[data-field="no-expiration"]');
    const date = form.querySelector('[data-field="expires-on"]');
    if (!toggle || !date) return;
    date.disabled = toggle.checked;
    date.required = !toggle.checked;
    if (toggle.checked) date.value = "";
  }

  function openCreateDialog() {
    const dialog = openDialog("create");
    const form = dialog?.querySelector("form");
    form?.reset();
    if (form) {
      setFormError(form, "");
      syncExpirationFields(form);
    }
    dialog?.querySelector('[data-field="title"]')?.focus();
  }

  function openReplaceDialog(documentId) {
    const document = state.documents.find((row) => String(row.id) === String(documentId));
    if (!document) return;
    state.activeDocument = document;
    const dialog = openDialog("replace");
    const form = dialog?.querySelector("form");
    form?.reset();
    if (form) {
      setFormError(form, "");
      form.querySelector("[data-replace-title]").textContent = document.title;
      const expiry = form.querySelector('[data-field="expires-on"]');
      const noExpiration = form.querySelector('[data-field="no-expiration"]');
      if (expiry) expiry.value = document.expiresOn || "";
      if (noExpiration) noExpiration.checked = !document.expiresOn;
      syncExpirationFields(form);
    }
    dialog?.querySelector('[data-field="file"]')?.focus();
  }

  function openEditValidityDialog(documentId) {
    const document = state.documents.find((row) => String(row.id) === String(documentId));
    if (!document) return;
    state.activeDocument = document;
    const dialog = openDialog("edit-validity");
    const form = dialog?.querySelector("form");
    form?.reset();
    if (form) {
      setFormError(form, "");
      form.querySelector("[data-edit-title]").textContent = document.title;
      const expiry = form.querySelector('[data-field="expires-on"]');
      const noExpiration = form.querySelector('[data-field="no-expiration"]');
      if (expiry) expiry.value = document.expiresOn || "";
      if (noExpiration) noExpiration.checked = !document.expiresOn;
      syncExpirationFields(form);
    }
    dialog?.querySelector('[data-field="expires-on"]')?.focus();
  }

  async function load() {
    state.loading = true;
    state.error = "";
    state.loaded = false;
    render();
    try {
      const gateway = api();
      const [documents, settings] = await Promise.all([gateway.listDocuments(), gateway.getSettings()]);
      state.documents = Array.isArray(documents) ? documents : [];
      state.selectedDocumentIds = reconcileDocumentSelection(state.selectedDocumentIds, state.documents);
      state.settings = { alertDays: DEFAULT_ALERT_DAYS, ...(settings || {}) };
      state.loaded = true;
      state.loading = false;
      render();
      focusPendingDocument();
    } catch (error) {
      state.loading = false;
      state.loaded = false;
      state.error = error?.message || "Tente novamente em instantes.";
      render();
    }
  }

  async function refreshListAfterMutation(documentId = null, action = "create") {
    try {
      state.documents = await api().listDocuments();
      state.selectedDocumentIds = reconcileDocumentSelection(state.selectedDocumentIds, state.documents);
      updateList();
      notifyAlertsChanged();
      focusAfterMutation(documentId, action);
    } catch (error) {
      toast("A alteração foi salva, mas não foi possível atualizar a lista. " + (error?.message || ""), "error");
    }
  }

  function focusAfterMutation(documentId, action) {
    if (documentId !== null && documentId !== undefined) {
      const button = [...(root?.querySelectorAll('[data-action="' + action + '"]') || [])]
        .find((candidate) => String(candidate.dataset.documentId) === String(documentId));
      if (button) { button.focus(); return; }
    }
    root?.querySelector('[data-action="create"]')?.focus();
  }

  function documentFormData(form, mode) {
    const title = form.querySelector('[data-field="title"]')?.value.trim() || "";
    const file = form.querySelector('[data-field="file"]')?.files?.[0] || null;
    const { noExpiration, expiresOn } = readExpirationFields(form);
    const message = validateDocumentFields({ mode, title, file, expiresOn, noExpiration });
    if (message) {
      reportDocumentValidationError(form, message);
      return null;
    }
    return { title, file, expiresOn };
  }

  async function submitCreate(form) {
    const data = documentFormData(form, "create");
    if (!data) return;
    state.busy = "create";
    const submit = form.querySelector('[type="submit"]');
    setButtonBusy(submit, "Salvando…", true);
    setFormError(form, "");
    try {
      const document = await api().createDocument(data);
      state.documents = [document, ...state.documents.filter((row) => String(row.id) !== String(document.id))];
      closeDialog("create");
      state.busy = "";
      render();
      focusAfterMutation(null, "create");
      toast("Documento cadastrado com sucesso.", "success");
      void refreshListAfterMutation();
    } catch (error) {
      state.busy = "";
      setButtonBusy(submit, "", false);
      setFormError(form, error?.message || "Não foi possível cadastrar o documento.");
    }
  }

  async function submitReplacement(form) {
    const data = documentFormData(form, "replace");
    if (!data || !state.activeDocument) return;
    state.pendingReplacement = { ...data, documentId: state.activeDocument.id };
    closeDialog("replace");
    const confirmation = openDialog("replace-confirm");
    confirmation.querySelector("[data-confirm-document-title]").textContent = state.activeDocument.title;
    confirmation.querySelector("[data-confirm-document-file]").textContent = "Novo arquivo: " + data.file.name;
    confirmation.querySelector("[data-confirm-document-expiry]").textContent = data.expiresOn
      ? "Nova validade: " + formatDate(data.expiresOn)
      : "Validade: sem vencimento";
    setFormError(confirmation, "");
  }

  async function confirmReplacement(button) {
    const replacement = state.pendingReplacement;
    const current = state.documents.find((row) => String(row.id) === String(replacement?.documentId));
    if (!replacement || !current) return;
    state.busy = "replace";
    button.disabled = true;
    button.dataset.idleLabel = button.textContent;
    button.textContent = "Substituindo…";
    button.setAttribute("aria-busy", "true");
    const confirmation = button.closest("dialog");
    setFormError(confirmation, "");
    try {
      const saved = await api().replaceDocument({
        documentId: current.id,
        expectedVersion: current.version,
        file: replacement.file,
        expiresOn: replacement.expiresOn,
      });
      if (String(saved?.id) !== String(current.id)) throw new Error("A substituição retornou uma identidade diferente do cadastro original.");
      state.documents = state.documents.map((row) => String(row.id) === String(current.id) ? saved : row);
      state.pendingReplacement = null;
      state.activeDocument = null;
      state.busy = "";
      closeDialog("replace-confirm");
      render();
      focusAfterMutation(current.id, "replace");
      toast("Documento substituído com sucesso.", "success");
      void refreshListAfterMutation(current.id, "replace");
    } catch (error) {
      state.busy = "";
      setButtonBusy(button, "", false);
      setFormError(confirmation, error?.message || "Não foi possível substituir o documento.");
    }
  }

  async function submitValidity(form) {
    const { noExpiration, expiresOn } = readExpirationFields(form);
    const message = validateDocumentFields({ mode: "edit", expiresOn, noExpiration });
    if (message || !state.activeDocument) {
      reportDocumentValidationError(form, message || "Selecione um documento para editar.");
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    state.busy = "validity";
    setButtonBusy(submit, "Salvando…", true);
    setFormError(form, "");
    try {
      const current = state.activeDocument;
      const saved = await api().updateValidity({
        documentId: current.id,
        expectedVersion: current.version,
        expiresOn,
      });
      if (String(saved?.id) !== String(current.id)) throw new Error("A atualização retornou uma identidade diferente do cadastro original.");
      state.documents = state.documents.map((row) => String(row.id) === String(current.id) ? saved : row);
      state.activeDocument = null;
      state.busy = "";
      closeDialog("edit-validity");
      render();
      focusAfterMutation(current.id, "edit-validity");
      toast("Validade atualizada com sucesso.", "success");
      void refreshListAfterMutation(current.id, "edit-validity");
    } catch (error) {
      state.busy = "";
      setButtonBusy(submit, "", false);
      setFormError(form, error?.message || "Não foi possível atualizar a validade.");
    }
  }

  async function saveSettings(form) {
    if (!canManageSettings()) return;
    const input = form.querySelector("[data-alert-days]");
    const limits = { min: state.settings.minAlertDays, max: state.settings.maxAlertDays };
    const error = validateAlertDays(input?.value, limits);
    if (error) {
      input?.setAttribute("aria-invalid", "true");
      state.settingsFeedback = error;
      state.settingsFeedbackTone = "error";
      const feedback = form.querySelector(".organization-documents-feedback");
      if (feedback) { feedback.textContent = error; feedback.dataset.tone = "error"; }
      else { render(); root.querySelector("[data-alert-days]")?.setAttribute("aria-invalid", "true"); }
      return;
    }
    const alertDays = Number(input.value);
    state.busy = "settings";
    state.settingsFeedback = "";
    state.settingsFeedbackTone = "";
    const submit = form.querySelector('[type="submit"]');
    setButtonBusy(submit, "Salvando…", true);
    try {
      state.settings = { ...state.settings, ...(await api().saveAlertDays({ alertDays })) };
      state.settingsFeedback = "Configuração salva.";
      state.settingsFeedbackTone = "success";
      state.busy = "";
      render();
      updateList();
      notifyAlertsChanged();
      root.querySelector("[data-alert-days]")?.focus();
    } catch (error) {
      state.settingsFeedback = error?.message || "Não foi possível salvar a configuração.";
      state.settingsFeedbackTone = "error";
      state.busy = "";
      render();
      root.querySelector("[data-alert-days]")?.setAttribute("aria-invalid", "true");
      root.querySelector("[data-alert-days]")?.focus();
    }
  }

  async function downloadDocument(record, view = false) {
    const popup = view ? window.open("about:blank", "_blank") : null;
    if (view && !popup) {
      toast("Permita a abertura de novas guias para visualizar o arquivo.", "error");
      return;
    }
    if (popup) popup.opener = null;
    try {
      const blob = await api().downloadDocument({ documentId: record.id });
      const url = URL.createObjectURL(blob);
      if (view) {
        popup.location.replace(url);
      } else {
        const anchor = globalThis.document.createElement("a");
        anchor.href = url;
        anchor.download = record.fileName || "documento";
        anchor.rel = "noopener";
        globalThis.document.body.append(anchor);
        anchor.click();
        anchor.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      popup?.close();
      toast(error?.message || "Não foi possível abrir o arquivo.", "error");
    }
  }

  async function downloadSelectedDocuments() {
    if (state.busy === "bulk-download") return;
    const selectedDocuments = state.documents.filter((document) => state.selectedDocumentIds.has(String(document.id)));
    if (!selectedDocuments.length) {
      toast("Selecione pelo menos um documento para baixar.", "error");
      return;
    }

    state.busy = "bulk-download";
    updateList();
    try {
      const gateway = api();
      if (typeof gateway.downloadDocumentsZip !== "function") {
        throw new Error("O serviço de download ZIP ainda não está disponível.");
      }
      const result = await gateway.downloadDocumentsZip({
        documentIds: selectedDocuments.map((document) => String(document.id)),
      });
      if (!(result?.blob instanceof Blob) || result.blob.type.toLowerCase() !== "application/zip" ||
        !/^docs-.+\.zip$/u.test(String(result.fileName || ""))) {
        throw new Error("O serviço ZIP retornou um arquivo inválido.");
      }
      const url = URL.createObjectURL(result.blob);
      const anchor = globalThis.document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.rel = "noopener";
      globalThis.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast("Download de " + selectedDocuments.length + (selectedDocuments.length === 1 ? " documento iniciado." : " documentos iniciado."), "success");
    } catch (error) {
      toast(error?.message || "Não foi possível preparar o arquivo ZIP.", "error");
    } finally {
      state.busy = "";
      updateList();
    }
  }

  function bind() {
    if (!root || bound) return;
    bound = true;
    root.addEventListener("input", (event) => {
      if (event.target.matches("[data-search]")) {
        state.query = event.target.value;
        updateList();
      }
    });
    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-select-document]")) {
        state.selectedDocumentIds = updateDocumentSelection(
          state.selectedDocumentIds,
          [event.target.dataset.selectDocument],
          event.target.checked,
        );
        updateList();
      } else if (event.target.matches("[data-select-all]")) {
        state.selectedDocumentIds = updateDocumentSelection(
          state.selectedDocumentIds,
          getFilteredDocuments().map(({ document }) => document.id),
          event.target.checked,
        );
        updateList();
      } else if (event.target.matches("[data-status-filter]")) {
        state.status = event.target.value;
        updateList();
      } else if (event.target.matches("[data-sort-direction]")) {
        state.sortDirection = event.target.value;
        updateList();
      } else if (event.target.matches('[data-field="no-expiration"]')) {
        syncExpirationFields(event.target.form);
      }
    });
    root.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-form]");
      if (!form) return;
      event.preventDefault();
      if (form.dataset.form === "alert-settings") void saveSettings(form);
      if (form.dataset.form === "create-document") void submitCreate(form);
      if (form.dataset.form === "replace-document") void submitReplacement(form);
      if (form.dataset.form === "edit-validity") void submitValidity(form);
    });
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const documentRow = state.documents.find((row) => String(row.id) === String(button.dataset.documentId));
      switch (button.dataset.action) {
        case "create": if (canManageDocuments()) openCreateDialog(); break;
        case "retry": void load(); break;
        case "close-dialog": button.closest("dialog")?.close(); break;
        case "replace": if (documentRow && canManageDocuments()) openReplaceDialog(documentRow.id); break;
        case "edit-validity": if (documentRow && canManageDocuments()) openEditValidityDialog(documentRow.id); break;
        case "view": if (documentRow) void downloadDocument(documentRow, true); break;
        case "download": if (documentRow) void downloadDocument(documentRow); break;
        case "download-selected": void downloadSelectedDocuments(); break;
        case "clear-selection":
          if (state.busy !== "bulk-download") {
            state.selectedDocumentIds.clear();
            updateList();
          }
          break;
        case "cancel-replacement":
          state.pendingReplacement = null;
          closeDialog("replace-confirm");
          break;
        case "confirm-replacement": void confirmReplacement(button); break;
        default: break;
      }
    });
  }

  bind();
  return {
    showPage: () => load(),
    refresh: () => load(),
    focusDocument(documentId) {
      state.pendingFocusDocumentId = String(documentId || "");
      if (state.loaded) focusPendingDocument();
    },
    reset() {
      state.loaded = false;
      state.loading = false;
      state.error = "";
      state.documents = [];
      state.selectedDocumentIds.clear();
      state.settings = { alertDays: DEFAULT_ALERT_DAYS };
      state.settingsFeedback = "";
      state.settingsFeedbackTone = "";
      state.query = "";
      state.status = "all";
      state.sortDirection = "asc";
      state.activeDocument = null;
      state.pendingReplacement = null;
      state.pendingFocusDocumentId = null;
      state.busy = "";
      if (root) root.innerHTML = "";
    },
  };
}

if (typeof window !== "undefined") {
  window.GLLOrganizationDocuments = {
    createOrganizationDocumentsFeature,
    countDocumentStatuses,
    daysUntilExpiration,
    filterOrganizationDocuments,
    getDocumentSelectionState,
    getDocumentStatus,
    reconcileDocumentSelection,
    todayInSaoPaulo,
    updateDocumentSelection,
    validateAlertDays,
    validateDocumentFields,
  };
}
