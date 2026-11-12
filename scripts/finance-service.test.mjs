import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {};
const { createCashflowService, eligibleReceiptBids, loadCashflowData, receiptItemAlreadyFullyRegistered, receiptSourcesForAwardedItem } = await import("../web/finance-service.js");

function makeClient(rowsByTable = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        select() { return this; },
        order() { return this; },
        in() { return this; },
        maybeSingle() { return Promise.resolve({ data: rowsByTable[table] ?? null, error: null }); },
        range() { return Promise.resolve({ data: rowsByTable[table] ?? [], error: null }); },
      };
    },
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: { id: "receipt-1" }, error: null };
    },
  };
}

test("eligible receipt bids require an allowed status and at least one won item", () => {
  const bids = [
    { id: "supply", status: "Em Fornecimento" },
    { id: "invoiced", status: "Faturado" },
    { id: "other", status: "Aprovada" },
    { id: "no-winner", status: "Faturado" },
  ];
  const items = [
    { bid_id: "supply", is_won: 1 },
    { bid_id: "invoiced", is_won: "1" },
    { bid_id: "other", is_won: 1 },
    { bid_id: "no-winner", is_won: 0 },
  ];

  assert.deepEqual(eligibleReceiptBids(bids, items).map((bid) => bid.id), ["supply", "invoiced"]);
});

test("a fully registered receipt item is no longer selectable", () => {
  const item = {
    received_quantity: 10,
    open_quantity: 0,
    open_amount_cents: 0,
  };
  assert.equal(receiptItemAlreadyFullyRegistered(item), true);
  assert.equal(receiptItemAlreadyFullyRegistered({ ...item, open_quantity: 1 }), false);
  assert.equal(receiptItemAlreadyFullyRegistered({ ...item, open_amount_cents: 1 }), false);
  assert.equal(receiptItemAlreadyFullyRegistered({ ...item, received_quantity: 0 }), false);
});

test("distribution bid choices require an invoice for a won item", () => {
  const bids = [
    { id: "with-invoice", status: "Em Fornecimento" },
    { id: "without-invoice", status: "Faturado" },
  ];
  const items = [
    { bid_id: "with-invoice", quotation_item_id: 101, is_won: 1 },
    { bid_id: "without-invoice", quotation_item_id: 202, is_won: 1 },
  ];
  const invoices = [{ bid_id: "with-invoice", quotation_item_id: "101" }];

  assert.deepEqual(eligibleReceiptBids(bids, items, invoices).map((bid) => bid.id), ["with-invoice"]);
});

test("receipt source choices do not duplicate an item that has linked invoices", () => {
  const item = { bid_id: "bid-1", quotation_item_id: 101 };
  const invoices = [
    { id: "invoice-1", bid_id: "bid-1", quotation_item_id: "101" },
    { id: "invoice-other-item", bid_id: "bid-1", quotation_item_id: 202 },
    { id: "invoice-other-bid", bid_id: "bid-2", quotation_item_id: 101 },
  ];

  assert.deepEqual(receiptSourcesForAwardedItem(item, invoices), [invoices[0]]);
});

test("receipt source choices omit items that have no invoice", () => {
  const item = { bid_id: "bid-1", quotation_item_id: 101 };
  const invoices = [{ id: "invoice-other-item", bid_id: "bid-1", quotation_item_id: 202 }];

  assert.deepEqual(receiptSourcesForAwardedItem(item, invoices), []);
});

test("cashflow data exposes a won item even when there are no invoices", async () => {
  const client = makeClient({
    cashflow_settings: null,
    items: [{ id: 1, bid_id: "bid-1", quotation_item_id: 101, item_number: 1, name: "Produto", is_won: 1 }],
    cashflow_item_receipt_summary: [{
      bid_id: "bid-1", quotation_item_id: 101, contract_quantity: "10.0000",
      unit_sale_price: "100.0000", contract_total_amount: "1000.00",
      unit_cost_price: "28.7950", received_quantity: "2.0000", received_amount: "200.00",
    }],
    quotation_items: [{
      id: 101, quotation_id: 201, item_number: 1, description: "Produto",
      unit: "un.", quantity: "10.0000", final_bid: "100.0000", supplier_cost: "40.0000",
    }],
  });

  const data = await loadCashflowData(client, [{ id: "bid-1", quotation_id: 201 }]);

  assert.equal(data.invoices.length, 0);
  assert.equal(data.awardedItems.length, 1);
  assert.equal(data.awardedItems[0].open_quantity, 8);
  assert.equal(data.awardedItems[0].open_amount_cents, 80000);
  assert.equal(data.awardedItems[0].unit_cost_price, "28.7950");
});

test("distribution RPC rejects an item line with no invoice", async () => {
  const client = makeClient();
  const service = createCashflowService(client);

  await assert.rejects(service.distributeReceipt({
    bidId: "bid-1",
    receivedOn: "2026-11-06",
    paymentMethod: "transfer",
    distributionMode: "default",
    idempotencyKey: "key-1",
    lines: [{
      invoiceId: null,
      quotationItemId: "101",
      receivedQuantity: 1,
      amountCents: 10000,
      costCents: 4000,
      reserveCents: 600,
    }],
  }), /somente itens faturados/);
  assert.equal(client.calls.length, 0);
});

test("distribution payload carries invoice, cost justification and each item's distribution choice", async () => {
  const client = makeClient();
  await createCashflowService(client).distributeReceipt({
    bidId: "bid-1", receivedOn: "2026-11-10", paymentMethod: "pix",
    distributionMode: "manual", idempotencyKey: "key-2",
    lines: [
      { invoiceId: "invoice-101", quotationItemId: "101", receivedQuantity: 1, amountCents: 10000, costCents: 4000,
        reserveCents: 600, distributionMode: "default" },
      { invoiceId: "invoice-102", quotationItemId: "102", receivedQuantity: 1, amountCents: 5000, costCents: 2000,
        reserveCents: 0, distributionMode: "manual",
        costJustification: "Correção do custo do item",
        participantAllocations: [{ participantId: "party-1", amountCents: 3000 }] },
    ],
  });
  const args = client.calls[0].args;
  assert.equal(client.calls[0].name, "distribute_cashflow_receipt");
  assert.equal(args.p_distribution_justification, "");
  assert.deepEqual(args.p_lines.map((line) => line.invoice_id), ["invoice-101", "invoice-102"]);
  assert.equal(args.p_lines[1].cost_justification, "Correção do custo do item");
  assert.deepEqual(args.p_lines.map((line) => line.distribution_mode), ["default", "manual"]);
  assert.equal(args.p_lines[1].participant_allocations[0].amount, "30.00");
});

test("participant payload saves equal division preference", async () => {
  const client = makeClient();
  await createCashflowService(client).saveParty({
    id: "party-1", name: "Participante", sharePercent: 0, equalShare: true,
  });
  assert.equal(client.calls[0].name, "save_cashflow_party");
  assert.equal(client.calls[0].args.p_equal_share, true);
});

test("expense RPC preserves the optional bid selected in the form", async () => {
  const client = makeClient();
  await createCashflowService(client).recordExpense({
    idempotencyKey: "expense-key",
    description: "Frete",
    category: "Logística",
    amountCents: 12000,
    occurredOn: "2026-11-10",
    paymentMethod: "pix",
    payerType: "company",
    bidId: "bid-42",
  });
  assert.equal(client.calls[0].name, "record_cashflow_expense");
  assert.equal(client.calls[0].args.p_bid_id, "bid-42");
  assert.equal(client.calls[0].args.p_quotation_item_id, null);
});
