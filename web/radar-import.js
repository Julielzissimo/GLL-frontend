const MAX_SELECTED_ITEM_NUMBERS = 20_000;

export function normalizeSelectedRadarItemNumbers(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_SELECTED_ITEM_NUMBERS) {
    throw new TypeError("Selecione ao menos um item para importar.");
  }
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const number = String(value ?? "").trim();
    if (!/^[1-9]\d*$/u.test(number) || !Number.isSafeInteger(Number(number))) {
      throw new TypeError("A seleção contém um número de item inválido.");
    }
    if (seen.has(number)) throw new TypeError("A seleção contém itens repetidos.");
    seen.add(number);
    result.push(number);
  }
  return result;
}

function positiveCount(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

export function formatRadarImportDocumentFeedback(value) {
  const status = String(value?.status || "");
  if (!status) return { message: "", tone: "success" };
  if (status === "unavailable") {
    return { message: "Os itens foram importados, mas não foi possível anexar os documentos do edital.", tone: "warning" };
  }
  if (status === "none") {
    return { message: "Não foram encontrados documentos publicados para anexar.", tone: "warning" };
  }

  const attached = positiveCount(value?.attached_count);
  const alreadyAttached = positiveCount(value?.already_attached_count);
  const failed = positiveCount(value?.failed_count);
  const ignored = positiveCount(value?.ignored_count);
  const capacitySkipped = positiveCount(value?.capacity_skipped_count);
  const messages = [];
  if (attached) messages.push(`${attached} ${attached === 1 ? "documento do edital anexado" : "documentos do edital anexados"}.`);
  if (alreadyAttached) messages.push(`${alreadyAttached} ${alreadyAttached === 1 ? "documento já estava" : "documentos já estavam"} anexado${alreadyAttached === 1 ? "" : "s"}.`);
  if (failed) messages.push(`${failed} ${failed === 1 ? "documento não pôde" : "documentos não puderam"} ser anexado${failed === 1 ? "" : "s"}.`);
  if (capacitySkipped) messages.push(attached || alreadyAttached
    ? "O limite de quatro arquivos foi atingido."
    : "O edital já atingiu o limite de quatro arquivos.");
  if (ignored) messages.push("Os documentos além dos quatro primeiros foram ignorados.");
  if (status === "limit_reached" && !messages.length) messages.push("O edital já atingiu o limite de quatro arquivos.");

  const tone = status === "partial" || status === "limit_reached" || failed > 0 || capacitySkipped > 0
    ? "warning"
    : "success";
  return { message: messages.join(" "), tone };
}

export function createRadarImportService({ getClient } = {}) {
  function client() {
    const value = getClient?.();
    if (!value) throw new Error("Entre no GLL para importar itens do Radar.");
    return value;
  }

  async function loadImportStatus(numberControlPncp) {
    const identifier = String(numberControlPncp || "").trim();
    if (!identifier) throw new TypeError("Identificador PNCP inválido.");
    const activeClient = client();
    const { data: importRow, error: importError } = await activeClient.from("radar_importacoes")
      .select("id, bid_id")
      .eq("numero_controle_pncp", identifier)
      .maybeSingle();
    if (importError) throw new Error("Não foi possível consultar a importação desta contratação.");
    if (!importRow) return null;

    const [bidResult, itemResult] = await Promise.all([
      activeClient.from("bids")
        .select("id, edital_number, buyer_agency, status")
        .eq("id", importRow.bid_id)
        .maybeSingle(),
      activeClient.from("items")
        .select("radar_numero_item_pncp")
        .eq("radar_importacao_id", importRow.id),
    ]);
    if (bidResult.error || itemResult.error || !bidResult.data) {
      throw new Error("Não foi possível consultar os itens já importados neste edital.");
    }
    const itemNumbers = (itemResult.data || []).map((row) => {
      const sourceNumber = String(row.radar_numero_item_pncp || "");
      const numericNumber = Number(sourceNumber);
      return Number.isSafeInteger(numericNumber) && numericNumber > 0 ? String(numericNumber) : sourceNumber;
    });
    return {
      importId: importRow.id,
      bidId: importRow.bid_id,
      editalNumber: bidResult.data.edital_number || importRow.bid_id,
      buyerAgency: bidResult.data.buyer_agency || "",
      status: bidResult.data.status || "",
      itemNumbers: new Set(itemNumbers),
    };
  }

  async function importSelected(numberControlPncp, selectedItemNumbers) {
    const selection = normalizeSelectedRadarItemNumbers(selectedItemNumbers);
    const { data, error } = await client().functions.invoke("radar-import", {
      body: {
        action: "import",
        numberControlPncp: String(numberControlPncp || "").trim(),
        selectedItemNumbers: selection,
      },
    });
    if (error) {
      let responseBody = null;
      try { responseBody = await error.context?.json?.(); } catch { /* The invocation may already have consumed the body. */ }
      throw new Error(responseBody?.error || "Não foi possível importar os itens selecionados.");
    }
    if (!data?.ok || !data.bid_id) throw new Error("A importação não retornou um edital válido.");
    return data;
  }

  async function attachDocuments(numberControlPncp) {
    const identifier = String(numberControlPncp || "").trim();
    if (!identifier) throw new TypeError("Identificador PNCP inválido.");
    const { data, error } = await client().functions.invoke("radar-import", {
      body: { action: "attach-documents", numberControlPncp: identifier },
    });
    if (error) {
      let responseBody = null;
      try { responseBody = await error.context?.json?.(); } catch { /* The invocation may already have consumed the body. */ }
      throw new Error(responseBody?.error || "Não foi possível anexar os documentos do edital.");
    }
    if (!data?.ok) throw new Error("A importação não confirmou o anexo dos documentos do edital.");
    return data.document_attachments || null;
  }

  return Object.freeze({ loadImportStatus, importSelected, attachDocuments });
}

if (typeof window !== "undefined") {
  window.GLLRadarImport = Object.freeze({ createRadarImportService, normalizeSelectedRadarItemNumbers });
}
