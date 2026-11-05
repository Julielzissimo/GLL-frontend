import { createFinanceLedgerPanel } from "../../web/finance-ledger.js";

export default {
  title: "Components/Finance Ledger Panel",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Painel reutilizável em Faturamento e Fluxo de Caixa. Este exemplo usa somente dados sintéticos; gravações são respostas simuladas.",
      },
    },
  },
};

const bid = {
  id: "storybook-edital-2026-001",
  edital_number: "014/2026",
  buyer_agency: "Secretaria Municipal de Educação",
  status: "Em Fornecimento",
};

const data = {
  summary: {
    bid_profit_id: "a1000000-0000-4000-8000-000000000001",
    bid_status: bid.status,
    expected_profit: 200,
    due_amount: 500,
    received_amount: 250,
    recognized_profit: 100,
    outstanding_amount: 250,
    unallocated_legacy_amount: 0,
  },
  items: [{
    profit_item_id: "a2000000-0000-4000-8000-000000000001",
    quotation_item_id: 1001,
    budget_item_number: 1,
    budget_description: "Caderno universitário 200 folhas",
    budget_quantity: 10,
    budget_supplier_cost: 30,
    budget_final_bid: 50,
    expected_profit: 200,
    due_amount: 500,
    received_amount: 250,
    recognized_profit: 100,
    outstanding_amount: 250,
  }],
  receipts: [{
    id: "a3000000-0000-4000-8000-000000000001",
    client_request_id: "a4000000-0000-4000-8000-000000000001",
    received_on: "2026-10-20",
    amount: 250,
    source_reference: "OB-2026-001",
    cancelled_at: null,
  }],
  profitAdjustments: [],
  recognitionAdjustments: [],
  receiptAllocations: [{
    id: "a5000000-0000-4000-8000-000000000001",
    receipt_id: "a3000000-0000-4000-8000-000000000001",
    profit_item_id: "a2000000-0000-4000-8000-000000000001",
    amount: 250,
  }],
  receiptAdjustments: [],
};

function renderPanel({ eligible = true } = {}) {
  const root = document.createElement("div");
  const currentBid = eligible ? bid : { ...bid, status: "Aprovada" };
  const panel = createFinanceLedgerPanel({
    root,
    getBid: () => currentBid,
    isAdmin: () => true,
    service: {
      async syncBid() {},
      async loadBidLedger() { return { ...data, summary: { ...data.summary, bid_status: currentBid.status } }; },
      async registerReceipt() {},
      async adjustProfit() {},
      async adjustRecognizedProfit() {},
      async adjustReceipt() {},
      async adjustLegacyReceipt() {},
      async allocateExistingReceipt() {},
      async reverseReceipt() {},
    },
    toast: (message) => { root.dataset.lastMessage = message; },
    billingLink: true,
  });
  void panel.refresh();
  return root;
}

export const EligibleEdital = {
  name: "Edital elegível para novos recebimentos",
  render: () => renderPanel(),
};

export const HistoricalEdital = {
  name: "Histórico de edital fora dos status elegíveis",
  render: () => renderPanel({ eligible: false }),
};
