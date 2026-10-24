import assert from "node:assert/strict";
import test from "node:test";
import { calculateDashboard } from "../web/dashboard-metrics.js";

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
