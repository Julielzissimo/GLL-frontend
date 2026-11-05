import { createCashflowReservationFeature } from "../../web/finance-reservations.js";

export default {
  title: "Patterns/Finance Reservations",
  tags: ["autodocs"],
};

const participantId = "a1000000-0000-4000-8000-000000000001";
const reservationId = "b1000000-0000-4000-8000-000000000001";
const allocationId = "c1000000-0000-4000-8000-000000000001";

const tables = {
  cashflow_reservations: [{
    id: reservationId, receipt_allocation_id: allocationId, recognized_profit_snapshot: "240.00",
    reserved_on: "2026-10-01", created_by: "d1000000-0000-4000-8000-000000000001",
  }],
  cashflow_reservation_allocations: [{
    reservation_id: reservationId, participant_id: participantId,
    percentage_snapshot: "100.000000", amount: "240.00",
  }],
  cashflow_reservation_events: [{
    reservation_id: reservationId, participant_id: participantId, event_type: "allocation",
    amount_signed: "240.00", source_id: allocationId, reason: null,
    created_at: "2026-10-01T10:00:00Z", created_by: "d1000000-0000-4000-8000-000000000001",
  }],
  cashflow_receipt_allocations: [{
    id: allocationId, receipt_id: "e1000000-0000-4000-8000-000000000001",
    profit_target_id: "f1000000-0000-4000-8000-000000000001", amount: "1200.00",
    recognized_profit_amount: "240.00",
  }],
  cashflow_receipt_reversals: [],
  cashflow_receipts: [{
    id: "e1000000-0000-4000-8000-000000000001", bid_id: "fictional-bid-001",
    received_on: "2026-10-01", created_by: "d1000000-0000-4000-8000-000000000001",
  }],
  cashflow_item_profit_targets: [{
    id: "f1000000-0000-4000-8000-000000000001", bid_id: "fictional-bid-001", item_id: 101,
    receivable_base: "1200.00", expected_profit: "240.00",
  }],
  items: [{ id: 101, item_number: 1 }],
  cashflow_participants: [{ id: participantId, display_name: "Participante fictício" }],
  cashflow_participant_profile_versions: [{
    participant_id: participantId, distribution_eligible: true, effective_on: "2026-01-01", created_at: "2026-01-01T00:00:00Z",
  }],
  cashflow_participant_status_events: [{
    participant_id: participantId, is_active: true, effective_on: "2026-01-01", created_at: "2026-01-01T00:00:00Z",
  }],
  cashflow_withdrawals: [],
  cashflow_withdrawal_reversals: [],
  cashflow_cash_events: [{ amount_signed: "1200.00", event_type: "profit_receipt", occurred_on: "2026-10-01" }],
  cashflow_audit_log: [],
};

function mockClient() {
  return {
    from(table) {
      const query = {
        select() { return query; },
        order() { return query; },
        async range(start, end) { return { data: (tables[table] || []).slice(start, end + 1), error: null }; },
      };
      return query;
    },
  };
}

function renderPanel() {
  const page = document.createElement("div");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const root = document.createElement("div");
  page.append(status, root);
  const feature = createCashflowReservationFeature({
    container: root,
    statusElement: status,
    getClient: mockClient,
    getUserRole: () => "Administrador",
    getUsers: () => [{ auth_user_id: "d1000000-0000-4000-8000-000000000001", display_name: "Admin de exemplo" }],
    getBids: () => [{ id: "fictional-bid-001", edital_number: "EDITAL-FICTÍCIO-001", status: "Em Fornecimento" }],
    getBidLabel: () => "EDITAL-FICTÍCIO-001",
  });
  void feature.showPage();
  return page;
}

export const ReservaDisponivel = {
  render: renderPanel,
};
