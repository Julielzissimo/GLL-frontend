import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
const transitionsSource = source.match(/const BID_STATUS_TRANSITIONS = Object\.freeze\([\s\S]*?\n\}\);/)?.[0];
const allowedSource = source.match(/function allowedBidStatusTargets[\s\S]*?\n\}/)?.[0];
const validateSource = source.match(/function validateBidStatusTransition[\s\S]*?\n\}/)?.[0];

assert.ok(transitionsSource && allowedSource && validateSource, "As regras de transição devem permanecer testáveis no frontend.");

const context = { statusDisplay: (value) => value };
vm.createContext(context);
vm.runInContext(`${transitionsSource}\n${allowedSource}\n${validateSource}\nthis.validate = validateBidStatusTransition;`, context);

test("status faturado exige aprovação anterior e só reabre para aprovada", () => {
  assert.doesNotThrow(() => context.validate("Aprovada", "Faturado", "Nota fiscal emitida"));
  assert.doesNotThrow(() => context.validate("Faturado", "Aprovada", "Correção operacional"));
  assert.throws(() => context.validate("Em Analise", "Faturado", "Atalho"), /Não é permitido/);
  assert.throws(() => context.validate("Faturado", "Disputada", "Reabrir"), /Não é permitido/);
});

test("toda transição de status exige motivo", () => {
  assert.throws(() => context.validate("Em Analise", "Disputada", "  "), /Informe o motivo/);
  assert.doesNotThrow(() => context.validate("Em Analise", "Disputada", "Sessão concluída"));
});

test("persistência remota usa a operação auditável de status", () => {
  assert.match(source, /client\.rpc\("change_bid_status"/);
  assert.match(source, /change_reason: statusReason\.trim\(\)/);
});
