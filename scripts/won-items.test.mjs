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
