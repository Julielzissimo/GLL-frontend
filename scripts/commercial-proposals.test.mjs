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
  assert.match(feature, /\[\["proposal", "Itens e edital"\], \["commercial", "Dados comerciais"\], \["review", "Conferir PDF"\]\]/);
  assert.match(feature, /data-update-budget-value=/);
  assert.match(feature, /override_final_bid/);
  assert.match(feature, /data-proposal-total/);
  assert.match(feature, /data-section-field="title"/);
  assert.match(feature, /placeholder="Ex\.: Declarações"/);
  assert.doesNotMatch(feature, /DECLARAÇÕES \/ TEXTO ADICIONAL/);
  assert.match(feature, /const logoData = await assetDataUrl\(settings\.logo_path\)/);
  assert.match(feature, /const watermarkAsset = await assetDataUrl\(settings\.watermark_path\)/);
  assert.match(feature, /Resumo da proposta/);
  assert.match(feature, /Marca \/ Fabricante/);
  assert.doesNotMatch(feature, /\["manufacturer", "Fabricante", "input"\]/);
  assert.match(feature, /Salvar também no orçamento ao salvar/);
  assert.match(feature, /function renderItemEditors\(\)/);
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
  assert.match(feature, /class="drag-handle" draggable="true"/);
  assert.doesNotMatch(feature, /<article[^>]+draggable="true"[^>]+data-drag-kind/);
  assert.match(feature, /animateCardReorder/);
  assert.match(feature, /\["ArrowUp", "ArrowDown"\]/);
  assert.match(styles, /container-type: inline-size/);
  assert.match(styles, /@container \(max-width: 1180px\)/);
  assert.match(styles, /\.commercial-proposal-item-grid textarea[^}]+height: 168px/s);
});

test("segue o protótipo: lista em tabela, etapas guiadas e prévia integral do PDF", async () => {
  const [feature, styles, patterns] = await Promise.all([
    readFile(new URL("../web/commercial-proposals.js", import.meta.url), "utf8"),
    readFile(new URL("../web/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../stories/patterns/Patterns.stories.js", import.meta.url), "utf8"),
  ]);

  assert.match(feature, /Propostas recentes/);
  assert.match(feature, /Edital \/ órgão/);
  assert.match(feature, /commercial-proposal-items-table/);
  assert.match(feature, /<th class="numeric">Nº<\/th>/);
  assert.match(feature, /Data da proposta<input type="date" data-proposal-field="proposal_date"/);
  assert.match(feature, /Personalizar esta proposta/);
  assert.match(feature, /Descrição técnica dos itens/);
  assert.match(feature, /commercialProposalReviewFrame/);
  assert.match(feature, /data-item-quick-total=/);
  assert.match(feature, /data-item-quick-quantity=/);
  assert.match(feature, /data-move-column=/);
  assert.match(feature, /Gerar PDF/);
  assert.match(feature, /commercial-proposal-more/);
  assert.match(styles, /\.commercial-proposal-items-table/);
  assert.match(styles, /\.commercial-proposal-review-preview/);
  assert.match(styles, /\.commercial-step-dot/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(patterns, /CommercialProposalFlow/);
});
