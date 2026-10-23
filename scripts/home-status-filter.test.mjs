import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
const start = source.indexOf("function applyHomeStatusFilter(status) {");
const end = source.indexOf("\n}", start) + 2;
const implementation = source.slice(start, end);

test("home status shortcuts clear filters that could hide matching bids", () => {
  assert.notEqual(start, -1);
  assert.match(implementation, /refs\.filterSearch\.value = ""/);
  assert.match(implementation, /refs\.filterDate\.value = ""/);
  assert.match(implementation, /refs\.filterGuaranteeDeposit\.checked = false/);
  assert.match(implementation, /setFilterStatuses\(status && status !== "Todos" \? \[normalizeBidStatus\(status\)\] : \[\]\)/);
});
