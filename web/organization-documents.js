const DEFAULT_ALERT_DAYS = 30;
const MIN_ALERT_DAYS = 0;
const MAX_ALERT_DAYS = 120;
const ALERT_DAYS_MARKS = Object.freeze([0, 7, 15, 30, 60, 90, 120]);
const ALERT_DAYS_STEPS_PER_MARK = 100;
const ALERT_DAYS_SLIDER_MAX = (ALERT_DAYS_MARKS.length - 1) * ALERT_DAYS_STEPS_PER_MARK;
const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const DOCUMENT_STATUS_FILTERS = Object.freeze([
  ["all", "Todas as situações"],
  ["valid", "Válidos"],
  ["near-expiry", "Próximos do vencimento"],
  ["due-today", "Vencendo hoje"],
  ["expired", "Vencidos"],
  ["no-expiry", "Sem vencimento"],
]);

export function alertDaysPositionToValue(position) {
  const normalizedPosition = Number.isFinite(Number(position))
    ? Math.min(ALERT_DAYS_SLIDER_MAX, Math.max(0, Number(position)))
    : 0;
  const segment = Math.min(
    Math.floor(normalizedPosition / ALERT_DAYS_STEPS_PER_MARK),
    ALERT_DAYS_MARKS.length - 2,
  );
  const segmentPosition = normalizedPosition - segment * ALERT_DAYS_STEPS_PER_MARK;
  const progress = segmentPosition / ALERT_DAYS_STEPS_PER_MARK;
  const start = ALERT_DAYS_MARKS[segment];
  const end = ALERT_DAYS_MARKS[segment + 1];
  return Math.round(start + (end - start) * progress);
}

export function alertDaysValueToPosition(days) {
  const normalizedDays = Number.isFinite(Number(days))
    ? Math.min(MAX_ALERT_DAYS, Math.max(MIN_ALERT_DAYS, Number(days)))
    : MIN_ALERT_DAYS;
  const segment = Math.max(0, ALERT_DAYS_MARKS.findIndex((mark, index) => (
    index < ALERT_DAYS_MARKS.length - 1
    && normalizedDays >= mark
    && normalizedDays <= ALERT_DAYS_MARKS[index + 1]
  )));
  const start = ALERT_DAYS_MARKS[segment];
  const end = ALERT_DAYS_MARKS[segment + 1];
  const progress = (normalizedDays - start) / (end - start);
  return Math.round((segment + progress) * ALERT_DAYS_STEPS_PER_MARK);
}

function alertDaysLabel(days) {
  return days + (days === 1 ? " dia" : " dias");
}

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

export function validateDocumentFields({ mode, title, file, expiresOn, noExpiration, requiresFile = false }) {
  if ((mode === "create" || mode === "update") && !String(title || "").trim()) return "Informe o título do documento.";
  if ((mode === "create" || mode === "replace" || (mode === "update" && requiresFile))
    && (!file || !Number(file.size))) return "Selecione um arquivo.";
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
    alertDaysDraft: null,
    settingsFeedback: "",
    settingsFeedbackTone: "",
    query: "",
    status: "all",
    sortDirection: "asc",
    activeDocument: null,
    pendingFileRemoval: false,
    pendingDeletion: null,
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
    (row.querySelector('[data-action="edit-document"]') || row.querySelector('[data-select-document]'))?.focus({ preventScroll: true });
  }

  function renderSettings() {
    const settings = state.settings || { alertDays: DEFAULT_ALERT_DAYS };
    const savedAlertDays = settings.alertDays !== null && Number.isSafeInteger(Number(settings.alertDays)) ? Number(settings.alertDays) : DEFAULT_ALERT_DAYS;
    const hasDraft = Number.isSafeInteger(state.alertDaysDraft);
    const alertDays = hasDraft
      ? state.alertDaysDraft
      : Math.min(MAX_ALERT_DAYS, Math.max(MIN_ALERT_DAYS, savedAlertDays));
    const savedValueOutsideRange = savedAlertDays < MIN_ALERT_DAYS || savedAlertDays > MAX_ALERT_DAYS;
    const requiresRangeAdjustment = savedValueOutsideRange && !hasDraft;
    const sliderPosition = alertDaysValueToPosition(alertDays);
    const progress = (sliderPosition / ALERT_DAYS_SLIDER_MAX) * 100;
    const disabled = !canManageSettings() || state.busy === "settings";
    return '<section class="section-band organization-documents-settings" aria-labelledby="organizationDocumentsSettingsTitle">'
      + '<div class="organization-documents-settings-intro"><span class="eyebrow">PREFERÊNCIAS DA ORGANIZAÇÃO</span><h2 id="organizationDocumentsSettingsTitle">Alertas de vencimento</h2>'
      + '<p>Defina com quantos dias de antecedência os documentos entram na lista de atenção.</p></div>'
      + '<form data-form="alert-settings" class="organization-documents-settings-form">'
      + '<div class="organization-documents-alert-label"><label for="organizationDocumentsAlertDays">Antecedência do alerta</label>'
      + '<span class="organization-documents-alert-info" title="Quando faltarem esses dias, o documento entra na lista de atenção." aria-label="Quando faltarem esses dias, o documento entra na lista de atenção." role="img" tabindex="0">i</span></div>'
      + '<div class="organization-documents-settings-control"><div class="organization-documents-settings-days">'
      + '<output class="organization-documents-alert-value" for="organizationDocumentsAlertDays" aria-live="polite"><strong data-alert-days-value>' + escapeHtml(alertDays) + '</strong><span data-alert-days-unit>' + (alertDays === 1 ? "dia" : "dias") + '</span></output>'
      + '<input id="organizationDocumentsAlertDays" data-alert-days type="range" min="0" max="' + ALERT_DAYS_SLIDER_MAX + '" step="1" value="' + sliderPosition + '" style="--alert-days-progress: ' + progress + '%" aria-valuetext="' + escapeHtml(alertDaysLabel(alertDays) + " antes do vencimento") + '" aria-describedby="organizationDocumentsAlertHelper organizationDocumentsAlertHelp organizationDocumentsAlertScaleDescription"' + (disabled ? " disabled" : "") + ' />'
      + '<div class="organization-documents-alert-scale" aria-hidden="true">' + ALERT_DAYS_MARKS.map((mark, index) => (
        '<span' + (index === 0 ? ' class="is-start' : index === ALERT_DAYS_MARKS.length - 1 ? ' class="is-end' : ' class="')
        + (mark === alertDays ? ' is-selected' : '') + '" data-alert-days-mark="' + mark + '">' + mark + '</span>'
      )).join("") + '</div>'
      + (requiresRangeAdjustment ? '<p class="organization-documents-alert-range-note" data-alert-days-range-note role="status">Valor salvo atual: ' + escapeHtml(savedAlertDays) + ' dias. Ajuste o slider para escolher uma nova antecedência de até 120 dias.</p>' : '')
      + '<p class="organization-documents-alert-helper" id="organizationDocumentsAlertHelper">dias antes do vencimento</p>'
      + '</div><button class="primary-action" data-alert-days-save type="submit"' + ((disabled || requiresRangeAdjustment) ? " disabled" : "") + (state.busy === "settings" ? ' aria-busy="true"' : "") + '>Salvar configuração</button></div>'
      + '<small id="organizationDocumentsAlertHelp">Esta configuração vale para toda a organização.' + (canManageSettings() ? "" : " Somente usuários autorizados podem alterá-la.") + '</small>'
      + '<span id="organizationDocumentsAlertScaleDescription" class="sr-only">Referências da escala: 0, 7, 15, 30, 60, 90 e 120 dias.</span>'
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
    const canEditDocument = canManageDocuments();
    const canDeleteDocument = canEditDocument && isAdmin();
    const manageActions = (canEditDocument
      ? '<button class="quiet-action compact-action" type="button" data-action="edit-document" data-document-id="' + documentId + '" aria-label="Editar documento ' + escapeHtml(title) + '">Editar</button>'
      : "")
      + (canDeleteDocument
        ? '<button class="danger-action compact-action" type="button" data-action="delete-document" data-document-id="' + documentId + '" aria-label="Excluir documento ' + escapeHtml(title) + '">Excluir</button>'
        : "");
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
      + '<td><div class="organization-documents-row-actions">' + manageActions + '</div></td></tr>';
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
    return '<dialog class="organization-documents-dialog" data-dialog="document-form" aria-labelledby="organizationDocumentFormTitle" aria-describedby="organizationDocumentFormDescription">'
      + '<form data-form="document"><div class="organization-documents-dialog-heading"><h2 id="organizationDocumentFormTitle" data-form-title>Cadastrar documento</h2>'
      + '<button class="icon-button modal-close-button" type="button" data-action="close-dialog" aria-label="Fechar formulário">×</button></div>'
      + '<p id="organizationDocumentFormDescription" data-form-description>Adicione o arquivo e informe sua validade.</p>'
      + '<label for="organizationDocumentTitle">Título do documento</label><input id="organizationDocumentTitle" data-field="title" required maxlength="160" autocomplete="off" />'
      + '<label for="organizationDocumentFile">Arquivo</label>'
      + '<p class="organization-documents-current-title organization-documents-file-row" data-current-file hidden>'
      + '<span>Arquivo atual: <strong data-current-file-name></strong></span>'
      + '<button class="danger-action compact-action" type="button" data-action="remove-current-file">Excluir arquivo</button></p>'
      + '<p id="organizationDocumentFileRemovalNote" class="organization-documents-form-error" data-file-removal-note role="status" hidden>Ao salvar, selecione o arquivo substituto; o documento não ficará sem arquivo.</p>'
      + '<input id="organizationDocumentFile" data-field="file" type="file" required aria-describedby="organizationDocumentFileHelp organizationDocumentFileRemovalNote" />'
      + '<small id="organizationDocumentFileHelp">Os formatos e limites aceitos seguem a política de armazenamento da organização.</small>'
      + renderExpirationFields("organizationDocumentForm")
      + '<p class="form-error organization-documents-form-error" data-form-error role="alert"></p>'
      + '<div class="button-row end"><button class="quiet-action" type="button" data-action="close-dialog">Cancelar</button><button class="primary-action" data-form-submit type="submit">Cadastrar</button></div></form></dialog>'
      + '<dialog class="organization-documents-dialog organization-documents-confirm-dialog" data-dialog="delete-confirm" aria-labelledby="organizationDocumentDeleteTitle" aria-describedby="organizationDocumentDeleteDescription">'
      + '<div><h2 id="organizationDocumentDeleteTitle" data-confirm-title>Excluir documento?</h2><p id="organizationDocumentDeleteDescription" data-confirm-description>O documento deixará de aparecer no Kit de Documentos.</p>'
      + '<p class="organization-documents-current-title"><strong data-delete-document-title></strong></p>'
      + '<p class="form-error organization-documents-form-error" data-form-error role="alert"></p>'
      + '<div class="button-row end"><button class="quiet-action" type="button" data-action="cancel-delete">Cancelar</button><button class="danger-action" type="button" data-action="confirm-delete" data-confirm-label>Excluir</button></div></div></dialog>';
  }

  function renderExpirationFields(prefix) {
    return '<div class="organization-documents-expiration-field"><label for="' + prefix + 'Expiry">Data de validade</label>'
      + '<input id="' + prefix + 'Expiry" data-field="expires-on" type="date" required />'
      + '<label class="organization-documents-no-expiry" for="' + prefix + 'NoExpiry"><input id="' + prefix + 'NoExpiry" data-field="no-expiration" type="checkbox" />Sem vencimento</label></div>';
  }

  function render() {
    if (!root) return;
    const heading = '<div class="page-heading organization-documents-heading"><div>'
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
    if (name === "document-form") {
      state.activeDocument = null;
      state.pendingFileRemoval = false;
    }
    if (name === "delete-confirm") state.pendingDeletion = null;
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

  function syncDocumentFormMode(form) {
    if (!form) return;
    const editing = form.dataset.mode === "edit";
    const document = editing ? state.activeDocument : null;
    const fileInput = form.querySelector('[data-field="file"]');
    const currentFile = form.querySelector("[data-current-file]");
    const currentFileName = form.querySelector("[data-current-file-name]");
    const fileRemovalNote = form.querySelector("[data-file-removal-note]");
    const removeFileButton = form.querySelector('[data-action="remove-current-file"], [data-action="cancel-file-removal"]');
    const submit = form.querySelector("[data-form-submit]");
    form.querySelector("[data-form-title]").textContent = editing ? "Editar documento" : "Cadastrar documento";
    form.querySelector("[data-form-description]").textContent = editing
      ? "Atualize os dados do documento e, se necessário, substitua o arquivo."
      : "Adicione o arquivo e informe sua validade.";
    if (currentFileName) currentFileName.textContent = document?.fileName || "";
    if (currentFile) currentFile.hidden = !editing || !document?.fileName;
    if (fileRemovalNote) fileRemovalNote.hidden = !state.pendingFileRemoval;
    if (removeFileButton) {
      const removalRequested = state.pendingFileRemoval;
      removeFileButton.textContent = removalRequested ? "Manter arquivo atual" : "Excluir arquivo";
      removeFileButton.dataset.action = removalRequested ? "cancel-file-removal" : "remove-current-file";
      removeFileButton.classList.toggle("danger-action", !removalRequested);
      removeFileButton.classList.toggle("quiet-action", removalRequested);
    }
    if (fileInput) fileInput.required = !editing || !document?.fileName || state.pendingFileRemoval;
    if (submit) submit.textContent = editing ? "Salvar alterações" : "Cadastrar";
  }

  function openCreateDialog() {
    state.activeDocument = null;
    state.pendingDeletion = null;
    state.pendingFileRemoval = false;
    const dialog = openDialog("document-form");
    const form = dialog?.querySelector("form");
    form?.reset();
    if (form) {
      form.dataset.mode = "create";
      setFormError(form, "");
      syncExpirationFields(form);
      syncDocumentFormMode(form);
    }
    dialog?.querySelector('[data-field="title"]')?.focus();
  }

  function openEditDialog(documentId) {
    const document = state.documents.find((row) => String(row.id) === String(documentId));
    if (!document || !canManageDocuments()) return;
    state.activeDocument = document;
    state.pendingDeletion = null;
    state.pendingFileRemoval = false;
    const dialog = openDialog("document-form");
    const form = dialog?.querySelector("form");
    form?.reset();
    if (form) {
      form.dataset.mode = "edit";
      setFormError(form, "");
      form.querySelector('[data-field="title"]').value = document.title || "";
      const expiry = form.querySelector('[data-field="expires-on"]');
      const noExpiration = form.querySelector('[data-field="no-expiration"]');
      if (expiry) expiry.value = document.expiresOn || "";
      if (noExpiration) noExpiration.checked = !document.expiresOn;
      syncExpirationFields(form);
      syncDocumentFormMode(form);
    }
    dialog?.querySelector('[data-field="title"]')?.focus();
  }

  function openDeleteConfirmation(documentId) {
    const document = state.documents.find((row) => String(row.id) === String(documentId));
    if (!document || !isAdmin()) return;
    state.activeDocument = null;
    state.pendingFileRemoval = false;
    state.pendingDeletion = { action: "document", document };
    const dialog = openDialog("delete-confirm");
    const heading = dialog?.querySelector("[data-confirm-title]");
    const description = dialog?.querySelector("[data-confirm-description]");
    const confirmButton = dialog?.querySelector("[data-confirm-label]");
    if (heading) heading.textContent = "Excluir documento?";
    if (description) description.textContent = "O documento deixará de aparecer no Kit de Documentos.";
    const title = dialog?.querySelector("[data-delete-document-title]");
    if (title) title.textContent = document.title || "Documento sem título";
    if (confirmButton) confirmButton.textContent = "Excluir";
    setFormError(dialog, "");
    dialog?.querySelector('[data-action="cancel-delete"]')?.focus();
  }

  function openFileRemovalConfirmation() {
    if (!state.activeDocument?.fileName) return;
    state.pendingDeletion = { action: "file", document: state.activeDocument };
    const dialog = openDialog("delete-confirm");
    const heading = dialog?.querySelector("[data-confirm-title]");
    const description = dialog?.querySelector("[data-confirm-description]");
    const confirmButton = dialog?.querySelector("[data-confirm-label]");
    if (heading) heading.textContent = "Excluir arquivo atual?";
    if (description) description.textContent = "Selecione um novo arquivo e salve o cadastro para concluir a substituição.";
    const title = dialog?.querySelector("[data-delete-document-title]");
    if (title) title.textContent = state.activeDocument.fileName || "Arquivo atual";
    if (confirmButton) confirmButton.textContent = "Excluir arquivo";
    setFormError(dialog, "");
    dialog?.querySelector('[data-action="cancel-delete"]')?.focus();
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
      state.alertDaysDraft = null;
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

  async function refreshListAfterMutation(documentId = null, action = "create", shouldFocus = true) {
    try {
      state.documents = await api().listDocuments();
      state.selectedDocumentIds = reconcileDocumentSelection(state.selectedDocumentIds, state.documents);
      if (state.activeDocument) {
        state.activeDocument = state.documents.find((row) => String(row.id) === String(state.activeDocument.id)) || state.activeDocument;
      }
      updateList();
      notifyAlertsChanged();
      if (shouldFocus) focusAfterMutation(documentId, action);
    } catch (error) {
      toast(shouldFocus
        ? "A alteração foi salva, mas não foi possível atualizar a lista. " + (error?.message || "")
        : "Não foi possível atualizar a lista depois da falha. Recarregue a página para conferir o estado atual.", "error");
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

  function documentFormData(form, mode, requiresFile = false) {
    const title = form.querySelector('[data-field="title"]')?.value.trim() || "";
    const file = form.querySelector('[data-field="file"]')?.files?.[0] || null;
    const { noExpiration, expiresOn } = readExpirationFields(form);
    const message = validateDocumentFields({ mode, title, file, expiresOn, noExpiration, requiresFile });
    if (message) {
      reportDocumentValidationError(form, message);
      return null;
    }
    return { title, file, expiresOn };
  }

  async function submitDocument(form) {
    const editing = form.dataset.mode === "edit";
    const current = editing ? state.activeDocument : null;
    if (editing && !current) return;
    const data = documentFormData(form, editing ? "update" : "create", editing && (!current.fileName || state.pendingFileRemoval));
    if (!data) return;
    state.busy = editing ? "edit" : "create";
    const submit = form.querySelector('[type="submit"]');
    setButtonBusy(submit, "Salvando…", true);
    setFormError(form, "");
    try {
      let document;
      if (!editing) {
        document = await api().createDocument(data);
      } else {
        document = current;
        if (data.title !== current.title) {
          document = await api().updateDocument({ documentId: current.id, title: data.title });
        }
        if (data.file) {
          document = await api().replaceDocument({
            documentId: current.id,
            expectedVersion: current.version,
            file: data.file,
            expiresOn: data.expiresOn,
          });
        } else if (data.expiresOn !== current.expiresOn) {
          document = await api().updateValidity({ documentId: current.id, expiresOn: data.expiresOn });
        }
      }
      if (editing && String(document?.id) !== String(current.id)) {
        throw new Error("A atualização retornou uma identidade diferente do cadastro original.");
      }
      state.documents = editing
        ? state.documents.map((row) => String(row.id) === String(current.id) ? document : row)
        : [document, ...state.documents.filter((row) => String(row.id) !== String(document.id))];
      state.busy = "";
      state.pendingFileRemoval = false;
      closeDialog("document-form");
      render();
      focusAfterMutation(editing ? current.id : null, editing ? "edit-document" : "create");
      toast(editing ? "Documento atualizado com sucesso." : "Documento cadastrado com sucesso.", "success");
      void refreshListAfterMutation(editing ? current.id : null, editing ? "edit-document" : "create");
    } catch (error) {
      state.busy = "";
      setButtonBusy(submit, "", false);
      setFormError(form, error?.message || (editing ? "Não foi possível editar o documento." : "Não foi possível cadastrar o documento."));
      if (editing) await refreshListAfterMutation(current.id, "edit-document", false);
    }
  }

  async function confirmDeleteAction(button) {
    const pending = state.pendingDeletion;
    if (!pending) return;
    if (pending.action === "file") {
      state.pendingFileRemoval = true;
      closeDialog("delete-confirm");
      const form = root?.querySelector('[data-dialog="document-form"] form');
      syncDocumentFormMode(form);
      form?.querySelector('[data-field="file"]')?.focus();
      return;
    }
    const current = pending.document;
    if (!current || !isAdmin()) return;
    state.busy = "delete";
    setButtonBusy(button, "Excluindo…", true);
    const dialog = button.closest("dialog");
    setFormError(dialog, "");
    try {
      const archived = await api().archiveDocument({ documentId: current.id });
      if (String(archived?.id) !== String(current.id)) throw new Error("A exclusão retornou uma identidade diferente do cadastro original.");
      state.documents = state.documents.filter((row) => String(row.id) !== String(current.id));
      state.selectedDocumentIds.delete(String(current.id));
      state.busy = "";
      state.pendingDeletion = null;
      closeDialog("delete-confirm");
      render();
      focusAfterMutation(null, "create");
      toast("Documento excluído com sucesso.", "success");
      void refreshListAfterMutation();
    } catch (error) {
      state.busy = "";
      setButtonBusy(button, "", false);
      setFormError(dialog, error?.message || "Não foi possível excluir o documento.");
    }
  }

  async function saveSettings(form) {
    if (!canManageSettings()) return;
    const input = form.querySelector("[data-alert-days]");
    if (!input) return;
    const limits = { min: MIN_ALERT_DAYS, max: MAX_ALERT_DAYS };
    const alertDays = alertDaysPositionToValue(input.value);
    const error = validateAlertDays(alertDays, limits);
    if (error) {
      input?.setAttribute("aria-invalid", "true");
      state.settingsFeedback = error;
      state.settingsFeedbackTone = "error";
      const feedback = form.querySelector(".organization-documents-feedback");
      if (feedback) { feedback.textContent = error; feedback.dataset.tone = "error"; }
      else { render(); root.querySelector("[data-alert-days]")?.setAttribute("aria-invalid", "true"); }
      return;
    }
    state.busy = "settings";
    if (input) input.disabled = true;
    state.settingsFeedback = "";
    state.settingsFeedbackTone = "";
    const submit = form.querySelector('[type="submit"]');
    setButtonBusy(submit, "Salvando…", true);
    try {
      state.settings = { ...state.settings, ...(await api().saveAlertDays({ alertDays })) };
      state.alertDaysDraft = null;
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
    root.addEventListener("keydown", (event) => {
      if (!event.target.matches("[data-alert-days]")) return;
      const adjustment = event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
      if (!adjustment) return;
      event.preventDefault();
      const currentDays = alertDaysPositionToValue(event.target.value);
      const nextDays = Math.min(MAX_ALERT_DAYS, Math.max(MIN_ALERT_DAYS, currentDays + adjustment));
      event.target.value = String(alertDaysValueToPosition(nextDays));
      event.target.dispatchEvent(new Event("input", { bubbles: true }));
    });
    root.addEventListener("input", (event) => {
      if (event.target.matches("[data-search]")) {
        state.query = event.target.value;
        updateList();
      } else if (event.target.matches("[data-alert-days]")) {
        const sliderPosition = Number(event.target.value);
        const alertDays = alertDaysPositionToValue(sliderPosition);
        state.alertDaysDraft = alertDays;
        event.target.setAttribute("aria-valuetext", alertDaysLabel(alertDays) + " antes do vencimento");
        event.target.style.setProperty("--alert-days-progress", (sliderPosition / ALERT_DAYS_SLIDER_MAX) * 100 + "%");
        const value = root.querySelector("[data-alert-days-value]");
        if (value) value.textContent = String(alertDays);
        const unit = root.querySelector("[data-alert-days-unit]");
        if (unit) unit.textContent = alertDays === 1 ? "dia" : "dias";
        root.querySelectorAll("[data-alert-days-mark]").forEach((mark) => {
          mark.classList.toggle("is-selected", Number(mark.dataset.alertDaysMark) === alertDays);
        });
        root.querySelector("[data-alert-days-range-note]")?.remove();
        const saveButton = root.querySelector("[data-alert-days-save]");
        if (saveButton) saveButton.disabled = !canManageSettings() || state.busy === "settings";
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
      if (form.dataset.form === "document") void submitDocument(form);
    });
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const documentRow = state.documents.find((row) => String(row.id) === String(button.dataset.documentId));
      switch (button.dataset.action) {
        case "create": if (canManageDocuments()) openCreateDialog(); break;
        case "retry": void load(); break;
        case "close-dialog": closeDialog(button.closest("dialog")?.dataset.dialog); break;
        case "edit-document": if (documentRow && canManageDocuments()) openEditDialog(documentRow.id); break;
        case "delete-document": if (documentRow && isAdmin()) openDeleteConfirmation(documentRow.id); break;
        case "remove-current-file": openFileRemovalConfirmation(); break;
        case "cancel-file-removal":
          state.pendingFileRemoval = false;
          if (button.closest("form")) button.closest("form").querySelector('[data-field="file"]').value = "";
          syncDocumentFormMode(button.closest("form"));
          break;
        case "cancel-delete": closeDialog("delete-confirm"); break;
        case "confirm-delete": void confirmDeleteAction(button); break;
        case "download-selected": void downloadSelectedDocuments(); break;
        case "clear-selection":
          if (state.busy !== "bulk-download") {
            state.selectedDocumentIds.clear();
            updateList();
          }
          break;
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
      state.alertDaysDraft = null;
      state.settingsFeedback = "";
      state.settingsFeedbackTone = "";
      state.query = "";
      state.status = "all";
      state.sortDirection = "asc";
      state.activeDocument = null;
      state.pendingFileRemoval = false;
      state.pendingDeletion = null;
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
