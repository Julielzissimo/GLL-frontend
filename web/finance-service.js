import {
  moneyToDecimalString,
  parseMoneyToCents,
  parseQuantityToUnits,
  quantityUnitsToNumber,
} from "./finance-money.js";

const CASHFLOW_PROOF_BUCKET = "cashflow-proofs";
const QUERY_PAGE_SIZE = 1000;

function assertSupabase(error) {
  if (!error) return;
  const normalized = new Error(error.message || "Não foi possível acessar o Fluxo de Caixa.");
  normalized.code = error.code;
  throw normalized;
}

async function loadAll(queryFactory) {
  const rows = [];
  for (let offset = 0; ; offset += QUERY_PAGE_SIZE) {
    const { data, error } = await queryFactory().range(offset, offset + QUERY_PAGE_SIZE - 1);
    assertSupabase(error);
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) return rows;
  }
}

function textId(value) {
  return value === null || value === undefined ? "" : String(value);
}

function multiplyMoneyByQuantity(unitPrice, quantity) {
  const priceCents = BigInt(parseMoneyToCents(unitPrice));
  const quantityUnits = BigInt(parseQuantityToUnits(quantity));
  return Number((priceCents * quantityUnits + 5000n) / 10000n);
}

function moneyForApi(cents) {
  return moneyToDecimalString(cents);
}

export async function loadCashflowData(client, accessibleBids = []) {
  if (!client) throw new Error("O Fluxo de Caixa está disponível somente após entrar em uma organização conectada ao Supabase.");
  const bids = Array.isArray(accessibleBids) ? accessibleBids : [];
  const bidIds = bids.map((bid) => textId(bid.id)).filter(Boolean);
  const quotationIds = [...new Set(bids.map((bid) => textId(bid.quotation_id)).filter(Boolean))];

  const [settingsResult, parties, receipts, receiptLines, allocations, expenses, reimbursements, withdrawals, auditEvents] = await Promise.all([
    client.from("cashflow_settings").select("*").maybeSingle(),
    loadAll(() => client.from("cashflow_parties").select("*").order("name", { ascending: true })),
    loadAll(() => client.from("cashflow_receipts").select("*").order("received_on", { ascending: false })),
    loadAll(() => client.from("cashflow_receipt_lines").select("*").order("created_at", { ascending: false })),
    loadAll(() => client.from("cashflow_receipt_allocations").select("*").order("created_at", { ascending: false })),
    loadAll(() => client.from("cashflow_expenses").select("*").order("occurred_on", { ascending: false })),
    loadAll(() => client.from("cashflow_reimbursements").select("*").order("paid_on", { ascending: false })),
    loadAll(() => client.from("cashflow_withdrawals").select("*").order("withdrawn_on", { ascending: false })),
    loadAll(() => client.from("cashflow_audit_events").select("*").order("created_at", { ascending: false })),
  ]);
  assertSupabase(settingsResult.error);

  let invoiceRows = [];
  let invoiceSummaries = [];
  let fulfillmentRows = [];
  let quotationItems = [];
  let bidItems = [];
  if (bidIds.length) {
    [invoiceRows, fulfillmentRows, bidItems, invoiceSummaries] = await Promise.all([
      loadAll(() => client.from("bid_item_invoices")
        .select("id,bid_id,fulfillment_id,invoice_number,invoice_date,quantity")
        .in("bid_id", bidIds)
        .order("invoice_date", { ascending: false })),
      loadAll(() => client.from("bid_item_fulfillments")
        .select("id,bid_id,quotation_item_id")
        .in("bid_id", bidIds)),
      loadAll(() => client.from("items")
        .select("id,bid_id,quotation_item_id,item_number,name,is_won")
        .in("bid_id", bidIds)),
      loadAll(() => client.from("cashflow_invoice_receipt_summary")
        .select("invoice_id,invoice_total_amount,received_quantity,received_amount")
        .in("bid_id", bidIds)),
    ]);
  }
  if (quotationIds.length) {
    quotationItems = await loadAll(() => client.from("quotation_items")
      .select("id,quotation_id,item_number,description,unit,quantity,final_bid,supplier_cost")
      .in("quotation_id", quotationIds));
  }

  const activeReceiptIds = new Set(receipts.filter((row) => !row.reversed_at).map((row) => String(row.id)));
  const paidQuantityByInvoice = new Map();
  const paidAmountByInvoice = new Map();
  for (const line of receiptLines) {
    if (!activeReceiptIds.has(String(line.receipt_id))) continue;
    const key = String(line.invoice_id);
    paidQuantityByInvoice.set(key, (paidQuantityByInvoice.get(key) || 0) + Number(line.received_quantity || 0));
    paidAmountByInvoice.set(key, (paidAmountByInvoice.get(key) || 0) + parseMoneyToCents(line.received_amount));
  }

  const fulfillmentById = new Map(fulfillmentRows.map((row) => [String(row.id), row]));
  const quotationItemById = new Map(quotationItems.map((row) => [String(row.id), row]));
  const awardByBidAndQuotationItem = new Map(bidItems.map((row) => [
    `${row.bid_id}:${row.quotation_item_id}`,
    row,
  ]));
  const invoiceSummaryById = new Map(invoiceSummaries.map((row) => [String(row.invoice_id), row]));
  const allInvoices = invoiceRows.flatMap((invoice) => {
    const fulfillment = fulfillmentById.get(String(invoice.fulfillment_id));
    const quotationItem = fulfillment && quotationItemById.get(String(fulfillment.quotation_item_id));
    const awardedItem = fulfillment && awardByBidAndQuotationItem.get(`${invoice.bid_id}:${fulfillment.quotation_item_id}`);
    if (!fulfillment || !quotationItem || !awardedItem?.is_won) return [];
    const calculatedFaceAmountCents = multiplyMoneyByQuantity(quotationItem.final_bid, invoice.quantity);
    const invoiceSummary = invoiceSummaryById.get(String(invoice.id));
    const faceAmountCents = invoiceSummary
      ? parseMoneyToCents(invoiceSummary.invoice_total_amount)
      : calculatedFaceAmountCents;
    const receivedAmountCents = invoiceSummary
      ? parseMoneyToCents(invoiceSummary.received_amount)
      : (paidAmountByInvoice.get(String(invoice.id)) || 0);
    const receivedQuantity = invoiceSummary
      ? Number(invoiceSummary.received_quantity || 0)
      : (paidQuantityByInvoice.get(String(invoice.id)) || 0);
    const invoiceQuantity = invoiceSummary
      ? Number(invoiceSummary.invoice_quantity || invoice.quantity || 0)
      : Number(invoice.quantity || 0);
    return [{
      ...invoice,
      id: String(invoice.id),
      fulfillment_id: String(invoice.fulfillment_id),
      quotation_item_id: String(fulfillment.quotation_item_id),
      invoice_quantity: invoiceQuantity,
      item_number: quotationItem.item_number,
      item_description: quotationItem.description || awardedItem.name || "Item sem descrição",
      item_unit: quotationItem.unit || "un.",
      unit_sale_cents: parseMoneyToCents(invoiceSummary?.unit_sale_price ?? quotationItem.final_bid),
      unit_cost_cents: parseMoneyToCents(quotationItem.supplier_cost),
      face_amount_cents: faceAmountCents,
      received_amount_cents: receivedAmountCents,
      received_quantity: receivedQuantity,
      open_amount_cents: Math.max(0, faceAmountCents - receivedAmountCents),
      open_quantity: Math.max(0, invoiceQuantity - receivedQuantity),
    }];
  }).filter((invoice) => invoice.face_amount_cents > 0);
  const invoices = allInvoices.filter((invoice) => invoice.open_amount_cents > 0 && invoice.open_quantity > 0);

  return {
    settings: settingsResult.data || { default_expense_reserve_percent: "0.00", opening_cash_balance: "0.00" },
    parties,
    receipts,
    receiptLines,
    allocations,
    expenses,
    reimbursements,
    withdrawals,
    auditEvents,
    invoices,
    allInvoices,
  };
}

export function createCashflowService(client) {
  if (!client) throw new Error("Conecte-se ao Supabase para usar o Fluxo de Caixa.");

  return {
    load: (bids) => loadCashflowData(client, bids),

    async saveParty({ id, name, sharePercent, active = true }) {
      const { data, error } = await client.rpc("save_cashflow_party", {
        p_party_id: id || null,
        p_name: name,
        p_party_type: "participant",
        p_default_share_percent: String(sharePercent ?? 0),
        p_active: Boolean(active),
      });
      assertSupabase(error);
      return data;
    },

    async recordReceipt(receipt) {
      const lines = receipt.lines.map((line) => ({
        invoice_id: String(line.invoiceId),
        received_quantity: String(line.receivedQuantity),
        received_amount: moneyForApi(line.amountCents),
        cost_amount: moneyForApi(line.costCents),
        cost_justification: line.costJustification || "",
        reserve_amount: moneyForApi(line.reserveCents),
        reserve_justification: line.reserveJustification || "",
        participant_allocations: (line.participantAllocations || []).map((allocation) => ({
          participant_id: String(allocation.participantId),
          amount: moneyForApi(allocation.amountCents),
        })),
      }));
      const { data, error } = await client.rpc("record_cashflow_receipt", {
        p_bid_id: String(receipt.bidId),
        p_received_on: receipt.receivedOn,
        p_payment_method: receipt.paymentMethod,
        p_payment_reference: receipt.paymentReference || "",
        p_notes: receipt.notes || "",
        p_distribution_mode: receipt.distributionMode,
        p_distribution_justification: receipt.distributionJustification || "",
        p_idempotency_key: receipt.idempotencyKey,
        p_lines: lines,
      });
      assertSupabase(error);
      return data;
    },

    async recordExpense(expense) {
      const { data, error } = await client.rpc("record_cashflow_expense", {
        p_idempotency_key: expense.idempotencyKey,
        p_description: expense.description,
        p_category: expense.category,
        p_amount: moneyForApi(expense.amountCents),
        p_occurred_on: expense.occurredOn,
        p_payment_method: expense.paymentMethod,
        p_payer_type: expense.payerType,
        p_payer_party_id: expense.payerPartyId || null,
        p_bid_id: null,
        p_quotation_item_id: null,
        p_profit_treatment: expense.profitTreatment || "expense_reserve",
        p_justification: expense.justification || "",
        p_notes: expense.notes || "",
        p_proof_storage_path: expense.proofStoragePath || null,
      });
      assertSupabase(error);
      return data;
    },

    async recordReimbursement(reimbursement) {
      const { data, error } = await client.rpc("record_cashflow_reimbursement", {
        p_expense_id: reimbursement.expenseId,
        p_amount: moneyForApi(reimbursement.amountCents),
        p_paid_on: reimbursement.paidOn,
        p_payment_method: reimbursement.paymentMethod,
        p_funding_source: reimbursement.fundingSource,
        p_notes: reimbursement.notes || "",
        p_idempotency_key: reimbursement.idempotencyKey,
      });
      assertSupabase(error);
      return data;
    },

    async recordWithdrawal(withdrawal) {
      const { data, error } = await client.rpc("record_cashflow_withdrawal", {
        p_bid_id: String(withdrawal.bidId),
        p_participant_id: withdrawal.participantId,
        p_amount: moneyForApi(withdrawal.amountCents),
        p_withdrawn_on: withdrawal.withdrawnOn,
        p_payment_method: withdrawal.paymentMethod,
        p_notes: withdrawal.notes || "",
        p_idempotency_key: withdrawal.idempotencyKey,
      });
      assertSupabase(error);
      return data;
    },

    async reverseReceipt(receiptId, reason) {
      const { data, error } = await client.rpc("reverse_cashflow_receipt", {
        p_receipt_id: receiptId,
        p_reason: reason,
      });
      assertSupabase(error);
      return data;
    },

    async uploadProof(organizationId, file) {
      const extension = String(file.name || "comprovante").split(".").pop().replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "bin";
      const objectId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const path = `${organizationId}/expenses/${objectId}.${extension}`;
      const { error } = await client.storage.from(CASHFLOW_PROOF_BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      assertSupabase(error);
      return path;
    },

    async removeProof(path) {
      if (!path) return;
      const { error } = await client.storage.from(CASHFLOW_PROOF_BUCKET).remove([path]);
      assertSupabase(error);
    },

    async signedProofUrl(path) {
      if (!path) return null;
      const { data, error } = await client.storage.from(CASHFLOW_PROOF_BUCKET).createSignedUrl(path, 600);
      assertSupabase(error);
      return data?.signedUrl || null;
    },
  };
}

window.GLLFinanceService = Object.freeze({ createCashflowService, loadCashflowData });
