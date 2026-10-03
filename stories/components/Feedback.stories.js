const c = () => window.GLLDesignSystem.COMPONENTS;
const row = (content) => `<div class="ds-preview-row">${content}</div>`;

export default {
  title: "Components/Feedback",
  tags: ["autodocs"],
};

export const Badges = { render: () => row(`${c().badge({ label: "Neutro" })}${c().badge({ label: "Sucesso", tone: "success" })}${c().badge({ label: "Atenção", tone: "warning" })}${c().badge({ label: "Erro", tone: "danger" })}${c().badge({ label: "Informação", tone: "info" })}`) };
export const BidStatuses = { render: () => row(["Em Analise", "Aprovada", "Descartada", "Faturado", "Disputada", "Desclassificado"].map((status) => c().statusBadge({ status, label: status === "Em Analise" ? "Em análise" : status })).join("")) };
export const Tag = { render: () => row(`${c().tag({ label: "papelaria" })}${c().tag({ label: "informática", removable: true })}`) };
export const Alerts = { render: () => `<div class="ds-stack">${c().alert({ title: "Informação", message: "Dados atualizados.", tone: "info" })}${c().alert({ title: "Atenção", message: "Revise os campos pendentes.", tone: "warning" })}${c().alert({ title: "Erro", message: "Não foi possível salvar.", tone: "danger" })}</div>` };
export const Toasts = { render: () => `<div class="ds-toast-stack">${c().toast({ message: "Edital salvo.", tone: "success" })}${c().toast({ message: "Revise os campos pendentes.", tone: "warning" })}${c().toast({ message: "Não foi possível concluir a operação.", tone: "danger" })}${c().toast({ message: "Dados atualizados.", tone: "info" })}</div>` };
export const ToastMessageCatalog = { render: () => `<details class="ds-copy-catalog" open><summary>Mensagens de toast mapeadas (${window.GLLDesignSystem.TOAST_CATALOG.reduce((total, group) => total + group.messages.length, 0)})</summary>${window.GLLDesignSystem.TOAST_CATALOG.map(({ tone, messages }) => `<div class="ds-copy-group"><strong>${tone}</strong><ul>${messages.map((message) => `<li>${message}</li>`).join("")}</ul></div>`).join("")}</details>` };
export const Loading = { render: () => c().loading({}) };
export const Skeleton = { render: () => c().skeleton() };
export const EmptyState = { render: () => c().emptyState({}) };
