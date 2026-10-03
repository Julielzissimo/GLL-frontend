const c = () => window.GLLDesignSystem.COMPONENTS;

export default {
  title: "Patterns",
  tags: ["autodocs"],
};

export const PageHeader = { render: () => c().pageHeader({}) };
export const Card = { render: () => c().card({ title: "Próximas sessões", body: "Licitações ordenadas pela data da sessão.", action: "Ver todas" }) };
export const Tabs = { render: () => c().tabs() };
export const Table = { render: () => c().table() };
export const CommercialProposalFlow = {
  name: "Proposta Comercial · etapas",
  render: () => `
    <nav class="declarations-tabs commercial-proposal-tabs" aria-label="Etapas da proposta">
      <button class="commercial-step active" type="button" aria-current="step"><span class="commercial-step-dot">1</span><span class="commercial-step-name">Itens e edital</span></button>
      <button class="commercial-step" type="button"><span class="commercial-step-dot">2</span><span class="commercial-step-name">Dados comerciais</span></button>
      <button class="commercial-step" type="button"><span class="commercial-step-dot">3</span><span class="commercial-step-name">Conferir PDF</span></button>
    </nav>
    <div class="commercial-proposal-workspace">
      <main class="commercial-proposal-editor-column">
        <section class="section-band commercial-builder-section commercial-edital-section">
          <h2>Edital</h2><p>A proposta fica vinculada ao edital e ao orçamento.</p>
          <div class="form-grid"><label>Edital<input value="Pregão 028/2026 · Secretaria Municipal de Saúde" readonly /></label><label>Data da proposta<input type="date" value="2026-09-30" /></label></div>
        </section>
        <section class="section-band commercial-builder-section">
          <div class="commercial-items-intro"><div><h2>Itens incluídos</h2><p>3 de 3 itens do orçamento</p></div><button class="quiet-action compact-action" type="button">Desmarcar todos</button></div>
          <div class="commercial-proposal-items"><table class="commercial-proposal-items-table"><thead><tr><th>Incluir</th><th class="numeric">Nº</th><th>Item</th><th>Quantidade</th><th>Valor unitário</th><th class="numeric">Total</th></tr></thead><tbody><tr class="commercial-proposal-item-row selected"><td><input type="checkbox" checked aria-label="Incluir item 1" /></td><td class="numeric">1</td><td class="commercial-item-description"><strong>Kit para curativo estéril</strong><span class="table-secondary">Marca MedCare · modelo MC-2</span></td><td>120 un.</td><td><input class="commercial-proposal-price-input" value="R$ 48,00" aria-label="Valor unitário" /></td><td class="numeric"><strong>R$ 5.760,00</strong></td></tr></tbody></table></div>
          <details class="commercial-proposal-more commercial-customize-proposal"><summary>Personalizar esta proposta</summary><div class="commercial-advanced-content"><section><h3>Descrição técnica dos itens</h3><label>Item 1 · Descrição Técnica<textarea rows="4">Kit para curativo estéril, descartável, acondicionado em embalagem resistente.</textarea></label></section><section><h3>Colunas do PDF</h3><p>Número e descrição técnica permanecem no documento.</p></section></div></details>
        </section>
      </main>
      <aside class="commercial-proposal-summary-column"><section class="section-band commercial-proposal-summary-card"><h2>Resumo da proposta</h2><div class="sum-row"><span>Itens incluídos</span><b>3</b></div><div class="sum-row"><span>Valor total</span><b class="sum-total">R$ 18.460,00</b></div><div class="sum-row"><span>Documento</span><b>PDF A4</b></div><button class="primary-action full-action" type="button">Continuar</button></section></aside>
    </div>`,
};
export const ConfirmationDialog = { render: () => c().dialogPreview({ size: "sm", title: "Excluir edital?", description: "O edital deixará de aparecer no sistema, mas os dados permanecerão preservados.", actions: ["Cancelar", "Excluir edital"], destructive: true }) };
export const DialogSizes = { render: () => `<div class="ds-dialog-examples">${["sm", "md", "lg", "xl"].map((size) => c().dialogPreview({ size, title: `Diálogo ${size.toUpperCase()}`, description: "O conteúdo e as ações respeitam a largura máxima definida para este tamanho.", actions: ["Cancelar", "Confirmar"] })).join("")}</div>` };
export const ExistingDialogCatalog = { render: () => `<div class="ds-dialog-catalog">${window.GLLDesignSystem.DIALOG_CATALOG.map((item) => `<article><span>${item.area}</span><strong>${item.title}</strong><code>${item.id}</code><p>${item.description}</p><small>Ações: ${item.actions.join(" · ") || "Sem ação; estado ocupado"}</small></article>`).join("")}</div>` };
