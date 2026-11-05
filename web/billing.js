import { createFinanceLedgerPanel } from "./finance-ledger.js";

const BILLING_RECORD_TABLES = Object.freeze({
  commitment: "bid_item_commitments",
  delivery: "bid_item_deliveries",
  invoice: "bid_item_invoices",
});

const BILLING_LABELS = Object.freeze({
  commitment: "empenho",
  delivery: "entrega",
  invoice: "nota fiscal",
});

function billingEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function billingNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function billingQuantity(value) {
  return billingNumber(value).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function billingMoney(value) {
  return billingNumber(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function billingBadge(label, tone = "neutral") {
  const safeTone = ["neutral", "success", "warning", "danger", "info"].includes(tone) ? tone : "neutral";
  return window.GLLDesignSystem?.COMPONENTS?.badge({ label, tone: safeTone })
    || `<span class="ds-badge ds-badge-${safeTone}">${billingEscape(label)}</span>`;
}

function billingDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? billingEscape(value) : new Intl.DateTimeFormat("pt-BR").format(date);
}

function createBillingFeature({ getBid, getQuotation, getBudgetItems, store, toast, runBusy, onSaved, financeService, isAdmin = () => false, navigateToFinance = () => undefined }) {
  const root = document.getElementById("billingRoot");
  const drawer = document.getElementById("billingDrawer");
  const drawerContent = document.getElementById("billingDrawerContent");
  const financePanel = createFinanceLedgerPanel({
    root: document.getElementById("billingFinanceLedgerPanel"),
    service: financeService,
    getBid,
    isAdmin,
    navigate: navigateToFinance,
    onSaved,
    toast,
    financeLink: true,
  });
  const state = {
    bidId: null,
    dataStatus: "idle",
    refreshRequestId: 0,
    fulfillment: [],
    commitment: [],
    delivery: [],
    invoice: [],
    query: "",
    supplyFilter: "Todos",
    invoiceFilter: "Todos",
    selectedItemId: null,
    activeSection: null,
    editing: { commitment: null, delivery: null, invoice: null },
  };

  const recordsForItem = (kind, itemId) => {
    const fulfillment = fulfillmentFor(itemId);
    return fulfillment ? state[kind].filter((row) => Number(row.fulfillment_id) === Number(fulfillment.id)) : [];
  };

  function currentBid() {
    return getBid?.() || null;
  }

  function budgetItems() {
    return (getBudgetItems?.() || []).slice().sort((a, b) => billingNumber(a.item_number) - billingNumber(b.item_number));
  }

  function fulfillmentFor(itemId) {
    return state.fulfillment.find((row) => Number(row.quotation_item_id) === Number(itemId)) || null;
  }

  function supplierName(row) {
    if (!row) return "";
    return String(row.supplier_name || "").trim();
  }

  function summaryFor(item) {
    const itemId = Number(item.id);
    const fulfillment = fulfillmentFor(itemId);
    const commitments = recordsForItem("commitment", itemId);
    const deliveries = recordsForItem("delivery", itemId);
    const invoices = recordsForItem("invoice", itemId);
    const planned = billingNumber(item.quantity);
    const committed = commitments.reduce((sum, row) => sum + billingNumber(row.quantity), 0);
    const supplied = deliveries.reduce((sum, row) => sum + billingNumber(row.quantity), 0);
    const billed = invoices.reduce((sum, row) => sum + billingNumber(row.quantity), 0);
    const supplyStatus = supplied <= 0
      ? commitments.length ? "Em fornecimento" : "Não iniciado"
      : supplied + 0.000001 >= planned ? "Totalmente fornecido" : "Parcialmente fornecido";
    const invoiceStatus = billed <= 0
      ? "Não faturado"
      : billed + 0.000001 >= planned ? "Totalmente faturado" : "Parcialmente faturado";
    return {
      item,
      fulfillment,
      commitments,
      deliveries,
      invoices,
      planned,
      committed,
      supplied,
      billed,
      supplyStatus,
      invoiceStatus,
      supplier: supplierName(fulfillment),
      purchaseOrder: fulfillment?.purchase_order_number || "",
    };
  }

  function badgeTone(status) {
    if (status.startsWith("Totalmente")) return "success";
    if (status.startsWith("Parcialmente")) return "warning";
    if (status === "Em fornecimento") return "info";
    return "neutral";
  }

  function renderSummary(items) {
    const summaries = items.map(summaryFor);
    document.getElementById("billingItemCount").textContent = String(items.length);
    if (state.dataStatus !== "ready") {
      const unavailable = state.dataStatus === "loading" ? "…" : "—";
      document.getElementById("billingPendingCount").textContent = unavailable;
      document.getElementById("billingPartialCount").textContent = unavailable;
      document.getElementById("billingSuppliedCount").textContent = unavailable;
      document.getElementById("billingInvoicedCount").textContent = unavailable;
      return;
    }
    document.getElementById("billingPendingCount").textContent = String(summaries.filter((row) => ["Não iniciado", "Em fornecimento"].includes(row.supplyStatus)).length);
    document.getElementById("billingPartialCount").textContent = String(summaries.filter((row) => row.supplyStatus === "Parcialmente fornecido").length);
    document.getElementById("billingSuppliedCount").textContent = String(summaries.filter((row) => row.supplyStatus === "Totalmente fornecido").length);
    document.getElementById("billingInvoicedCount").textContent = String(summaries.filter((row) => row.invoiceStatus === "Totalmente faturado").length);
  }

  function matchesFilters(row) {
    const query = state.query.trim().toLocaleLowerCase("pt-BR");
    const text = [
      row.item.item_number,
      row.item.description,
      row.item.manufacturer,
      row.item.model,
      row.supplier,
      row.purchaseOrder,
    ].join(" ").toLocaleLowerCase("pt-BR");
    if (query && !text.includes(query)) return false;
    if (state.dataStatus === "ready") {
      if (state.supplyFilter === "Pendentes" && !["Não iniciado", "Em fornecimento"].includes(row.supplyStatus)) return false;
      if (state.supplyFilter === "Parciais" && row.supplyStatus !== "Parcialmente fornecido") return false;
      if (state.supplyFilter === "Concluídos" && row.supplyStatus !== "Totalmente fornecido") return false;
      if (state.invoiceFilter !== "Todos" && row.invoiceStatus !== state.invoiceFilter) return false;
    }
    return true;
  }

  function billingDataNotice() {
    if (state.dataStatus === "loading") {
      return '<tr><td colspan="7"><div class="empty-state compact-empty" role="status" aria-live="polite">Carregando dados de fornecimento e faturamento…</div></td></tr>';
    }
    if (state.dataStatus === "error") {
      return '<tr><td colspan="7"><div class="empty-state compact-empty" role="alert">Não foi possível carregar os dados de fornecimento e faturamento. <button class="quiet-action compact-action" type="button" data-retry-billing-data>Tentar novamente</button></div></td></tr>';
    }
    return "";
  }

  function renderTable() {
    if (!root) return;
    const items = budgetItems();
    const body = document.getElementById("billingTableBody");
    if (!body) return;
    const visible = items.map(summaryFor).filter(matchesFilters);
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="7"><div class="empty-state compact-empty">Nenhum item foi marcado como vencido neste edital.</div></td></tr>${billingDataNotice()}`;
      return;
    }
    if (!visible.length) {
      body.innerHTML = `<tr><td colspan="7"><div class="empty-state compact-empty">Nenhum item corresponde aos filtros selecionados.</div></td></tr>${billingDataNotice()}`;
      return;
    }
    const dataLoaded = state.dataStatus === "ready";
    const pendingLabel = state.dataStatus === "loading" ? "Carregando…" : "Indisponível";
    body.innerHTML = visible.map((row) => {
      const item = row.item;
      const progress = row.planned > 0 ? Math.min(100, Math.round((row.supplied / row.planned) * 100)) : 0;
      const supplyTone = badgeTone(row.supplyStatus);
      let safePurchaseUrl = "";
      try {
        const parsedPurchaseUrl = new URL(row.fulfillment?.purchase_link || "");
        if (["http:", "https:"].includes(parsedPurchaseUrl.protocol)) safePurchaseUrl = parsedPurchaseUrl.href;
      } catch { /* Invalid stored URLs remain plain text. */ }
      const purchase = !dataLoaded ? pendingLabel : safePurchaseUrl
        ? `<a class="table-link" href="${billingEscape(safePurchaseUrl)}" target="_blank" rel="noopener noreferrer">${billingEscape(row.purchaseOrder || "Abrir pedido")}</a>`
        : billingEscape(row.purchaseOrder || "—");
      const supplier = !dataLoaded ? `<span class="table-secondary">${pendingLabel}</span>` : row.supplier ? `<strong>${billingEscape(row.supplier)}</strong>` : '<span class="table-secondary">Fornecedor não informado</span>';
      const supplyStatus = dataLoaded
        ? `${billingBadge(row.supplyStatus, supplyTone)}<div class="billing-progress" data-tone="${supplyTone}" role="progressbar" aria-label="${billingEscape(`Fornecimento do item ${item.item_number}`)}" aria-valuemin="0" aria-valuemax="${billingEscape(row.planned)}" aria-valuenow="${billingEscape(row.supplied)}"><span style="width:${progress}%"></span></div><small>${billingQuantity(row.supplied)} de ${billingQuantity(row.planned)} fornecidos</small>`
        : billingBadge(pendingLabel);
      const invoiceStatus = dataLoaded
        ? `${billingBadge(row.invoiceStatus, badgeTone(row.invoiceStatus))}<small>${billingQuantity(row.billed)} de ${billingQuantity(row.planned)} faturados</small>`
        : billingBadge(pendingLabel);
      return `<tr>
        <td><strong>${billingEscape(item.item_number)}</strong><small class="billing-cell-subtitle">${billingEscape(item.description || "Sem descrição")}</small></td>
        <td>${billingQuantity(row.planned)}<small class="billing-cell-subtitle">${billingEscape(item.unit || "Unidade")}</small></td>
        <td><strong>${dataLoaded ? row.commitments.length ? `${row.commitments.length} ${row.commitments.length === 1 ? "empenho" : "empenhos"}` : "—" : pendingLabel}</strong><small class="billing-cell-subtitle">${dataLoaded ? billingMoney(row.commitments.reduce((sum, entry) => sum + billingNumber(entry.amount), 0)) : ""}</small></td>
        <td>${supplier}<small class="billing-cell-subtitle">Pedido ${purchase}</small></td>
        <td><div class="billing-status-stack">${supplyStatus}</div></td>
        <td><div class="billing-status-stack">${invoiceStatus}</div></td>
        <td><button class="quiet-action compact-action" type="button" data-open-billing-item="${billingEscape(item.id)}" ${dataLoaded ? "" : "disabled"}>Acompanhar</button></td>
      </tr>`;
    }).join("") + billingDataNotice();
  }

  function renderOverview() {
    const bid = currentBid();
    if (!root || !bid) return;
    const quotation = getQuotation?.() || null;
    document.getElementById("billingOverviewDescription").textContent = quotation
      ? `${quotation.agency || quotation.edital} · Orçamento #${quotation.id}`
      : bid.quotation_id ? `Itens carregados do orçamento #${bid.quotation_id}.` : "Itens carregados do orçamento vinculado à licitação.";
    renderSummary(budgetItems());
    renderTable();
  }

  function getEditingRecord(kind) {
    const id = state.editing[kind];
    return id ? state[kind].find((entry) => Number(entry.id) === Number(id)) || null : null;
  }

  function renderEntryList(kind, itemId) {
    const entries = recordsForItem(kind, itemId).slice().sort((a, b) => String(b[`${kind}_date`] || b.delivery_date || b.invoice_date || "").localeCompare(String(a[`${kind}_date`] || a.delivery_date || a.invoice_date || "")) || Number(b.id) - Number(a.id));
    if (!entries.length) return `<div class="billing-history-empty">Nenhum registro de ${BILLING_LABELS[kind]} até o momento.</div>`;
    return `<ul class="billing-history-list">${entries.map((entry) => {
      const date = entry.commitment_date || entry.delivery_date || entry.invoice_date;
      const number = entry.commitment_number || entry.invoice_number || "Entrega";
      const extra = kind === "commitment" ? billingMoney(entry.amount) : entry.notes || entry.observations || "";
      return `<li class="billing-history-entry"><div><strong>${billingEscape(number)}</strong><small>${billingDate(date)} · ${billingQuantity(entry.quantity)} un. ${extra ? `· ${billingEscape(extra)}` : ""}</small></div><div class="billing-history-actions"><button class="text-action" type="button" data-edit-billing-entry="${billingEscape(entry.id)}" data-entry-kind="${kind}">Editar</button><button class="text-action billing-delete-entry" type="button" data-delete-billing-entry="${billingEscape(entry.id)}" data-entry-kind="${kind}">Excluir</button></div></li>`;
    }).join("")}</ul>`;
  }

  function fieldMarkup({ id, name, label, type = "text", value = "", required = false, step = null, min = null, wide = false, placeholder = "" }) {
    const classes = wide ? "billing-field billing-field-wide" : "billing-field";
    const escapedValue = type === "textarea" ? "" : ` value="${billingEscape(value)}"`;
    const attrs = `${required ? " required" : ""}${step ? ` step="${step}"` : ""}${min !== null ? ` min="${min}"` : ""}${placeholder ? ` placeholder="${billingEscape(placeholder)}"` : ""}`;
    return type === "textarea"
      ? `<label class="${classes}" for="${id}">${label}<textarea id="${id}" name="${name}" rows="3"${attrs}>${billingEscape(value)}</textarea></label>`
      : `<label class="${classes}" for="${id}">${label}<input id="${id}" name="${name}" type="${type}"${escapedValue}${attrs} /></label>`;
  }

  function renderRecordForm(kind, itemId) {
    const record = getEditingRecord(kind) || {};
    const item = budgetItems().find((row) => Number(row.id) === Number(itemId));
    const itemSummary = item ? summaryFor(item) : { planned: 0 };
    const isEditing = Boolean(state.editing[kind]);
    let fields = "";
    if (kind === "commitment") {
      fields = `<div class="billing-form-grid">${fieldMarkup({ id: "billingCommitmentNumber", name: "commitment_number", label: "Número do empenho", value: record.commitment_number || "", required: true })}${fieldMarkup({ id: "billingCommitmentDate", name: "commitment_date", label: "Data", type: "date", value: record.commitment_date || new Date().toISOString().slice(0, 10), required: true })}${fieldMarkup({ id: "billingCommitmentQuantity", name: "quantity", label: "Quantidade empenhada", type: "number", value: record.quantity ?? "", required: true, min: "0.0001", step: "0.0001" })}${fieldMarkup({ id: "billingCommitmentAmount", name: "amount", label: "Valor empenhado (R$)", type: "number", value: record.amount ?? "", required: true, min: "0", step: "0.01" })}</div>`;
    } else if (kind === "delivery") {
      fields = `<div class="billing-form-grid">${fieldMarkup({ id: "billingDeliveryDate", name: "delivery_date", label: "Data da entrega", type: "date", value: record.delivery_date || new Date().toISOString().slice(0, 10), required: true })}${fieldMarkup({ id: "billingDeliveryQuantity", name: "quantity", label: "Quantidade fornecida", type: "number", value: record.quantity ?? "", required: true, min: "0.0001", step: "0.0001" })}${fieldMarkup({ id: "billingDeliveryNotes", name: "notes", label: "Observações da entrega", type: "textarea", value: record.notes || "", wide: true })}</div>`;
    } else {
      fields = `<div class="billing-form-grid">${fieldMarkup({ id: "billingInvoiceNumber", name: "invoice_number", label: "Número da nota fiscal", value: record.invoice_number || "", required: true })}${fieldMarkup({ id: "billingInvoiceDate", name: "invoice_date", label: "Data da nota fiscal", type: "date", value: record.invoice_date || new Date().toISOString().slice(0, 10), required: true })}${fieldMarkup({ id: "billingInvoiceQuantity", name: "quantity", label: "Quantidade faturada", type: "number", value: record.quantity ?? "", required: true, min: "0.0001", step: "0.0001" })}${fieldMarkup({ id: "billingInvoiceObservations", name: "observations", label: "Observações", type: "textarea", value: record.observations || "", wide: true })}</div>`;
    }
    const descriptions = {
      commitment: `Pedido: ${billingQuantity(itemSummary.committed || 0)} de ${billingQuantity(itemSummary.planned)}.`,
      delivery: `Entregue: ${billingQuantity(itemSummary.supplied)} de ${billingQuantity(itemSummary.planned)}.`,
      invoice: `Faturado: ${billingQuantity(itemSummary.billed)} de ${billingQuantity(itemSummary.planned)}.`,
    };
    return `<form class="billing-entry-form" data-billing-form="${kind}" novalidate><p class="billing-form-hint">${descriptions[kind]}</p>${fields}<p class="billing-form-error" data-billing-error="${kind}" role="alert"></p><div class="button-row end"><button class="quiet-action" type="button" data-cancel-entry="${kind}" ${isEditing ? "" : "hidden"}>Cancelar edição</button><button class="primary-action" type="submit">${isEditing ? "Salvar alterações" : `Registrar ${BILLING_LABELS[kind]}`}</button></div></form>`;
  }

  function renderBillingSection(kind, itemId, row) {
    const sections = {
      commitment: {
        title: "Pedido",
        description: `${billingQuantity(row.committed)} de ${billingQuantity(row.planned)} un. registradas em ${row.commitments.length} ${row.commitments.length === 1 ? "empenho" : "empenhos"}.`,
      },
      delivery: {
        title: "Entregue",
        description: `${billingQuantity(row.supplied)} de ${billingQuantity(row.planned)} un. entregues.`,
      },
      invoice: {
        title: "Faturado",
        description: `${billingQuantity(row.billed)} de ${billingQuantity(row.planned)} un. faturadas.`,
      },
    };
    const section = sections[kind];
    const title = document.getElementById("billingDrawerTitle");
    const description = document.getElementById("billingDrawerDescription");
    title.textContent = section.title;
    description.textContent = `Item ${row.item.item_number} · ${row.item.description || "Sem descrição"}`;
    return `<section class="billing-drawer-section" aria-labelledby="billingActiveSectionTitle"><div class="billing-section-heading billing-active-section-heading"><div><h3 id="billingActiveSectionTitle">${section.title}</h3><p>${section.description}</p></div><button class="quiet-action" type="button" data-back-billing-overview>Voltar</button></div>${renderRecordForm(kind, itemId)}${renderEntryList(kind, itemId)}</section>`;
  }

  function renderBillingOverview(row, itemId) {
    const categories = [
      { kind: "commitment", title: "Pedido", quantity: row.committed, status: null },
      { kind: "delivery", title: "Entregue", quantity: row.supplied, status: row.supplyStatus },
      { kind: "invoice", title: "Faturado", quantity: row.billed, status: row.invoiceStatus },
    ];
    return `<section class="billing-drawer-section billing-flow-section" aria-label="Resumo do item"><div class="billing-section-heading"><div><h3>Acompanhamento</h3><p>Acesse cada etapa para consultar ou registrar movimentações.</p></div></div><div class="billing-flow-list">${categories.map((category) => {
      const progress = row.planned > 0 ? Math.min(100, Math.round((category.quantity / row.planned) * 100)) : 0;
      const status = category.status ? `<span class="billing-flow-status">${billingBadge(category.status, badgeTone(category.status))}</span>` : "";
      const openLabel = `Abrir ${category.title.toLocaleLowerCase("pt-BR")}: ${billingQuantity(category.quantity)} de ${billingQuantity(row.planned)} unidades`;
      const progressLabel = `${category.title}: ${billingQuantity(category.quantity)} de ${billingQuantity(row.planned)} unidades`;
      return `<button class="billing-flow-card" type="button" data-open-billing-section="${category.kind}" aria-label="${billingEscape(openLabel)}"><span class="billing-flow-card-main"><span class="billing-flow-card-heading"><strong>${category.title}</strong>${status}</span><span class="billing-flow-card-quantity">${billingQuantity(category.quantity)} <small>de ${billingQuantity(row.planned)} un.</small></span><span class="billing-progress" data-tone="${category.status ? badgeTone(category.status) : "neutral"}" role="progressbar" aria-label="${billingEscape(progressLabel)}" aria-valuemin="0" aria-valuemax="${billingEscape(row.planned)}" aria-valuenow="${billingEscape(category.quantity)}"><span style="width:${progress}%"></span></span></span><span class="billing-flow-card-action">Ver ${category.title.toLocaleLowerCase("pt-BR")} <span aria-hidden="true">→</span></span></button>`;
    }).join("")}</div></section>`;
  }

  function renderDrawer() {
    const itemId = state.selectedItemId;
    const item = budgetItems().find((row) => Number(row.id) === Number(itemId));
    if (!item) return;
    const row = summaryFor(item);
    const drawerTitle = document.getElementById("billingDrawerTitle");
    const drawerDescription = document.getElementById("billingDrawerDescription");
    if (state.activeSection) {
      drawerContent.innerHTML = `<div class="billing-drawer-item-summary"><div><span class="eyebrow">ITEM DO ORÇAMENTO</span><h3>Item ${billingEscape(item.item_number)} · ${billingEscape(item.description || "Sem descrição")}</h3><p>${billingEscape([item.manufacturer, item.model].filter(Boolean).join(" · ") || item.unit || "")}</p></div><div class="billing-drawer-item-value"><span>Previsto</span><strong>${billingQuantity(row.planned)} un.</strong><small>${billingMoney(billingNumber(item.final_bid) * row.planned)}</small></div></div>${renderBillingSection(state.activeSection, itemId, row)}`;
      return;
    }
    drawerTitle.textContent = "Detalhes do item";
    drawerDescription.textContent = "Acompanhe o que foi pedido, entregue e faturado.";
    drawerContent.innerHTML = `<div class="billing-drawer-item-summary"><div><span class="eyebrow">ITEM DO ORÇAMENTO</span><h3>Item ${billingEscape(item.item_number)} · ${billingEscape(item.description || "Sem descrição")}</h3><p>${billingEscape([item.manufacturer, item.model].filter(Boolean).join(" · ") || item.unit || "")}</p></div><div class="billing-drawer-item-value"><span>Previsto</span><strong>${billingQuantity(row.planned)} un.</strong><small>${billingMoney(billingNumber(item.final_bid) * row.planned)}</small></div></div>${renderBillingOverview(row, itemId)}`;
  }

  async function refreshData({ keepDrawer = true } = {}) {
    const bid = currentBid();
    if (!bid) return;
    const changedBid = String(state.bidId) !== String(bid.id);
    state.bidId = bid.id;
    if (changedBid) {
      state.fulfillment = [];
      state.commitment = [];
      state.delivery = [];
      state.invoice = [];
      state.selectedItemId = null;
      state.activeSection = null;
    }
    state.dataStatus = "loading";
    const requestId = ++state.refreshRequestId;
    renderOverview();
    try {
      const result = await store.getBillingData(bid.id);
      if (requestId !== state.refreshRequestId || String(currentBid()?.id) !== String(bid.id)) return;
      state.fulfillment = result?.fulfillment || [];
      state.commitment = result?.commitment || [];
      state.delivery = result?.delivery || [];
      state.invoice = result?.invoice || [];
      state.dataStatus = "ready";
    } catch {
      if (requestId !== state.refreshRequestId || String(currentBid()?.id) !== String(bid.id)) return;
      state.dataStatus = "error";
      renderOverview();
      if (keepDrawer && drawer?.open && state.selectedItemId) renderDrawer();
      void financePanel.refresh();
      return;
    }
    renderOverview();
    await financePanel.refresh();
    if (keepDrawer && drawer?.open && state.selectedItemId) renderDrawer();
  }

  function openItem(itemId) {
    const item = budgetItems().find((row) => Number(row.id) === Number(itemId));
    if (!item) return;
    state.selectedItemId = Number(itemId);
    state.activeSection = null;
    state.editing = { commitment: null, delivery: null, invoice: null };
    renderDrawer();
    if (!drawer.open) drawer.showModal();
  }

  function closeDrawer() {
    if (drawer.open) drawer.close();
    state.selectedItemId = null;
    state.activeSection = null;
    state.editing = { commitment: null, delivery: null, invoice: null };
  }

  function validateQuantity(kind, itemId, quantity, entryId) {
    const item = budgetItems().find((row) => Number(row.id) === Number(itemId));
    const planned = billingNumber(item?.quantity);
    const used = recordsForItem(kind, itemId)
      .filter((entry) => Number(entry.id) !== Number(entryId))
      .reduce((sum, entry) => sum + billingNumber(entry.quantity), 0);
    if (!(quantity > 0)) throw new Error("Informe uma quantidade maior que zero.");
    if (used + quantity > planned + 0.000001) throw new Error(`A quantidade acumulada não pode ultrapassar ${billingQuantity(planned)} unidades.`);
  }

  function clearError(form) {
    form.querySelector("[data-billing-error]").textContent = "";
  }

  function reportFormError(form, error) {
    const message = error?.message || "Não foi possível salvar os dados.";
    form.querySelector("[data-billing-error]").textContent = message;
  }

  async function handleRecordSave(kind, form) {
    const values = new FormData(form);
    const quantity = billingNumber(values.get("quantity"));
    const entryId = state.editing[kind];
    validateQuantity(kind, state.selectedItemId, quantity, entryId);
    const record = { quantity };
    if (kind === "commitment") {
      record.commitment_number = String(values.get("commitment_number") || "").trim();
      record.commitment_date = values.get("commitment_date");
      record.amount = billingNumber(values.get("amount"));
      if (!record.commitment_number || !record.commitment_date || values.get("amount") === "" || record.amount < 0) throw new Error("Preencha número, data e valor do empenho.");
    } else if (kind === "delivery") {
      record.delivery_date = values.get("delivery_date");
      record.notes = String(values.get("notes") || "").trim();
      if (!record.delivery_date) throw new Error("Informe a data da entrega.");
    } else {
      record.invoice_number = String(values.get("invoice_number") || "").trim();
      record.invoice_date = values.get("invoice_date");
      record.observations = String(values.get("observations") || "").trim();
      if (!record.invoice_number || !record.invoice_date) throw new Error("Preencha número e data da nota fiscal.");
    }
    await runBusy(() => store.saveBillingRecord(kind, state.bidId, state.selectedItemId, record, entryId), `Salvando ${BILLING_LABELS[kind]}…`);
    onSaved?.();
    state.editing[kind] = null;
    await refreshData();
    toast(`${BILLING_LABELS[kind][0].toLocaleUpperCase("pt-BR")}${BILLING_LABELS[kind].slice(1)} salvo${kind === "invoice" ? "a" : ""}.`);
  }

  async function handleDelete(kind, id) {
    if (!window.confirm(`Excluir este registro de ${BILLING_LABELS[kind]}?`)) return;
    await runBusy(() => store.deleteBillingRecord(kind, id, state.bidId, state.selectedItemId), `Excluindo ${BILLING_LABELS[kind]}…`);
    onSaved?.();
    if (Number(state.editing[kind]) === Number(id)) state.editing[kind] = null;
    await refreshData();
    toast(`${BILLING_LABELS[kind][0].toLocaleUpperCase("pt-BR")}${BILLING_LABELS[kind].slice(1)} excluído${kind === "invoice" ? "a" : ""}.`);
  }

  function bindEvents() {
    if (!root || root.dataset.bound === "true") return;
    root.dataset.bound = "true";
    root.addEventListener("input", (event) => {
      if (event.target.id !== "billingSearch") return;
      state.query = event.target.value;
      renderTable();
    });
    root.addEventListener("change", (event) => {
      if (event.target.id === "billingSupplyFilter") state.supplyFilter = event.target.value;
      if (event.target.id === "billingInvoiceFilter") state.invoiceFilter = event.target.value;
      renderTable();
    });
    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-retry-billing-data]")) {
        void refreshData();
        return;
      }
      const button = event.target.closest("[data-open-billing-item]");
      if (button) openItem(button.dataset.openBillingItem);
    });
    drawer.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-billing-drawer]")) closeDrawer();
      const sectionButton = event.target.closest("[data-open-billing-section]");
      if (sectionButton) {
        state.activeSection = sectionButton.dataset.openBillingSection;
        renderDrawer();
      }
      if (event.target.closest("[data-back-billing-overview]")) {
        state.activeSection = null;
        renderDrawer();
      }
      const editButton = event.target.closest("[data-edit-billing-entry]");
      if (editButton) {
        state.editing[editButton.dataset.entryKind] = Number(editButton.dataset.editBillingEntry);
        renderDrawer();
      }
      const cancelButton = event.target.closest("[data-cancel-entry]");
      if (cancelButton) {
        state.editing[cancelButton.dataset.cancelEntry] = null;
        renderDrawer();
      }
      const deleteButton = event.target.closest("[data-delete-billing-entry]");
      if (deleteButton) void handleDelete(deleteButton.dataset.entryKind, Number(deleteButton.dataset.deleteBillingEntry))
        .then(() => renderDrawer())
        .catch((error) => toast(error.message, "error"));
    });
    drawer.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-billing-form]");
      if (!form) return;
      event.preventDefault();
      clearError(form);
      const kind = form.dataset.billingForm;
      void handleRecordSave(kind, form)
        .then(() => renderDrawer())
        .catch((error) => reportFormError(form, error));
    });
    drawer.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDrawer();
    });
  }

  async function showPage() {
    bindEvents();
    const bid = currentBid();
    if (!bid || !["Em Fornecimento", "Faturado"].includes(bid.status)) return;
    if (state.bidId !== bid.id) {
      state.selectedItemId = null;
      closeDrawer();
    }
    await refreshData({ keepDrawer: false });
  }

  function hide() {
    closeDrawer();
    financePanel.hide();
  }

  function reset() {
    closeDrawer();
    financePanel.hide();
    state.refreshRequestId += 1;
    state.bidId = null;
    state.dataStatus = "idle";
    state.fulfillment = [];
    state.commitment = [];
    state.delivery = [];
    state.invoice = [];
    state.query = "";
    state.supplyFilter = "Todos";
    state.invoiceFilter = "Todos";
    const search = document.getElementById("billingSearch");
    if (search) search.value = "";
    const supply = document.getElementById("billingSupplyFilter");
    const invoice = document.getElementById("billingInvoiceFilter");
    if (supply) supply.value = "Todos";
    if (invoice) invoice.value = "Todos";
  }

  return { showPage, refresh: refreshData, hide, reset };
}

if (typeof window !== "undefined") {
  window.GLLBilling = { createBillingFeature };
}
