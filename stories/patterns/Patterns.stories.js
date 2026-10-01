const c = () => window.GLLDesignSystem.COMPONENTS;

export default {
  title: "Patterns",
  tags: ["autodocs"],
};

export const PageHeader = { render: () => c().pageHeader({}) };
export const Card = { render: () => c().card({ title: "Próximas sessões", body: "Licitações ordenadas pela data da sessão.", action: "Ver todas" }) };
export const Tabs = { render: () => c().tabs() };
export const Table = { render: () => c().table() };
export const ConfirmationDialog = { render: () => c().dialogPreview({ size: "sm", title: "Excluir edital?", description: "O edital deixará de aparecer no sistema, mas os dados permanecerão preservados.", actions: ["Cancelar", "Excluir edital"], destructive: true }) };
export const DialogSizes = { render: () => `<div class="ds-dialog-examples">${["sm", "md", "lg", "xl"].map((size) => c().dialogPreview({ size, title: `Diálogo ${size.toUpperCase()}`, description: "O conteúdo e as ações respeitam a largura máxima definida para este tamanho.", actions: ["Cancelar", "Confirmar"] })).join("")}</div>` };
export const ExistingDialogCatalog = { render: () => `<div class="ds-dialog-catalog">${window.GLLDesignSystem.DIALOG_CATALOG.map((item) => `<article><span>${item.area}</span><strong>${item.title}</strong><code>${item.id}</code><p>${item.description}</p><small>Ações: ${item.actions.join(" · ") || "Sem ação; estado ocupado"}</small></article>`).join("")}</div>` };
