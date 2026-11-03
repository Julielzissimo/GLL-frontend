// Lê a planilha no navegador; nenhum conteúdo é transmitido durante a prévia.
const decode = new TextDecoder();
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
function xml(bytes) {
  const doc = new DOMParser().parseFromString(decode.decode(bytes), "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("A planilha contém XML inválido.");
  return doc;
}
async function unzip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length > 5 * 1024 * 1024) throw new Error("A planilha deve ter no máximo 5 MB.");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("Arquivo XLSX inválido.");
  const count = view.getUint16(end + 10, true);
  if (count > 1000) throw new Error("A planilha contém arquivos demais.");
  let position = view.getUint32(end + 16, true);
  let total = 0;
  const files = {};
  for (let i = 0; i < count; i++) {
    if (position + 46 > bytes.length || view.getUint32(position, true) !== 0x02014b50) throw new Error("Arquivo XLSX inválido.");
    const flags = view.getUint16(position + 8, true), method = view.getUint16(position + 10, true);
    const compressed = view.getUint32(position + 20, true), size = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true), extra = view.getUint16(position + 30, true), comment = view.getUint16(position + 32, true);
    const offset = view.getUint32(position + 42, true);
    const name = decode.decode(bytes.subarray(position + 46, position + 46 + nameLength));
    position += 46 + nameLength + extra + comment;
    total += size;
    if (flags & 1 || total > 20 * 1024 * 1024 || offset + 30 > bytes.length) throw new Error("Planilha protegida ou excessivamente grande.");
    if (!/^xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/[^/]+\.xml)$/.test(name)) continue;
    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error("Arquivo XLSX inválido.");
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    if (start + compressed > bytes.length) throw new Error("Arquivo XLSX truncado.");
    const part = bytes.slice(start, start + compressed);
    let contents;
    if (method === 0) contents = part;
    else if (method === 8 && typeof DecompressionStream !== "undefined") {
      try {
        const reader = new Blob([part]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
        const chunks = []; let length = 0;
        for (;;) {
          const item = await reader.read();
          if (item.done) break;
          length += item.value.length;
          if (length > size || length > 20 * 1024 * 1024) { await reader.cancel(); throw new Error("Arquivo XLSX excede o tamanho declarado."); }
          chunks.push(item.value);
        }
        contents = new Uint8Array(length);
        let cursor = 0;
        for (const chunk of chunks) { contents.set(chunk, cursor); cursor += chunk.length; }
      }
      catch { throw new Error("Este navegador não consegue abrir XLSX localmente. Use um navegador atualizado."); }
    } else throw new Error("Compressão XLSX não suportada neste navegador.");
    if (contents.length !== size) throw new Error("Arquivo XLSX truncado.");
    files[name] = contents;
  }
  return files;
}
function dateValue(value, date1904) {
  const iso = String(value).match(/^(\d{4})-(\d\d)-(\d\d)$/);
  const br = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso || br) {
    const year = Number(iso ? iso[1] : br[3]), month = Number(iso ? iso[2] : br[2]), day = Number(iso ? iso[3] : br[1]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : "";
  }
  const serial = Number(value);
  if (!value || !Number.isFinite(serial) || serial < 1 || serial > 2958465) return "";
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
}
export async function readExpenseWorkbook(file) {
  const files = await unzip(await file.arrayBuffer());
  if (!files["xl/workbook.xml"] || !files["xl/_rels/workbook.xml.rels"]) throw new Error("Não foi possível encontrar as abas da planilha.");
  const workbook = xml(files["xl/workbook.xml"]), rels = xml(files["xl/_rels/workbook.xml.rels"]);
  const sheet = workbook.getElementsByTagNameNS("*", "sheet")[0];
  const relId = sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const relation = [...rels.getElementsByTagNameNS("*", "Relationship")].find((r) => r.getAttribute("Id") === relId);
  const target = relation?.getAttribute("Target")?.replace(/^\//, "");
  const path = target?.startsWith("xl/") ? target : `xl/${target}`;
  if (!files[path]) throw new Error("Não foi possível abrir a primeira aba.");
  const strings = files["xl/sharedStrings.xml"] ? [...xml(files["xl/sharedStrings.xml"]).getElementsByTagNameNS("*", "si")].map((node) => [...node.getElementsByTagNameNS("*", "t")].map((t) => t.textContent).join("")) : [];
  const rows = [...xml(files[path]).getElementsByTagNameNS("*", "row")].map((row) => {
    const result = { row: Number(row.getAttribute("r")) };
    for (const cell of row.getElementsByTagNameNS("*", "c")) {
      const col = cell.getAttribute("r")?.replace(/\d/g, "");
      const val = cell.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
      result[col] = cell.getAttribute("t") === "s" ? strings[Number(val)] : cell.getAttribute("t") === "inlineStr" ? [...cell.getElementsByTagNameNS("*", "t")].map((t) => t.textContent).join("") : val;
    }
    return result;
  });
  const header = rows.find((row) => normalize(row.B) === "data pgto" && normalize(row.C) === "valor" && normalize(row.D) === "descricao" && normalize(row.E) === "quem pagou" && normalize(row.F) === "ressarcido?");
  if (!header) throw new Error("As colunas esperadas não foram encontradas na primeira aba.");
  const date1904 = workbook.getElementsByTagNameNS("*", "workbookPr")[0]?.getAttribute("date1904") === "1";
  return rows.filter((row) => row.row > header.row && [row.B, row.C, row.D, row.E, row.F].some(Boolean)).map((row) => ({ row: row.row, paid_on: dateValue(row.B, date1904), amount: String(row.C ?? "").trim() === "" ? NaN : Number(row.C), description: String(row.D || "").trim(), payer: String(row.E || "").trim(), reimbursed: normalize(row.F) }));
}
