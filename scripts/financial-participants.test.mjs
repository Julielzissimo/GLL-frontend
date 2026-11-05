import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyCompanyEnquadramento,
  isParticipantTypeCompatible,
  participantTypeLabel,
  validatePercentageComposition,
} from "../web/financial-participants.js";

const root = new URL("../", import.meta.url);
const [html, companyFeature, feature, styles, contracts] = await Promise.all([
  readFile(new URL("web/index.html", root), "utf8"),
  readFile(new URL("web/company-data.js", root), "utf8"),
  readFile(new URL("web/financial-participants.js", root), "utf8"),
  readFile(new URL("web/styles.css", root), "utf8"),
  readFile(new URL("web/financial-participants-contracts.d.ts", root), "utf8"),
]);

test("a nomenclatura acompanha o Enquadramento existente e não presume texto desconhecido", () => {
  assert.equal(classifyCompanyEnquadramento("MEI — Microempreendedor Individual"), "individual");
  assert.equal(classifyCompanyEnquadramento("Empresária Individual"), "individual");
  assert.equal(classifyCompanyEnquadramento("Sociedade Empresária Limitada (LTDA)"), "societaria");
  assert.equal(classifyCompanyEnquadramento("Microempresa"), "indefinido");
  assert.match(participantTypeLabel("titular", "MEI"), /empresário individual/);
  assert.match(participantTypeLabel("socio_legal", "LTDA"), /quadro societário/);
  assert.equal(participantTypeLabel("participante_financeiro", "MEI"), "Participante financeiro");
  assert.equal(isParticipantTypeCompatible("socio_legal", "MEI"), false);
  assert.equal(isParticipantTypeCompatible("titular", "LTDA"), false);
  assert.equal(isParticipantTypeCompatible("socio_legal", "Microempresa"), true);
});

test("percentuais aceitam omissão para pagamentos e validam beneficiários ativos elegíveis", () => {
  const eligible = ["participant-a", "participant-b"];
  assert.deepEqual(
    validatePercentageComposition([
      { participant_id: "participant-a", percentage: "60,25" },
      { participant_id: "participant-b", percentage: "" },
    ], eligible),
    {
      valid: true,
      members: [{ participant_id: "participant-a", percentage: "60.25" }],
      total: "60.25",
      error: "",
    },
  );
  assert.equal(validatePercentageComposition([
    { participant_id: "participant-a", percentage: "100" },
    { participant_id: "participant-b", percentage: "0.000001" },
  ], eligible).valid, false);
  assert.equal(validatePercentageComposition([
    { participant_id: "third-party", percentage: "10" },
  ], eligible).valid, false);
  assert.equal(validatePercentageComposition([
    { participant_id: "participant-a", percentage: "0" },
  ], eligible).valid, false);
  assert.equal(validatePercentageComposition([
    { participant_id: "participant-a", percentage: "10.0000001" },
  ], eligible).valid, false);
  assert.equal(validatePercentageComposition([
    { participant_id: "participant-a", percentage: "50" },
    { participant_id: "participant-a", percentage: "10" },
  ], eligible).valid, false);
});

test("o formulário fica em Dados da Empresa e a seção só carrega para administradores", () => {
  assert.match(html, /id="companyDataPage"[\s\S]*?id="financialParticipantsFeature"/);
  assert.match(html, /id="participantClassificationContext"/);
  assert.match(html, /id="financialParticipantForm"[\s\S]*?id="percentageVersionForm"/);
  assert.match(html, /Terceiros pagadores têm cadastro separado no Financeiro/);
  assert.doesNotMatch(html, /id="thirdPartyPayerForm"|id="thirdPartyPayersList"/);
  assert.match(companyFeature, /createFinancialParticipantsFeature/);
  assert.match(companyFeature, /financialParticipantsFeature\.showPage\(\)/);
  assert.match(feature, /if \(!isAdmin\(\)\)[\s\S]*?return;/);
  assert.match(feature, /client\.rpc\("cashflow_manage_participants"/);
  assert.match(feature, /client\.from\("declaration_settings"\)\.select\("company_classification"\)/);
  assert.match(styles, /\.company-data-participants \{[\s\S]*?display: grid/);
});

test("o contrato tipado separa pagadores e restringe o tipo de participante", () => {
  assert.match(contracts, /"titular"[\s\S]*?"socio_legal"[\s\S]*?"participante_financeiro"/);
  assert.match(contracts, /create_third_party_payer/);
  assert.match(contracts, /set_percentage_version/);
  assert.match(contracts, /percentage_version_id/);
  assert.match(contracts, /cashflow_manage_participants/);
  assert.doesNotMatch(contracts, /organization_id\??:/);
});
