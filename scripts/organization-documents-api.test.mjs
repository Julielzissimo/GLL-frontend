import assert from "node:assert/strict";
import test from "node:test";
import { createOrganizationDocumentsApi } from "../web/organization-documents-api.js";

const documentRow = (overrides = {}) => ({
  id: "document-1",
  title: "Certidão estadual",
  file_storage_object_id: "object-1",
  original_file_name: "certidao.pdf",
  mime_type: "application/pdf",
  size_bytes: 2048,
  expires_on: "2026-10-30",
  version: 1,
  expiry_status: "expiring_soon",
  days_remaining: 10,
  ...overrides,
});

function createFixture({ rpcResult, invokeResult } = {}) {
  const calls = [];
  const client = {
    auth: {
      async getSession() {
        calls.push({ type: "session" });
        return { data: { session: { access_token: "test-access-token" } }, error: null };
      },
    },
    async rpc(name, args) {
      calls.push({ type: "rpc", name, args });
      return rpcResult ? rpcResult(name, args) : { data: [], error: null };
    },
    functions: {
      async invoke(name, options) {
        calls.push({ type: "invoke", name, body: options.body });
        return invokeResult ? invokeResult(name, options.body) : { data: {}, error: null };
      },
    },
  };
  return { calls, client };
}

test("loads current, expiring, expired, and notification rows from their scoped RPCs", async () => {
  const fixture = createFixture({
    rpcResult(name) {
      if (name === "list_organization_documents") return { data: [documentRow()], error: null };
      if (name === "list_expiring_organization_documents") return { data: [documentRow()], error: null };
      if (name === "list_expired_organization_documents") return { data: [documentRow({ id: "expired", expiry_status: "expired", days_remaining: -2 })], error: null };
      if (name === "list_organization_document_expiry_notifications") {
        return { data: [{
          id: "notification-1", document_id: "document-1", notification_date: "2026-10-20",
          document_version: 1, title: "Certidão estadual", expires_on: "2026-10-30",
          expiry_status: "expiring_soon", days_remaining: 10, status: "active",
          created_at: "2026-10-20T12:00:00Z", updated_at: "2026-10-20T12:05:00Z",
        }], error: null };
      }
      if (name === "get_organization_document_settings") return { data: [{ alert_days: 30, time_zone: "America/Sao_Paulo" }], error: null };
      return { data: [], error: null };
    },
  });
  const api = createOrganizationDocumentsApi({ getClient: () => fixture.client });

  assert.equal((await api.listDocuments())[0].expiresOn, "2026-10-30");
  assert.deepEqual((await api.listExpiringDocuments()).map((row) => row.id), ["document-1", "expired"]);
  assert.equal((await api.listNotifications())[0].daysRemaining, 10);
  assert.equal((await api.listNotifications())[0].updatedAt, "2026-10-20T12:05:00Z");
  assert.deepEqual(await api.getSettings(), {
    alertDays: 30, minAlertDays: 0, maxAlertDays: 365, timeZone: "America/Sao_Paulo",
  });
  assert.ok(fixture.calls.some((call) => call.name === "list_expired_organization_documents"));
});

test("upload and replacement keep the document identity and update validity atomically", async () => {
  const fixture = createFixture({
    rpcResult(name, args) {
      if (name === "create_organization_document") return { data: [documentRow({ id: args.p_document_id, expires_on: args.p_expires_on })], error: null };
      if (name === "replace_organization_document_file") return { data: [documentRow({ id: args.p_document_id, version: 2, expires_on: args.p_expires_on })], error: null };
      return { data: [], error: null };
    },
    invokeResult(name) {
      if (name !== "file-storage") return { data: {}, error: null };
      return { data: { id: "uploaded-object", path: "org/document/file.pdf", url: "https://storage.test/upload", contentType: "application/pdf" }, error: null };
    },
  });
  let id = 0;
  const api = createOrganizationDocumentsApi({
    getClient: () => fixture.client,
    idGenerator: () => `generated-${++id}`,
    fetchImpl: async () => ({ ok: true, blob: async () => new Blob(["document"]) }),
  });
  const file = { name: "certidao.pdf", size: 10 };

  const created = await api.createDocument({ title: "Certidão estadual", file, expiresOn: "2026-10-30" });
  const replaced = await api.replaceDocument({ documentId: created.id, expectedVersion: 1, file, expiresOn: "2026-11-30" });

  assert.equal(created.id, "generated-1");
  assert.equal(replaced.id, created.id);
  assert.equal(replaced.version, 2);
  assert.equal(replaced.expiresOn, "2026-11-30");
  const replaceCall = fixture.calls.find((call) => call.name === "replace_organization_document_file");
  assert.equal(replaceCall.args.p_document_id, created.id);
  assert.equal(replaceCall.args.p_update_expiry, true);
  assert.equal(replaceCall.args.p_expires_on, "2026-11-30");
  assert.equal(fixture.calls.filter((call) => call.name === "file-storage").length, 4);
});

test("removes a newly uploaded replacement when the document update fails", async () => {
  const fixture = createFixture({
    rpcResult(name) {
      if (name === "replace_organization_document_file") return { data: null, error: { message: "stale version" } };
      return { data: [], error: null };
    },
    invokeResult(name, body) {
      if (name === "file-storage" && body.action === "request-upload") {
        return { data: { id: "uploaded-object", path: "org/document/new.pdf", url: "https://storage.test/upload", contentType: "application/pdf" }, error: null };
      }
      return { data: {}, error: null };
    },
  });
  const api = createOrganizationDocumentsApi({
    getClient: () => fixture.client,
    fetchImpl: async () => ({ ok: true }),
  });

  await assert.rejects(
    api.replaceDocument({ documentId: "document-1", expectedVersion: 1, file: { name: "new.pdf", size: 10 }, expiresOn: "2026-11-30" }),
    /stale version/,
  );
  assert.ok(fixture.calls.some((call) => call.type === "invoke" && call.body.action === "delete"));
});

test("baixa o ZIP pelo endpoint autenticado e usa o nome UTF-8 calculado pelo servidor", async () => {
  const fixture = createFixture();
  let request;
  const api = createOrganizationDocumentsApi({
    getClient: () => fixture.client,
    getSupabaseUrl: () => "https://project.test/",
    getSupabaseAnonKey: () => "public-key",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(new Blob(["valid zip bytes"], { type: "application/zip" }), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": "attachment; filename=\"docs-Raz_o Ltda.zip\"; filename*=UTF-8''docs-Raz%C3%A3o%20Ltda.zip",
        },
      });
    },
  });

  const result = await api.downloadDocumentsZip({ documentIds: ["document-1", "document-2"] });
  assert.equal(result.fileName, "docs-Razão Ltda.zip");
  assert.equal(result.blob.type, "application/zip");
  assert.equal(await result.blob.text(), "valid zip bytes");
  assert.equal(request.url, "https://project.test/functions/v1/file-storage");
  assert.equal(request.options.headers.Authorization, "Bearer test-access-token");
  assert.equal(request.options.headers.apikey, "public-key");
  assert.deepEqual(JSON.parse(request.options.body), {
    action: "download-zip", bucket: "organization-documents", documentIds: ["document-1", "document-2"],
  });
  assert.ok(fixture.calls.some((call) => call.type === "session"));
  assert.ok(!fixture.calls.some((call) => call.type === "invoke"));
});

test("rejeita seleção vazia, sessão expirada e falha de autorização", async () => {
  const fixture = createFixture();
  let fetchCount = 0;
  const api = createOrganizationDocumentsApi({
    getClient: () => fixture.client,
    getSupabaseUrl: () => "https://project.test",
    getSupabaseAnonKey: () => "public-key",
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({ error: "Você não tem autorização para baixar esses documentos." }), {
        status: 403, headers: { "Content-Type": "application/json" },
      });
    },
  });

  await assert.rejects(api.downloadDocumentsZip({ documentIds: [] }), /Selecione pelo menos um documento/);
  await assert.rejects(api.downloadDocumentsZip({ documentIds: ["document-1"] }), /autorização/);
  assert.equal(fetchCount, 1);

  fixture.client.auth.getSession = async () => ({ data: { session: null }, error: null });
  await assert.rejects(api.downloadDocumentsZip({ documentIds: ["document-1"] }), /sessão expirou/);
  assert.equal(fetchCount, 1);
});

test("não retorna um ZIP se o fluxo de resposta for interrompido", async () => {
  const fixture = createFixture();
  const api = createOrganizationDocumentsApi({
    getClient: () => fixture.client,
    getSupabaseUrl: () => "https://project.test",
    getSupabaseAnonKey: () => "public-key",
    fetchImpl: async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("partial"));
        controller.error(new Error("storage stream failed"));
      },
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename*=UTF-8''docs-LSMS%20Suprimentos.zip",
      },
    }),
  });

  await assert.rejects(
    api.downloadDocumentsZip({ documentIds: ["document-1"] }),
    /download foi interrompido antes de concluir/,
  );
});
