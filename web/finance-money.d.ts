export interface CashflowItemObjectiveInput {
  unitPrice: string;
  supplierCost: string;
  quantity: string;
}

export interface CashflowItemObjective {
  receivableBase: string;
  expectedProfit: string;
}

export interface CashflowRecognitionInput {
  expectedProfit: string;
  receivableBase: string;
  receivedBefore: string;
  receiptAmount: string;
}

export interface CashflowPercentageInput {
  participantId: string;
  percentage: string;
}

export interface CashflowAllocationResult {
  reservedAmount: string;
  unallocatedAmount: string;
  shares: ReadonlyArray<{
    participantId: string;
    percentage: string;
    amount: string;
  }>;
}

export function parseMoneyToCents(value: string): bigint;
export function formatCents(cents: bigint): string;
export function sumMoney(values: string[]): string;
export function calculateItemObjective(input: CashflowItemObjectiveInput): CashflowItemObjective;
export function calculateRecognizedProfitDelta(input: CashflowRecognitionInput): string;
export function allocateRecognizedProfit(
  amount: string,
  members: CashflowPercentageInput[],
): CashflowAllocationResult;
export function sha256Hex(source: string | ArrayBuffer | ArrayBufferView | Blob): Promise<string>;
export function hashImportRows(rows: unknown[]): Promise<string>;
