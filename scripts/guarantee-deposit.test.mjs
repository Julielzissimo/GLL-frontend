import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [html, app] = await Promise.all([
  readFile(new URL("web/index.html", root), "utf8"),
  readFile(new URL("web/app.js", root), "utf8"),
]);

test("edital form persists the guarantee deposit confirmation", () => {
  assert.match(html, /id="hasGuaranteeDeposit" type="checkbox"/);
  assert.match(html, /Possui depósito de garantia\?/);
  assert.match(app, /has_guarantee_deposit: refs\.hasGuaranteeDeposit\.checked/);
  assert.match(app, /refs\.hasGuaranteeDeposit\.checked = Boolean\(bid\.has_guarantee_deposit\)/);
  assert.match(app, /has_guarantee_deposit: Boolean\(record\.has_guarantee_deposit\)/);
});

test("bid catalog can filter confirmed guarantee deposits", () => {
  assert.match(html, /id="filterGuaranteeDeposit" type="checkbox"/);
  assert.match(app, /const guaranteeDepositFilter = refs\.filterGuaranteeDeposit\.checked/);
  assert.match(app, /!guaranteeDepositFilter \|\| bid\.has_guarantee_deposit/);
  assert.match(app, /refs\.filterGuaranteeDeposit\.checked = false/);
});
