import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateRecognizedProfit,
  calculateItemObjective,
  calculateRecognizedProfitDelta,
  formatCents,
  hashImportRows,
  parseMoneyToCents,
  sha256Hex,
  sumMoney,
} from "../web/finance-money.js";
import { createCashflowService } from "../web/finance-service.js";

test("fixed-point money parsing and summing never use floating-point arithmetic", () => {
  assert.equal(parseMoneyToCents("90071992547409.91"), 9007199254740991n);
  assert.equal(sumMoney(["0.10", "0.20", "-0.01"]), "0.29");
  assert.equal(formatCents(-123n), "-1.23");
  assert.throws(() => parseMoneyToCents("1.001"), /no máximo 2 casas/);
  assert.throws(() => parseMoneyToCents("1,23"), /no máximo 2 casas/);
  assert.throws(() => parseMoneyToCents(0.1), /decimal textual/);
});

test("item objective and receivable base use the agreed fixed scales", () => {
  assert.deepEqual(calculateItemObjective({
    unitPrice: "12.3456",
    supplierCost: "10.0000",
    quantity: "2.500000",
  }), {
    receivableBase: "30.86",
    expectedProfit: "5.86",
  });
  assert.equal(calculateItemObjective({
    unitPrice: "9.0000",
    supplierCost: "10.0000",
    quantity: "1.000000",
  }).expectedProfit, "0.00");
  assert.throws(() => calculateItemObjective({
    unitPrice: "1.00000",
    supplierCost: "0.5000",
    quantity: "1",
  }), /no máximo 4 casas/);
});

test("partial receipts recognize profit only from the received cumulative amount", () => {
  const partials = [
    calculateRecognizedProfitDelta({ expectedProfit: "1.00", receivableBase: "3.00", receivedBefore: "0.00", receiptAmount: "1.00" }),
    calculateRecognizedProfitDelta({ expectedProfit: "1.00", receivableBase: "3.00", receivedBefore: "1.00", receiptAmount: "1.00" }),
    calculateRecognizedProfitDelta({ expectedProfit: "1.00", receivableBase: "3.00", receivedBefore: "2.00", receiptAmount: "1.00" }),
  ];
  assert.deepEqual(partials, ["0.33", "0.34", "0.33"]);
  assert.equal(sumMoney(partials), "1.00");
  assert.throws(() => calculateRecognizedProfitDelta({
    expectedProfit: "10.00",
    receivableBase: "100.00",
    receivedBefore: "90.00",
    receiptAmount: "10.01",
  }), /excedem a base/);
});

test("percentage snapshots allocate rounded cents without exceeding recognized profit", () => {
  const penny = allocateRecognizedProfit("0.01", [
    { participantId: "00000000-0000-0000-0000-000000000002", percentage: "50.000000" },
    { participantId: "00000000-0000-0000-0000-000000000001", percentage: "50.000000" },
  ]);
  assert.equal(penny.reservedAmount, "0.01");
  assert.equal(penny.unallocatedAmount, "0.00");
  assert.deepEqual(penny.shares, [{
    participantId: "00000000-0000-0000-0000-000000000001",
    percentage: "50.000000",
    amount: "0.01",
  }]);

  const full = allocateRecognizedProfit("100.01", [
    { participantId: "a", percentage: "33.333333" },
    { participantId: "b", percentage: "33.333333" },
    { participantId: "c", percentage: "33.333334" },
  ]);
  assert.equal(full.reservedAmount, "100.01");
  assert.equal(sumMoney(full.shares.map((share) => share.amount)), "100.01");
  assert.throws(() => allocateRecognizedProfit("10.00", [
    { participantId: "a", percentage: "50" },
    { participantId: "b", percentage: "50.000001" },
  ]), /não pode ultrapassar 100/);
});

test("import hashes are lowercase SHA-256 hex values", async () => {
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.match(await hashImportRows([{ row_key: "row-1", amount: "12.30" }]), /^[0-9a-f]{64}$/);
});

test("shared finance service requires administrator role and passes a stable idempotency key", async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: { participant_id: "participant-1" }, error: null };
    },
  };
  let role = "Analista";
  const service = createCashflowService(client, { getUserRole: () => role });
  await assert.rejects(
    service.execute("create_participant", { display_name: "Participante" }, "request-1"),
    /Somente um Administrador/,
  );
  assert.equal(calls.length, 0);

  role = "Administrador";
  const result = await service.execute("create_participant", { display_name: "Participante" }, "request-1");
  assert.deepEqual(result, { participant_id: "participant-1" });
  assert.deepEqual(calls[0], {
    name: "cashflow_execute",
    args: {
      p_command: "create_participant",
      p_idempotency_key: "request-1",
      p_payload: { display_name: "Participante" },
    },
  });
  await assert.rejects(
    service.execute("create_participant", { display_name: "Participante" }, " "),
    /chave idempotente/,
  );
  await assert.rejects(
    service.execute("record_receipt", { bid_id: "BID-1", amount: "0.10" }, "request-3"),
    /Comando.*desconhecido/,
  );
});

test("shared finance service propagates RPC failures and validates dependencies", async () => {
  assert.throws(() => createCashflowService({}, { getUserRole: () => "Administrador" }), /cliente Supabase/);
  assert.throws(() => createCashflowService({ rpc() {} }, {}), /perfil da sessão/);
  const service = createCashflowService({
    async rpc() { return { data: null, error: { message: "falha do banco" } }; },
  }, { getUserRole: () => "Administrador" });
  await assert.rejects(
    service.execute("create_participant", { display_name: "Participante" }, "request-2"),
    /falha do banco/,
  );
});
