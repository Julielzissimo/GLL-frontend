import type { CashflowService, CashflowServiceOptions } from "./finance-contracts.js";

export type {
  CashflowCommand,
  CashflowCommandPayloads,
  CashflowCommandResults,
  CashflowService,
  CashflowServiceOptions,
  FinanceDate,
  FinanceDecimal,
  FinanceExpenseInput,
  FinanceId,
  FinancePercentageMember,
  FinanceReceiptAllocationInput,
} from "./finance-contracts.js";

export function createCashflowService(
  client: {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  options: CashflowServiceOptions,
): CashflowService;
