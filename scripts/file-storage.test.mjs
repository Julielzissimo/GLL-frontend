import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../web/file-storage.js", import.meta.url), "utf8");

function adapter({ provider = "r2", replies = {}, fetchReply = { ok: true } } = {}) {
  const calls = [];
  const legacy = {
    download: async (path) => ({ data: new Blob([`legacy:${path}`]), error: null }),
    remove: async () => ({ data: [], error: null }),
    createSignedUrl: async (path) => ({ data: { signedUrl: `https://legacy.invalid/${path}` }, error: null }),
  };
  const context = {
    window: { GLL_CONFIG: { storageProvider: provider } },
    fetch: async (url, options) => {
      calls.push({ fetch: url, method: options?.method });
      return { ...fetchReply, blob: async () => new Blob(["r2"]) };
    },
  };
  vm.runInNewContext(source, context);
  const client = {
    storage: { from: () => legacy },
    functions: { invoke: async (_name, { body }) => {
      calls.push(body);
      return { data: replies[body.action] ?? {}, error: null };
    } },
  };
  return { bucket: context.window.GLLFileStorage.storageBucket(client, "bid-edital-files"), calls };
}

test("R2 upload uses the server-generated path and completes after PUT", async () => {
  const { bucket, calls } = adapter({ replies: {
    "request-upload": { path: "org/bid/new/file.pdf", url: "https://r2.invalid/put", contentType: "application/pdf" },
  } });
  const { data, error } = await bucket.upload("org/bid/client/file.pdf", { name: "file.pdf", size: 4 });
  assert.equal(error, null);
  assert.equal(data.path, "org/bid/new/file.pdf");
  assert.deepEqual(calls.map((call) => call.action || call.method), ["request-upload", "PUT", "complete-upload"]);
});

test("legacy objects remain downloadable while R2 is active", async () => {
  const { bucket } = adapter({ replies: { "download-url": { legacy: true } } });
  const { data, error } = await bucket.download("org/legacy.pdf");
  assert.equal(error, null);
  assert.equal(await data.text(), "legacy:org/legacy.pdf");
});

test("failed R2 PUT calls cleanup and returns an error", async () => {
  const { bucket, calls } = adapter({ replies: {
    "request-upload": { path: "org/bid/new/file.pdf", url: "https://r2.invalid/put", contentType: "application/pdf" },
  }, fetchReply: { ok: false } });
  const { error } = await bucket.upload("org/bid/client/file.pdf", { name: "file.pdf", size: 4 });
  assert.match(error.message, /envio ao R2 falhou/);
  assert.equal(calls.at(-1).action, "delete");
});
