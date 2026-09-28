import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  commercialProposalFileName,
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

test("integra a página independente, navegação e build versionado", async () => {
  const [html, app, build, migration] = await Promise.all([
    readFile(new URL("../web/index.html", import.meta.url), "utf8"),
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-web.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../GLL/supabase/migrations/20260928120000_add_commercial_proposals.sql", import.meta.url), "utf8"),
  ]);
  assert.match(html, /data-navigation-page="commercialProposals"/);
  assert.match(html, /commercial-proposals\.js/);
  assert.match(app, /commercialProposals: "propostas-comerciais"/);
  assert.match(build, /commercial-proposals\.js/);
  assert.match(migration, /unique \(organization_id, bid_id\)/);
  assert.match(migration, /update_commercial_proposal_final_bid/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /commercial_proposal_generations/);
});
