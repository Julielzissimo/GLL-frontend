export interface CashflowReservationEvent {
  reservation_id: string;
  participant_id: string;
  amount_signed: string;
}

export interface CashflowWithdrawalDraft {
  amount: string;
  paidOn: string;
  reason: string;
  bidId: string;
  reservationId: string;
  participantId: string;
  reservationBalance: string;
  participantBalance: string;
  recognizedProfitAvailable: string;
  cashAvailable: string;
}

export interface CashflowReservationFeatureOptions {
  getClient: () => { rpc: Function; from: Function } | null;
  getUserRole: () => string;
  getUsers?: () => Array<{ auth_user_id: string; name?: string; display_name?: string; email?: string }>;
  getBids?: () => Array<{ id: string; edital_number?: string; status: string }>;
  getActorName?: (actorId: string) => string;
  getBidLabel?: (bidId: string) => string;
  toast?: (message: string, tone?: string) => void;
  container?: HTMLElement;
  statusElement?: HTMLElement;
}

export function calculateReservationBalance(events: CashflowReservationEvent[], reservationId: string, participantId: string): string;
export function calculateParticipantReserveBalance(events: CashflowReservationEvent[], participantId: string): string;
export function calculateCashAvailable(events: Array<{ amount_signed: string }>): string;
export function calculateRecognizedProfit(
  allocations: Array<{ recognized_profit_amount: string }>,
  reversals: Array<{ recognized_profit_amount: string }>
): string;
export function validateWithdrawalDraft(draft: CashflowWithdrawalDraft): Readonly<{ amount: string; paid_on: string; reason: string }>;
export function validateRedistributionDraft(draft: {
  amount: string; reason: string; reservationId: string; fromParticipantId: string;
  toParticipantId: string; sourceBalance: string;
}): Readonly<{ amount: string; reason: string }>;
export function validateReversalAmount(value: string, outstanding: string): string;
export function formatFinanceCurrency(value: string): string;
export function createCashflowReservationFeature(options: CashflowReservationFeatureOptions): Readonly<{
  showPage(): Promise<void>;
  reset(): void;
}>;
