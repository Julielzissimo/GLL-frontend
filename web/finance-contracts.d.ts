export type FinanceDecimal = string;
export type FinanceDate = string;
export type FinanceId = string;

export interface FinancePercentageMember {
  participant_id: FinanceId;
  percentage: FinanceDecimal;
}

export type FinanceExpenseInput =
  | {
      payer_type: "organization";
      participant_payer_id?: never;
      third_party_payer_id?: never;
      paid_on: FinanceDate;
      amount: FinanceDecimal;
      description: string;
      is_historical?: boolean;
      historical_reimbursed_amount?: FinanceDecimal;
    }
  | {
      payer_type: "participant";
      participant_payer_id: FinanceId;
      third_party_payer_id?: never;
      paid_on: FinanceDate;
      amount: FinanceDecimal;
      description: string;
      is_historical?: boolean;
      historical_reimbursed_amount?: FinanceDecimal;
    }
  | {
      payer_type: "third_party";
      participant_payer_id?: never;
      third_party_payer_id: FinanceId;
      paid_on: FinanceDate;
      amount: FinanceDecimal;
      description: string;
      is_historical?: boolean;
      historical_reimbursed_amount?: FinanceDecimal;
    };

export interface FinanceExpenseImportRow {
  row_key: string;
  payer_type: "unresolved";
  participant_payer_id?: never;
  third_party_payer_id?: never;
  source_payer_label: string;
  paid_on: FinanceDate;
  amount: FinanceDecimal;
  description: string;
  is_historical: true;
  historical_reimbursed_amount: "0.00";
}

export interface CashflowCommandPayloads {
  create_participant: {
    display_name: string;
    effective_on?: FinanceDate;
    reason?: string;
  };
  set_participant_status: {
    participant_id: FinanceId;
    effective_on: FinanceDate;
    is_active: boolean;
    reason: string;
  };
  create_third_party_payer: { display_name: string };
  set_percentage_version: {
    effective_on: FinanceDate;
    reason: string;
    members: FinancePercentageMember[];
  };
  redistribute_reservation: {
    reservation_id: FinanceId;
    from_participant_id: FinanceId;
    to_participant_id: FinanceId;
    amount: FinanceDecimal;
    reason: string;
  };
  adjust_reservation: {
    reservation_id: FinanceId;
    participant_id: FinanceId;
    amount_delta: FinanceDecimal;
    reason: string;
    reverses_adjustment_id?: FinanceId;
  };
  withdraw_by_bid: {
    reservation_id: FinanceId;
    bid_id: string;
    participant_id: FinanceId;
    amount: FinanceDecimal;
    paid_on: FinanceDate;
    reason: string;
  };
  reverse_withdrawal: {
    withdrawal_id: FinanceId;
    amount: FinanceDecimal;
    reason: string;
    reversed_on?: FinanceDate;
  };
  record_expense: FinanceExpenseInput;
  adjust_expense: {
    expense_id: FinanceId;
    amount_delta: FinanceDecimal;
    reason: string;
    occurred_on?: FinanceDate;
    reverses_adjustment_id?: FinanceId;
  };
  reimburse_expense: {
    expense_id: FinanceId;
    amount: FinanceDecimal;
    paid_on: FinanceDate;
    reason: string;
  };
  reverse_reimbursement: {
    reimbursement_id: FinanceId;
    amount: FinanceDecimal;
    reason: string;
    reversed_on?: FinanceDate;
  };
  adjust_cash: {
    amount_delta: FinanceDecimal;
    occurred_on: FinanceDate;
    reason: string;
    reverses_cash_event_id?: FinanceId;
  };
  import_expenses: {
    source_key: string;
    source_file_sha256: string;
    rows: FinanceExpenseImportRow[];
  };
}

export interface CashflowCommandResults {
  create_participant: { participant_id: FinanceId };
  set_participant_status: { status_event_id: FinanceId };
  create_third_party_payer: { third_party_payer_id: FinanceId };
  set_percentage_version: { percentage_version_id: FinanceId; total_percentage: FinanceDecimal };
  redistribute_reservation: { redistribution_id: FinanceId };
  adjust_reservation: { reserve_adjustment_id: FinanceId };
  withdraw_by_bid: { withdrawal_id: FinanceId; cash_event_id: FinanceId };
  reverse_withdrawal: { withdrawal_reversal_id: FinanceId };
  record_expense: { expense_id: FinanceId; cash_event_id: FinanceId | null };
  adjust_expense: { expense_adjustment_id: FinanceId };
  reimburse_expense: { reimbursement_id: FinanceId; cash_event_id: FinanceId };
  reverse_reimbursement: { reimbursement_reversal_id: FinanceId };
  adjust_cash: { cash_adjustment_id: FinanceId; cash_event_id: FinanceId };
  import_expenses: {
    import_batch_id: FinanceId;
    row_count: number;
    replayed: boolean;
    rows?: Array<{ row_key: string; expense_id: FinanceId }>;
  };
}

export type CashflowCommand = keyof CashflowCommandPayloads;

export interface CashflowServiceOptions {
  getUserRole: () => string | null | undefined;
}

export interface CashflowService {
  newIdempotencyKey(): string;
  execute<K extends CashflowCommand>(
    command: K,
    payload: CashflowCommandPayloads[K],
    idempotencyKey: string,
  ): Promise<CashflowCommandResults[K]>;
}
