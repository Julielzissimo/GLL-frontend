const icon = (name) => window.GLLDesignSystem.ICONS[name];

export default {
  title: "Patterns/Primary Navigation",
  tags: ["autodocs"],
};

const navigation = (active = "bids") => `
  <div class="navigation-story-shell" style="width: min(300px, 100%); height: 680px; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-md);">
    <aside class="app-sidebar" aria-label="Navegação principal" style="position: relative; width: 100%; height: 100%; min-height: 0; box-sizing: border-box;">
      <div class="app-brand-row">
        <div class="app-logo" aria-label="GLL">
          <span class="brand-mark" aria-hidden="true">GLL</span>
          <span class="brand-copy"><strong>GLL</strong><small>GESTÃO DE LICITAÇÕES</small></span>
        </div>
        <button class="mobile-nav-close" type="button" aria-label="Fechar menu"><span data-gll-icon="close" aria-hidden="true">${icon("close")}</span></button>
      </div>
      <div class="workspace-summary" aria-label="Espaço de trabalho">
        <span class="workspace-avatar" aria-hidden="true">LS</span>
        <span class="workspace-copy"><small>ESPAÇO DE TRABALHO</small><strong>LSMS Suprimentos</strong></span>
        <span class="workspace-chevron" aria-hidden="true">${icon("chevronDown")}</span>
      </div>
      <nav class="app-nav" aria-label="Áreas do GLL">
        <div class="nav-section">
          <span class="nav-section-label">ÁREA DE TRABALHO</span>
          <button class="nav-link ${active === "home" ? "active" : ""}" type="button"><span class="nav-icon" aria-hidden="true">${icon("layoutDashboard")}</span><span class="nav-link-label">Visão geral</span></button>
          <button class="nav-link ${active === "bids" ? "active" : ""}" type="button"><span class="nav-icon" aria-hidden="true">${icon("briefcaseBusiness")}</span><span class="nav-link-label">Licitações</span><span class="nav-count">12</span></button>
          <button class="nav-link ${active === "quotations" ? "active" : ""}" type="button"><span class="nav-icon" aria-hidden="true">${icon("clipboardList")}</span><span class="nav-link-label">Orçamentos</span></button>
        </div>
        <div class="nav-section">
          <span class="nav-section-label">DOCUMENTOS</span>
          <button class="nav-link ${active === "commercialProposals" ? "active" : ""}" type="button"><span class="nav-icon" aria-hidden="true">${icon("fileText")}</span><span class="nav-link-label">Propostas comerciais</span></button>
          <button class="nav-link ${active === "declarations" ? "active" : ""}" type="button"><span class="nav-icon" aria-hidden="true">${icon("fileCheck2")}</span><span class="nav-link-label">Declarações</span></button>
        </div>
        <div class="nav-section">
          <span class="nav-section-label">ADMINISTRAÇÃO</span>
          <button class="nav-link ${active === "suppliers" ? "active" : ""}" type="button"><span class="nav-icon" aria-hidden="true">${icon("package")}</span><span class="nav-link-label">Fornecedores</span></button>
          <button class="nav-link ${active === "users" ? "active" : ""}" type="button"><span class="nav-icon" aria-hidden="true">${icon("lucideUsers")}</span><span class="nav-link-label">Usuários</span></button>
          <button class="nav-link" type="button" aria-expanded="true"><span class="nav-icon" aria-hidden="true">${icon("settings2")}</span><span class="nav-link-label">Configurações</span><span class="nav-group-chevron" aria-hidden="true">${icon("chevronDown")}</span></button>
          <div class="nav-submenu is-expanded"><div class="nav-submenu-inner">
            <button class="nav-link nav-sublink ${active === "settings" ? "active" : ""}" type="button"><span class="nav-link-label">Geral</span></button>
            <button class="nav-link nav-sublink ${active === "companyData" ? "active" : ""}" type="button"><span class="nav-link-label">Dados da Empresa</span></button>
          </div></div>
          <button class="nav-link ${active === "designSystem" ? "active" : ""}" type="button"><span class="nav-icon" aria-hidden="true">${icon("bookOpen")}</span><span class="nav-link-label">Design System</span></button>
        </div>
      </nav>
      <div class="sidebar-footer"><div class="sidebar-environment"><span class="environment-dot" aria-hidden="true"></span><div><strong class="environment-badge">Homologação</strong><small>Ambiente de validação</small></div></div></div>
    </aside>
  </div>`;

export const LicitacoesAtivas = {
  name: "Licitações selecionada",
  render: () => navigation("bids"),
};

export const DocumentosAtivos = {
  name: "Declarações selecionada",
  render: () => navigation("declarations"),
};
