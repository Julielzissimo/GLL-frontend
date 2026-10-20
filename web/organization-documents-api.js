const DOCUMENT_BUCKET = "organization-documents";

function apiError(error, data, fallback) {
  return new Error(data?.error || error?.message || fallback);
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function documentFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    fileName: row.original_file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes || 0),
    fileStorageObjectId: row.file_storage_object_id,
    expiresOn: row.expires_on || null,
    version: Number(row.version || 1),
    expiryStatus: row.expiry_status || null,
    daysRemaining: row.days_remaining === null || row.days_remaining === undefined
      ? null
      : Number(row.days_remaining),
  };
}

function notificationFromRow(row) {
  return {
    id: row.id,
    documentId: row.document_id,
    notificationDate: row.notification_date,
    documentVersion: Number(row.document_version),
    title: row.title,
    expiresOn: row.expires_on,
    expiryStatus: row.expiry_status,
    daysRemaining: Number(row.days_remaining),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function settingsFromRow(row) {
  return {
    alertDays: Number(row?.alert_days ?? 30),
    minAlertDays: 0,
    maxAlertDays: 365,
    timeZone: row?.time_zone || "America/Sao_Paulo",
  };
}

/** Supabase gateway for the organization document module. */
export function createOrganizationDocumentsApi({
  getClient,
  getSupabaseUrl = () => "",
  getSupabaseAnonKey = () => "",
  fetchImpl = globalThis.fetch,
  idGenerator = () => globalThis.crypto.randomUUID(),
} = {}) {
  function client() {
    const value = getClient?.();
    if (!value) throw new Error("Entre novamente para acessar os documentos da organização.");
    return value;
  }

  async function rpc(name, args = {}) {
    const { data, error } = await client().rpc(name, args);
    if (error) throw new Error(error.message || "Não foi possível acessar os documentos da organização.");
    return data;
  }

  async function invokeStorage(action, payload = {}) {
    const { data, error } = await client().functions.invoke("file-storage", {
      body: { action, bucket: DOCUMENT_BUCKET, ...payload },
    });
    if (error || data?.error) throw apiError(error, data, "Não foi possível acessar o arquivo do documento.");
    return data;
  }

  function downloadFileNameFromHeader(header) {
    const encoded = /(?:^|;)\s*filename\*\s*=\s*UTF-8''([^;]+)/i.exec(String(header || ""));
    if (encoded) {
      try { return decodeURIComponent(encoded[1].trim()); } catch { return ""; }
    }
    const quoted = /(?:^|;)\s*filename\s*=\s*"([^"]+)"/i.exec(String(header || ""));
    return quoted?.[1] || "";
  }

  async function uploadFile(documentId, file) {
    const reservation = await invokeStorage("request-upload", {
      path: documentId,
      fileName: file.name,
      size: file.size,
    });
    try {
      const response = await fetchImpl(reservation.url, {
        method: "PUT",
        headers: { "Content-Type": reservation.contentType, "If-None-Match": "*" },
        body: file,
      });
      if (!response.ok) throw new Error("O envio do arquivo falhou. Tente novamente.");
      await invokeStorage("complete-upload", { path: reservation.path });
      return { objectId: reservation.id, path: reservation.path };
    } catch (error) {
      await invokeStorage("delete", { path: reservation.path }).catch(() => undefined);
      throw error;
    }
  }

  async function saveUploadedDocument(file, invokeRpc) {
    const documentId = idGenerator();
    const upload = await uploadFile(documentId, file);
    try {
      const row = firstRow(await invokeRpc(documentId, upload.objectId));
      if (!row) throw new Error("O servidor não confirmou o cadastro do documento.");
      return documentFromRow(row);
    } catch (error) {
      await invokeStorage("delete", { path: upload.path }).catch(() => undefined);
      throw error;
    }
  }

  return {
    async listDocuments() {
      const rows = await rpc("list_organization_documents", { p_status: "all", p_search: null });
      return (rows || []).map(documentFromRow);
    },

    async listExpiringDocuments() {
      const [near, expired] = await Promise.all([
        rpc("list_expiring_organization_documents"),
        rpc("list_expired_organization_documents"),
      ]);
      return [...(near || []), ...(expired || [])].map(documentFromRow);
    },

    async listNotifications() {
      const rows = await rpc("list_organization_document_expiry_notifications");
      return (rows || []).map(notificationFromRow);
    },

    async getSettings() {
      return settingsFromRow(firstRow(await rpc("get_organization_document_settings")));
    },

    async createDocument({ title, file, expiresOn }) {
      return saveUploadedDocument(file, (documentId, objectId) => rpc("create_organization_document", {
        p_document_id: documentId,
        p_title: title,
        p_file_storage_object_id: objectId,
        p_idempotency_key: idGenerator(),
        p_expires_on: expiresOn || null,
      }));
    },

    async replaceDocument({ documentId, expectedVersion, file, expiresOn }) {
      const upload = await uploadFile(documentId, file);
      try {
        const row = firstRow(await rpc("replace_organization_document_file", {
          p_document_id: documentId,
          p_file_storage_object_id: upload.objectId,
          p_expected_version: expectedVersion,
          p_idempotency_key: idGenerator(),
          p_update_expiry: true,
          p_expires_on: expiresOn || null,
        }));
        if (!row) throw new Error("O servidor não confirmou a substituição do documento.");
        return documentFromRow(row);
      } catch (error) {
        await invokeStorage("delete", { path: upload.path }).catch(() => undefined);
        throw error;
      }
    },

    async updateValidity({ documentId, expiresOn }) {
      const row = firstRow(await rpc("set_organization_document_expiry", {
        p_document_id: documentId,
        p_expires_on: expiresOn || null,
      }));
      if (!row) throw new Error("O servidor não confirmou a validade do documento.");
      return documentFromRow(row);
    },

    async saveAlertDays({ alertDays }) {
      return settingsFromRow(firstRow(await rpc("update_organization_document_settings", {
        p_alert_days: alertDays,
      })));
    },

    async downloadDocument({ documentId }) {
      const document = firstRow(await rpc("get_organization_document", { p_document_id: documentId }));
      if (!document?.file_storage_object_id) throw new Error("Documento não encontrado.");
      const signed = await invokeStorage("download-url", { objectId: document.file_storage_object_id });
      if (signed?.legacy || !signed?.url) throw new Error("O arquivo do documento não está disponível.");
      const response = await fetchImpl(signed.url);
      if (!response.ok) throw new Error("Não foi possível abrir o arquivo do documento.");
      return response.blob();
    },

    async downloadDocumentsZip({ documentIds } = {}) {
      const ids = Array.isArray(documentIds)
        ? Array.from(new Set(documentIds.map(String).filter(Boolean)))
        : [];
      if (!ids.length) throw new Error("Selecione pelo menos um documento para baixar.");
      const currentClient = client();
      const { data: sessionData, error: sessionError } = await currentClient.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Sua sessão expirou. Entre novamente e tente baixar os documentos.");

      const baseUrl = String(getSupabaseUrl?.() || "").trim().replace(/\/+$/, "");
      const apiKey = String(getSupabaseAnonKey?.() || "").trim();
      if (!baseUrl || !apiKey) throw new Error("A conexão segura com o serviço de documentos não está disponível.");

      let response;
      try {
        response = await fetchImpl(baseUrl + "/functions/v1/file-storage", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
            apikey: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "download-zip", bucket: DOCUMENT_BUCKET, documentIds: ids }),
        });
      } catch (error) {
        if (error?.name === "AbortError") throw new Error("O download foi interrompido. Tente novamente.");
        throw new Error("Não foi possível conectar ao serviço de documentos. Tente novamente.");
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente e tente baixar os documentos.");
        throw new Error(data?.error || "Não foi possível preparar o arquivo ZIP. Tente novamente.");
      }

      const contentType = String(response.headers?.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (contentType !== "application/zip") throw new Error("O serviço não retornou um arquivo ZIP válido.");
      const fileName = downloadFileNameFromHeader(response.headers?.get("content-disposition"));
      if (!/^docs-.+\.zip$/u.test(fileName) || /[\\/]/u.test(fileName)) {
        throw new Error("O serviço retornou um nome de arquivo inválido.");
      }

      let blob;
      try {
        blob = await response.blob();
      } catch {
        throw new Error("O download foi interrompido antes de concluir. Tente novamente.");
      }
      if (!(blob instanceof Blob) || blob.type.toLowerCase() !== "application/zip" || blob.size === 0) {
        throw new Error("O serviço não conseguiu concluir um arquivo ZIP válido. Tente novamente.");
      }
      return { blob, fileName };
    },
  };
}

if (typeof window !== "undefined") {
  window.GLLOrganizationDocumentsApi = { createOrganizationDocumentsApi };
}
