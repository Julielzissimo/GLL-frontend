const PARTICIPANT_TYPES = Object.freeze({
  titular: "titular",
  legalPartner: "socio_legal",
  financial: "participante_financeiro",
});

const PARTICIPANT_TYPE_VALUES = Object.values(PARTICIPANT_TYPES);

export function classifyCompanyEnquadramento(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\b(mei|microempreendedor[ao]? individual|empresari[oa]? individual)\b/.test(normalized)) {
    return "individual";
  }
  if (/\b(sociedade|ltda|limitada|eireli|s\s*\.?\s*a\.?|sociedade anonima)\b/.test(normalized)) {
    return "societaria";
  }
  return "indefinido";
}

export function participantTypeLabel(type, companyClassification = "") {
  const legalNature = classifyCompanyEnquadramento(companyClassification);
  if (type === PARTICIPANT_TYPES.titular) {
    return legalNature === "individual" ? "Titular (empresário individual)" : "Titular";
  }
  if (type === PARTICIPANT_TYPES.legalPartner) {
    return legalNature === "societaria" ? "Sócio legal (quadro societário)" : "Sócio legal";
  }
  if (type === PARTICIPANT_TYPES.financial) return "Participante financeiro";
  return "Tipo não informado";
}

export function isParticipantTypeCompatible(type, companyClassification = "") {
  const legalNature = classifyCompanyEnquadramento(companyClassification);
  if (legalNature === "individual" && type === PARTICIPANT_TYPES.legalPartner) return false;
  if (legalNature === "societaria" && type === PARTICIPANT_TYPES.titular) return false;
  return PARTICIPANT_TYPE_VALUES.includes(type);
}

function normalizedPercent(value) {
  const input = String(value ?? "").trim().replace(",", ".");
  if (!/^(?:\d{1,3})(?:\.\d{1,6})?$/.test(input)) return null;
  const [whole, fraction = ""] = input.split(".");
  const micros = BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
  if (micros <= 0n || micros > 100_000_000n) return null;
  const canonical = `${whole}${fraction ? `.${fraction}` : ""}`;
  return { micros, canonical };
}

export function validatePercentageComposition(members, eligibleParticipantIds) {
  const eligible = new Set(eligibleParticipantIds || []);
  const seen = new Set();
  const normalizedMembers = [];
  let totalMicros = 0n;
  for (const member of members || []) {
    if (!member?.percentage || !String(member.percentage).trim()) continue;
    const participantId = String(member.participant_id || "");
    const parsed = normalizedPercent(member.percentage);
    if (!participantId || !eligible.has(participantId) || seen.has(participantId) || !parsed) {
      return { valid: false, members: [], total: "0", error: "Informe percentuais positivos para participantes ativos e elegíveis." };
    }
    seen.add(participantId);
    totalMicros += parsed.micros;
    normalizedMembers.push({ participant_id: participantId, percentage: parsed.canonical });
  }
  if (!normalizedMembers.length || totalMicros <= 0n || totalMicros > 100_000_000n) {
    return { valid: false, members: [], total: formatPercentMicros(totalMicros), error: "A soma dos percentuais deve ser maior que 0% e no máximo 100%." };
  }
  return { valid: true, members: normalizedMembers, total: formatPercentMicros(totalMicros), error: "" };
}

function formatPercentMicros(value) {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
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
  if (result?.error) throw new Error(result.error.message || "Não foi possível carregar os participantes financeiros.");
  return result?.data;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function latestAsOf(events, date) {
  return (events || [])
    .filter((event) => event.effective_on <= date)
    .sort((left, right) => right.effective_on.localeCompare(left.effective_on)
      || String(right.created_at || "").localeCompare(String(left.created_at || ""))
      || String(right.id || "").localeCompare(String(left.id || "")))[0] || null;
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.()
    || `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createFinancialParticipantsFeature(options) {
  const { getClient, getContext, isAdmin, toast, runBusy } = options;
  const $ = (id) => document.getElementById(id);
  const refs = {
    root: $("financialParticipantsFeature"),
    classification: $("participantClassificationContext"),
    status: $("financialParticipantsStatus"),
    loading: $("financialParticipantsLoading"),
    participantForm: $("financialParticipantForm"),
    participantId: $("financialParticipantId"),
    participantName: $("financialParticipantName"),
    participantEffectiveOn: $("financialParticipantEffectiveOn"),
    participantType: $("financialParticipantType"),
    participantEligible: $("financialParticipantDistributionEligible"),
    participantReason: $("financialParticipantReason"),
    cancelParticipant: $("cancelFinancialParticipantEdit"),
    addParticipant: $("addFinancialParticipantButton"),
    participants: $("financialParticipantsList"),
    versionForm: $("percentageVersionForm"),
    versionId: $("percentageVersionId"),
    versionDate: $("percentageVersionEffectiveOn"),
    versionReason: $("percentageVersionReason"),
    versionMembers: $("percentageMembersEditor"),
    versionTotal: $("percentageTotal"),
    cancelVersion: $("cancelPercentageVersionEdit"),
    versions: $("percentageVersionsList"),
    statusForm: $("participantStatusForm"),
    statusTargetId: $("participantStatusTargetId"),
    statusTitle: $("participantStatusTitle"),
    statusActive: $("participantStatusActive"),
    statusDate: $("participantStatusEffectiveOn"),
    statusReason: $("participantStatusReason"),
    cancelStatus: $("cancelParticipantStatus"),
  };
  let loaded = false;
  let state = emptyState();

  function emptyState() {
    return {
      classification: "",
      participants: [], participantProfiles: [], participantStatuses: [],
      percentageVersions: [], percentageMembers: [],
    };
  }

  function setStatus(message, isError = false) {
    refs.status.textContent = message || "";
    refs.status.classList.toggle("form-error", isError);
    refs.status.classList.toggle("form-success", !isError && Boolean(message));
  }

  function selectedProfile(participantId, date = today()) {
    return latestAsOf(state.participantProfiles.filter((profile) => profile.participant_id === participantId), date);
  }

  function selectedStatus(participantId, date = today(), collection = state.participantStatuses) {
    return latestAsOf(collection.filter((event) => event.participant_id === participantId), date);
  }

  function participantAt(participant, date = today()) {
    const profile = selectedProfile(participant.id, date);
    const status = selectedStatus(participant.id, date);
    return {
      ...participant,
      display_name: profile?.display_name || participant.display_name,
      participant_type: profile?.participant_type || PARTICIPANT_TYPES.financial,
      distribution_eligible: profile?.distribution_eligible === true,
      is_active: status?.is_active === true,
      profile,
    };
  }

  function participantTypeOptions(selected = "") {
    const classification = state.classification;
    const typeLabels = PARTICIPANT_TYPE_VALUES.map((type) =>
      `<option value="${type}" ${type === selected ? "selected" : ""} ${isParticipantTypeCompatible(type, classification) ? "" : "disabled"}>${escapeHtml(participantTypeLabel(type, classification))}</option>`);
    return typeLabels.join("");
  }

  function renderClassification() {
    const classification = state.classification.trim();
    const nature = classifyCompanyEnquadramento(classification);
    const note = nature === "individual"
      ? " A opção de titular usa a nomenclatura de empresário individual."
      : nature === "societaria"
        ? " A opção de sócio usa a nomenclatura societária."
        : " Enquadramento não mapeado automaticamente; escolha Titular ou Sócio legal conforme o cadastro jurídico da empresa.";
    refs.classification.textContent = `Enquadramento (Dados da Empresa): ${classification || "não informado"}.${note}`;
    refs.participantType.innerHTML = participantTypeOptions(refs.participantType.value);
  }

  function participantMarkup(participant) {
    const role = participantTypeLabel(participant.participant_type, state.classification);
    const status = participant.is_active
      ? '<span class="participant-status-tag">Ativo</span>'
      : '<span class="participant-status-tag is-inactive">Inativo</span>';
    const distribution = participant.distribution_eligible
      ? "Elegível para receber percentual"
      : "Somente pagamentos e ressarcimentos";
    return `<article class="participant-record-card" data-participant-record="${escapeHtml(participant.id)}">
      <div class="participant-record-copy"><strong>${escapeHtml(participant.display_name)}</strong><small>${escapeHtml(role)} · ${escapeHtml(distribution)} · ${status}</small></div>
      <div class="participant-record-actions">
        <button class="quiet-action compact-action" type="button" data-edit-participant="${escapeHtml(participant.id)}">Editar</button>
        <button class="quiet-action compact-action" type="button" data-status-kind="participant" data-status-id="${escapeHtml(participant.id)}">${participant.is_active ? "Inativar" : "Reativar"}</button>
      </div>
    </article>`;
  }

  function renderParticipants() {
    const participants = state.participants.map((participant) => participantAt(participant));
    refs.participants.innerHTML = participants.length
      ? participants.map(participantMarkup).join("")
      : '<div class="empty-state compact-empty">Nenhum participante financeiro cadastrado.</div>';
    refs.participantType.innerHTML = participantTypeOptions(refs.participantType.value);
  }

  function availableParticipants(date) {
    return state.participants
      .map((participant) => participantAt(participant, date))
      .filter((participant) => participant.is_active && participant.distribution_eligible);
  }

  function renderPercentageMembers(values = null) {
    const date = refs.versionDate.value || today();
    const valueMap = values || new Map([...refs.versionMembers.querySelectorAll("[data-percentage-participant]")]
      .map((input) => [input.dataset.percentageParticipant, input.value]));
    const eligible = availableParticipants(date);
    refs.versionMembers.innerHTML = eligible.length
      ? eligible.map((participant) => `<label class="percentage-member-row">
          <span><strong>${escapeHtml(participant.display_name)}</strong><small>${escapeHtml(participantTypeLabel(participant.participant_type, state.classification))}</small></span>
          <span>Percentual (%)<input data-percentage-participant="${escapeHtml(participant.id)}" type="number" min="0.000001" max="100" step="0.000001" inputmode="decimal" placeholder="Sem percentual" value="${escapeHtml(valueMap.get(participant.id) || "")}" /></span>
        </label>`).join("")
      : '<div class="empty-state compact-empty">Não há participantes ativos e elegíveis nesta data de vigência.</div>';
    updateTotal();
  }

  function updateTotal() {
    const inputs = [...refs.versionMembers.querySelectorAll("[data-percentage-participant]")];
    const eligibleIds = inputs.map((input) => input.dataset.percentageParticipant);
    const composition = validatePercentageComposition(inputs.map((input) => ({
      participant_id: input.dataset.percentageParticipant,
      percentage: input.value,
    })), eligibleIds);
    refs.versionTotal.textContent = `Total informado: ${composition.total}%${composition.valid ? "" : " · preencha ao menos um percentual; a soma máxima é 100%."}`;
    refs.versionTotal.classList.toggle("form-error", !composition.valid && inputs.some((input) => input.value.trim()));
  }

  function renderVersions() {
    const versions = [...state.percentageVersions].sort((left, right) => right.effective_on.localeCompare(left.effective_on)
      || String(right.created_at || "").localeCompare(String(left.created_at || "")));
    refs.versions.innerHTML = versions.length
      ? versions.map((version) => {
        const members = state.percentageMembers.filter((member) => member.percentage_version_id === version.id);
        const summary = members.map((member) => {
          const participant = state.participants.find((item) => item.id === member.participant_id);
          const profile = participant ? selectedProfile(participant.id, version.effective_on) : null;
          return `${profile?.display_name || participant?.display_name || "Participante"}: ${member.percentage}%`;
        }).join(" · ");
        return `<article class="participant-record-card" data-percentage-version="${escapeHtml(version.id)}">
          <div class="participant-record-copy"><strong>Vigência em ${formatDate(version.effective_on)} · ${escapeHtml(version.total_percentage)}%</strong><small>${escapeHtml(version.reason)}${summary ? ` · ${escapeHtml(summary)}` : ""}</small></div>
          <div class="participant-record-actions"><button class="quiet-action compact-action" type="button" data-edit-version="${escapeHtml(version.id)}">Usar como base para nova versão</button></div>
        </article>`;
      }).join("")
      : '<div class="empty-state compact-empty">Nenhuma composição percentual registrada.</div>';
  }

  async function load() {
    if (!isAdmin()) {
      refs.root.classList.add("hidden");
      state = emptyState();
      loaded = true;
      return;
    }
    const client = getClient();
    if (!client) {
      refs.root.classList.add("hidden");
      loaded = true;
      return;
    }
    refs.root.classList.remove("hidden");
    refs.loading.classList.remove("hidden");
    setStatus("");
    try {
      const organizationId = getContext().organizationId;
      const requests = await Promise.all([
        client.from("declaration_settings").select("company_classification").eq("organization_id", organizationId).maybeSingle(),
        client.from("cashflow_participants").select("id,display_name,created_at").eq("organization_id", organizationId).order("created_at"),
        client.from("cashflow_participant_profile_versions").select("id,participant_id,display_name,participant_type,distribution_eligible,effective_on,reason,created_at").eq("organization_id", organizationId).order("effective_on").order("created_at"),
        client.from("cashflow_participant_status_events").select("id,participant_id,effective_on,is_active,reason,created_at").eq("organization_id", organizationId).order("effective_on").order("created_at"),
        client.from("cashflow_percentage_versions").select("id,effective_on,reason,total_percentage,created_at").eq("organization_id", organizationId).order("effective_on", { ascending: false }).order("created_at", { ascending: false }),
        client.from("cashflow_percentage_members").select("id,percentage_version_id,participant_id,percentage").eq("organization_id", organizationId),
      ]);
      const [classification, participants, profiles, statuses, versions, members] = requests.map(assertResult);
      state = {
        classification: classification?.company_classification || "",
        participants: participants || [], participantProfiles: profiles || [], participantStatuses: statuses || [],
        percentageVersions: versions || [], percentageMembers: members || [],
      };
      loaded = true;
      renderClassification();
      renderParticipants();
      renderVersions();
      if (!refs.versionDate.value) refs.versionDate.value = today();
      renderPercentageMembers();
    } catch (error) {
      setStatus(error.message || "Não foi possível carregar os cadastros financeiros.", true);
      toast?.(error.message || "Falha ao carregar participantes financeiros.", "error");
    } finally {
      refs.loading.classList.add("hidden");
    }
  }

  async function execute(command, payload) {
    if (!isAdmin()) throw new Error("Somente administradores podem alterar participantes financeiros.");
    const client = getClient();
    if (!client) throw new Error("Sessão financeira indisponível.");
    const result = await client.rpc("cashflow_manage_participants", {
      p_command: command,
      p_idempotency_key: idempotencyKey(),
      p_payload: payload,
    });
    return assertResult(result);
  }

  function openParticipantForm(participant = null) {
    refs.participantForm.classList.remove("hidden");
    refs.participantId.value = participant?.id || "";
    const profile = participant ? participantAt(participant) : null;
    refs.participantName.value = profile?.display_name || "";
    refs.participantEffectiveOn.value = today();
    refs.participantType.innerHTML = participantTypeOptions(profile?.participant_type || PARTICIPANT_TYPES.financial);
    refs.participantEligible.checked = profile?.distribution_eligible === true;
    refs.participantReason.value = participant ? "Atualização cadastral" : "Cadastro inicial";
    refs.participantForm.querySelector("button[type='submit']").textContent = participant ? "Registrar alteração" : "Salvar participante";
    refs.cancelParticipant.classList.toggle("hidden", !participant);
    refs.participantName.focus();
  }

  function closeParticipantForm() {
    refs.participantForm.reset();
    refs.participantForm.classList.add("hidden");
    refs.participantId.value = "";
    refs.cancelParticipant.classList.add("hidden");
  }

  async function saveParticipant(event) {
    event.preventDefault();
    const participantId = refs.participantId.value;
    const payload = {
      display_name: refs.participantName.value.trim(),
      participant_type: refs.participantType.value,
      distribution_eligible: refs.participantEligible.checked,
      effective_on: refs.participantEffectiveOn.value,
      reason: refs.participantReason.value.trim(),
    };
    if (!payload.display_name || !payload.effective_on || !payload.reason || !PARTICIPANT_TYPE_VALUES.includes(payload.participant_type)) {
      setStatus("Preencha nome, tipo, vigência e motivo.", true);
      return;
    }
    await execute(participantId ? "update_participant" : "create_participant", participantId
      ? { ...payload, participant_id: participantId }
      : payload);
    closeParticipantForm();
    await load();
    setStatus("Participante salvo com histórico preservado.");
  }

  function openStatusForm(id) {
    const record = state.participants.find((item) => item.id === id);
    if (!record) return;
    const current = participantAt(record);
    refs.statusForm.classList.remove("hidden");
    refs.statusTargetId.value = id;
    refs.statusTitle.textContent = `${current.is_active ? "Inativar" : "Reativar"}: ${current.display_name}`;
    refs.statusActive.value = current.is_active ? "false" : "true";
    refs.statusDate.value = today();
    refs.statusReason.value = current.is_active ? "Inativação cadastral" : "Reativação cadastral";
    refs.statusDate.focus();
  }

  async function saveStatus(event) {
    event.preventDefault();
    const targetId = refs.statusTargetId.value;
    const payload = {
      participant_id: targetId,
      effective_on: refs.statusDate.value,
      is_active: refs.statusActive.value === "true",
      reason: refs.statusReason.value.trim(),
    };
    if (!targetId || !payload.effective_on || !payload.reason) {
      setStatus("Preencha estado, data de vigência e motivo.", true);
      return;
    }
    await execute("set_participant_status", payload);
    refs.statusForm.reset();
    refs.statusForm.classList.add("hidden");
    await load();
    setStatus("Estado registrado sem excluir o histórico financeiro.");
  }

  function handleParticipantClick(event) {
    const editButton = event.target.closest("[data-edit-participant]");
    const statusButton = event.target.closest("[data-status-kind]");
    const versionButton = event.target.closest("[data-edit-version]");
    if (editButton) openParticipantForm(state.participants.find((item) => item.id === editButton.dataset.editParticipant));
    if (statusButton) openStatusForm(statusButton.dataset.statusId);
    if (versionButton) loadVersionAsDraft(versionButton.dataset.editVersion);
  }

  function loadVersionAsDraft(versionId) {
    const version = state.percentageVersions.find((item) => item.id === versionId);
    if (!version) return;
    refs.versionId.value = version.id;
    refs.versionDate.value = version.effective_on;
    refs.versionReason.value = `${version.reason} (nova versão)`;
    const map = new Map(state.percentageMembers
      .filter((member) => member.percentage_version_id === version.id)
      .map((member) => [member.participant_id, String(member.percentage)]));
    renderPercentageMembers(map);
    refs.cancelVersion.classList.remove("hidden");
    refs.versionForm.querySelector("button[type='submit']").textContent = "Salvar nova versão percentual";
    refs.versionForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetVersionDraft() {
    refs.versionForm.reset();
    refs.versionId.value = "";
    refs.versionDate.value = today();
    refs.cancelVersion.classList.add("hidden");
    refs.versionForm.querySelector("button[type='submit']").textContent = "Salvar nova versão percentual";
    renderPercentageMembers(new Map());
  }

  async function saveVersion(event) {
    event.preventDefault();
    const inputs = [...refs.versionMembers.querySelectorAll("[data-percentage-participant]")];
    const available = availableParticipants(refs.versionDate.value);
    const composition = validatePercentageComposition(inputs.map((input) => ({
      participant_id: input.dataset.percentageParticipant,
      percentage: input.value,
    })), available.map((participant) => participant.id));
    if (!refs.versionDate.value || !refs.versionReason.value.trim() || !composition.valid) {
      setStatus(composition.error || "Preencha vigência e motivo.", true);
      return;
    }
    await execute("set_percentage_version", {
      effective_on: refs.versionDate.value,
      reason: refs.versionReason.value.trim(),
      members: composition.members,
    });
    resetVersionDraft();
    await load();
    setStatus("Nova versão percentual criada. As versões e operações anteriores foram preservadas.");
  }

  function bindForm(form, operation, message) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      setStatus("");
      const task = () => operation(event);
      Promise.resolve(runBusy ? runBusy(task, message) : task()).catch((error) => {
        setStatus(error.message || "Não foi possível salvar o cadastro.", true);
        toast?.(error.message || "Não foi possível salvar o cadastro.", "error");
      });
    });
  }

  refs.addParticipant.addEventListener("click", () => openParticipantForm());
  refs.cancelParticipant.addEventListener("click", closeParticipantForm);
  refs.cancelStatus.addEventListener("click", () => refs.statusForm.classList.add("hidden"));
  refs.cancelVersion.addEventListener("click", resetVersionDraft);
  refs.versionDate.addEventListener("change", () => renderPercentageMembers());
  refs.versionMembers.addEventListener("input", updateTotal);
  refs.root.addEventListener("click", handleParticipantClick);
  bindForm(refs.participantForm, saveParticipant, "Salvando participante financeiro…");
  bindForm(refs.statusForm, saveStatus, "Registrando vigência do estado…");
  bindForm(refs.versionForm, saveVersion, "Salvando versão percentual…");

  async function showPage() {
    await load();
  }

  function reset() {
    loaded = false;
    state = emptyState();
    refs.root.classList.add("hidden");
    refs.participantForm.reset();
    refs.statusForm.reset();
    refs.versionForm.reset();
    refs.participantForm.classList.add("hidden");
    refs.statusForm.classList.add("hidden");
    refs.cancelParticipant.classList.add("hidden");
    refs.cancelVersion.classList.add("hidden");
    refs.participantId.value = "";
    refs.versionId.value = "";
    refs.classification.textContent = "";
    refs.status.textContent = "";
    refs.versionMembers.innerHTML = "";
  }

  return { showPage, reset, refresh: load, isLoaded: () => loaded };
}

if (typeof window !== "undefined") {
  window.GLLFinancialParticipants = { createFinancialParticipantsFeature };
}
