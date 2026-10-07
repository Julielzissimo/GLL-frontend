import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  documentDigits,
  formatCnpj,
  formatCpf,
  isValidCnpj,
  isValidCpf,
} from "../web/company-data.js";

const root = new URL("../", import.meta.url);
const [html, app, feature, styles] = await Promise.all([
  readFile(new URL("web/index.html", root), "utf8"),
  readFile(new URL("web/app.js", root), "utf8"),
  readFile(new URL("web/company-data.js", root), "utf8"),
  readFile(new URL("web/styles.css", root), "utf8"),
]);

test("documentos brasileiros são formatados sem perder os dígitos", () => {
  assert.equal(formatCnpj("11222333000181"), "11.222.333/0001-81");
  assert.equal(formatCpf("52998224725"), "529.982.247-25");
  assert.equal(documentDigits("529.982.247-25"), "52998224725");
});

test("CNPJ e CPF exigem dígitos verificadores válidos", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
});

test("Configurações oferece a subpágina Dados da Empresa", () => {
  assert.match(html, /id="openCompanyDataButton"[\s\S]*?>Abrir cadastro</);
  assert.match(html, /id="companyDataPage"[\s\S]*?Dados da Empresa/);
  assert.match(html, /id="legalRepresentativesList"/);
  assert.match(html, /<h2>Identidade visual<\/h2>[\s\S]*?incluídas automaticamente nas propostas e declarações/);
  assert.match(html, /id="companyLogo"/);
  assert.match(html, /id="companyWatermark"/);
  assert.doesNotMatch(html, /id="declarationLogo"|id="declarationWatermark"/);
  assert.match(app, /companyData:\s*"configuracoes\/dados-da-empresa"/);
  assert.match(app, /companyDataFeature\.showPage\(\)/);
});

test("salvamento central usa função transacional e sincroniza a organização", () => {
  assert.match(feature, /client\.rpc\("save_current_company_data"/);
  assert.match(feature, /onOrganizationUpdate\?\.\(organization\)/);
  assert.match(feature, /Somente administradores podem alterar os dados da empresa/);
  assert.match(feature, /select\("id,name,cnpj,logo_path,watermark_path"\)/);
  assert.match(feature, /from\(COMPANY_ASSET_BUCKET\)\.upload/);
  assert.match(feature, /\.update\(branding\)/);
});

test("salvar a razão social atualiza a navbar e expõe o nome completo no tooltip", () => {
  assert.match(app, /onOrganizationUpdate: \(organization\) => \{[\s\S]*?updateWorkspaceSummary\(\);/);
  assert.match(app, /function updateWorkspaceSummary\(\)[\s\S]*?refs\.workspaceName\.textContent = organizationName;[\s\S]*?refs\.workspaceSummary\.title = organizationName;[\s\S]*?refs\.workspaceSummary\.setAttribute\("aria-label", `Espaço de trabalho: \$\{organizationName\}`\)/);
  assert.match(styles, /\.workspace-copy strong \{[\s\S]*?text-overflow: ellipsis;[\s\S]*?text-overflow: "\.\.\.";/);
});
