import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DECLARATION_VARIABLES,
  formatDeclarationDate,
  resolveDeclarationVariables,
  resolveVariableSuggestionHost,
  sanitizePdfFileName,
} from "../web/declarations.js";

test("nome do PDF preserva espaços e acentos e remove somente caracteres incompatíveis", () => {
  assert.equal(sanitizePdfFileName("Declaração de Habilitação"), "Declaração de Habilitação.pdf");
  assert.equal(sanitizePdfFileName('Declaração: Edital 12/2026?'), "Declaração- Edital 12-2026-.pdf");
});

test("variáveis conhecidas são substituídas e valores ausentes são informados", () => {
  const result = resolveDeclarationVariables(
    "A {{razao_social}} participa do edital {{ numero_edital }} de {{orgao}}.",
    { razao_social: "Empresa Ágil", numero_edital: "42/2026", orgao: "" },
  );
  assert.equal(result.output, "A Empresa Ágil participa do edital 42/2026 de {{orgao}}.");
  assert.deepEqual(result.missing, ["orgao"]);
});

test("data é formatada em português sem deslocamento de fuso", () => {
  assert.equal(formatDeclarationDate("2026-09-26"), "26 de setembro de 2026");
});

test("catálogo público contém todas as variáveis essenciais", () => {
  const keys = new Set(DECLARATION_VARIABLES.map((item) => item.key));
  for (const key of ["razao_social", "cpf_representante", "numero_processo", "data"]) assert.ok(keys.has(key));
});

test("sugestões são hospedadas no diálogo ativo para permanecerem visíveis", () => {
  const dialog = { id: "declarationTemplateModal" };
  const page = { id: "declarationsPage" };
  assert.equal(resolveVariableSuggestionHost({ closest: () => dialog }, page), dialog);
  assert.equal(resolveVariableSuggestionHost({ closest: () => null }, page), page);
});

test("pré-visualização do PDF ocupa a área disponível no modal", async () => {
  const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  assert.match(
    html,
    /<iframe id="declarationPreviewFrame" class="declaration-preview-frame"/,
  );
});

test("configurações preservam o espaçamento visual entre cabeçalho e seções", async () => {
  const styles = await readFile(new URL("../web/styles.css", import.meta.url), "utf8");
  assert.match(
    styles,
    /#declarationSettingsForm\s*{\s*display:\s*grid;\s*gap:\s*inherit;\s*}/,
  );
});
