import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
const actionsSource = source.match(/const BID_HISTORY_ENTITY_ACTIONS = Object\.freeze\([\s\S]*?^\}\);/m)?.[0];
const entityPresentationSource = source.match(/function bidHistoryEntityPresentation\(event\) \{[\s\S]*?^\}/m)?.[0];
const presentationSource = source.match(/function bidHistoryPresentation\(event\) \{[\s\S]*?^\}/m)?.[0];

assert.ok(actionsSource && entityPresentationSource && presentationSource, "O histórico deve mapear operações de entidades testáveis no frontend.");

const context = {
  BID_STATUS_LABELS: {},
  bidHistoryItemNumber: () => "",
  bidHistoryItemDetail: () => "",
  bidHistoryChangedFields: () => "",
};
vm.createContext(context);
vm.runInContext(`${actionsSource}\n${entityPresentationSource}\n${presentationSource}\nthis.actions = BID_HISTORY_ENTITY_ACTIONS; this.present = bidHistoryPresentation;`, context);

test("entidades auditadas têm descrições para criação, edição e remoção", () => {
  const eventTypes = { created: "entity_created", updated: "entity_updated", deleted: "entity_deleted" };
  for (const [entity, actions] of Object.entries(context.actions)) {
    for (const operation of Object.keys(eventTypes)) {
      const presentation = context.present({ entity_type: entity, event_type: eventTypes[operation], operation });
      assert.ok(presentation.summary.endsWith("."), `${entity} / ${operation} deve ter uma descrição`);
      assert.doesNotMatch(presentation.summary, /atividade relacionada ao edital/i, `${entity} / ${operation} não deve cair no texto genérico`);
    }
  }
});

test("usa a operação do evento e o tipo de entidade para descrever o ocorrido", () => {
  assert.equal(
    context.present({ entity_type: "commercial_proposals", event_type: "entity_created" }).summary,
    "criou uma proposta comercial para o edital.",
  );
  assert.equal(
    context.present({ entity_type: "bid_item_invoices", event_type: "entity_updated", operation: "updated" }).summary,
    "atualizou uma nota fiscal vinculada a um item do edital.",
  );
  assert.equal(
    context.present({ entity_type: "failure_history", event_type: "entity_deleted", operation: "deleted" }).summary,
    "removeu um registro de falha.",
  );
});

test("mantém um fallback neutro para entidades desconhecidas", () => {
  assert.equal(
    context.present({ entity_type: "future_entity", event_type: "entity_created" }).summary,
    "registrou uma nova informação relacionada ao edital.",
  );
});
