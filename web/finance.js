import { readExpenseWorkbook } from "./finance-xlsx.js";
const TABLES = ["finance_shareholders", "finance_settings", "finance_bid_profits", "finance_receipts", "finance_expenses", "finance_reimbursements", "finance_distributions", "finance_distribution_shares", "finance_withdrawals", "finance_audit_log"];
const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const active = (rows) => (rows || []).filter((row) => !row.cancelled_at);
const sum = (rows, field = "amount") => rows.reduce((total, row) => total + Number(row[field] || 0), 0);

export const financeBidName = (bid) => bid ? `${bid.edital_number || bid.id} — ${bid.status}` : "Edital indisponível";

export function calculateFinanceSummary(data) {
  const receipts = active(data.finance_receipts);
  const reimbursements = active(data.finance_reimbursements);
  const withdrawals = active(data.finance_withdrawals);
  return {
    balance: Number(data.finance_settings?.[0]?.opening_balance || 0) + sum(receipts) - sum(reimbursements) - sum(withdrawals),
    expected: sum(active(data.finance_bid_profits), "expected_profit"),
    received: sum(receipts),
    owed: active(data.finance_expenses).reduce((total, expense) => total + Number(expense.amount) - Number(expense.historical_reimbursed || 0) - sum(reimbursements.filter((row) => row.expense_id === expense.id)), 0),
  };
}

export function createFinanceFeature({ getClient, getOrganizationId, getBids, getSuggestedProfit, isAdmin }) {
  const root = document.getElementById("financeRoot");
  const status = document.getElementById("financeStatus");
  let data = {};
  let edit = null;
  let importRows = [];
  let generation = 0;
  let saving = false;
  const validBid = (bid) => bid && ["Em Fornecimento", "Faturado"].includes(bid.status);
  const bidName = financeBidName;
  const find = (table, id) => (data[table] || []).find((row) => String(row.id) === String(id));
  const shareholder = (id) => find("finance_shareholders", id)?.name || "Acionista indisponível";
  const profitLabel = (row) => `${bidName(getBids().find((bid) => String(bid.id) === String(row.bid_id)))} — ${money(row.expected_profit)}`;
  const expenseLabel = (row) => `${row.description} — ${shareholder(row.shareholder_id)} (${money(row.amount)})`;
  const distributionLabel = (row) => `${row.distributed_on} — ${row.description || "Distribuição"}`;
  const shareLabel = (row) => `${shareholder(row.shareholder_id)} — ${money(row.amount)}`;
  const defs = [
    { table: "finance_bid_profits", title: "Lucro previsto por edital", fields: [["bid_id", "Edital", "bids"], ["expected_profit", "Lucro previsto", "number"]] },
    { table: "finance_receipts", title: "Recebimentos de lucro", fields: [["bid_profit_id", "Lucro do edital", "profits"], ["received_on", "Data do recebimento", "date"], ["amount", "Valor recebido", "number"]] },
    { table: "finance_expenses", title: "Custos pagos por acionistas", fields: [["shareholder_id", "Acionista pagador", "shareholders"], ["paid_on", "Data do pagamento", "date"], ["description", "Descrição", "text"], ["amount", "Valor do custo", "number"]] },
    { table: "finance_reimbursements", title: "Ressarcimentos", fields: [["expense_id", "Custo", "expenses"], ["paid_on", "Data do ressarcimento", "date"], ["amount", "Valor ressarcido", "number"]] },
    { table: "finance_distributions", title: "Distribuições", fields: [["distributed_on", "Data da distribuição", "date"], ["description", "Descrição", "optional"]] },
    { table: "finance_distribution_shares", title: "Parcelas por acionista", fields: [["distribution_id", "Distribuição", "distributions"], ["shareholder_id", "Acionista", "shareholders"], ["amount", "Valor da parcela", "number"]] },
    { table: "finance_withdrawals", title: "Saques de lucro", fields: [["share_id", "Parcela do acionista", "shares"], ["paid_on", "Data do saque", "date"], ["amount", "Valor do saque", "number"]] },
  ];
  function choices(type) {
    if (type === "bids") return getBids().filter(validBid).map((row) => [row.id, bidName(row)]);
    if (type === "shareholders") return (data.finance_shareholders || []).filter((row) => row.active).map((row) => [row.id, row.name]);
    if (type === "profits") return active(data.finance_bid_profits).filter((row) => validBid(getBids().find((bid) => String(bid.id) === String(row.bid_id)))).map((row) => [row.id, profitLabel(row)]);
    if (type === "expenses") return active(data.finance_expenses).map((row) => [row.id, expenseLabel(row)]);
    if (type === "distributions") return active(data.finance_distributions).map((row) => [row.id, distributionLabel(row)]);
    if (type === "shares") return active(data.finance_distribution_shares).map((row) => [row.id, shareLabel(row)]);
    return [];
  }
  function fieldMarkup([name, label, type], value) {
    if (["bids", "shareholders", "profits", "expenses", "distributions", "shares"].includes(type)) {
      const options = choices(type);
      if (value && !options.some(([id]) => String(id) === String(value))) options.push([value, "Valor existente (indisponível para novo lançamento)"]);
      return `<label>${label}<select name="${name}" required><option value="">Selecione</option>${options.map(([id, text]) => `<option value="${escapeHtml(id)}" ${String(id) === String(value) ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
    }
    return `<label>${label}<input name="${name}" type="${type === "optional" ? "text" : type}" ${type === "number" ? 'step="0.01"' : ""} ${type === "optional" ? "" : "required"} value="${escapeHtml(value ?? "")}" /></label>`;
  }
  function valueText(name, value) {
    if (["amount", "expected_profit"].includes(name)) return money(value);
    if (name === "shareholder_id") return shareholder(value);
    if (name === "bid_id") return bidName(getBids().find((row) => String(row.id) === String(value)));
    if (name === "bid_profit_id") return profitLabel(find("finance_bid_profits", value) || {});
    if (name === "expense_id") return expenseLabel(find("finance_expenses", value) || {});
    if (name === "distribution_id") return distributionLabel(find("finance_distributions", value) || {});
    if (name === "share_id") return shareLabel(find("finance_distribution_shares", value) || {});
    return value ?? "";
  }
  function render() {
    const summary = calculateFinanceSummary(data);
    root.innerHTML = `<section class="section-band"><h2>Visão geral</h2><p>Caixa: <strong>${money(summary.balance)}</strong> · Lucro previsto: ${money(summary.expected)} · Lucro recebido: ${money(summary.received)} · A ressarcir: ${money(summary.owed)}</p><form data-settings class="form-grid"><label>Saldo inicial<input name="opening_balance" type="number" step="0.01" required value="${escapeHtml(data.finance_settings?.[0]?.opening_balance ?? 0)}" /></label><button class="primary-action" type="submit">Salvar saldo inicial</button></form><p>O saldo considera lucros recebidos, ressarcimentos e saques. Custos pagos pelos acionistas não reduzem o caixa antes do ressarcimento.</p></section>` + defs.map((def) => {
      const current = edit?.table === def.table ? find(def.table, edit.id) : null;
      const rows = data[def.table] || [];
      return `<section class="section-band"><h2>${def.title}</h2><form data-table="${def.table}" class="form-grid">${def.fields.map((field) => fieldMarkup(field, current?.[field[0]])).join("")}<div class="button-row"><button class="primary-action" type="submit">${current ? "Salvar correção" : "Adicionar"}</button>${current ? '<button class="quiet-action" type="button" data-clear-edit>Cancelar edição</button>' : ""}</div></form><div>${rows.length ? rows.map((row) => {
        const warning = def.table === "finance_bid_profits" && !validBid(getBids().find((bid) => String(bid.id) === String(row.bid_id))) ? " — edital fora dos status elegíveis" : "";
        const detail = def.fields.map(([name, label]) => `${label}: ${escapeHtml(valueText(name, row[name]))}`).join(" · ");
        const extra = def.table === "finance_expenses" ? ` · Ressarcimento histórico: ${money(row.historical_reimbursed)} · A ressarcir: ${money(Number(row.amount) - Number(row.historical_reimbursed || 0) - sum(active(data.finance_reimbursements).filter((item) => item.expense_id === row.id)))}`
          : def.table === "finance_bid_profits" ? ` · Recebido: ${money(sum(active(data.finance_receipts).filter((item) => item.bid_profit_id === row.id)))} · Saldo previsto: ${money(Number(row.expected_profit) - sum(active(data.finance_receipts).filter((item) => item.bid_profit_id === row.id)))}`
          : def.table === "finance_distribution_shares" ? ` · Sacado: ${money(sum(active(data.finance_withdrawals).filter((item) => item.share_id === row.id)))} · Saldo da parcela: ${money(Number(row.amount) - sum(active(data.finance_withdrawals).filter((item) => item.share_id === row.id)))}` : "";
        return `<div class="section-band"><p>${detail}${extra}${escapeHtml(warning)}${row.cancelled_at ? " · Cancelado" : ""}</p>${row.cancelled_at ? "" : `<div class="button-row"><button class="quiet-action" type="button" data-edit-table="${def.table}" data-id="${escapeHtml(row.id)}">Corrigir</button><button class="danger-action" type="button" data-cancel-table="${def.table}" data-id="${escapeHtml(row.id)}">Cancelar lançamento</button></div>`}</div>`;
      }).join("") : '<p>Nenhum lançamento.</p>'}</div></section>`;
    }).join("") + `<section class="section-band"><h2>Importar despesas</h2><p>Selecione a planilha atual para conferir os lançamentos. Os dados são lidos neste navegador. Despesas já ressarcidas não geram nova saída do caixa.</p><label>Arquivo XLSX<input data-import-file type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></label><div id="financeImportPreview"></div></section><section class="section-band"><h2>Histórico de alterações</h2>${(data.finance_audit_log || []).length ? `<div>${data.finance_audit_log.slice().reverse().map((row) => `<details><summary>${escapeHtml(row.changed_at)} · ${escapeHtml(row.table_name)} · ${escapeHtml(row.operation)}</summary><p>Responsável: ${escapeHtml(row.actor_id)}</p><pre>${escapeHtml(JSON.stringify({ anterior: row.old_data, atual: row.new_data }, null, 2))}</pre></details>`).join("")}</div>` : "<p>Nenhuma alteração registrada.</p>"}</section>`;
    renderImport();
  }
  function importKey(row) { return [row.paid_on, Number(row.amount).toFixed(2), row.description.trim().toLocaleLowerCase("pt-BR"), row.shareholder_id].join("|"); }
  function renderImport() {
    const container = document.getElementById("financeImportPreview");
    if (!container || !importRows.length) return;
    const seen = new Set(active(data.finance_expenses).map(importKey));
    container.innerHTML = `<form data-import><p>Confira os dados e associe cada pagador. Possíveis duplicidades começam desmarcadas.</p>${importRows.map((row, index) => {
      const match = (data.finance_shareholders || []).find((item) => item.name.trim().toLocaleLowerCase("pt-BR") === row.payer.toLocaleLowerCase("pt-BR"));
      row.shareholder_id ||= match?.id || "";
      const valid = row.paid_on && Number.isFinite(row.amount) && row.description && ["sim", "nao"].includes(row.reimbursed);
      const key = importKey(row), duplicate = seen.has(key);
      seen.add(key);
      return `<div class="section-band"><label><input type="checkbox" name="include_${index}" ${valid && !duplicate && row.selected !== false ? "checked" : ""} /> Importar linha ${row.row}</label><p>${escapeHtml(row.paid_on || "Data inválida")} · ${Number.isFinite(row.amount) ? money(row.amount) : "Valor inválido"} · ${escapeHtml(row.description)} · Pagador: ${escapeHtml(row.payer)} · Ressarcido: ${escapeHtml(row.reimbursed)} ${duplicate ? "· Possível duplicidade" : ""} ${valid ? "" : "· Dados inválidos: esta linha não pode ser importada"}</p><label>Acionista<select name="shareholder_${index}"><option value="">Selecione</option>${(data.finance_shareholders || []).map((person) => `<option value="${escapeHtml(person.id)}" ${person.id === row.shareholder_id ? "selected" : ""}>${escapeHtml(person.name)}${person.active ? "" : " (inativo)"}</option>`).join("")}</select></label></div>`;
    }).join("")}<button class="primary-action" type="submit">Confirmar importação</button></form>`;
  }
  async function fetchAll(table) {
    const rows = [];
    for (let from = 0; ; from += 500) {
      const result = await getClient().from(table).select("*").eq("organization_id", getOrganizationId()).order(table === "finance_settings" ? "organization_id" : "id").range(from, from + 499);
      if (result.error) throw new Error(result.error.message);
      rows.push(...(result.data || []));
      if (!result.data || result.data.length < 500) break;
    }
    return rows;
  }
  async function refresh() {
    if (!isAdmin() || !getClient() || !getOrganizationId()) throw new Error("Financeiro disponível apenas para administradores conectados.");
    const current = ++generation;
    status.textContent = "Carregando informações financeiras…";
    const results = await Promise.all(TABLES.map(fetchAll));
    if (current !== generation) return;
    data = Object.fromEntries(TABLES.map((table, index) => [table, results[index]]));
    status.textContent = "";
    render();
  }
  async function showPage() {
    try { await refresh(); } catch (error) { root.replaceChildren(); status.textContent = error.message; }
  }
  root.addEventListener("change", (event) => {
    if (event.target.name?.startsWith("shareholder_") && event.target.form?.hasAttribute("data-import")) {
      const form = event.target.form;
      importRows.forEach((row, index) => { row.selected = form.elements[`include_${index}`]?.checked; row.shareholder_id = form.elements[`shareholder_${index}`]?.value || ""; });
      renderImport();
      return;
    }
    if (event.target.hasAttribute("data-import-file")) {
      const file = event.target.files?.[0];
      if (!file) return;
      const current = generation;
      status.textContent = "Lendo planilha neste navegador…";
      void readExpenseWorkbook(file).then((rows) => { if (current !== generation || !isAdmin()) return; importRows = rows; renderImport(); status.textContent = rows.length ? "Confira a prévia antes de importar." : "Nenhuma despesa encontrada."; }).catch((error) => { if (current !== generation) return; importRows = []; renderImport(); status.textContent = error.message; });
      return;
    }
    if (event.target.name !== "bid_id") return;
    const bid = getBids().find((row) => String(row.id) === event.target.value);
    const suggested = bid && getSuggestedProfit(bid);
    const input = event.target.form?.elements.expected_profit;
    if (input) input.value = suggested == null ? "" : Number(suggested).toFixed(2);
  });
  root.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const form = event.target;
    try {
      if (!isAdmin() || !getClient()) throw new Error("Acesso não autorizado.");
      const formData = new FormData(form);
      let result;
      if (form.hasAttribute("data-import")) {
        const selected = importRows.map((row, index) => ({ ...row, include: formData.has(`include_${index}`), shareholder_id: formData.get(`shareholder_${index}`) })).filter((row) => row.include);
        if (!selected.length) throw new Error("Selecione ao menos uma linha para importar.");
        if (selected.some((row) => !row.paid_on || !Number.isFinite(row.amount) || !row.description || !row.shareholder_id || !["sim", "nao"].includes(row.reimbursed))) throw new Error("Corrija ou desmarque as linhas inválidas e associe cada pagador.");
        const newest = await fetchAll("finance_expenses");
        const keys = new Set(active(newest).map(importKey));
        let duplicate = false;
        for (const row of selected) { const key = importKey(row); if (keys.has(key)) duplicate = true; keys.add(key); }
        if (duplicate && !window.confirm("Há possíveis despesas duplicadas. Deseja importar mesmo assim?")) return;
        result = await getClient().from("finance_expenses").insert(selected.map((row) => ({ organization_id: getOrganizationId(), paid_on: row.paid_on, amount: row.amount, description: row.description, shareholder_id: row.shareholder_id, historical_reimbursed: row.reimbursed === "sim" ? row.amount : 0 })));
        importRows = [];
        if (result.error) { await refresh(); throw new Error("Não foi possível confirmar a importação. Confira os lançamentos existentes antes de tentar novamente. " + result.error.message); }
      } else if (form.hasAttribute("data-settings")) {
        result = await getClient().from("finance_settings").upsert({ organization_id: getOrganizationId(), opening_balance: Number(formData.get("opening_balance")) });
      } else {
        const def = defs.find((item) => item.table === form.dataset.table);
        if (!def) return;
        const payload = Object.fromEntries(def.fields.map(([name, , type]) => [name, type === "number" ? Number(formData.get(name)) : formData.get(name)]));
        const existingProfit = edit?.table === def.table ? find(def.table, edit.id) : null;
        if (def.table === "finance_bid_profits" && String(existingProfit?.bid_id || "") !== String(payload.bid_id) && !validBid(getBids().find((row) => String(row.id) === String(payload.bid_id)))) throw new Error("Selecione edital em fornecimento ou faturado.");
        const query = getClient().from(def.table);
        result = edit?.table === def.table ? await query.update(payload).eq("id", edit.id).eq("organization_id", getOrganizationId()) : await query.insert({ ...payload, organization_id: getOrganizationId() });
      }
      if (result.error) throw result.error;
      edit = null;
      await refresh();
      status.textContent = "Lançamento salvo.";
    } catch (error) { status.textContent = error.message || "Não foi possível salvar."; }
    finally { saving = false; }
  });
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-clear-edit")) { edit = null; render(); return; }
    if (button.dataset.editTable) { edit = { table: button.dataset.editTable, id: button.dataset.id }; render(); return; }
    if (!button.dataset.cancelTable || !window.confirm("Cancelar este lançamento? O histórico será preservado.")) return;
    try {
      const result = await getClient().from(button.dataset.cancelTable).update({ cancelled_at: new Date().toISOString() }).eq("id", button.dataset.id).eq("organization_id", getOrganizationId());
      if (result.error) throw result.error;
      edit = null;
      await refresh();
      status.textContent = "Lançamento cancelado.";
    } catch (error) { status.textContent = error.message || "Não foi possível cancelar."; }
  });
  return { showPage, reset() { generation += 1; data = {}; edit = null; importRows = []; root.replaceChildren(); status.textContent = ""; } };
}

if (typeof window !== "undefined") window.GLLFinance = { createFinanceFeature };
