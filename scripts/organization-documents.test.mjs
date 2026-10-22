import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  countDocumentStatuses,
  daysUntilExpiration,
  filterOrganizationDocuments,
  getDocumentSelectionState,
  getDocumentStatus,
  reconcileDocumentSelection,
  todayInSaoPaulo,
  updateDocumentSelection,
  validateAlertDays,
  validateDocumentFields,
} from "../web/organization-documents.js";

const TODAY = "2026-10-20";

test("calcula a data do negócio em São Paulo sem deslocamento de calendário", () => {
  assert.equal(todayInSaoPaulo(new Date("2026-10-20T03:00:00.000Z")), TODAY);
  assert.equal(daysUntilExpiration("2026-10-21", TODAY), 1);
  assert.equal(daysUntilExpiration("2026-10-17", TODAY), -3);
  assert.equal(daysUntilExpiration("2026-02-30", TODAY), null);
});

test("diferencia documento válido, próximo, hoje, vencido e sem vencimento", () => {
  assert.deepEqual(getDocumentStatus({ expiresOn: "2026-12-01" }, 30, TODAY), {
    key: "valid", label: "Válido", daysRemaining: 42,
  });
  assert.equal(getDocumentStatus({ expiresOn: "2026-11-04" }, 30, TODAY).label, "Faltam 15 dias para vencer");
  assert.equal(getDocumentStatus({ expiresOn: "2026-10-21" }, 30, TODAY).label, "Vence amanhã");
  assert.equal(getDocumentStatus({ expiresOn: TODAY }, 30, TODAY).label, "Vence hoje");
  assert.equal(getDocumentStatus({ expiresOn: "2026-10-17" }, 30, TODAY).label, "Vencido há 3 dias");
  assert.equal(getDocumentStatus({ expiresOn: null }, 30, TODAY).label, "Sem vencimento");
});

test("resumo inclui documentos sem validade entre os válidos e hoje entre os próximos", () => {
  const documents = [
    { expiresOn: "2026-12-01" },
    { expiresOn: null },
    { expiresOn: "2026-11-04" },
    { expiresOn: TODAY },
    { expiresOn: "2026-10-17" },
  ];
  assert.deepEqual(countDocumentStatuses(documents, 30, TODAY), {
    total: 5, valid: 2, nearExpiry: 2, expired: 1,
  });
});

test("pesquisa ignora acentos, filtra situação e ordena vencimentos", () => {
  const documents = [
    { id: "no-date", title: "Certidão sem prazo", expiresOn: null },
    { id: "far", title: "Certidão estadual", expiresOn: "2026-12-01" },
    { id: "near", title: "Certidão federal", expiresOn: "2026-11-04" },
    { id: "late", title: "Alvará", expiresOn: "2026-10-17" },
  ];

  const byExpiry = filterOrganizationDocuments(documents, { today: TODAY, sortDirection: "asc" });
  assert.deepEqual(byExpiry.map(({ document }) => document.id), ["late", "near", "far", "no-date"]);
  const byTitle = filterOrganizationDocuments(documents, { query: "federal", status: "near-expiry", today: TODAY });
  assert.deepEqual(byTitle.map(({ document }) => document.id), ["near"]);
  const noExpiry = filterOrganizationDocuments(documents, { status: "no-expiry", today: TODAY });
  assert.deepEqual(noExpiry.map(({ document }) => document.id), ["no-date"]);
});

test("seleção em lote atua sobre os resultados visíveis e preserva itens ocultos por filtros", () => {
  const selected = new Set(["hidden"]);
  const afterSelectVisible = updateDocumentSelection(selected, ["visible-a", "visible-b"], true);

  assert.deepEqual([...afterSelectVisible].sort(), ["hidden", "visible-a", "visible-b"]);
  assert.deepEqual(getDocumentSelectionState(["visible-a", "visible-b"], afterSelectVisible), {
    selectedCount: 2, checked: true, indeterminate: false,
  });

  const afterPartialDeselect = updateDocumentSelection(afterSelectVisible, ["visible-a"], false);
  assert.deepEqual(getDocumentSelectionState(["visible-a", "visible-b"], afterPartialDeselect), {
    selectedCount: 1, checked: false, indeterminate: true,
  });
  assert.equal(afterPartialDeselect.has("hidden"), true);
  assert.deepEqual([...reconcileDocumentSelection(afterPartialDeselect, [{ id: "visible-b" }, { id: "hidden" }])].sort(), ["hidden", "visible-b"]);
});

test("valida cadastro, substituição, edição de validade e antecedência dos alertas", () => {
  const file = { name: "certidao.pdf", size: 128 };
  assert.equal(validateDocumentFields({ mode: "create", title: "  ", file, expiresOn: TODAY }), "Informe o título do documento.");
  assert.equal(validateDocumentFields({ mode: "create", title: "Certidão", file: null, expiresOn: TODAY }), "Selecione um arquivo.");
  assert.equal(validateDocumentFields({ mode: "create", title: "Certidão", file, expiresOn: "", noExpiration: false }), "Informe uma data de validade ou marque “Sem vencimento”.");
  assert.equal(validateDocumentFields({ mode: "replace", title: "", file, noExpiration: true }), "");
  assert.equal(validateDocumentFields({ mode: "edit", expiresOn: null, noExpiration: true }), "");
  assert.equal(validateAlertDays("30", { min: 0, max: 365 }), "");
  assert.match(validateAlertDays("-1", { min: 0, max: 365 }), /pelo menos 0/);
  assert.match(validateAlertDays("366", { min: 0, max: 365 }), /no máximo 365/);
  assert.equal(validateAlertDays("0", { min: 0, max: 120 }), "");
  assert.equal(validateAlertDays("120", { min: 0, max: 120 }), "");
  assert.match(validateAlertDays("121", { min: 0, max: 120 }), /no máximo 120/);
  assert.match(validateAlertDays("1.5"), /número inteiro/);
});

test("preferências de alertas usam slider acessível e mantêm o salvamento por organização", async () => {
  const feature = await readFile(new URL("../web/organization-documents.js", import.meta.url), "utf8");

  assert.match(feature, /const MIN_ALERT_DAYS = 0/);
  assert.match(feature, /const MAX_ALERT_DAYS = 120/);
  assert.match(feature, /type="range" min="' \+ MIN_ALERT_DAYS \+ '" max="' \+ MAX_ALERT_DAYS \+ '" step="1"/);
  assert.match(feature, /aria-valuetext=/);
  assert.match(feature, /<span class="is-start">0<\/span><span style="left: 5\.8333%">7<\/span><span style="left: 12\.5%">15<\/span><span style="left: 25%">30<\/span><span style="left: 50%">60<\/span><span style="left: 75%">90<\/span><span class="is-end">120<\/span>/);
  assert.match(feature, /state\.alertDaysDraft = alertDays/);
  assert.match(feature, /api\(\)\.saveAlertDays\(\{ alertDays \}\)/);
  assert.match(feature, /Esta configuração vale para toda a organização/);
});

test("registra a página na seção Documentos e restringe a navegação do Kit à homologação", async () => {
  const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
  const build = await readFile(new URL("../scripts/build-web.mjs", import.meta.url), "utf8");

  assert.match(html, /<span class="nav-section-label">DOCUMENTOS<\/span>[\s\S]{0,1000}data-navigation-page="organizationDocuments"/);
  assert.match(html, /id="organizationDocumentsPage"[\s\S]*?id="organizationDocumentsRoot"/);
  assert.match(app, /organizationDocuments: "kit-de-documentos"/);
  assert.match(app, /page === "organizationDocuments" && GLL_CONFIG\.organizationDocumentsEnabled !== true/);
  assert.match(build, /environment: "homolog"[\s\S]*?organizationDocumentsEnabled: true/);
  assert.match(build, /environment: "production"[\s\S]*?organizationDocumentsEnabled: false/);
});

test("reutiliza componentes do Design System e mantém uma gateway de dados tipada", async () => {
  const feature = await readFile(new URL("../web/organization-documents.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../web/styles.css", import.meta.url), "utf8");
  assert.match(feature, /@typedef \{Object\} OrganizationDocumentsGateway/);
  assert.match(feature, /COMPONENTS\?\.button/);
  assert.match(feature, /COMPONENTS\?\.checkbox/);
  assert.match(feature, /COMPONENTS\?\.badge/);
  assert.match(feature, /COMPONENTS\?\.emptyState/);
  assert.match(feature, /COMPONENTS\?\.skeleton/);
  assert.match(feature, /replaceDocument\(/);
  assert.match(feature, /updateValidity\(/);
  assert.match(feature, /downloadDocumentsZip\(/);
  assert.match(feature, /const label = "Baixar selecionados \(\.zip\)"/);
  assert.match(feature, /anchor\.download = result\.fileName/);
  assert.match(styles, /\.organization-documents-page\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.organization-documents-settings,\s*\.organization-documents-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.organization-documents-table-wrap\s*\{[^}]*min-width:\s*0;[^}]*overflow-x:\s*auto/);
});
