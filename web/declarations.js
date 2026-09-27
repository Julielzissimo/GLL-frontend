const ASSET_BUCKET = "declaration-assets";
const PDF_BUCKET = "declaration-pdfs";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";

export const DECLARATION_VARIABLES = Object.freeze([
  { key: "razao_social", label: "Razão social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "endereco", label: "Endereço" },
  { key: "representante", label: "Representante legal" },
  { key: "cpf_representante", label: "CPF do representante" },
  { key: "enquadramento_empresa", label: "Enquadramento da empresa" },
  { key: "telefone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "cidade_empresa", label: "Cidade da empresa" },
  { key: "uf_empresa", label: "UF da empresa" },
  { key: "orgao", label: "Órgão público" },
  { key: "municipio_uf", label: "Município/UF do edital" },
  { key: "numero_edital", label: "Número do edital" },
  { key: "numero_processo", label: "Número do processo" },
  { key: "data", label: "Data" },
]);

const VARIABLE_BY_KEY = new Map(DECLARATION_VARIABLES.map((variable) => [variable.key, variable]));
const DEFAULT_INTRODUCTION = "A empresa {{razao_social}}, inscrita no CNPJ sob o nº {{cnpj}}, estabelecida à {{endereco}}, neste ato representada por seu responsável legal, {{representante}}, CPF nº {{cpf_representante}}, na condição de {{enquadramento_empresa}}, DECLARA que:";

export function sanitizePdfFileName(title) {
  const safe = String(title || "DECLARAÇÃO")
    .replace(/[<>:\"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${safe || "DECLARAÇÃO"}.pdf`;
}

export function formatDeclarationDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })
    .format(new Date(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00-03:00`));
}

export function resolveDeclarationVariables(text, values) {
  const missing = [];
  const output = String(text || "").replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (token, rawKey) => {
    const key = rawKey.toLowerCase();
    const value = String(values[key] ?? "").trim();
    if (!value) missing.push(key);
    return value || token;
  });
  return { output, missing: [...new Set(missing)] };
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function plainPreview(value, limit = 260) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit).trim()}…` : clean;
}

function assertResult(result) {
  if (result?.error) throw new Error(result.error.message || "Não foi possível acessar os dados de Declarações.");
  return result?.data;
}

function localKey(organizationId) {
  return `gll-declarations:${organizationId || "local"}`;
}

function readLocal(context) {
  try {
    return JSON.parse(localStorage.getItem(localKey(context.organizationId))) || {};
  } catch {
    return {};
  }
}

function writeLocal(context, data) {
  localStorage.setItem(localKey(context.organizationId), JSON.stringify(data));
}

function defaultSettings(context) {
  return {
    organization_id: context.organizationId,
    legal_name: context.organizationName || "",
    cnpj: context.organizationCnpj || "",
    address: "",
    company_city: "",
    company_state: "",
    legal_representative: "",
    representative_cpf: "",
    company_classification: "",
    phone: "",
    email: "",
    signature_city: "",
    signature_state: "",
    default_introduction: DEFAULT_INTRODUCTION,
    logo_path: null,
    watermark_path: null,
  };
}

function setImagePreview(element, url) {
  element.src = url || "";
  element.classList.toggle("hidden", !url);
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

async function urlAsDataUrl(url) {
  if (!url) return "";
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível carregar a identidade visual da organização.");
  return fileAsDataUrl(await response.blob());
}

function safeStorageName(value) {
  return String(value || "imagem")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "imagem";
}

export function createDeclarationsFeature({ getClient, getContext, getBids, navigate, toast, runBusy }) {
  const $ = (id) => document.getElementById(id);
  const state = {
    loaded: false,
    loading: null,
    settings: null,
    templates: [],
    history: [],
    bids: [],
    selectedIds: [],
    logoUrl: "",
    watermarkUrl: "",
    previewUrl: "",
    draggedId: null,
  };

  const refs = {};
  const ids = [
    "declarationLoading", "declarationGeneratorPanel", "declarationLibraryPanel", "declarationSettingsPanel", "declarationHistoryPanel",
    "declarationGeneratorForm", "declarationDocumentTitle", "declarationBid", "declarationAgency", "declarationMunicipality",
    "declarationEditalNumber", "declarationProcessNumber", "declarationDate", "declarationIntroduction", "declarationTemplatePicker",
    "declarationSelectedOrder", "declarationManualText", "declarationSaveManual", "declarationManualTitleField", "declarationManualTitle",
    "declarationSelectedCount", "declarationSummaryBid", "declarationGeneratorStatus", "previewDeclarationButton", "generateDeclarationButton",
    "declarationTemplateSearch", "declarationTemplateScopeFilter", "declarationTemplateList", "newDeclarationTemplateButton",
    "declarationSettingsForm", "declarationLegalName", "declarationCnpj", "declarationAddress", "declarationCompanyCity",
    "declarationCompanyState", "declarationRepresentative", "declarationRepresentativeCpf", "declarationClassification",
    "declarationPhone", "declarationEmail", "declarationSignatureCity", "declarationSignatureState", "declarationDefaultIntroduction",
    "declarationLogo", "declarationWatermark", "declarationLogoPreview", "declarationWatermarkPreview", "declarationSettingsStatus",
    "declarationHistoryList", "refreshDeclarationHistoryButton", "declarationTemplateModal", "declarationTemplateForm",
    "declarationTemplateModalTitle", "declarationTemplateId", "declarationTemplateTitle", "declarationTemplateScope",
    "declarationTemplateBidField", "declarationTemplateBid", "declarationTemplateContent", "declarationTemplateError",
    "deleteDeclarationTemplateButton", "closeDeclarationTemplateModalButton", "cancelDeclarationTemplateButton",
    "declarationPreviewModal", "declarationPreviewFrame", "closeDeclarationPreviewButton", "closeDeclarationPreviewFooterButton",
    "generateDeclarationFromPreviewButton", "declarationValidationModal", "declarationMissingVariables", "closeDeclarationValidationButton",
    "declarationVariableSuggestions", "goToDeclarationLibraryButton",
  ];
  for (const id of ids) refs[id] = $(id);

  function currentContext() {
    return getContext();
  }

  function client() {
    return getClient?.() || null;
  }

  async function loadAll(force = false) {
    if (state.loaded && !force) return;
    if (state.loading && !force) return state.loading;
    state.loading = (async () => {
      refs.declarationLoading.classList.remove("hidden");
      const context = currentContext();
      const supabase = client();
      if (supabase) {
        const [settingsResult, templatesResult, historyResult, bidsResult] = await Promise.all([
          supabase.from("declaration_settings").select("*").maybeSingle(),
          supabase.from("declaration_templates").select("*").order("title"),
          supabase.from("declaration_documents").select("*").order("generated_at", { ascending: false }),
          supabase.rpc("list_declaration_bids"),
        ]);
        state.settings = assertResult(settingsResult) || defaultSettings(context);
        state.templates = assertResult(templatesResult) || [];
        state.history = assertResult(historyResult) || [];
        state.bids = assertResult(bidsResult) || [];
        await loadAssetUrls();
      } else {
        const local = readLocal(context);
        state.settings = { ...defaultSettings(context), ...(local.settings || {}) };
        state.templates = local.templates || [];
        state.history = local.history || [];
        state.bids = getBids();
        state.logoUrl = state.settings.logo_data_url || "";
        state.watermarkUrl = state.settings.watermark_data_url || "";
      }
      state.loaded = true;
      refs.declarationLoading.classList.add("hidden");
      renderBids();
      fillSettings();
      resetGenerator(false);
      renderLibrary();
      renderHistory();
    })().finally(() => { state.loading = null; });
    return state.loading;
  }

  async function loadAssetUrls() {
    const supabase = client();
    state.logoUrl = "";
    state.watermarkUrl = "";
    for (const [pathKey, urlKey] of [["logo_path", "logoUrl"], ["watermark_path", "watermarkUrl"]]) {
      const path = state.settings?.[pathKey];
      if (!path) continue;
      const result = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(path, 3600);
      if (!result.error) state[urlKey] = result.data.signedUrl;
    }
  }

  function renderBids() {
    const bids = state.bids;
    const options = bids.map((bid) => `<option value="${escapeHtml(bid.id)}">${escapeHtml(bid.edital_number || bid.id)} · ${escapeHtml(bid.buyer_agency || "Órgão não informado")}</option>`).join("");
    refs.declarationBid.innerHTML = `<option value="">Declaração avulsa (sem edital)</option>${options}`;
    refs.declarationTemplateBid.innerHTML = `<option value="">Selecione um edital</option>${options}`;
  }

  function fillSettings() {
    const config = state.settings || defaultSettings(currentContext());
    const mapping = {
      declarationLegalName: "legal_name", declarationCnpj: "cnpj", declarationAddress: "address",
      declarationCompanyCity: "company_city", declarationCompanyState: "company_state",
      declarationRepresentative: "legal_representative", declarationRepresentativeCpf: "representative_cpf",
      declarationClassification: "company_classification", declarationPhone: "phone", declarationEmail: "email",
      declarationSignatureCity: "signature_city", declarationSignatureState: "signature_state",
      declarationDefaultIntroduction: "default_introduction",
    };
    for (const [id, key] of Object.entries(mapping)) refs[id].value = config[key] || "";
    setImagePreview(refs.declarationLogoPreview, state.logoUrl);
    setImagePreview(refs.declarationWatermarkPreview, state.watermarkUrl);
  }

  function readSettingsForm() {
    return {
      organization_id: currentContext().organizationId,
      legal_name: refs.declarationLegalName.value.trim(), cnpj: refs.declarationCnpj.value.trim(),
      address: refs.declarationAddress.value.trim(), company_city: refs.declarationCompanyCity.value.trim(),
      company_state: refs.declarationCompanyState.value.trim().toUpperCase(),
      legal_representative: refs.declarationRepresentative.value.trim(),
      representative_cpf: refs.declarationRepresentativeCpf.value.trim(),
      company_classification: refs.declarationClassification.value.trim(), phone: refs.declarationPhone.value.trim(),
      email: refs.declarationEmail.value.trim(), signature_city: refs.declarationSignatureCity.value.trim(),
      signature_state: refs.declarationSignatureState.value.trim().toUpperCase(),
      default_introduction: refs.declarationDefaultIntroduction.value.trim(),
      logo_path: state.settings?.logo_path || null, watermark_path: state.settings?.watermark_path || null,
    };
  }

  async function uploadAsset(file, kind) {
    if (!file) return state.settings?.[`${kind}_path`] || null;
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE) throw new Error("Use uma imagem PNG, JPG ou WebP de até 5 MB.");
    const supabase = client();
    if (!supabase) return fileAsDataUrl(file);
    const path = `${currentContext().organizationId}/${kind}-${Date.now()}-${safeStorageName(file.name)}`;
    assertResult(await supabase.storage.from(ASSET_BUCKET).upload(path, file, { contentType: file.type, upsert: false }));
    return path;
  }

  async function saveSettings(event) {
    event?.preventDefault();
    refs.declarationSettingsStatus.textContent = "";
    const supabase = client();
    const data = readSettingsForm();
    if (supabase) {
      data.logo_path = await uploadAsset(refs.declarationLogo.files[0], "logo");
      data.watermark_path = await uploadAsset(refs.declarationWatermark.files[0], "watermark");
      assertResult(await supabase.from("declaration_settings").upsert(data, { onConflict: "organization_id" }).select().single());
    } else {
      const logoFile = refs.declarationLogo.files[0];
      const watermarkFile = refs.declarationWatermark.files[0];
      data.logo_data_url = logoFile ? await fileAsDataUrl(logoFile) : state.settings?.logo_data_url || "";
      data.watermark_data_url = watermarkFile ? await fileAsDataUrl(watermarkFile) : state.settings?.watermark_data_url || "";
      const local = readLocal(currentContext());
      writeLocal(currentContext(), { ...local, settings: data });
    }
    state.settings = data;
    await loadAssetUrlsIfNeeded();
    refs.declarationLogo.value = "";
    refs.declarationWatermark.value = "";
    refs.declarationSettingsStatus.textContent = "Configurações salvas para a organização.";
    resetGenerator(false);
    toast("Configurações de Declarações salvas.");
  }

  async function loadAssetUrlsIfNeeded() {
    if (client()) await loadAssetUrls();
    else {
      state.logoUrl = state.settings.logo_data_url || "";
      state.watermarkUrl = state.settings.watermark_data_url || "";
    }
    setImagePreview(refs.declarationLogoPreview, state.logoUrl);
    setImagePreview(refs.declarationWatermarkPreview, state.watermarkUrl);
  }

  function resetGenerator(clearSelection = true) {
    if (clearSelection) state.selectedIds = [];
    refs.declarationDocumentTitle.value = "DECLARAÇÃO UNIFICADA";
    refs.declarationBid.value = "";
    refs.declarationAgency.value = "";
    refs.declarationMunicipality.value = "";
    refs.declarationEditalNumber.value = "";
    refs.declarationProcessNumber.value = "";
    refs.declarationDate.value = todayInSaoPaulo();
    refs.declarationIntroduction.value = state.settings?.default_introduction || DEFAULT_INTRODUCTION;
    refs.declarationManualText.value = "";
    refs.declarationSaveManual.checked = false;
    refs.declarationManualTitle.value = "";
    refs.declarationManualTitleField.classList.add("hidden");
    refs.declarationGeneratorStatus.textContent = "";
    renderPicker();
    renderOrder();
    updateSummary();
  }

  function availableTemplates() {
    const bidId = refs.declarationBid.value;
    return state.templates.filter((template) => !template.bid_id || (bidId && template.bid_id === bidId));
  }

  function renderPicker() {
    const available = availableTemplates();
    state.selectedIds = state.selectedIds.filter((id) => available.some((template) => template.id === id));
    refs.declarationTemplatePicker.innerHTML = available.length ? available.map((template) => `
      <label class="declaration-pick-card ${state.selectedIds.includes(template.id) ? "selected" : ""}">
        <input type="checkbox" value="${escapeHtml(template.id)}" ${state.selectedIds.includes(template.id) ? "checked" : ""} />
        <span><strong>${escapeHtml(template.title)}</strong><small>${template.bid_id ? "Exclusiva deste edital" : "Biblioteca da organização"}</small><em>${escapeHtml(plainPreview(template.content, 150))}</em></span>
      </label>`).join("") : `<div class="empty-state compact-empty">Nenhuma declaração disponível. Cadastre textos na Biblioteca.</div>`;
  }

  function handlePickerChange(event) {
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (!checkbox) return;
    if (checkbox.checked && !state.selectedIds.includes(checkbox.value)) state.selectedIds.push(checkbox.value);
    if (!checkbox.checked) state.selectedIds = state.selectedIds.filter((id) => id !== checkbox.value);
    renderPicker();
    renderOrder();
    updateSummary();
  }

  function selectedTemplates() {
    return state.selectedIds.map((id) => state.templates.find((template) => template.id === id)).filter(Boolean);
  }

  function renderOrder() {
    const selected = selectedTemplates();
    refs.declarationSelectedOrder.innerHTML = selected.length ? selected.map((template, index) => `
      <li draggable="true" data-template-id="${escapeHtml(template.id)}"><span class="declaration-drag" aria-hidden="true">⠿</span><strong><span>${index + 1}.</span> ${escapeHtml(template.title)}</strong><span class="declaration-order-actions"><button type="button" data-move="up" aria-label="Mover para cima" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move="down" aria-label="Mover para baixo" ${index === selected.length - 1 ? "disabled" : ""}>↓</button></span></li>`).join("") : `<li class="empty-state compact-empty">Selecione uma ou mais declarações acima.</li>`;
  }

  function moveTemplate(id, direction) {
    const index = state.selectedIds.indexOf(id);
    const next = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= state.selectedIds.length) return;
    [state.selectedIds[index], state.selectedIds[next]] = [state.selectedIds[next], state.selectedIds[index]];
    renderOrder();
  }

  function updateSummary() {
    refs.declarationSelectedCount.textContent = String(state.selectedIds.length);
    const bid = state.bids.find((row) => row.id === refs.declarationBid.value);
    refs.declarationSummaryBid.textContent = bid ? String(bid.edital_number || bid.id) : "Avulsa";
  }

  function handleBidChange() {
    const bid = state.bids.find((row) => row.id === refs.declarationBid.value);
    refs.declarationAgency.value = bid?.buyer_agency || "";
    refs.declarationMunicipality.value = bid?.delivery_place || "";
    refs.declarationEditalNumber.value = bid?.edital_number || "";
    refs.declarationProcessNumber.value = bid?.process_number || "";
    renderPicker();
    renderOrder();
    updateSummary();
  }

  function renderLibrary() {
    const search = refs.declarationTemplateSearch.value.trim().toLocaleLowerCase("pt-BR");
    const scope = refs.declarationTemplateScopeFilter.value;
    const rows = state.templates.filter((template) => {
      const matchesSearch = !search || `${template.title} ${template.content}`.toLocaleLowerCase("pt-BR").includes(search);
      const matchesScope = !scope || (scope === "bid" ? Boolean(template.bid_id) : !template.bid_id);
      return matchesSearch && matchesScope;
    });
    refs.declarationTemplateList.innerHTML = rows.length ? rows.map((template) => {
      const bid = state.bids.find((row) => row.id === template.bid_id);
      return `<article class="section-band declaration-library-card"><div><span class="status-pill">${template.bid_id ? `Edital ${escapeHtml(bid?.edital_number || template.bid_id)}` : "Organização"}</span><h3>${escapeHtml(template.title)}</h3><p>${escapeHtml(plainPreview(template.content))}</p></div><button class="quiet-action" type="button" data-edit-template="${escapeHtml(template.id)}">Editar</button></article>`;
    }).join("") : `<div class="section-band empty-state">Nenhuma declaração encontrada.</div>`;
  }

  function openTemplateModal(template = null) {
    refs.declarationTemplateForm.reset();
    refs.declarationTemplateId.value = template?.id || "";
    refs.declarationTemplateModalTitle.textContent = template ? "Editar declaração" : "Nova declaração";
    refs.declarationTemplateTitle.value = template?.title || "";
    refs.declarationTemplateScope.value = template?.bid_id ? "bid" : "organization";
    refs.declarationTemplateBid.value = template?.bid_id || "";
    refs.declarationTemplateContent.value = template?.content || "";
    refs.deleteDeclarationTemplateButton.classList.toggle("hidden", !template);
    refs.declarationTemplateError.textContent = "";
    updateTemplateScope();
    refs.declarationTemplateModal.showModal();
    refs.declarationTemplateTitle.focus();
  }

  function closeTemplateModal() {
    refs.declarationTemplateModal.close();
    hideVariableSuggestions();
  }

  function updateTemplateScope() {
    const specific = refs.declarationTemplateScope.value === "bid";
    refs.declarationTemplateBidField.classList.toggle("hidden", !specific);
    refs.declarationTemplateBid.required = specific;
  }

  async function saveTemplate(event) {
    event.preventDefault();
    refs.declarationTemplateError.textContent = "";
    const id = refs.declarationTemplateId.value;
    const record = {
      organization_id: currentContext().organizationId,
      bid_id: refs.declarationTemplateScope.value === "bid" ? refs.declarationTemplateBid.value : null,
      title: refs.declarationTemplateTitle.value.trim(), content: refs.declarationTemplateContent.value.trim(),
      created_by: currentContext().userAuthId,
    };
    if (!record.title || !record.content || (refs.declarationTemplateScope.value === "bid" && !record.bid_id)) {
      refs.declarationTemplateError.textContent = "Preencha título, conteúdo e o edital quando o escopo for específico.";
      return;
    }
    const supabase = client();
    if (supabase) {
      if (id) {
        const update = { bid_id: record.bid_id, title: record.title, content: record.content };
        assertResult(await supabase.from("declaration_templates").update(update).eq("id", id).select().single());
      } else {
        assertResult(await supabase.from("declaration_templates").insert(record).select().single());
      }
      await refreshTemplates();
    } else {
      const now = new Date().toISOString();
      if (id) state.templates = state.templates.map((row) => row.id === id ? { ...row, ...record, updated_at: now } : row);
      else state.templates.push({ ...record, id: crypto.randomUUID(), created_at: now, updated_at: now });
      persistLocal();
    }
    closeTemplateModal();
    renderLibrary();
    renderPicker();
    renderOrder();
    toast(id ? "Declaração atualizada." : "Declaração adicionada à biblioteca.");
  }

  async function refreshTemplates() {
    if (!client()) return;
    state.templates = assertResult(await client().from("declaration_templates").select("*").order("title")) || [];
  }

  async function deleteTemplate() {
    const id = refs.declarationTemplateId.value;
    if (!id || !confirm("Excluir esta declaração da biblioteca? PDFs já gerados não serão alterados.")) return;
    if (client()) assertResult(await client().from("declaration_templates").delete().eq("id", id));
    else { state.templates = state.templates.filter((row) => row.id !== id); persistLocal(); }
    state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id);
    closeTemplateModal();
    renderLibrary(); renderPicker(); renderOrder(); updateSummary();
    toast("Declaração excluída da biblioteca.");
  }

  function persistLocal() {
    const local = readLocal(currentContext());
    writeLocal(currentContext(), { ...local, settings: state.settings, templates: state.templates, history: state.history });
  }

  function variableValues() {
    const config = state.settings || {};
    return {
      razao_social: config.legal_name, cnpj: config.cnpj, endereco: config.address,
      representante: config.legal_representative, cpf_representante: config.representative_cpf,
      enquadramento_empresa: config.company_classification, telefone: config.phone, email: config.email,
      cidade_empresa: config.company_city, uf_empresa: config.company_state,
      orgao: refs.declarationAgency.value, municipio_uf: refs.declarationMunicipality.value,
      numero_edital: refs.declarationEditalNumber.value, numero_processo: refs.declarationProcessNumber.value,
      data: formatDeclarationDate(refs.declarationDate.value),
    };
  }

  function composeDocument() {
    const title = refs.declarationDocumentTitle.value.trim();
    if (!title) throw new Error("Informe o título do documento.");
    const values = variableValues();
    const pieces = [refs.declarationIntroduction.value, ...selectedTemplates().map((template) => template.content), refs.declarationManualText.value];
    const missingKeys = [];
    for (const piece of pieces) missingKeys.push(...resolveDeclarationVariables(piece, values).missing);
    const missing = [...new Set(missingKeys)].map((key) => VARIABLE_BY_KEY.get(key)?.label || `Variável {{${key}}}`);
    if (missing.length) return { missing };
    const resolve = (text) => resolveDeclarationVariables(text, values).output;
    return {
      missing: [], title, fileName: sanitizePdfFileName(title), values,
      introduction: resolve(refs.declarationIntroduction.value),
      declarations: selectedTemplates().map((template) => ({ id: template.id, title: template.title, content: resolve(template.content) })),
      manualText: resolve(refs.declarationManualText.value),
      bidId: refs.declarationBid.value || null,
      agency: refs.declarationAgency.value.trim(), municipality: refs.declarationMunicipality.value.trim(),
      editalNumber: refs.declarationEditalNumber.value.trim(), processNumber: refs.declarationProcessNumber.value.trim(),
      date: formatDeclarationDate(refs.declarationDate.value),
      signaturePlace: [state.settings?.signature_city, state.settings?.signature_state].filter(Boolean).join(" - "),
      legalName: state.settings?.legal_name || "", representative: state.settings?.legal_representative || "",
      phone: state.settings?.phone || "", email: state.settings?.email || "",
    };
  }

  function showMissing(missing) {
    refs.declarationMissingVariables.innerHTML = missing.map((label) => `<li>${escapeHtml(label)}</li>`).join("");
    refs.declarationValidationModal.showModal();
  }

  async function createPdf(composition) {
    const { jsPDF } = await import(JSPDF_URL);
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 22;
    const top = 38;
    const bottom = 28;
    const contentWidth = pageWidth - marginX * 2;
    let y = top;
    let logoData = "";
    let watermarkData = "";
    try { logoData = await urlAsDataUrl(state.logoUrl); } catch { logoData = ""; }
    try { watermarkData = await urlAsDataUrl(state.watermarkUrl); } catch { watermarkData = ""; }

    const addPage = () => { doc.addPage(); y = top; };
    const ensureSpace = (height) => { if (y + height > pageHeight - bottom) addPage(); };
    const writeParagraph = (text, options = {}) => {
      const content = String(text || "").trim();
      if (!content) return;
      doc.setFont("helvetica", options.bold ? "bold" : "normal");
      doc.setFontSize(options.size || 10.5);
      doc.setTextColor(34, 40, 49);
      const lines = doc.splitTextToSize(content, options.width || contentWidth);
      const lineHeight = options.lineHeight || 5.2;
      for (const line of lines) {
        ensureSpace(lineHeight + 1);
        doc.text(line, options.x || marginX, y, { align: options.align || "left" });
        y += lineHeight;
      }
      y += options.after ?? 2;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    const titleLines = doc.splitTextToSize(composition.title, contentWidth);
    for (const line of titleLines) { ensureSpace(7); doc.text(line, pageWidth / 2, y, { align: "center" }); y += 7; }
    y += 3;
    const editalDetails = [
      composition.agency && `Órgão: ${composition.agency}`,
      composition.municipality && `Município/UF: ${composition.municipality}`,
      composition.editalNumber && `Edital: ${composition.editalNumber}`,
      composition.processNumber && `Processo: ${composition.processNumber}`,
    ].filter(Boolean);
    if (editalDetails.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      for (const detail of editalDetails) { ensureSpace(5); doc.text(detail, pageWidth / 2, y, { align: "center" }); y += 4.6; }
      y += 4;
    }
    writeParagraph(composition.introduction, { align: "justify", after: 5 });
    composition.declarations.forEach((item, index) => {
      ensureSpace(18);
      writeParagraph(`${index + 1}. ${item.title}`, { bold: true, size: 11, after: 2 });
      writeParagraph(item.content, { align: "justify", after: 4 });
      if (index < composition.declarations.length - 1 || composition.manualText) {
        ensureSpace(7); doc.setDrawColor(180, 186, 196); doc.line(marginX, y, pageWidth - marginX, y); y += 7;
      }
    });
    if (composition.manualText) {
      ensureSpace(18);
      writeParagraph("CONTEÚDO ADICIONAL", { bold: true, size: 11, after: 2 });
      writeParagraph(composition.manualText, { align: "justify", after: 5 });
    }
    ensureSpace(46);
    const locationDate = [composition.signaturePlace, composition.date].filter(Boolean).join(", ");
    if (locationDate) { doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.text(`${locationDate}.`, pageWidth / 2, y + 4, { align: "center" }); }
    y += 26;
    doc.setDrawColor(40, 45, 52); doc.line(55, y, 155, y); y += 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(composition.legalName || "RAZÃO SOCIAL", pageWidth / 2, y, { align: "center" }); y += 5;
    doc.setFont("helvetica", "normal"); doc.text(composition.representative || "REPRESENTANTE LEGAL", pageWidth / 2, y, { align: "center" });

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      if (watermarkData) {
        try {
          doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.09 }));
          doc.addImage(watermarkData, "AUTO", 48, 82, 114, 114, undefined, "FAST");
          doc.restoreGraphicsState();
        } catch { /* PDF continua válido sem transparência da marca-d'água. */ }
      }
      if (logoData) {
        try { doc.addImage(logoData, "AUTO", marginX, 10, 36, 18, undefined, "FAST"); } catch { /* imagem inválida não bloqueia o documento */ }
      } else {
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(70, 78, 90);
        doc.text(composition.legalName || currentContext().organizationName || "", marginX, 19);
      }
      doc.setDrawColor(205, 210, 218); doc.line(marginX, 31, pageWidth - marginX, 31);
      doc.line(marginX, pageHeight - 19, pageWidth - marginX, pageHeight - 19);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(92, 100, 112);
      doc.text([composition.phone, composition.email].filter(Boolean).join("  •  "), marginX, pageHeight - 12);
      doc.text(`${page}/${pageCount}`, pageWidth - marginX, pageHeight - 12, { align: "right" });
    }
    return doc.output("blob");
  }

  async function previewDocument() {
    refs.declarationGeneratorStatus.textContent = "";
    const composition = composeDocument();
    if (composition.missing.length) { showMissing(composition.missing); return; }
    const blob = await createPdf(composition);
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = URL.createObjectURL(blob);
    refs.declarationPreviewFrame.src = state.previewUrl;
    refs.declarationPreviewModal.showModal();
  }

  function closePreview() {
    refs.declarationPreviewModal.close();
  }

  async function saveManualToLibraryIfRequested() {
    if (!refs.declarationSaveManual.checked || !refs.declarationManualText.value.trim()) return;
    const title = refs.declarationManualTitle.value.trim();
    if (!title) throw new Error("Informe um título para salvar o texto manual na biblioteca.");
    const record = {
      organization_id: currentContext().organizationId, bid_id: null, title,
      content: refs.declarationManualText.value.trim(), created_by: currentContext().userAuthId,
    };
    if (client()) {
      assertResult(await client().from("declaration_templates").insert(record));
      await refreshTemplates();
    } else {
      state.templates.push({ ...record, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      persistLocal();
    }
  }

  async function generateDocument(event) {
    event?.preventDefault();
    refs.declarationGeneratorStatus.textContent = "";
    const composition = composeDocument();
    if (composition.missing.length) { showMissing(composition.missing); return; }
    const blob = await createPdf(composition);
    await saveManualToLibraryIfRequested();
    const context = currentContext();
    const supabase = client();
    if (supabase) {
      const filePath = `${context.organizationId}/${crypto.randomUUID()}/${composition.fileName}`;
      assertResult(await supabase.storage.from(PDF_BUCKET).upload(filePath, blob, { contentType: "application/pdf", upsert: false }));
      const historyRecord = {
        organization_id: context.organizationId, bid_id: composition.bidId, title: composition.title,
        file_name: composition.fileName, file_path: filePath, edital_number: composition.editalNumber,
        agency: composition.agency, created_by: context.userAuthId, created_by_name: context.userName || context.userEmail,
        document_snapshot: composition,
      };
      const insert = await supabase.from("declaration_documents").insert(historyRecord).select().single();
      if (insert.error) {
        await supabase.storage.from(PDF_BUCKET).remove([filePath]);
        assertResult(insert);
      }
      await refreshHistory();
    } else {
      state.history.unshift({
        id: crypto.randomUUID(), organization_id: context.organizationId, bid_id: composition.bidId,
        title: composition.title, file_name: composition.fileName, file_path: "local",
        edital_number: composition.editalNumber, agency: composition.agency,
        created_by_name: context.userName || context.userEmail, generated_at: new Date().toISOString(), document_snapshot: composition,
      });
      persistLocal();
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = composition.fileName; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    closePreview();
    renderHistory(); renderLibrary(); renderPicker();
    toast(`${composition.fileName} gerado e registrado no histórico.`);
  }

  async function refreshHistory() {
    if (client()) state.history = assertResult(await client().from("declaration_documents").select("*").order("generated_at", { ascending: false })) || [];
    renderHistory();
  }

  function renderHistory() {
    refs.declarationHistoryList.innerHTML = state.history.length ? state.history.map((row) => `
      <tr><td><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.file_name)}</small></td><td>${escapeHtml(row.edital_number || "Declaração avulsa")}</td><td>${escapeHtml(row.agency || "—")}</td><td>${escapeHtml(new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(row.generated_at)))}</td><td>${escapeHtml(row.created_by_name || "Usuário")}</td><td><button class="quiet-action" type="button" data-open-history="${escapeHtml(row.id)}">Abrir PDF</button></td></tr>`).join("") : `<tr><td colspan="6" class="empty-state">Nenhum PDF foi gerado nesta organização.</td></tr>`;
  }

  async function openHistory(id) {
    const row = state.history.find((item) => item.id === id);
    if (!row) return;
    if (!client()) { toast("No modo local, gere novamente o PDF para baixá-lo."); return; }
    const result = await client().storage.from(PDF_BUCKET).createSignedUrl(row.file_path, 600, { download: row.file_name });
    assertResult(result);
    const link = document.createElement("a"); link.href = result.data.signedUrl; link.target = "_blank"; link.rel = "noopener"; link.click();
  }

  function showVariableSuggestions(textarea) {
    const before = textarea.value.slice(0, textarea.selectionStart);
    const match = before.match(/{{([a-z0-9_]*)$/i);
    if (!match) { hideVariableSuggestions(); return; }
    const query = match[1].toLowerCase();
    const options = DECLARATION_VARIABLES.filter((variable) => variable.key.includes(query) || variable.label.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 8);
    if (!options.length) { hideVariableSuggestions(); return; }
    refs.declarationVariableSuggestions.innerHTML = options.map((variable) => `<button type="button" role="option" data-variable="${variable.key}"><code>{{${variable.key}}}</code><span>${escapeHtml(variable.label)}</span></button>`).join("");
    refs.declarationVariableSuggestions.classList.remove("hidden");
    const rect = textarea.getBoundingClientRect();
    refs.declarationVariableSuggestions.style.left = `${Math.min(rect.left, window.innerWidth - 330)}px`;
    refs.declarationVariableSuggestions.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 280)}px`;
    refs.declarationVariableSuggestions.dataset.target = textarea.id;
    refs.declarationVariableSuggestions.dataset.start = String(textarea.selectionStart - match[0].length);
  }

  function insertVariable(key) {
    const textarea = $(refs.declarationVariableSuggestions.dataset.target);
    if (!textarea) return;
    const start = Number(refs.declarationVariableSuggestions.dataset.start);
    const end = textarea.selectionStart;
    const token = `{{${key}}}`;
    textarea.setRangeText(token, start, end, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    hideVariableSuggestions(); textarea.focus();
  }

  function hideVariableSuggestions() {
    refs.declarationVariableSuggestions.classList.add("hidden");
    refs.declarationVariableSuggestions.innerHTML = "";
    delete refs.declarationVariableSuggestions.dataset.target;
  }

  async function showPage(page) {
    await loadAll();
    const mapping = {
      declarations: refs.declarationGeneratorPanel,
      declarationLibrary: refs.declarationLibraryPanel,
      declarationSettings: refs.declarationSettingsPanel,
      declarationHistory: refs.declarationHistoryPanel,
    };
    for (const panel of Object.values(mapping)) panel.classList.add("hidden");
    (mapping[page] || mapping.declarations).classList.remove("hidden");
    document.querySelectorAll("[data-declaration-page]").forEach((button) => button.classList.toggle("active", button.dataset.declarationPage === page));
    if (page === "declarationLibrary") renderLibrary();
    if (page === "declarationHistory") renderHistory();
  }

  function reset() {
    state.loaded = false; state.loading = null; state.settings = null; state.templates = []; state.history = []; state.bids = []; state.selectedIds = [];
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = "";
  }

  function bind() {
    document.querySelectorAll("[data-declaration-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.declarationPage)));
    refs.goToDeclarationLibraryButton.addEventListener("click", () => navigate("declarationLibrary"));
    refs.declarationBid.addEventListener("change", handleBidChange);
    refs.declarationTemplatePicker.addEventListener("change", handlePickerChange);
    refs.declarationSelectedOrder.addEventListener("click", (event) => {
      const button = event.target.closest("[data-move]"); const item = event.target.closest("[data-template-id]");
      if (button && item) moveTemplate(item.dataset.templateId, button.dataset.move);
    });
    refs.declarationSelectedOrder.addEventListener("dragstart", (event) => { state.draggedId = event.target.closest("[data-template-id]")?.dataset.templateId || null; });
    refs.declarationSelectedOrder.addEventListener("dragover", (event) => event.preventDefault());
    refs.declarationSelectedOrder.addEventListener("drop", (event) => {
      event.preventDefault(); const targetId = event.target.closest("[data-template-id]")?.dataset.templateId;
      if (!state.draggedId || !targetId || targetId === state.draggedId) return;
      const from = state.selectedIds.indexOf(state.draggedId); const to = state.selectedIds.indexOf(targetId);
      state.selectedIds.splice(to, 0, state.selectedIds.splice(from, 1)[0]); renderOrder();
    });
    refs.declarationSaveManual.addEventListener("change", () => {
      refs.declarationManualTitleField.classList.toggle("hidden", !refs.declarationSaveManual.checked);
      refs.declarationManualTitle.required = refs.declarationSaveManual.checked;
    });
    refs.declarationGeneratorForm.addEventListener("submit", (event) => runBusy(() => generateDocument(event), "Gerando e armazenando PDF…"));
    refs.previewDeclarationButton.addEventListener("click", () => runBusy(previewDocument, "Preparando pré-visualização…"));
    refs.generateDeclarationFromPreviewButton.addEventListener("click", () => runBusy(generateDocument, "Gerando e armazenando PDF…"));
    refs.closeDeclarationPreviewButton.addEventListener("click", closePreview);
    refs.closeDeclarationPreviewFooterButton.addEventListener("click", closePreview);
    refs.declarationPreviewModal.addEventListener("cancel", (event) => { event.preventDefault(); closePreview(); });
    refs.closeDeclarationValidationButton.addEventListener("click", () => refs.declarationValidationModal.close());
    refs.declarationSettingsForm.addEventListener("submit", (event) => runBusy(() => saveSettings(event), "Salvando configurações…"));
    refs.declarationLogo.addEventListener("change", async () => setImagePreview(refs.declarationLogoPreview, refs.declarationLogo.files[0] ? await fileAsDataUrl(refs.declarationLogo.files[0]) : state.logoUrl));
    refs.declarationWatermark.addEventListener("change", async () => setImagePreview(refs.declarationWatermarkPreview, refs.declarationWatermark.files[0] ? await fileAsDataUrl(refs.declarationWatermark.files[0]) : state.watermarkUrl));
    refs.newDeclarationTemplateButton.addEventListener("click", () => openTemplateModal());
    refs.declarationTemplateList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-template]"); if (button) openTemplateModal(state.templates.find((row) => row.id === button.dataset.editTemplate));
    });
    refs.declarationTemplateSearch.addEventListener("input", renderLibrary);
    refs.declarationTemplateScopeFilter.addEventListener("change", renderLibrary);
    refs.declarationTemplateScope.addEventListener("change", updateTemplateScope);
    refs.declarationTemplateForm.addEventListener("submit", (event) => runBusy(() => saveTemplate(event), "Salvando declaração…"));
    refs.deleteDeclarationTemplateButton.addEventListener("click", () => runBusy(deleteTemplate, "Excluindo declaração…"));
    refs.closeDeclarationTemplateModalButton.addEventListener("click", closeTemplateModal);
    refs.cancelDeclarationTemplateButton.addEventListener("click", closeTemplateModal);
    refs.declarationTemplateModal.addEventListener("cancel", (event) => { event.preventDefault(); closeTemplateModal(); });
    refs.refreshDeclarationHistoryButton.addEventListener("click", () => runBusy(refreshHistory, "Atualizando histórico…"));
    refs.declarationHistoryList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-history]"); if (button) runBusy(() => openHistory(button.dataset.openHistory), "Abrindo PDF…");
    });
    document.querySelectorAll("[data-variable-editor]").forEach((textarea) => {
      textarea.addEventListener("input", () => showVariableSuggestions(textarea));
      textarea.addEventListener("click", () => showVariableSuggestions(textarea));
      textarea.addEventListener("keydown", (event) => { if (event.key === "Escape") hideVariableSuggestions(); });
    });
    refs.declarationVariableSuggestions.addEventListener("mousedown", (event) => {
      const button = event.target.closest("[data-variable]"); if (!button) return;
      event.preventDefault(); insertVariable(button.dataset.variable);
    });
    document.addEventListener("mousedown", (event) => {
      if (!event.target.closest("[data-variable-editor]") && !event.target.closest("#declarationVariableSuggestions")) hideVariableSuggestions();
    });
  }

  bind();
  return { showPage, reset, refresh: () => loadAll(true) };
}

if (typeof window !== "undefined") {
  window.GLLDeclarations = { createDeclarationsFeature };
}
