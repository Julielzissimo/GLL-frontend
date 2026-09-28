export function documentDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function formatCnpj(value) {
  const digits = documentDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatCpf(value) {
  const digits = documentDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})(\d)/, "$1-$2");
}

function hasValidCheckDigits(value, baseLength) {
  const digits = documentDigits(value);
  if (digits.length !== baseLength + 2 || /^(\d)\1+$/.test(digits)) return false;
  const calculateDigit = (partial) => {
    let factor = partial.length + 1;
    const total = [...partial].reduce((sum, digit) => {
      const weight = factor > 9 ? factor - 8 : factor;
      factor -= 1;
      return sum + Number(digit) * weight;
    }, 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  if (baseLength === 9) {
    const cpfDigit = (partial) => {
      const total = [...partial].reduce((sum, digit, index) => sum + Number(digit) * (partial.length + 1 - index), 0);
      const remainder = (total * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    const first = cpfDigit(digits.slice(0, 9));
    const second = cpfDigit(`${digits.slice(0, 9)}${first}`);
    return digits.endsWith(`${first}${second}`);
  }
  const first = calculateDigit(digits.slice(0, 12));
  const second = calculateDigit(`${digits.slice(0, 12)}${first}`);
  return digits.endsWith(`${first}${second}`);
}

export function isValidCpf(value) {
  return hasValidCheckDigits(value, 9);
}

export function isValidCnpj(value) {
  return hasValidCheckDigits(value, 12);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function assertResult(result) {
  if (result?.error) throw new Error(result.error.message || "Não foi possível acessar os dados da empresa.");
  return result?.data;
}

export function createCompanyDataFeature(options) {
  const { getClient, getContext, isAdmin, onOrganizationUpdate, toast, runBusy } = options;
  const $ = (id) => document.getElementById(id);
  const refs = {
    page: $("companyDataPage"),
    loading: $("companyDataLoading"),
    form: $("companyDataForm"),
    legalName: $("companyLegalName"),
    cnpj: $("companyCnpj"),
    representatives: $("legalRepresentativesList"),
    addButton: $("addLegalRepresentativeButton"),
    readOnlyNotice: $("companyDataReadOnlyNotice"),
    status: $("companyDataStatus"),
    actions: $("companyDataActions"),
  };
  const localKey = () => `gll-company-data-v1-${getContext().organizationId}`;
  let loaded = false;
  let state = { organization: null, representatives: [] };

  function defaultOrganization() {
    const context = getContext();
    return { id: context.organizationId, name: context.organizationName || "", cnpj: context.organizationCnpj || "" };
  }

  function readLocal() {
    try {
      return JSON.parse(window.localStorage.getItem(localKey())) || null;
    } catch {
      return null;
    }
  }

  function writeLocal(value) {
    window.localStorage.setItem(localKey(), JSON.stringify(value));
  }

  async function load() {
    refs.loading.classList.remove("hidden");
    refs.form.classList.add("hidden");
    refs.status.textContent = "";
    const client = getClient();
    if (client) {
      const organizationId = getContext().organizationId;
      const [organizationResult, representativesResult] = await Promise.all([
        client.from("organizations").select("id,name,cnpj").eq("id", organizationId).single(),
        client.from("organization_legal_representatives")
          .select("id,name,cpf,position,is_primary,display_order")
          .eq("organization_id", organizationId)
          .order("display_order")
          .order("name"),
      ]);
      state = {
        organization: assertResult(organizationResult),
        representatives: assertResult(representativesResult) || [],
      };
    } else {
      state = readLocal() || { organization: defaultOrganization(), representatives: [] };
    }
    loaded = true;
    render();
    refs.loading.classList.add("hidden");
    refs.form.classList.remove("hidden");
  }

  function representativeMarkup(representative, index) {
    const editable = isAdmin();
    return `
      <fieldset class="legal-representative-card" data-representative-index="${index}">
        <legend>Representante ${index + 1}</legend>
        <div class="legal-representative-card-heading">
          <label class="legal-representative-primary">
            <input type="radio" name="primaryLegalRepresentative" value="${index}" ${representative.is_primary ? "checked" : ""} ${editable ? "" : "disabled"} />
            <span>Representante principal</span>
          </label>
          ${editable ? `<button class="danger-action compact-action" type="button" data-remove-representative="${index}">Remover</button>` : ""}
        </div>
        <div class="form-grid legal-representative-grid">
          <label>Nome completo *<input data-representative-field="name" maxlength="240" value="${escapeHtml(representative.name)}" required ${editable ? "" : "disabled"} /></label>
          <label>CPF *<input data-representative-field="cpf" maxlength="14" inputmode="numeric" placeholder="000.000.000-00" value="${escapeHtml(formatCpf(representative.cpf))}" required ${editable ? "" : "disabled"} /></label>
          <label class="full-field">Cargo ou função<input data-representative-field="position" maxlength="160" value="${escapeHtml(representative.position)}" placeholder="Ex.: Sócia-administradora" ${editable ? "" : "disabled"} /></label>
        </div>
      </fieldset>`;
  }

  function renderRepresentatives() {
    refs.representatives.innerHTML = state.representatives.length
      ? state.representatives.map(representativeMarkup).join("")
      : `<div class="empty-state compact-empty">Nenhum representante legal cadastrado.</div>`;
  }

  function render() {
    const organization = state.organization || defaultOrganization();
    refs.legalName.value = organization.name || "";
    refs.cnpj.value = formatCnpj(organization.cnpj || "");
    const editable = isAdmin();
    refs.legalName.disabled = !editable;
    refs.cnpj.disabled = !editable;
    refs.addButton.classList.toggle("hidden", !editable);
    refs.actions.classList.toggle("hidden", !editable);
    refs.readOnlyNotice.classList.toggle("hidden", editable);
    renderRepresentatives();
  }

  function addRepresentative() {
    if (refs.representatives.querySelector("[data-representative-index]")) state.representatives = readRepresentatives();
    state.representatives.push({ name: "", cpf: "", position: "", is_primary: state.representatives.length === 0 });
    renderRepresentatives();
    refs.representatives.querySelector(`[data-representative-index="${state.representatives.length - 1}"] input`)?.focus();
  }

  function removeRepresentative(index) {
    state.representatives = readRepresentatives();
    const removedPrimary = Boolean(state.representatives[index]?.is_primary);
    state.representatives.splice(index, 1);
    if (removedPrimary && state.representatives.length) state.representatives[0].is_primary = true;
    renderRepresentatives();
  }

  function readRepresentatives() {
    return [...refs.representatives.querySelectorAll("[data-representative-index]")].map((card, index) => ({
      name: card.querySelector('[data-representative-field="name"]').value.trim(),
      cpf: formatCpf(card.querySelector('[data-representative-field="cpf"]').value),
      position: card.querySelector('[data-representative-field="position"]').value.trim(),
      is_primary: card.querySelector('[name="primaryLegalRepresentative"]').checked || (index === 0 && !refs.representatives.querySelector('[name="primaryLegalRepresentative"]:checked')),
    }));
  }

  function validate(company, representatives) {
    if (!company.name) throw new Error("Informe a razão social.");
    if (!isValidCnpj(company.cnpj)) throw new Error("Informe um CNPJ válido.");
    const seenCpfs = new Set();
    representatives.forEach((representative, index) => {
      if (!representative.name) throw new Error(`Informe o nome do representante ${index + 1}.`);
      if (!isValidCpf(representative.cpf)) throw new Error(`Informe um CPF válido para o representante ${index + 1}.`);
      const digits = documentDigits(representative.cpf);
      if (seenCpfs.has(digits)) throw new Error("O mesmo CPF não pode ser cadastrado para mais de um representante.");
      seenCpfs.add(digits);
    });
  }

  async function save(event) {
    event?.preventDefault();
    if (!isAdmin()) throw new Error("Somente administradores podem alterar os dados da empresa.");
    refs.status.textContent = "";
    const organization = {
      id: getContext().organizationId,
      name: refs.legalName.value.trim(),
      cnpj: formatCnpj(refs.cnpj.value),
    };
    const representatives = readRepresentatives();
    validate(organization, representatives);
    const client = getClient();
    if (client) {
      assertResult(await client.rpc("save_current_company_data", {
        p_company_name: organization.name,
        p_company_cnpj: organization.cnpj,
        p_representatives: representatives,
      }));
    } else {
      writeLocal({ organization, representatives });
    }
    state = { organization, representatives };
    onOrganizationUpdate?.(organization);
    refs.status.textContent = "Dados da empresa salvos com sucesso.";
    toast("Dados da empresa salvos.");
    render();
  }

  async function showPage() {
    await load();
  }

  function reset() {
    loaded = false;
    state = { organization: null, representatives: [] };
  }

  refs.addButton.addEventListener("click", addRepresentative);
  refs.cnpj.addEventListener("input", () => { refs.cnpj.value = formatCnpj(refs.cnpj.value); });
  refs.representatives.addEventListener("input", (event) => {
    if (event.target.matches('[data-representative-field="cpf"]')) event.target.value = formatCpf(event.target.value);
  });
  refs.representatives.addEventListener("change", (event) => {
    if (!event.target.matches('[name="primaryLegalRepresentative"]')) return;
    state.representatives = readRepresentatives();
  });
  refs.representatives.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-representative]");
    if (button) removeRepresentative(Number(button.dataset.removeRepresentative));
  });
  refs.form.addEventListener("submit", (event) => runBusy(() => save(event), "Salvando dados da empresa…"));

  return { showPage, reset, refresh: load, isLoaded: () => loaded };
}

if (typeof window !== "undefined") {
  window.GLLCompanyData = { createCompanyDataFeature };
}
