const ADMIN_ROLE = "Administrador";
const RPC_NAME = "cashflow_execute";

const COMMANDS = new Set([
  "create_participant",
  "set_participant_status",
  "create_third_party_payer",
  "set_percentage_version",
  "redistribute_reservation",
  "adjust_reservation",
  "withdraw_by_bid",
  "reverse_withdrawal",
  "record_expense",
  "adjust_expense",
  "reimburse_expense",
  "reverse_reimbursement",
  "adjust_cash",
  "import_expenses",
]);

function assertPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("Informe o conteúdo do comando financeiro.");
  }
  try {
    JSON.stringify(payload);
  } catch {
    throw new TypeError("O comando precisa conter apenas dados serializáveis em JSON.");
  }
}

function assertDecimalInputs(value) {
  if (Array.isArray(value)) {
    for (const entry of value) assertDecimalInputs(entry);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const scale = key === "percentage" ? 6 : ["amount", "amount_delta", "historical_reimbursed_amount"].includes(key) ? 2 : null;
    if (scale !== null && (typeof entry !== "string" || !new RegExp(`^-?(0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`).test(entry))) {
      throw new TypeError(`${key} deve ser enviado como decimal textual com no máximo ${scale} casas.`);
    }
    assertDecimalInputs(entry);
  }
}

/**
 * Shared client for the Fluxo de Caixa command RPC. The role check improves
 * the user experience; the database function remains the security boundary.
 *
 * @param {{rpc: Function}} client Authenticated Supabase client.
 * @param {{getUserRole: () => string|null|undefined}} options Current session role.
 */
export function createCashflowService(client, options) {
  if (!client || typeof client.rpc !== "function") {
    throw new TypeError("Informe um cliente Supabase autenticado.");
  }
  if (!options || typeof options.getUserRole !== "function") {
    throw new TypeError("Informe a função que retorna o perfil da sessão atual.");
  }

  return Object.freeze({
    newIdempotencyKey() {
      if (typeof globalThis.crypto?.randomUUID !== "function") {
        throw new Error("Geração segura de chave idempotente não está disponível.");
      }
      return globalThis.crypto.randomUUID();
    },

    /** @template {string} K */
    async execute(command, payload, idempotencyKey) {
      if (options.getUserRole() !== ADMIN_ROLE) {
        throw new Error("Somente um Administrador da empresa pode usar o Fluxo de Caixa.");
      }
      if (!COMMANDS.has(command)) throw new TypeError("Comando de Fluxo de Caixa desconhecido.");
      assertPayload(payload);
      assertDecimalInputs(payload);
      if (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.length > 128) {
        throw new TypeError("Informe uma chave idempotente para esta operação.");
      }
      const result = await client.rpc(RPC_NAME, {
        p_command: command,
        p_idempotency_key: idempotencyKey,
        p_payload: payload,
      });
      if (result?.error) throw new Error(result.error.message || "Falha ao executar operação financeira.");
      if (!result?.data || typeof result.data !== "object" || Array.isArray(result.data)) {
        throw new Error("O serviço financeiro retornou uma resposta inválida.");
      }
      return result.data;
    },
  });
}
