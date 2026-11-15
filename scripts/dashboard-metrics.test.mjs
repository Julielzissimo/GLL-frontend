import assert from "node:assert/strict";
import test from "node:test";
import { calculateDashboard, calculateSupplyTracking } from "../web/dashboard-metrics.js";

const bids = [
  { id: 1, edital_number: "10/2026", status: "Disputada", session_datetime: "2026-10-10T10:00:00", quotation_id: 10 },
  { id: 2, edital_number: "20/2026", status: "Em Fornecimento", session_datetime: "2026-10-20T10:00:00", quotation_id: 20 },
  { id: 3, edital_number: "30/2026", status: "Descartada", session_datetime: "2026-10-20T10:00:00", quotation_id: 30 },
];
const quotationItems = [
  { id: 100, quotation_id: 10, item_number: 1, quantity: 10, final_bid: 100, supplier_cost: 60 },
  { id: 200, quotation_id: 20, item_number: 1, quantity: 4, final_bid: 50, supplier_cost: 0 },
  { id: 300, quotation_id: 30, item_number: 1, quantity: 3, final_bid: 100, supplier_cost: 30 },
];
const items = [
  { bid_id: 1, quotation_item_id: 100, item_number: 1, is_won: 1 },
  { bid_id: 2, quotation_item_id: 200, item_number: 1, is_won: 1 },
  { bid_id: 3, quotation_item_id: 300, item_number: 1, is_won: 1 },
];
const invoices = [{ bid_id: 1, quotation_item_id: 100, quantity: 3, invoice_date: "2026-11-04" }];

test("partial invoice, disputed bid, and missing cost remain distinct", () => {
  const result = calculateDashboard({ bids, items, quotationItems, invoices });
  assert.equal(result.rows.length, 2);
  assert.equal(result.totals.potential, 1200);
  assert.equal(result.totals.coveredPotential, 1000);
  assert.equal(result.totals.cost, 600);
  assert.equal(result.totals.profit, 400);
  assert.equal(result.totals.margin, 40);
  assert.equal(result.totals.coverage, 1000 / 1200 * 100);
  assert.equal(result.totals.invoicedQuantity, 3);
  assert.equal(result.totals.invoicedValue, 300);
  assert.deepEqual(result.invoiceSeries, [{ month: "2026-11", quantity: 3, value: 300 }]);
});

test("session-period and status filters apply to bids, not invoice dates", () => {
  const result = calculateDashboard({ bids, items, quotationItems, invoices, from: "2026-10-01", to: "2026-10-15", status: "Disputada" });
  assert.equal(result.totals.potential, 1000);
  assert.equal(result.totals.invoicedValue, 300);
  assert.equal(result.invoiceSeries[0].month, "2026-11");
});

test("an empty portfolio has no invented margin or coverage", () => {
  const result = calculateDashboard({ bids: [], items: [], quotationItems: [], invoices: [] });
  assert.equal(result.totals.potential, 0);
  assert.equal(result.totals.margin, null);
  assert.equal(result.totals.coverage, null);
  assert.equal(result.invoiceSeries.length, 0);
});

test("supply tracking lists only in-supply bids and totals requested, delivered, and invoiced quantities", () => {
  const supplyBids = [
    { id: "supply", edital_number: "40/2026", buyer_agency: "Órgão de teste", status: "Em Fornecimento", quotation_id: 40 },
    { id: "billed", edital_number: "50/2026", status: "Faturado", quotation_id: 50 },
    { id: "approved", edital_number: "60/2026", status: "Aprovada", quotation_id: 60 },
  ];
  const supplyItems = [
    { bid_id: "supply", quotation_item_id: 400, item_number: 1, is_won: 1 },
    { bid_id: "supply", quotation_item_id: 401, item_number: 2, is_won: 0 },
    { bid_id: "supply", quotation_item_id: 402, item_number: 3, is_won: 1 },
    { bid_id: "billed", quotation_item_id: 500, item_number: 1, is_won: 1 },
    { bid_id: "approved", quotation_item_id: 600, item_number: 1, is_won: 1 },
  ];
  const supplyQuotationItems = [
    { id: 400, quotation_id: 40, item_number: 1, description: "Item acompanhado" },
    { id: 401, quotation_id: 40, item_number: 2, description: "Item não vencido" },
    { id: 402, quotation_id: 40, item_number: 3, description: "Item sem movimentação" },
    { id: 500, quotation_id: 50, item_number: 1, description: "Edital faturado" },
    { id: 600, quotation_id: 60, item_number: 1, description: "Edital aprovado" },
  ];
  const result = calculateSupplyTracking({
    bids: supplyBids,
    items: supplyItems,
    quotationItems: supplyQuotationItems,
    commitments: [
      { bid_id: "supply", quotation_item_id: 400, quantity: 1.25 },
      { bid_id: "supply", quotation_item_id: 400, quantity: 0.75 },
      { bid_id: "billed", quotation_item_id: 500, quantity: 4 },
    ],
    deliveries: [{ bid_id: "supply", quotation_item_id: 400, quantity: 1.5 }],
    invoices: [
      { bid_id: "supply", quotation_item_id: 400, quantity: 1 },
      { bid_id: "approved", quotation_item_id: 600, quantity: 3 },
    ],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].bidId, "supply");
  assert.deepEqual(result[0].items.map((row) => row.itemNumber), [1, 3]);
  assert.deepEqual(result[0].items.map((row) => [row.requestedQuantity, row.deliveredQuantity, row.invoicedQuantity]), [
    [2, 1.5, 1],
    [0, 0, 0],
  ]);
  assert.deepEqual(result[0].totals, { requestedQuantity: 2, deliveredQuantity: 1.5, invoicedQuantity: 1 });
});
