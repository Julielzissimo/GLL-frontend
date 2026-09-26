const c = () => window.GLLDesignSystem.COMPONENTS;

export default {
  title: "Patterns",
  tags: ["autodocs"],
};

export const PageHeader = { render: () => c().pageHeader({}) };
export const Card = { render: () => c().card({ title: "Próximas sessões", body: "Licitações ordenadas pela data da sessão.", action: "Ver todas" }) };
export const Tabs = { render: () => c().tabs() };
export const Table = { render: () => c().table() };
export const ConfirmationDialog = { render: () => c().modal() };
