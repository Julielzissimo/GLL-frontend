/** Contrato de integração do cadastro P0/P1 da release Fluxo de Caixa. */
export type FinancialParticipantId = string;
export type FinancialParticipantDate = string;
export type FinancialParticipantDecimal = string;

export type FinancialParticipantType =
  | "titular"
  | "socio_legal"
  | "participante_financeiro";

export interface FinancialPercentageMemberInput {
  participant_id: FinancialParticipantId;
  percentage: FinancialParticipantDecimal;
}

export interface FinancialParticipantProfileInput {
  display_name: string;
  participant_type: FinancialParticipantType;
  distribution_eligible: boolean;
  effective_on: FinancialParticipantDate;
  reason: string;
}

export interface FinancialParticipantProfileUpdate extends FinancialParticipantProfileInput {
  participant_id: FinancialParticipantId;
}

export interface ThirdPartyPayerProfileInput {
  display_name: string;
  effective_on: FinancialParticipantDate;
  reason: string;
}

export interface ParticipantStatusInput {
  participant_id: FinancialParticipantId;
  effective_on: FinancialParticipantDate;
  is_active: boolean;
  reason: string;
}

export interface ThirdPartyPayerStatusInput {
  payer_id: FinancialParticipantId;
  effective_on: FinancialParticipantDate;
  is_active: boolean;
  reason: string;
}

export interface PercentageVersionInput {
  effective_on: FinancialParticipantDate;
  reason: string;
  members: FinancialPercentageMemberInput[];
}

export interface FinancialParticipantCommands {
  create_participant: FinancialParticipantProfileInput;
  update_participant: FinancialParticipantProfileUpdate;
  set_participant_status: ParticipantStatusInput;
  create_third_party_payer: ThirdPartyPayerProfileInput;
  update_third_party_payer: ThirdPartyPayerProfileInput & { payer_id: FinancialParticipantId };
  set_third_party_payer_status: ThirdPartyPayerStatusInput;
  set_percentage_version: PercentageVersionInput;
}

export interface FinancialParticipantCommandResults {
  create_participant: { participant_id: FinancialParticipantId };
  update_participant: { participant_profile_version_id: FinancialParticipantId };
  set_participant_status: { status_event_id: FinancialParticipantId };
  create_third_party_payer: { third_party_payer_id: FinancialParticipantId };
  update_third_party_payer: { payer_profile_version_id: FinancialParticipantId };
  set_third_party_payer_status: { status_event_id: FinancialParticipantId };
  set_percentage_version: {
    percentage_version_id: FinancialParticipantId;
    total_percentage: FinancialParticipantDecimal;
  };
}

export interface CashflowParticipantCommandRequest<K extends keyof FinancialParticipantCommands> {
  p_command: K;
  p_idempotency_key: string;
  p_payload: FinancialParticipantCommands[K];
}

export type CashflowParticipantCommandResponse<K extends keyof FinancialParticipantCommandResults> =
  FinancialParticipantCommandResults[K];

/**
 * O id da organização não é aceito como entrada do RPC: o backend deriva o
 * tenant da sessão e valida o perfil Administrador.
 */
export interface CashflowParticipantRpc {
  <K extends keyof FinancialParticipantCommands>(
    functionName: "cashflow_manage_participants",
    request: CashflowParticipantCommandRequest<K>,
  ): Promise<{ data: CashflowParticipantCommandResponse<K> | null; error: Error | null }>;
}
