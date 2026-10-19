import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [html, source] = await Promise.all([
  readFile(new URL("web/index.html", root), "utf8"),
  readFile(new URL("web/app.js", root), "utf8"),
]);

test("linked quotation restores the won-item checkbox in bid stages", () => {
  assert.match(html, /id="quotationItemWonHeader"[^>]*>ITEM VENCIDO<\/th>/);
  assert.match(source, /appState\.activePage === "items" && shouldUseWonItems\(\)/);
  assert.match(source, /data-quotation-item-won="\$\{bidItem\?\.id \|\| ""\}"/);
  assert.match(source, /setItemWon\(Number\(checkbox\.dataset\.quotationItemWon\)/);
});

test("won-item checkbox maps the quotation item back to its bid item", () => {
  assert.match(source, /function bidItemForQuotationItem\(quotationItem, bidId\)/);
  assert.match(source, /String\(item\.bid_id\) === String\(bidId\)/);
  assert.match(source, /Number\(item\.quotation_item_id\) === Number\(quotationItem\.id\)/);
  assert.match(source, /Number\(item\.item_number\) === Number\(quotationItem\.item_number\)/);
});

test("Em Fornecimento mantém disponível a marcação de item vencido", () => {
  assert.match(source, /const WON_ITEM_STATUSES = \[[^\]]*"Em Fornecimento"/);
  assert.match(source, /const WON_ITEM_TOTAL_STATUSES = \[[^\]]*"Em Fornecimento"/);
  assert.match(source, /function shouldUseWonItems\(\)[\s\S]*?canMarkWonItems\(refs\.bidStatus\.value\)/);
});

test("lucro total considera só itens vencidos nas etapas que exibem a marcação", () => {
  assert.match(source, /function canMarkWonItems\(status\)\s*\{\s*return WON_ITEM_STATUSES\.includes\(status\);/);
  assert.match(
    source,
    /function calculateLinkedQuotationProfit\(bid\)[\s\S]*?const onlyWonItems = canMarkWonItems\(bid\.status\);[\s\S]*?if \(onlyWonItems && !Boolean\(Number\(bidItemForQuotationItem\(item, bid\.id\)\?\.is_won\)\)\) return total;[\s\S]*?return roundMoney\(total \+ calculateItemProfit\(item\.final_bid, item\.supplier_cost, item\.quantity\)\);/
  );
});
