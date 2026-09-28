import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  commercialProposalFileName,
  commercialProposalSignaturePlacement,
  formatCommercialMoney,
  moneyInWords,
} from "../web/commercial-proposals.js";

test("gera o nome obrigatório do PDF a partir do número do edital", () => {
  assert.equal(commercialProposalFileName("00206-2026"), "Proposta Final - 00206-2026.pdf");
  assert.equal(commercialProposalFileName("PE/02:2026"), "Proposta Final - PE-02-2026.pdf");
});

test("formata valores e converte o total por extenso em português", () => {
  assert.match(formatCommercialMoney(2799.01), /2\.799,01/);
  assert.equal(moneyInWords(2799.01), "dois mil, setecentos e noventa e nove reais e um centavo");
});

test("posiciona a assinatura no fim da última página e evita sobreposição com o conteúdo", () => {
  assert.deepEqual(commercialProposalSignaturePlacement(180), { addPage: false, y: 231 });
  assert.deepEqual(commercialProposalSignaturePlacement(232), { addPage: true, y: 231 });
});

test("integra a página independente, navegação e build versionado", async () => {
  const [html, app, build] = await Promise.all([
    readFile(new URL("../web/index.html", import.meta.url), "utf8"),
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-web.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(html, /data-navigation-page="commercialProposals"/);
  assert.match(html, /commercial-proposals\.js/);
  assert.match(app, /commercialProposals: "propostas-comerciais"/);
  assert.match(build, /commercial-proposals\.js/);
  assert.match(build, /production:[\s\S]+commercialProposalsEnabled: false/);
  assert.match(build, /homolog:[\s\S]+commercialProposalsEnabled: true/);
  assert.match(app, /page === "commercialProposals" && GLL_CONFIG\.commercialProposalsEnabled === false/);
  assert.match(app, /navCommercialProposalsButton\.disabled = !commercialProposalsEnabled/);
});

test("mantém os ajustes de interface e organização do construtor de propostas", async () => {
  const [feature, app, styles] = await Promise.all([
    readFile(new URL("../web/commercial-proposals.js", import.meta.url), "utf8"),
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../web/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(feature, />Criar proposta<\/button>/);
  assert.match(feature, />Configuração<\/button>/);
  assert.match(feature, /<span class="eyebrow">RESUMO<\/span>/);
  assert.match(feature, /Marca \/ Fabricante/);
  assert.doesNotMatch(feature, /\["manufacturer", "Fabricante", "input"\]/);
  assert.match(feature, /Salvar esta informação permanentemente/);
  assert.match(feature, /data-toggle-item=/);
  assert.match(feature, /drawWatermarkBackground\(\)/);
  assert.match(feature, /filter\(\(entry\) => entry\.type !== "signature"\)/);
  assert.match(feature, /enabledSections\.some\(\(entry\) => entry\.type === "signature"\)/);
  assert.match(feature, /drawInlineTextSection\(section\.title \|\| "Prazo de entrega", proposal\.delivery_term\)/);
  assert.match(feature, /drawInlineTextSection\(section\.title \|\| "Validade da proposta", proposal\.proposal_validity\)/);
  assert.match(feature, /drawInlineTextSection\(section\.title \|\| "Condições de pagamento", proposal\.payment_terms\)/);
  assert.match(feature, /id="commercialProposalDiscardDialog"/);
  assert.match(feature, />Continuar editando<\/button>/);
  assert.match(feature, />Descartar alterações<\/button>/);
  assert.doesNotMatch(feature, /confirm\("Há alterações não salvas/);
  assert.match(app, /commercialProposalsFeature\.requestDiscardChanges/);
  assert.match(styles, /\.commercial-proposal-create-modal/);
  assert.match(styles, /#commercialProposalPreviewFrame[^}]+min-height: 0/s);
});
