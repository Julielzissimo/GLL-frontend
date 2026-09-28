const PDF_BUCKET = "commercial-proposal-pdfs";
const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";
const BUILTIN_FIELDS = Object.freeze({
  item_number: "Item",
  technical_description: "Descrição Técnica",
  brand: "Marca / Fabricante",
  model: "Modelo",
  quantity: "Quantidade",
  unit: "Unidade",
  final_bid: "Valor Final",
  total: "Valor Total",
});

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function assertResult(result, fallback = "Não foi possível acessar as Propostas Comerciais.") {
  if (result?.error) throw new Error(result.error.message || fallback);
  return result?.data;
}

export function formatCommercialMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function commercialProposalFileName(editalNumber) {
  const safe = String(editalNumber || "edital")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  return `Proposta Final - ${safe || "edital"}.pdf`;
}

export function commercialProposalSignaturePlacement(currentY, pageHeight = 297, bottom = 24, height = 42) {
  const y = pageHeight - bottom - height;
  return { addPage: currentY > y, y };
}

const ONES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const TEENS = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function groupInWords(value) {
  const number = Math.trunc(value);
  if (!number) return "";
  if (number === 100) return "cem";
  const parts = [];
  const hundreds = Math.trunc(number / 100);
  const remainder = number % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (remainder >= 10 && remainder < 20) parts.push(TEENS[remainder - 10]);
  else {
    const tens = Math.trunc(remainder / 10);
    const ones = remainder % 10;
    if (tens) parts.push(TENS[tens]);
    if (ones) parts.push(ONES[ones]);
  }
  return parts.join(" e ");
}

function integerInWords(value) {
  const integer = Math.trunc(Math.max(0, value));
  if (!integer) return "zero";
  const scales = [
    { divisor: 1_000_000_000, singular: "bilhão", plural: "bilhões" },
    { divisor: 1_000_000, singular: "milhão", plural: "milhões" },
    { divisor: 1_000, singular: "mil", plural: "mil" },
    { divisor: 1, singular: "", plural: "" },
  ];
  let remainder = integer;
  const parts = [];
  for (const scale of scales) {
    const group = Math.trunc(remainder / scale.divisor);
    remainder %= scale.divisor;
    if (!group) continue;
    if (scale.divisor === 1_000 && group === 1) parts.push("mil");
    else {
      const suffix = group === 1 ? scale.singular : scale.plural;
      parts.push([groupInWords(group), suffix].filter(Boolean).join(" "));
    }
  }
  return parts.join(remainder && parts.length ? " e " : ", ").replace(", e ", " e ");
}

export function moneyInWords(value) {
  const centsTotal = Math.round(Number(value || 0) * 100);
  const reais = Math.trunc(centsTotal / 100);
  const cents = centsTotal % 100;
  const pieces = [];
  if (reais || !cents) pieces.push(`${integerInWords(reais)} ${reais === 1 ? "real" : "reais"}`);
  if (cents) pieces.push(`${integerInWords(cents)} ${cents === 1 ? "centavo" : "centavos"}`);
  return pieces.join(" e ");
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function resolveVariables(text, values) {
  return String(text || "").replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (token, key) => {
    const value = String(values[key.toLowerCase()] ?? "").trim();
    return value || token;
  });
}

export function createCommercialProposalsFeature({ getClient, getContext, toast, runBusy }) {
  const root = document.getElementById("commercialProposalsRoot");
  const state = {
    loaded: false,
    list: [],
    bids: [],
    editor: null,
    dirty: false,
    previewUrl: "",
    dragged: null,
    activeEditorTab: "proposal",
    collapsedItems: new Set(),
    permanentFields: new Set(),
  };
  let pendingDiscardRequest = null;

  function client() {
    const value = getClient();
    if (!value) throw new Error("Propostas Comerciais exigem conexão com o ambiente Supabase.");
    return value;
  }

  async function rpc(name, args = {}) {
    return assertResult(await client().rpc(name, args));
  }

  async function loadList() {
    [state.list, state.bids] = await Promise.all([
      rpc("list_commercial_proposals"),
      rpc("list_commercial_proposal_bids"),
    ]);
    state.loaded = true;
  }

  function statusLabel(status) {
    return status === "finalized" ? "Finalizada" : "Rascunho";
  }

  function renderList() {
    const available = state.bids.filter((bid) => !bid.proposal_id && Number(bid.item_count) > 0);
    root.innerHTML = `
      <div class="page-heading">
        <div><span class="eyebrow">DOCUMENTOS COMERCIAIS</span><h1 id="commercialProposalsTitle">Propostas Comerciais</h1>
        <p>Crie propostas estruturadas a partir dos itens do orçamento de cada edital.</p></div>
        <button class="primary-action" type="button" data-proposal-action="new">＋ Nova Proposta Comercial</button>
      </div>
      <section class="section-band table-panel commercial-proposal-list-panel">
        <div class="table-wrap"><table class="commercial-proposal-list"><thead><tr>
          <th>Número do edital</th><th>Órgão</th><th class="numeric">Itens</th>
          <th class="numeric">Valor total</th><th>Status</th><th>Última alteração</th><th>Responsável</th><th>Ações</th>
        </tr></thead><tbody>
          ${state.list.length ? state.list.map((proposal) => `<tr>
            <td><strong>${escapeHtml(proposal.edital_number || proposal.bid_id)}</strong></td>
            <td>${escapeHtml(proposal.agency || "—")}</td>
            <td class="numeric">${proposal.selected_items}</td>
            <td class="numeric"><strong>${formatCommercialMoney(proposal.total_value)}</strong></td>
            <td><span class="status-pill proposal-status-${proposal.status}">${statusLabel(proposal.status)}</span></td>
            <td>${formatDateTime(proposal.updated_at)}</td><td>${escapeHtml(proposal.updated_by_name || "—")}</td>
            <td><div class="commercial-proposal-row-actions">
              <button class="quiet-action compact-action" type="button" data-open-proposal="${proposal.id}">Editar</button>
              <button class="quiet-action compact-action" type="button" data-preview-proposal="${proposal.id}">Visualizar</button>
              <button class="quiet-action compact-action" type="button" data-download-reference="${escapeHtml(proposal.last_generation_reference || "")}" ${proposal.last_generation_reference ? "" : "disabled"}>Baixar PDF</button>
            </div></td>
          </tr>`).join("") : `<tr><td colspan="8"><div class="empty-state compact-empty">Nenhuma Proposta Comercial cadastrada.</div></td></tr>`}
        </tbody></table></div>
      </section>
      <dialog id="newCommercialProposalDialog" class="quotation-item-discard-modal commercial-proposal-create-modal" aria-labelledby="newCommercialProposalTitle">
        <form method="dialog" class="commercial-proposal-dialog-form">
          <h2 id="newCommercialProposalTitle">Nova Proposta Comercial</h2>
          <p>Selecione um edital com orçamento vinculado. Se já houver proposta, ela será aberta para edição.</p>
          <label>Edital<select id="newCommercialProposalBid" required>
            <option value="">Selecione um edital</option>
            ${available.map((bid) => `<option value="${escapeHtml(bid.bid_id)}">${escapeHtml(bid.edital_number || bid.bid_id)} · ${escapeHtml(bid.agency || "Órgão não informado")} (${bid.item_count} itens)</option>`).join("")}
          </select></label>
          ${available.length ? "" : `<div class="empty-state compact-empty">Todos os editais com orçamento já possuem proposta, ou não há itens cadastrados.</div>`}
          <p id="newCommercialProposalError" class="form-error" role="alert"></p>
          <div class="button-row end"><button class="quiet-action" value="cancel">Cancelar</button>
          <button class="primary-action" type="submit" value="default" ${available.length ? "" : "disabled"}>Criar proposta</button></div>
        </form>
      </dialog>
    `;
  }

  function selectedItems() {
    return state.editor.items.filter((item) => item.selected).sort((a, b) => a.position - b.position);
  }

  function enabledColumns() {
    return state.editor.columns
      .filter((column) => column.enabled && column.source_field !== "manufacturer")
      .sort((a, b) => a.position - b.position);
  }

  function effectiveItemValue(item, field) {
    const override = {
      technical_description: item.override_technical_description,
      brand: item.override_brand,
      model: item.override_model,
      manufacturer: item.override_manufacturer,
      quantity: item.override_quantity,
      unit: item.override_unit,
    }[field];
    if (override !== null && override !== undefined && override !== "") return override;
    if (field === "technical_description") return item.technical_text || "";
    if (field === "brand") return item.brand || item.manufacturer || "";
    return item[field] ?? "";
  }

  function lineTotal(item) {
    return Math.round(Number(effectiveItemValue(item, "quantity") || 0) * Number(item.final_bid || 0) * 100) / 100;
  }

  function proposalTotal() {
    return selectedItems().reduce((total, item) => total + lineTotal(item), 0);
  }

  function markDirty() {
    state.dirty = true;
    if (state.editor.proposal.status === "finalized") state.editor.proposal.status = "draft";
    const marker = root.querySelector("[data-dirty-marker]");
    if (marker) marker.textContent = "Alterações não salvas";
  }

  function renderItemRows() {
    const customColumns = state.editor.columns.filter((column) => column.is_custom);
    return state.editor.items.sort((a, b) => a.position - b.position).map((item, index) => {
      const collapsed = state.collapsedItems.has(item.id);
      return `
      <article class="commercial-proposal-item ${item.selected ? "selected" : ""} ${collapsed ? "is-collapsed" : ""}" draggable="true" data-drag-kind="item" data-drag-id="${item.id}">
        <div class="commercial-proposal-item-head">
          <label class="checkbox-line proposal-item-selector"><input type="checkbox" data-item-field="selected" data-item-id="${item.id}" ${item.selected ? "checked" : ""} />
            <strong>Item ${escapeHtml(item.item_number)}</strong></label>
          <span class="drag-handle" title="Arraste para reorganizar" aria-label="Arraste para reorganizar">⠿</span>
          <span class="table-secondary">Posição ${index + 1}</span>
          <button class="commercial-item-collapse" type="button" data-toggle-item="${item.id}" aria-expanded="${!collapsed}" aria-label="${collapsed ? "Expandir" : "Recolher"} item ${escapeHtml(item.item_number)}"><span aria-hidden="true"></span></button>
        </div>
        <div class="commercial-proposal-item-grid">
          ${[
            ["technical_description", "Descrição Técnica", "textarea"],
            ["brand", "Marca / Fabricante", "input"],
            ["model", "Modelo", "input"],
            ["quantity", "Quantidade", "number"],
            ["unit", "Unidade", "input"],
          ].map(([field, label, type]) => `<label class="proposal-item-field ${field === "technical_description" ? "wide" : ""}">
            ${label}
            ${type === "textarea"
              ? `<textarea rows="2" data-item-field="${field}" data-item-id="${item.id}">${escapeHtml(effectiveItemValue(item, field))}</textarea>`
              : `<input type="${type}" ${type === "number" ? 'min="0" step="0.0001"' : ""} data-item-field="${field}" data-item-id="${item.id}" value="${escapeHtml(effectiveItemValue(item, field))}" />`}
            <span class="proposal-permanent-option" tabindex="0" data-tooltip="Ao marcar este checkbox, esta informação também será salva no orçamento vinculado."><input type="checkbox" data-permanent-field="${field}" data-item-id="${item.id}" ${state.permanentFields.has(`${item.id}:${field}`) ? "checked" : ""} /> <span>Salvar esta informação permanentemente</span></span>
          </label>`).join("")}
          <label>Valor Final
            <input data-final-bid data-item-id="${item.id}" inputmode="decimal" value="${Number(item.final_bid || 0).toFixed(2).replace(".", ",")}" />
            <span class="table-secondary">Altera obrigatoriamente o orçamento após confirmação.</span>
          </label>
          <label>Valor Total<input readonly value="${formatCommercialMoney(lineTotal(item))}" /></label>
          ${customColumns.map((column) => {
            const value = state.editor.custom_values.find((entry) => entry.proposal_item_id === item.id && entry.proposal_column_id === column.id)?.value || "";
            return `<label>${escapeHtml(column.display_name)}<input data-custom-value data-item-id="${item.id}" data-column-id="${column.id}" value="${escapeHtml(value)}" /></label>`;
          }).join("")}
        </div>
      </article>
    `;
    }).join("");
  }

  function renderColumns() {
    return state.editor.columns
      .filter((column) => column.source_field !== "manufacturer")
      .sort((a, b) => a.position - b.position).map((column, index) => `
      <article class="commercial-column-row" draggable="true" data-drag-kind="column" data-drag-id="${column.id}">
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <label class="checkbox-line"><input type="checkbox" data-column-field="enabled" data-column-id="${column.id}" ${column.enabled ? "checked" : ""} /> Exibir</label>
        <label>Título visual<input data-column-field="display_name" data-column-id="${column.id}" value="${escapeHtml(column.display_name)}" /></label>
        <label>Largura <span class="commercial-width-output">${Number(column.width)}%</span>
          <input type="range" min="5" max="60" step="1" data-column-field="width" data-column-id="${column.id}" value="${Number(column.width)}" />
        </label>
        <span class="status-pill">${column.is_custom ? "Personalizada" : escapeHtml(BUILTIN_FIELDS[column.source_field] || "Campo")}</span>
        ${column.is_custom ? `<button class="danger-action compact-action" type="button" data-remove-column="${column.id}" aria-label="Remover coluna">Remover</button>` : ""}
        <span class="table-secondary">${index + 1}</span>
      </article>
    `).join("");
  }

  function sectionLabel(section) {
    return {
      delivery_term: "Prazo de entrega", proposal_validity: "Validade da proposta",
      payment_terms: "Condições de pagamento", items_table: "Tabela de itens",
      banking_data: "Dados bancários", signature: "Assinatura",
      configured_section: "Seção configurada", text_block: "Bloco de Texto",
    }[section.type] || section.type;
  }

  function renderSections() {
    return state.editor.sections.sort((a, b) => a.position - b.position).map((section, index) => `
      <article class="commercial-section-row" draggable="true" data-drag-kind="section" data-drag-id="${section.id}">
        <div class="commercial-section-head">
          <span class="drag-handle" aria-hidden="true">⠿</span>
          <label class="checkbox-line"><input type="checkbox" data-section-field="enabled" data-section-id="${section.id}" ${section.enabled ? "checked" : ""} /> <strong>${sectionLabel(section)}</strong></label>
          <span class="table-secondary">Posição ${index + 1}</span>
          ${section.type === "text_block" || section.type === "configured_section" ? `<button class="danger-action compact-action" type="button" data-remove-section="${section.id}">Remover</button>` : ""}
        </div>
        ${["text_block", "configured_section", "banking_data"].includes(section.type) ? `
          <div class="form-grid commercial-section-fields">
            <label>Título opcional<input data-section-field="title" data-section-id="${section.id}" value="${escapeHtml(section.title)}" /></label>
            <label class="full-span">Conteúdo<textarea rows="3" data-section-field="content" data-section-id="${section.id}" data-variable-editor>${escapeHtml(section.content)}</textarea></label>
            ${section.type === "text_block" && !section.configuration?.template_id
              ? `<label class="checkbox-line full-span"><input type="checkbox" data-save-default-section="${section.id}" /> Salvar como seção reutilizável e inserir por padrão em novas propostas</label>`
              : section.configuration?.template_id ? '<span class="table-secondary full-span">Seção padrão: alterações nesta proposta não modificam o modelo reutilizável.</span>' : ""}
          </div>` : ""}
      </article>
    `).join("");
  }

  function renderEditor() {
    const { proposal, bid, representatives, generations, price_history: priceHistory } = state.editor;
    const total = proposalTotal();
    root.innerHTML = `
      <div class="page-heading commercial-proposal-editor-heading">
        <div><button class="quiet-action compact-action" type="button" data-proposal-action="back">← Todas as propostas</button>
          <span class="eyebrow">EDITAL ${escapeHtml(bid.edital_number || bid.id)}</span>
          <h1 id="commercialProposalsTitle">Proposta Comercial</h1>
          <p>Construtor estruturado · <span data-dirty-marker>${state.dirty ? "Alterações não salvas" : "Todas as alterações salvas"}</span></p>
        </div>
        <div class="commercial-proposal-toolbar">
          <span class="status-pill proposal-status-${proposal.status}">${statusLabel(proposal.status)}</span>
          <button class="quiet-action" type="button" data-proposal-action="save">Salvar rascunho</button>
          <button class="primary-action" type="button" data-proposal-action="finalize">Finalizar proposta</button>
        </div>
      </div>
      <nav class="declarations-tabs commercial-proposal-tabs" aria-label="Etapas da proposta">
        <button class="${state.activeEditorTab === "proposal" ? "active" : ""}" type="button" data-proposal-tab="proposal" aria-selected="${state.activeEditorTab === "proposal"}">Criar proposta</button>
        <button class="${state.activeEditorTab === "settings" ? "active" : ""}" type="button" data-proposal-tab="settings" aria-selected="${state.activeEditorTab === "settings"}">Configuração</button>
        <button class="${state.activeEditorTab === "history" ? "active" : ""}" type="button" data-proposal-tab="history" aria-selected="${state.activeEditorTab === "history"}">Histórico</button>
      </nav>
      <div class="commercial-proposal-workspace">
        <main class="commercial-proposal-editor-column">
      <div class="commercial-proposal-tab-panel ${state.activeEditorTab === "proposal" ? "" : "hidden"}" data-proposal-panel="proposal">
      <section class="section-band commercial-builder-section">
        <div class="section-heading"><div><h2>Informações da proposta</h2><p>Os dados do edital identificam a proposta, mas não são inseridos automaticamente no documento.</p></div></div>
        <div class="form-grid commercial-proposal-general-grid">
          <label>Data da proposta<input type="date" data-proposal-field="proposal_date" value="${proposal.proposal_date || todayInSaoPaulo()}" /></label>
          <label>Representante da proposta<select data-proposal-field="representative_id"><option value="">Sem representante</option>
            ${representatives.map((representative) => `<option value="${representative.id}" ${representative.id === proposal.representative_id ? "selected" : ""}>${escapeHtml(representative.name)} · ${escapeHtml(representative.position || "Representante legal")}</option>`).join("")}
          </select></label>
          <label>Prazo de entrega<input data-proposal-field="delivery_term" value="${escapeHtml(proposal.delivery_term)}" /></label>
          <label>Validade da proposta<input data-proposal-field="proposal_validity" value="${escapeHtml(proposal.proposal_validity)}" /></label>
          <label class="full-span">Condições de pagamento<input data-proposal-field="payment_terms" value="${escapeHtml(proposal.payment_terms)}" /></label>
          <label class="proposal-switch"><input type="checkbox" role="switch" data-proposal-field="show_total_in_words" ${proposal.show_total_in_words ? "checked" : ""} /><span class="proposal-switch-control" aria-hidden="true"></span><span>Exibir valor total por extenso</span></label>
        </div>
      </section>
      <section class="section-band commercial-builder-section">
        <div class="section-heading"><div><h2>Itens da proposta</h2><p>Edite os dados somente nesta proposta ou confirme cada alteração permanente no orçamento.</p></div>
          <div class="button-row"><button class="quiet-action compact-action" type="button" data-proposal-action="select-all">Selecionar todos</button>
          <button class="quiet-action compact-action" type="button" data-proposal-action="clear-selection">Limpar seleção</button></div>
        </div>
        <div class="commercial-proposal-items">${renderItemRows()}</div>
      </section>
      </div>
      <div class="commercial-proposal-tab-panel ${state.activeEditorTab === "settings" ? "" : "hidden"}" data-proposal-panel="settings">
      <section class="section-band commercial-builder-section">
        <div class="section-heading"><div><h2>Colunas da tabela</h2><p>Ative, renomeie, dimensione e arraste as colunas para definir o PDF.</p></div>
          <button class="quiet-action" type="button" data-proposal-action="add-column">＋ Coluna personalizada</button></div>
        <div class="commercial-column-list">${renderColumns()}</div>
      </section>
      <section class="section-band commercial-builder-section">
        <div class="section-heading"><div><h2>Estrutura do documento</h2><p>Arraste seções, condições, tabela, assinatura e blocos de texto.</p></div>
          <button class="quiet-action" type="button" data-proposal-action="add-text">＋ Bloco de Texto</button></div>
        <div class="commercial-section-list">${renderSections()}</div>
        <p class="table-secondary">Variáveis disponíveis: {{razao_social}}, {{cnpj}}, {{representante_legal}}, {{cpf_representante}}, {{data_proposta}}, {{valor_total}}, {{valor_total_extenso}}.</p>
      </section>
      <section class="section-band commercial-builder-section">
        <div class="section-heading"><div><h2>Identidade visual e assinatura</h2><p>Logo e marca-d'água reutilizam os ativos configurados em Declarações.</p></div></div>
        <div class="commercial-visual-options">
          <label class="checkbox-line"><input type="checkbox" data-visual-field="show_logo" ${proposal.visual_config?.show_logo ? "checked" : ""} /> Exibir logo</label>
          <label class="checkbox-line"><input type="checkbox" data-visual-field="show_watermark" ${proposal.visual_config?.show_watermark ? "checked" : ""} /> Exibir marca-d'água</label>
          <label class="checkbox-line"><input type="checkbox" data-visual-field="footer_all_pages" ${proposal.visual_config?.footer_all_pages !== false ? "checked" : ""} /> Exibir rodapé em todas as páginas</label>
          <label class="full-span">Texto do rodapé<input data-visual-field="footer_text" value="${escapeHtml(proposal.visual_config?.footer_text || "")}" placeholder="Telefone, e-mail, razão social ou outro texto" /></label>
        </div>
        <fieldset class="commercial-signature-options"><legend>Elementos da assinatura</legend>
          ${[
            ["city", "Cidade"], ["state", "UF"], ["date", "Data da proposta"], ["line", "Linha para assinatura"],
            ["company", "Razão Social"], ["representative", "Representante legal"], ["cpf", "CPF"], ["position", "Cargo/função"],
          ].map(([field, label]) => `<label class="checkbox-line"><input type="checkbox" data-signature-field="${field}" ${proposal.visual_config?.signature?.[field] !== false ? "checked" : ""} /> ${label}</label>`).join("")}
        </fieldset>
      </section>
      </div>
      <div class="commercial-proposal-tab-panel ${state.activeEditorTab === "history" ? "" : "hidden"}" data-proposal-panel="history">
      <section class="section-band commercial-builder-section">
        <div class="section-heading"><div><h2>Histórico</h2><p>Gerações preservam o PDF e o snapshot; alterações de Valor Final são auditáveis.</p></div></div>
        <div class="commercial-history-grid">
          <div><h3>Gerações</h3>${generations.length ? generations.map((generation) => `<button class="history-row" type="button" data-download-reference="${escapeHtml(generation.pdf_reference)}"><strong>${formatDateTime(generation.generated_at)}</strong><span>${generation.item_count} itens · ${formatCommercialMoney(generation.total_value)} · ${statusLabel(generation.status)}</span></button>`).join("") : '<div class="empty-state compact-empty">Nenhuma geração registrada.</div>'}</div>
          <div><h3>Alterações financeiras</h3>${priceHistory.length ? priceHistory.map((entry) => `<div class="history-row"><strong>Item ${entry.quotation_item_id}</strong><span>${formatCommercialMoney(entry.previous_value)} → ${formatCommercialMoney(entry.new_value)}</span><small>${escapeHtml(entry.changed_by_name || "Usuário")} · ${formatDateTime(entry.changed_at)}</small></div>`).join("") : '<div class="empty-state compact-empty">Nenhuma alteração registrada.</div>'}</div>
        </div>
      </section>
      </div>
        </main>
        <aside class="commercial-proposal-summary-column">
          <section class="section-band declaration-summary-card commercial-proposal-summary-card">
            <span class="eyebrow">RESUMO</span>
            <h2>Proposta pronta para conferência</h2>
            <dl>
              <div><dt>Itens selecionados</dt><dd>${selectedItems().length}</dd></div>
              <div><dt>Valor total</dt><dd>${formatCommercialMoney(total)}</dd></div>
              <div><dt>Saída</dt><dd>PDF A4</dd></div>
            </dl>
            <p class="commercial-proposal-total-words">${moneyInWords(total)}</p>
            <button class="quiet-action full-action" type="button" data-proposal-action="preview">Pré-visualizar</button>
            <button class="primary-action full-action" type="button" data-proposal-action="download">Gerar PDF</button>
          </section>
        </aside>
      </div>
      <dialog id="commercialProposalPreviewDialog" class="declaration-preview-modal" aria-labelledby="commercialProposalPreviewTitle">
        <div class="declaration-preview-shell"><div class="quotation-item-modal-header"><div><span class="eyebrow">PRÉ-VISUALIZAÇÃO</span><h2 id="commercialProposalPreviewTitle">Proposta Comercial</h2></div><button class="quotation-item-modal-close" type="button" data-proposal-action="close-preview" aria-label="Fechar">×</button></div>
        <iframe id="commercialProposalPreviewFrame" title="Pré-visualização da Proposta Comercial"></iframe>
        <div class="button-row end"><button class="quiet-action" type="button" data-proposal-action="close-preview">Fechar</button><button class="primary-action" type="button" data-proposal-action="download">Baixar PDF</button></div></div>
      </dialog>
      <dialog id="commercialCustomColumnDialog" class="quotation-item-discard-modal" aria-labelledby="commercialCustomColumnTitle">
        <form method="dialog" class="commercial-proposal-dialog-form"><h2 id="commercialCustomColumnTitle">Coluna personalizada</h2>
          <label>Reutilizar definição existente<select id="commercialReusableColumn"><option value="">Criar nova coluna</option>
            ${state.editor.reusable_columns.map((column) => `<option value="${column.id}" data-name="${escapeHtml(column.name)}" data-width="${column.default_width}">${escapeHtml(column.name)}</option>`).join("")}
          </select></label>
          <label>Nome da coluna<input id="commercialCustomColumnName" maxlength="120" required /></label>
          <label>Largura inicial (%)<input id="commercialCustomColumnWidth" type="number" min="5" max="100" value="15" required /></label>
          <label class="checkbox-line"><input id="commercialCustomColumnReusable" type="checkbox" /> Salvar para reutilizar em futuras propostas</label>
          <p id="commercialCustomColumnError" class="form-error" role="alert"></p>
          <div class="button-row end"><button class="quiet-action" value="cancel">Cancelar</button><button class="primary-action" type="submit" value="default">Adicionar</button></div>
        </form>
      </dialog>
      <dialog id="commercialProposalDiscardDialog" class="quotation-item-discard-modal" aria-labelledby="commercialProposalDiscardTitle" aria-describedby="commercialProposalDiscardDescription">
        <div class="quotation-item-discard-content">
          <h2 id="commercialProposalDiscardTitle">Descartar alterações?</h2>
          <p id="commercialProposalDiscardDescription">Há alterações não salvas nesta proposta. Se você sair agora, elas serão perdidas.</p>
          <div class="button-row end">
            <button class="quiet-action" type="button" data-proposal-action="keep-editing">Continuar editando</button>
            <button class="danger-action" type="button" data-proposal-action="discard-changes">Descartar alterações</button>
          </div>
        </div>
      </dialog>
    `;
  }

  function requestDiscardChanges(action, onCancel) {
    if (!state.editor || !state.dirty) {
      action();
      return true;
    }
    pendingDiscardRequest = { action, onCancel };
    const dialog = root.querySelector("#commercialProposalDiscardDialog");
    if (dialog && !dialog.open) dialog.showModal();
    return false;
  }

  function keepEditing() {
    const request = pendingDiscardRequest;
    pendingDiscardRequest = null;
    root.querySelector("#commercialProposalDiscardDialog")?.close();
    request?.onCancel?.();
  }

  function discardChanges() {
    const request = pendingDiscardRequest;
    pendingDiscardRequest = null;
    root.querySelector("#commercialProposalDiscardDialog")?.close();
    state.dirty = false;
    request?.action?.();
  }

  async function openEditor(id) {
    state.editor = await rpc("get_commercial_proposal_editor", { p_proposal_id: id });
    state.editor.columns.forEach((column) => {
      if (column.source_field === "manufacturer") column.enabled = false;
      if (column.source_field === "brand" && /^marca$/i.test(column.display_name || "")) column.display_name = "MARCA / FABRICANTE";
    });
    state.dirty = false;
    state.activeEditorTab = "proposal";
    state.collapsedItems = new Set(state.editor.items.filter((item) => item.selected).map((item) => item.id));
    state.permanentFields = new Set();
    renderEditor();
  }

  function payload() {
    return {
      proposal_date: state.editor.proposal.proposal_date || todayInSaoPaulo(),
      representative_id: state.editor.proposal.representative_id || null,
      delivery_term: state.editor.proposal.delivery_term || "",
      proposal_validity: state.editor.proposal.proposal_validity || "",
      payment_terms: state.editor.proposal.payment_terms || "",
      show_total_in_words: Boolean(state.editor.proposal.show_total_in_words),
      visual_config: state.editor.proposal.visual_config || {},
      items: state.editor.items.map((item, position) => ({
        id: item.id,
        selected: Boolean(item.selected),
        position,
        override_technical_description: item.override_technical_description,
        override_brand: item.override_brand,
        override_model: item.override_model,
        override_manufacturer: item.override_manufacturer,
        override_quantity: item.override_quantity,
        override_unit: item.override_unit,
      })),
      columns: state.editor.columns.map((column, position) => ({
        id: column.id,
        source_field: column.source_field,
        custom_column_id: column.custom_column_id,
        display_name: column.display_name,
        width: Number(column.width),
        position,
        enabled: Boolean(column.enabled),
        is_custom: Boolean(column.is_custom),
      })),
      custom_values: state.editor.custom_values,
      sections: state.editor.sections.map((section, position) => ({
        id: section.id,
        type: section.type,
        title: section.title || "",
        content: section.content || "",
        position,
        enabled: Boolean(section.enabled),
        configuration: section.configuration || {},
      })),
    };
  }

  function validateForDocument() {
    if (!selectedItems().length) throw new Error("Selecione pelo menos um item para gerar a proposta.");
    if (!enabledColumns().length) throw new Error("Ative pelo menos uma coluna da tabela.");
    for (const item of selectedItems()) {
      const quantity = Number(effectiveItemValue(item, "quantity"));
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error(`Informe uma quantidade válida para o item ${item.item_number}.`);
      if (!Number.isFinite(Number(item.final_bid)) || Number(item.final_bid) < 0) throw new Error(`Informe um Valor Final válido para o item ${item.item_number}.`);
    }
  }

  async function saveProposal(finalize = false) {
    if (finalize) validateForDocument();
    const defaultSectionIds = [...root.querySelectorAll("[data-save-default-section]:checked")].map((input) => input.dataset.saveDefaultSection);
    for (const sectionId of defaultSectionIds) {
      const section = state.editor.sections.find((entry) => entry.id === sectionId);
      if (!section || section.configuration?.template_id) continue;
      const saved = assertResult(await client().from("commercial_proposal_section_templates").insert({
        title: section.title.trim() || "Seção reutilizável",
        content: section.content,
        insert_by_default: true,
        position: section.position,
      }).select("id").single());
      section.configuration = { ...(section.configuration || {}), template_id: saved.id };
    }
    const updated = await rpc("save_commercial_proposal", {
      p_proposal_id: state.editor.proposal.id,
      p_expected_version: state.editor.proposal.version,
      p_payload: payload(),
      p_finalize: finalize,
    });
    state.editor.proposal = updated;

    for (const selection of state.permanentFields) {
      const [itemId, field] = selection.split(":");
      const item = state.editor.items.find((entry) => entry.id === itemId);
      const value = effectiveItemValue(item, field);
      await rpc("update_commercial_proposal_budget_field", {
        p_proposal_id: state.editor.proposal.id,
        p_quotation_item_id: item.quotation_item_id,
        p_field: field,
        p_value: String(value ?? ""),
      });
    }
    state.permanentFields.clear();
    state.dirty = false;
    await openEditor(state.editor.proposal.id);
    toast(finalize ? "Proposta finalizada." : "Rascunho salvo.");
  }

  async function createProposal() {
    const dialog = root.querySelector("#newCommercialProposalDialog");
    const bidId = dialog.querySelector("#newCommercialProposalBid").value;
    if (!bidId) return;
    const id = await rpc("create_or_open_commercial_proposal", { p_bid_id: bidId });
    dialog.close();
    await openEditor(id);
    toast("Proposta Comercial criada.");
  }

  async function addCustomColumn() {
    const dialog = root.querySelector("#commercialCustomColumnDialog");
    const name = dialog.querySelector("#commercialCustomColumnName").value.trim();
    const width = Number(dialog.querySelector("#commercialCustomColumnWidth").value);
    const selectedReusable = dialog.querySelector("#commercialReusableColumn").value;
    const reusable = dialog.querySelector("#commercialCustomColumnReusable").checked;
    if (!name || !Number.isFinite(width) || width < 5 || width > 100) {
      dialog.querySelector("#commercialCustomColumnError").textContent = "Informe nome e largura entre 5% e 100%.";
      return;
    }
    let reusableId = selectedReusable || null;
    if (reusable && !reusableId) {
      const record = assertResult(await client().from("commercial_proposal_custom_columns")
        .insert({ name, default_width: width }).select("id").single());
      reusableId = record.id;
    }
    state.editor.columns.push({
      id: crypto.randomUUID(), proposal_id: state.editor.proposal.id,
      source_field: null, custom_column_id: reusableId, display_name: name,
      width, position: state.editor.columns.length, enabled: true, is_custom: true,
    });
    dialog.close();
    markDirty();
    renderEditor();
  }

  function addTextBlock() {
    state.editor.sections.push({
      id: crypto.randomUUID(), proposal_id: state.editor.proposal.id, type: "text_block",
      title: "", content: "", position: state.editor.sections.length, enabled: true, configuration: {},
    });
    markDirty();
    renderEditor();
  }

  function moveRecord(kind, sourceId, targetId) {
    const collection = kind === "item" ? state.editor.items : kind === "column" ? state.editor.columns : state.editor.sections;
    const sourceIndex = collection.findIndex((entry) => entry.id === sourceId);
    const targetIndex = collection.findIndex((entry) => entry.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const [record] = collection.splice(sourceIndex, 1);
    collection.splice(targetIndex, 0, record);
    collection.forEach((entry, position) => { entry.position = position; });
    markDirty();
    renderEditor();
  }

  async function updateFinalBid(input) {
    const item = state.editor.items.find((entry) => entry.id === input.dataset.itemId);
    const value = Number(String(input.value).replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(value) || value < 0) throw new Error("Informe um Valor Final válido.");
    if (Number(item.final_bid) === value) return;
    const accepted = confirm("Esta alteração atualizará o Valor Final do item no orçamento vinculado, recalculará seus indicadores financeiros e será registrada no histórico. Deseja continuar?");
    if (!accepted) {
      input.value = Number(item.final_bid || 0).toFixed(2).replace(".", ",");
      return;
    }
    const result = await rpc("update_commercial_proposal_final_bid", {
      p_proposal_id: state.editor.proposal.id,
      p_quotation_item_id: item.quotation_item_id,
      p_new_value: value,
    });
    item.final_bid = result.new_value;
    item.profit_margin = result.profit_margin;
    item.total = lineTotal(item);
    state.editor.proposal.total_value = result.total_value;
    state.editor.proposal.version += 1;
    state.editor.proposal.status = "draft";
    state.editor.price_history.unshift({
      quotation_item_id: item.quotation_item_id,
      previous_value: result.previous_value,
      new_value: result.new_value,
      changed_by_name: getContext().userName,
      changed_at: new Date().toISOString(),
    });
    renderEditor();
    toast("Valor Final atualizado no orçamento e registrado no histórico.");
  }

  function variableValues() {
    const proposal = state.editor.proposal;
    const representative = state.editor.representatives.find((entry) => entry.id === proposal.representative_id) || {};
    const settings = state.editor.declaration_settings || {};
    const total = proposalTotal();
    return {
      razao_social: state.editor.organization?.name || settings.legal_name || "",
      cnpj: state.editor.organization?.cnpj || settings.cnpj || "",
      representante_legal: representative.name || "",
      representante: representative.name || "",
      cpf_representante: representative.cpf || "",
      cargo_representante: representative.position || "",
      data_proposta: formatDate(proposal.proposal_date),
      valor_total: formatCommercialMoney(total),
      valor_total_extenso: moneyInWords(total),
    };
  }

  function itemColumnValue(item, column) {
    if (column.is_custom) {
      return state.editor.custom_values.find((entry) =>
        entry.proposal_item_id === item.id && entry.proposal_column_id === column.id)?.value || "";
    }
    if (column.source_field === "total") return formatCommercialMoney(lineTotal(item));
    if (column.source_field === "final_bid") return formatCommercialMoney(item.final_bid);
    if (column.source_field === "quantity") {
      return Number(effectiveItemValue(item, "quantity") || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
    }
    return String(effectiveItemValue(item, column.source_field) ?? "");
  }

  async function assetDataUrl(path) {
    if (!path) return "";
    const signed = assertResult(await client().storage.from("declaration-assets").createSignedUrl(path, 120));
    const response = await fetch(signed.signedUrl);
    if (!response.ok) return "";
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function imageDataUrlWithOpacity(dataUrl, opacity) {
    if (!dataUrl) return "";
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          context.globalAlpha = opacity;
          context.drawImage(image, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve("");
        }
      };
      image.onerror = () => resolve("");
      image.src = dataUrl;
    });
  }

  function documentSnapshot() {
    return {
      ...payload(),
      proposal: { ...state.editor.proposal, total_value: proposalTotal() },
      bid: {
        id: state.editor.bid.id,
        edital_number: state.editor.bid.edital_number,
        buyer_agency: state.editor.bid.buyer_agency,
      },
      organization: state.editor.organization,
      representatives: state.editor.representatives,
      rendered_items: selectedItems().map((item) => ({
        id: item.id,
        quotation_item_id: item.quotation_item_id,
        values: Object.fromEntries(enabledColumns().map((column) => [column.id, itemColumnValue(item, column)])),
      })),
    };
  }

  async function buildPdf() {
    validateForDocument();
    const { jsPDF } = await import(JSPDF_URL);
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = 180;
    const bottom = 24;
    let y = 30;
    const values = variableValues();
    const proposal = state.editor.proposal;
    const settings = state.editor.declaration_settings || {};
    const representative = state.editor.representatives.find((entry) => entry.id === proposal.representative_id) || {};
    const logoData = proposal.visual_config?.show_logo ? await assetDataUrl(settings.logo_path) : "";
    const watermarkAsset = proposal.visual_config?.show_watermark ? await assetDataUrl(settings.watermark_path) : "";
    const watermarkData = await imageDataUrlWithOpacity(watermarkAsset, 0.08);

    const drawWatermarkBackground = () => {
      if (!watermarkData) return;
      try {
        doc.addImage(watermarkData, undefined, 55, 92, 100, 100, undefined, "FAST");
      } catch {}
    };

    const addPage = () => {
      doc.addPage();
      drawWatermarkBackground();
      y = 25;
    };
    const ensure = (height) => {
      if (y + height > pageHeight - bottom) addPage();
    };
    const writeLines = (text, width = contentWidth, options = {}) => {
      const lines = doc.splitTextToSize(String(text || ""), width);
      const height = Number(options.lineHeight || 5);
      for (const line of lines.length ? lines : [""]) {
        ensure(height + 1);
        doc.text(line, options.align === "center" ? pageWidth / 2 : margin, y, options.align ? { align: options.align } : undefined);
        y += height;
      }
    };
    const drawTitle = (title) => {
      if (!title) return;
      ensure(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      writeLines(String(title).toUpperCase(), contentWidth, { lineHeight: 5.5 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      y += 1;
    };
    const drawTextSection = (title, content) => {
      const resolved = resolveVariables(content, values).trim();
      if (!resolved && !title) return;
      drawTitle(resolveVariables(title, values));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      writeLines(resolved, contentWidth, { lineHeight: 4.7 });
      y += 3;
    };
    const drawInlineTextSection = (title, content) => {
      const resolvedTitle = resolveVariables(title, values).trim();
      const resolvedContent = resolveVariables(content, values).trim();
      if (!resolvedTitle && !resolvedContent) return;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const label = resolvedTitle ? `${resolvedTitle.toUpperCase()}:` : "";
      const labelWidth = label ? doc.getTextWidth(label) : 0;
      const valueX = margin + labelWidth + (label ? 1.5 : 0);
      const valueWidth = Math.max(3, pageWidth - margin - valueX);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const lines = resolvedContent ? doc.splitTextToSize(resolvedContent, valueWidth) : [];
      ensure(Math.max(1, lines.length) * 4.7 + 3);

      if (label) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(label, margin, y);
      }
      if (lines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text(lines, valueX, y);
      }
      y += Math.max(1, lines.length) * 4.7 + 3;
    };

    drawWatermarkBackground();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    writeLines("PROPOSTA COMERCIAL", contentWidth, { align: "center", lineHeight: 7 });
    doc.setFontSize(10);
    writeLines(values.razao_social || "EMPRESA PROPONENTE", contentWidth, { align: "center", lineHeight: 5 });
    y += 5;

    const columns = enabledColumns();
    const totalWidth = columns.reduce((sum, column) => sum + Number(column.width || 10), 0);
    const widths = columns.map((column) => contentWidth * Number(column.width || 10) / totalWidth);
    const drawTableHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      let x = margin;
      let maxLines = 1;
      const lineSets = columns.map((column, index) => {
        const lines = doc.splitTextToSize(column.display_name, Math.max(3, widths[index] - 2));
        maxLines = Math.max(maxLines, lines.length);
        return lines;
      });
      const height = Math.max(8, maxLines * 3.5 + 3);
      ensure(height);
      lineSets.forEach((lines, index) => {
        doc.setFillColor(235, 239, 247);
        doc.rect(x, y, widths[index], height, "FD");
        doc.text(lines, x + 1, y + 4);
        x += widths[index];
      });
      y += height;
      doc.setFont("helvetica", "normal");
      return height;
    };
    const drawItemsTable = () => {
      drawTableHeader();
      doc.setFontSize(7.5);
      for (const item of selectedItems()) {
        const cellLines = columns.map((column, index) =>
          doc.splitTextToSize(itemColumnValue(item, column) || "—", Math.max(3, widths[index] - 2)));
        let offset = 0;
        const lineCount = Math.max(...cellLines.map((lines) => lines.length), 1);
        while (offset < lineCount) {
          const availableLines = Math.max(1, Math.floor((pageHeight - bottom - y - 3) / 3.5));
          if (availableLines <= 1 && y > 40) {
            addPage();
            drawTableHeader();
            continue;
          }
          const chunkCount = Math.min(lineCount - offset, availableLines);
          const height = Math.max(7, chunkCount * 3.5 + 3);
          if (y + height > pageHeight - bottom) {
            addPage();
            drawTableHeader();
            continue;
          }
          let x = margin;
          cellLines.forEach((lines, index) => {
            doc.rect(x, y, widths[index], height);
            const chunk = lines.slice(offset, offset + chunkCount);
            if (chunk.length) doc.text(chunk, x + 1, y + 4);
            x += widths[index];
          });
          y += height;
          offset += chunkCount;
        }
      }
      ensure(15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("VALOR TOTAL DA PROPOSTA", margin, y + 5);
      doc.text(formatCommercialMoney(proposalTotal()), pageWidth - margin, y + 5, { align: "right" });
      y += 10;
      if (proposal.show_total_in_words) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        writeLines(`Valor por extenso: ${moneyInWords(proposalTotal())}.`, contentWidth, { lineHeight: 4.5 });
      }
      y += 4;
    };
    const drawSignature = () => {
      const placement = commercialProposalSignaturePlacement(y, pageHeight, bottom);
      if (placement.addPage) addPage();
      y = placement.y;
      const signature = proposal.visual_config?.signature || {};
      const location = [
        signature.city !== false ? settings.signature_city || settings.company_city : "",
        signature.state !== false ? settings.signature_state || settings.company_state : "",
      ].filter(Boolean).join(" - ");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const dateText = signature.date !== false ? formatDate(proposal.proposal_date) : "";
      if (location || dateText) doc.text(`${location}${location && dateText ? ", " : ""}${dateText}.`, pageWidth / 2, y + 4, { align: "center" });
      y += 17;
      if (signature.line !== false) { doc.line(55, y, 155, y); y += 5; }
      if (signature.company !== false) {
        doc.setFont("helvetica", "bold");
        doc.text(values.razao_social || "RAZÃO SOCIAL", pageWidth / 2, y, { align: "center" });
        y += 5;
      }
      doc.setFont("helvetica", "normal");
      if (signature.representative !== false) {
        doc.text(representative.name || "REPRESENTANTE LEGAL", pageWidth / 2, y, { align: "center" });
      }
      if (signature.cpf !== false && representative.cpf) { y += 4; doc.text(`CPF: ${representative.cpf}`, pageWidth / 2, y, { align: "center" }); }
      if (signature.position !== false && representative.position) { y += 4; doc.text(representative.position, pageWidth / 2, y, { align: "center" }); }
      y += 6;
    };

    const enabledSections = state.editor.sections.filter((entry) => entry.enabled).sort((a, b) => a.position - b.position);
    for (const section of enabledSections.filter((entry) => entry.type !== "signature")) {
      if (section.type === "items_table") drawItemsTable();
      else if (section.type === "delivery_term") drawInlineTextSection(section.title || "Prazo de entrega", proposal.delivery_term);
      else if (section.type === "proposal_validity") drawInlineTextSection(section.title || "Validade da proposta", proposal.proposal_validity);
      else if (section.type === "payment_terms") drawInlineTextSection(section.title || "Condições de pagamento", proposal.payment_terms);
      else drawTextSection(section.title, section.content);
    }
    if (enabledSections.some((entry) => entry.type === "signature")) drawSignature();

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      if (logoData) {
        try { doc.addImage(logoData, undefined, margin, 8, 28, 15, undefined, "FAST"); } catch {}
      }
      doc.setDrawColor(205, 210, 218);
      doc.line(margin, 24, pageWidth - margin, 24);
      doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const footer = proposal.visual_config?.footer_text || [settings.phone, settings.email].filter(Boolean).join(" · ") || values.razao_social;
      if (proposal.visual_config?.footer_all_pages !== false || page === pageCount) {
        doc.text(String(footer || ""), margin, pageHeight - 12);
      }
      doc.text(`${page}/${pageCount}`, pageWidth - margin, pageHeight - 12, { align: "right" });
    }
    return doc;
  }

  async function previewPdf() {
    const doc = await buildPdf();
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = URL.createObjectURL(doc.output("blob"));
    root.querySelector("#commercialProposalPreviewFrame").src = state.previewUrl;
    root.querySelector("#commercialProposalPreviewDialog").showModal();
  }

  async function generateAndDownload() {
    if (state.dirty) await saveProposal(false);
    const doc = await buildPdf();
    const blob = doc.output("blob");
    const reference = `${getContext().organizationId}/${state.editor.proposal.id}/${crypto.randomUUID()}.pdf`;
    assertResult(await client().storage.from(PDF_BUCKET).upload(reference, blob, {
      contentType: "application/pdf", upsert: false,
    }), "Não foi possível armazenar o PDF.");
    await rpc("record_commercial_proposal_generation", {
      p_proposal_id: state.editor.proposal.id,
      p_snapshot: documentSnapshot(),
      p_pdf_reference: reference,
    });
    doc.save(commercialProposalFileName(state.editor.bid.edital_number || state.editor.bid.id));
    await openEditor(state.editor.proposal.id);
    toast("PDF gerado e registrado no histórico.");
  }

  async function downloadReference(reference) {
    if (!reference) return;
    const signed = assertResult(await client().storage.from(PDF_BUCKET).createSignedUrl(reference, 120));
    const anchor = document.createElement("a");
    anchor.href = signed.signedUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.click();
  }

  root.addEventListener("input", (event) => {
    if (!state.editor) return;
    const target = event.target;
    if (target.dataset.proposalField) {
      const field = target.dataset.proposalField;
      state.editor.proposal[field] = target.type === "checkbox" ? target.checked : target.value;
      markDirty();
      return;
    }
    if (target.dataset.visualField) {
      state.editor.proposal.visual_config ||= {};
      state.editor.proposal.visual_config[target.dataset.visualField] = target.type === "checkbox" ? target.checked : target.value;
      markDirty();
      return;
    }
    if (target.dataset.signatureField) {
      state.editor.proposal.visual_config ||= {};
      state.editor.proposal.visual_config.signature ||= {};
      state.editor.proposal.visual_config.signature[target.dataset.signatureField] = target.checked;
      markDirty();
      return;
    }
    if (target.dataset.permanentField) {
      const key = `${target.dataset.itemId}:${target.dataset.permanentField}`;
      if (target.checked) state.permanentFields.add(key);
      else state.permanentFields.delete(key);
      return;
    }
    if (target.dataset.itemField) {
      const item = state.editor.items.find((entry) => entry.id === target.dataset.itemId);
      const field = target.dataset.itemField;
      if (!item) return;
      if (field === "selected") {
        item.selected = target.checked;
        if (target.checked) state.collapsedItems.add(item.id);
        else state.collapsedItems.delete(item.id);
      }
      else {
        const overrideField = `override_${field}`;
        item[overrideField] = field === "quantity" ? (target.value === "" ? null : Number(target.value)) : target.value;
      }
      markDirty();
      return;
    }
    if (target.dataset.customValue !== undefined) {
      let entry = state.editor.custom_values.find((value) =>
        value.proposal_item_id === target.dataset.itemId && value.proposal_column_id === target.dataset.columnId);
      if (!entry) {
        entry = { proposal_item_id: target.dataset.itemId, proposal_column_id: target.dataset.columnId, value: "" };
        state.editor.custom_values.push(entry);
      }
      entry.value = target.value;
      markDirty();
      return;
    }
    if (target.dataset.columnField) {
      const column = state.editor.columns.find((entry) => entry.id === target.dataset.columnId);
      if (!column) return;
      column[target.dataset.columnField] = target.type === "checkbox" ? target.checked
        : target.dataset.columnField === "width" ? Number(target.value) : target.value;
      if (target.dataset.columnField === "width") target.closest("label").querySelector(".commercial-width-output").textContent = `${target.value}%`;
      markDirty();
      return;
    }
    if (target.dataset.sectionField) {
      const section = state.editor.sections.find((entry) => entry.id === target.dataset.sectionId);
      if (!section) return;
      section[target.dataset.sectionField] = target.type === "checkbox" ? target.checked : target.value;
      markDirty();
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "commercialReusableColumn") {
      const option = target.selectedOptions[0];
      if (target.value) {
        root.querySelector("#commercialCustomColumnName").value = option.dataset.name || option.textContent;
        root.querySelector("#commercialCustomColumnWidth").value = option.dataset.width || 15;
        root.querySelector("#commercialCustomColumnReusable").checked = false;
      }
      return;
    }
    if (target.matches("[data-final-bid]")) {
      runBusy(() => updateFinalBid(target), "Atualizando o Valor Final no orçamento…").catch((error) => toast(error.message));
    }
    if (target.matches('[data-item-field="selected"], [data-column-field="enabled"], [data-section-field="enabled"]')) {
      renderEditor();
    }
  });

  root.addEventListener("submit", (event) => {
    if (event.target.closest("#newCommercialProposalDialog")) {
      event.preventDefault();
      runBusy(createProposal, "Criando Proposta Comercial…").catch((error) => {
        const output = root.querySelector("#newCommercialProposalError");
        if (output) output.textContent = error.message;
      });
    }
    if (event.target.closest("#commercialCustomColumnDialog")) {
      event.preventDefault();
      runBusy(addCustomColumn, "Adicionando coluna…").catch((error) => {
        const output = root.querySelector("#commercialCustomColumnError");
        if (output) output.textContent = error.message;
      });
    }
  });

  root.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-proposal]");
    if (open) return void runBusy(() => openEditor(open.dataset.openProposal), "Abrindo proposta…").catch((error) => toast(error.message));
    const previewList = event.target.closest("[data-preview-proposal]");
    if (previewList) return void runBusy(async () => {
      await openEditor(previewList.dataset.previewProposal);
      await previewPdf();
    }, "Preparando pré-visualização…").catch((error) => toast(error.message));
    const download = event.target.closest("[data-download-reference]");
    if (download) return void runBusy(() => downloadReference(download.dataset.downloadReference), "Abrindo PDF…").catch((error) => toast(error.message));

    const removeColumn = event.target.closest("[data-remove-column]");
    if (removeColumn) {
      state.editor.columns = state.editor.columns.filter((column) => column.id !== removeColumn.dataset.removeColumn);
      state.editor.custom_values = state.editor.custom_values.filter((value) => value.proposal_column_id !== removeColumn.dataset.removeColumn);
      markDirty(); renderEditor(); return;
    }
    const removeSection = event.target.closest("[data-remove-section]");
    if (removeSection) {
      state.editor.sections = state.editor.sections.filter((section) => section.id !== removeSection.dataset.removeSection);
      markDirty(); renderEditor(); return;
    }
    const tab = event.target.closest("[data-proposal-tab]");
    if (tab) {
      state.activeEditorTab = tab.dataset.proposalTab;
      renderEditor();
      return;
    }
    const itemToggle = event.target.closest("[data-toggle-item]");
    if (itemToggle) {
      const itemId = itemToggle.dataset.toggleItem;
      if (state.collapsedItems.has(itemId)) state.collapsedItems.delete(itemId);
      else state.collapsedItems.add(itemId);
      renderEditor();
      return;
    }
    const action = event.target.closest("[data-proposal-action]")?.dataset.proposalAction;
    if (!action) return;
    if (action === "new") return root.querySelector("#newCommercialProposalDialog").showModal();
    if (action === "back") {
      return void requestDiscardChanges(() => {
        state.editor = null;
        runBusy(async () => { await loadList(); renderList(); }, "Atualizando propostas…").catch((error) => toast(error.message));
      });
    }
    if (action === "keep-editing") return keepEditing();
    if (action === "discard-changes") return discardChanges();
    if (action === "save") return void runBusy(() => saveProposal(false), "Salvando rascunho…").catch((error) => toast(error.message));
    if (action === "finalize") return void runBusy(() => saveProposal(true), "Finalizando proposta…").catch((error) => toast(error.message));
    if (action === "preview") return void runBusy(previewPdf, "Preparando pré-visualização…").catch((error) => toast(error.message));
    if (action === "download") return void runBusy(generateAndDownload, "Gerando e armazenando PDF…").catch((error) => toast(error.message));
    if (action === "close-preview") return root.querySelector("#commercialProposalPreviewDialog")?.close();
    if (action === "add-column") return root.querySelector("#commercialCustomColumnDialog").showModal();
    if (action === "add-text") return addTextBlock();
    if (action === "select-all" || action === "clear-selection") {
      state.editor.items.forEach((item) => {
        item.selected = action === "select-all";
        if (item.selected) state.collapsedItems.add(item.id);
        else state.collapsedItems.delete(item.id);
      });
      markDirty(); renderEditor();
    }
  });

  root.addEventListener("cancel", (event) => {
    if (event.target.id !== "commercialProposalDiscardDialog") return;
    event.preventDefault();
    keepEditing();
  }, true);

  root.addEventListener("dragstart", (event) => {
    const record = event.target.closest("[data-drag-kind]");
    if (!record) return;
    state.dragged = { kind: record.dataset.dragKind, id: record.dataset.dragId };
    event.dataTransfer.effectAllowed = "move";
  });
  root.addEventListener("dragover", (event) => {
    if (event.target.closest("[data-drag-kind]")) event.preventDefault();
  });
  root.addEventListener("drop", (event) => {
    const target = event.target.closest("[data-drag-kind]");
    if (!target || !state.dragged || target.dataset.dragKind !== state.dragged.kind) return;
    event.preventDefault();
    moveRecord(state.dragged.kind, state.dragged.id, target.dataset.dragId);
    state.dragged = null;
  });

  async function showPage() {
    if (state.editor) {
      renderEditor();
      return;
    }
    await loadList();
    renderList();
  }

  function reset() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    pendingDiscardRequest = null;
    Object.assign(state, {
      loaded: false, list: [], bids: [], editor: null, dirty: false, previewUrl: "", dragged: null,
      activeEditorTab: "proposal", collapsedItems: new Set(), permanentFields: new Set(),
    });
    root.innerHTML = "";
  }

  return { showPage, reset, requestDiscardChanges };
}

if (typeof window !== "undefined") {
  window.GLLCommercialProposals = {
    createCommercialProposalsFeature,
    commercialProposalFileName,
    moneyInWords,
    formatCommercialMoney,
  };
}
