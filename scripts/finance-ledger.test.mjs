import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinanceAllocations,
  calculateObjectiveProfit,
  calculateRecognizedProfit,
  createFinanceLedgerService,
  financeCents,
  financeLedgerPanelMarkup,
  financeReceiptAllocationTotal,
  financeReceiptNetAmount,
} from "../web/finance-ledger.js";

const item = {
  profit_item_id: "profit-item-1",
  budget_item_number: 4,
  budget_description: "Caderno de capa dura",
  budget_quantity: 10,
  budget_supplier_cost: 30,
  budget_final_bid: 50,
  expected_profit: 200,
  due_amount: 500,
  received_amount: 250,
  recognized_profit: 100,
  outstanding_amount: 250,
};

function panelData(status = "Em Fornecimento") {
  return {
    summary: {
      bid_profit_id: "profit-1",
      bid_status: status,
      expected_profit: 200,
      due_amount: 500,
      received_amount: 250,
      recognized_profit: 100,
      outstanding_amount: 250,
      unallocated_legacy_amount: 0,
    },
    items: [{ ...item }],
    receipts: [],
    profitAdjustments: [],
    recognitionAdjustments: [],
    receiptAllocations: [],
    receiptAdjustments: [],
  };
}

test("objective profit uses budget quantity, unit cost and final bid", () => {
  assert.equal(calculateObjectiveProfit({ quantity: 2.5, supplierCost: 31.11, finalBid: 45.67 }), "36.40");
  assert.equal(calculateObjectiveProfit({ quantity: 4, supplierCost: 60, finalBid: 50 }), "0.00");
});

test("recognized profit follows the received share of the full budget item value", () => {
  assert.equal(calculateRecognizedProfit(200, 125, 500), "50.00");
  assert.equal(calculateRecognizedProfit(200, 250, 500), "100.00");
  assert.equal(calculateRecognizedProfit(200, 500, 500), "200.00");
  assert.equal(calculateRecognizedProfit(200, 0, 0), "0.00");
  assert.throws(() => calculateRecognizedProfit(-40, 25, 100), /fora do intervalo permitido/);
});

test("allocation helpers keep exact cents and ignore zero item amounts", () => {
  const rows = [
    { profit_item_id: "item-1", input: "100.01" },
    { profit_item_id: "item-2", input: "0" },
    { profit_item_id: "item-3", input: "49.99" },
  ];
  const allocations = buildFinanceAllocations(rows, (row) => row.input);
  assert.deepEqual(allocations, [
    { profit_item_id: "item-1", amount: "100.01" },
    { profit_item_id: "item-3", amount: "49.99" },
  ]);
  assert.equal(financeReceiptAllocationTotal(allocations), 15000n);
  assert.equal(financeCents("49.99"), 4999n);
  assert.throws(() => buildFinanceAllocations([{ profit_item_id: "bad", input: "100.005" }], (row) => row.input), /no máximo 2 casas/);
});

test("receipt balance includes immutable corrections without losing the source amount", () => {
  const receipt = { id: "receipt-1", amount: 150 };
  const allocations = [
    { id: "allocation-1", receipt_id: "receipt-1", amount: 100 },
    { id: "allocation-2", receipt_id: "receipt-1", amount: 50 },
  ];
  const adjustments = [
    { receipt_id: "receipt-1", receipt_allocation_id: "allocation-1", amount_delta: -10 },
    { receipt_id: "receipt-1", receipt_allocation_id: "allocation-2", amount_delta: 5 },
  ];
  assert.equal(financeReceiptNetAmount(receipt, allocations, adjustments), "145.00");
  assert.equal(financeReceiptNetAmount({ id: "legacy", amount: 90 }, [], [
    { receipt_id: "legacy", receipt_allocation_id: null, amount_delta: -10 },
    { receipt_id: "legacy", receipt_allocation_id: null, amount_delta: 5 },
  ]), "85.00");
});

test("new receipts appear only for eligible edital statuses; corrections remain available", () => {
  const bid = { id: "bid-1", status: "Em Fornecimento" };
  const eligible = financeLedgerPanelMarkup({ bid, data: panelData(), isAdmin: true });
  assert.match(eligible, /data-finance-receipt-form/);
  assert.doesNotMatch(eligible, /data-finance-profit-form/);
  assert.match(eligible, /bloqueado após o primeiro recebimento/i);
  assert.match(eligible, /data-finance-recognized-profit-form/);

  const historical = financeLedgerPanelMarkup({ bid: { ...bid, status: "Aprovada" }, data: panelData("Aprovada"), isAdmin: true });
  assert.doesNotMatch(historical, /data-finance-receipt-form/);
  assert.doesNotMatch(historical, /data-finance-profit-form/);
  assert.match(historical, /data-finance-recognized-profit-form/);

  const beforeReceipt = panelData();
  beforeReceipt.items[0].received_amount = "0.00";
  beforeReceipt.items[0].recognized_profit = "0.00";
  assert.match(financeLedgerPanelMarkup({ bid, data: beforeReceipt, isAdmin: true }), /data-finance-profit-form/);
  assert.doesNotMatch(financeLedgerPanelMarkup({ bid, data: beforeReceipt, isAdmin: true }), /data-finance-recognized-profit-form/);

  const legacy = panelData();
  legacy.summary.unallocated_legacy_amount = 25;
  assert.doesNotMatch(financeLedgerPanelMarkup({ bid, data: legacy, isAdmin: true }), /data-finance-receipt-form/);
});

test("reversed receipts remain visible without allowing a new correction", () => {
  const data = panelData();
  data.receipts = [{ id: "receipt-reversed", amount: 100, client_request_id: "request-1", received_on: "2026-10-01" }];
  data.receiptAllocations = [{ id: "allocation-reversed", receipt_id: "receipt-reversed", profit_item_id: item.profit_item_id, amount: 100 }];
  data.receiptAdjustments = [{ id: "reversal-1", receipt_id: "receipt-reversed", receipt_allocation_id: "allocation-reversed", amount_delta: -100, event_kind: "reversal", reason: "Duplicidade confirmada." }];
  const markup = financeLedgerPanelMarkup({ bid: { id: "bid-1", status: "Faturado" }, data, isAdmin: true });
  assert.match(markup, /Estornado/);
  assert.doesNotMatch(markup, /data-finance-receipt-adjust-form/);
});

test("finance service sends stable RPC names and arguments to the shared ledger", async () => {
  const calls = [];
  const service = createFinanceLedgerService(() => ({
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: "event-id", error: null };
    },
  }));
  await service.adjustRecognizedProfit({
    profitItemId: "profit-item-1",
    recognizedProfit: "125.50",
    reason: "Correção validada no documento de recebimento.",
    requestId: "request-1",
  });
  assert.deepEqual(calls, [{
    name: "finance_cashflow_execute",
    args: {
      p_command: "adjust_recognized_profit",
      p_payload: {
        profit_item_id: "profit-item-1",
        recognized_profit: "125.50",
        reason: "Correção validada no documento de recebimento.",
        request_id: "request-1",
      },
    },
  }]);
});
