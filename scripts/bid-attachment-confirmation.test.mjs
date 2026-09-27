import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [html, app] = await Promise.all([
  readFile(new URL("web/index.html", root), "utf8"),
  readFile(new URL("web/app.js", root), "utf8"),
]);

test("bid attachment removal uses the GLL confirmation dialog", () => {
  assert.match(html, /<dialog id="deleteBidAttachmentModal"[^>]*aria-labelledby="deleteBidAttachmentModalTitle"[^>]*aria-describedby="deleteBidAttachmentModalDescription"/);
  assert.match(html, /id="confirmDeleteBidAttachmentButton"[^>]*class="danger-action"/);
  assert.match(app, /function requestDeleteBidAttachment\(button\)/);
  assert.match(app, /deleteBidAttachmentModalDescription"\)\.textContent/);
  assert.match(app, /withBlockingLoading\(\(\) => deleteBidAttachment\(bidId, attachmentPath\), "Removendo arquivo…"\)/);
  assert.doesNotMatch(app, /window\.confirm\(`Remover o arquivo/);
});
