const c = () => window.GLLDesignSystem.COMPONENTS;
const row = (content) => `<div class="ds-preview-row">${content}</div>`;

export default {
  title: "Components/Feedback",
  tags: ["autodocs"],
};

export const Badges = { render: () => row(`${c().badge({ label: "Neutro" })}${c().badge({ label: "Sucesso", tone: "success" })}${c().badge({ label: "Atenção", tone: "warning" })}${c().badge({ label: "Erro", tone: "danger" })}${c().badge({ label: "Informação", tone: "info" })}`) };
export const Tag = { render: () => row(`${c().tag({ label: "papelaria" })}${c().tag({ label: "informática", removable: true })}`) };
export const Alerts = { render: () => `<div class="ds-stack">${c().alert({ title: "Informação", message: "Dados atualizados.", tone: "info" })}${c().alert({ title: "Atenção", message: "Revise os campos pendentes.", tone: "warning" })}${c().alert({ title: "Erro", message: "Não foi possível salvar.", tone: "danger" })}</div>` };
export const Loading = { render: () => c().loading({}) };
export const Skeleton = { render: () => c().skeleton() };
export const EmptyState = { render: () => c().emptyState({}) };
