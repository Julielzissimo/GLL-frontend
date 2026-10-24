export const DASHBOARD_STATUSES = ["Disputada", "Aprovada", "Em Fornecimento", "Faturado"];

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const cents = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateDashboard({ bids = [], items = [], quotationItems = [], invoices = [], from = "", to = "", status = "Todos" }) {
  const visibleBids = bids.filter((bid) => {
    const sessionDate = String(bid.session_datetime || "").slice(0, 10);
    return DASHBOARD_STATUSES.includes(bid.status)
      && (status === "Todos" || bid.status === status)
      && (!from || (sessionDate && sessionDate >= from))
      && (!to || (sessionDate && sessionDate <= to));
  });
  const bidIds = new Set(visibleBids.map((bid) => String(bid.id)));
  const bidById = new Map(visibleBids.map((bid) => [String(bid.id), bid]));
  const itemByBidAndQuotation = new Map(items.filter((item) => bidIds.has(String(item.bid_id)))
    .map((item) => [`${item.bid_id}:${item.quotation_item_id}`, item]));
  const itemByBidAndNumber = new Map(items.filter((item) => bidIds.has(String(item.bid_id)))
    .map((item) => [`${item.bid_id}:${item.item_number}`, item]));
  const quotationItemsByQuotation = new Map();
  for (const item of quotationItems) {
    const key = String(item.quotation_id);
    if (!quotationItemsByQuotation.has(key)) quotationItemsByQuotation.set(key, []);
    quotationItemsByQuotation.get(key).push(item);
  }
  const rows = [];
  for (const bid of visibleBids) {
    for (const item of quotationItemsByQuotation.get(String(bid.quotation_id)) || []) {
      const bidItem = itemByBidAndQuotation.get(`${bid.id}:${item.id}`)
        || itemByBidAndNumber.get(`${bid.id}:${item.item_number}`);
      if (!Number(bidItem?.is_won)) continue;
      const quantity = Math.max(0, number(item.quantity));
      const unitPrice = Math.max(0, number(item.final_bid));
      const unitCost = number(item.supplier_cost);
      const costKnown = unitCost > 0;
      rows.push({
        bidId: bid.id, bidNumber: bid.edital_number || String(bid.id),
        agency: bid.buyer_agency || "", sessionDate: String(bid.session_datetime || "").slice(0, 10),
        status: bid.status, quotationItemId: item.id, itemNumber: item.item_number,
        description: item.description || "", quantity, unitPrice, unitCost, costKnown,
        potential: cents(quantity * unitPrice), cost: costKnown ? cents(quantity * unitCost) : 0,
        invoicedQuantity: 0, invoicedValue: 0,
      });
    }
  }
  const rowByBidAndItem = new Map(rows.map((row) => [`${row.bidId}:${row.quotationItemId}`, row]));
  const invoiceSeries = new Map();
  for (const invoice of invoices) {
    if (!bidById.has(String(invoice.bid_id))) continue;
    const row = rowByBidAndItem.get(`${invoice.bid_id}:${invoice.quotation_item_id}`);
    if (!row) continue;
    const quantity = Math.max(0, number(invoice.quantity));
    const effectiveQuantity = Math.min(quantity, Math.max(0, row.quantity - row.invoicedQuantity));
    const value = cents(effectiveQuantity * row.unitPrice);
    row.invoicedQuantity += effectiveQuantity;
    row.invoicedValue = cents(row.invoicedValue + value);
    const month = String(invoice.invoice_date || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) {
      const previous = invoiceSeries.get(month) || { month, quantity: 0, value: 0 };
      previous.quantity += effectiveQuantity;
      previous.value = cents(previous.value + value);
      invoiceSeries.set(month, previous);
    }
  }
  const totals = rows.reduce((result, row) => {
    result.potential = cents(result.potential + row.potential);
    result.invoicedQuantity += row.invoicedQuantity;
    result.invoicedValue = cents(result.invoicedValue + row.invoicedValue);
    if (row.costKnown) {
      result.coveredPotential = cents(result.coveredPotential + row.potential);
      result.cost = cents(result.cost + row.cost);
      result.coveredItems += 1;
    }
    return result;
  }, { potential: 0, coveredPotential: 0, cost: 0, coveredItems: 0, invoicedQuantity: 0, invoicedValue: 0 });
  totals.profit = cents(totals.coveredPotential - totals.cost);
  totals.margin = totals.coveredPotential > 0 ? totals.profit / totals.coveredPotential * 100 : null;
  totals.coverage = totals.potential > 0 ? totals.coveredPotential / totals.potential * 100 : null;
  const byStatus = DASHBOARD_STATUSES.map((name) => ({
    status: name,
    value: cents(rows.filter((row) => row.status === name).reduce((sum, row) => sum + row.potential, 0)),
    count: rows.filter((row) => row.status === name).length,
  }));
  return { rows, totals, byStatus, invoiceSeries: [...invoiceSeries.values()].sort((a, b) => a.month.localeCompare(b.month)) };
}
