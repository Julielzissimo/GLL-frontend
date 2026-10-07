import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the prototype navigation groups, Lucide icons and existing GLL palette", async () => {
  const [html, app, styles, tokens, icons, story] = await Promise.all([
    readFile(new URL("../web/index.html", import.meta.url), "utf8"),
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../web/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../web/design-system/tokens.css", import.meta.url), "utf8"),
    readFile(new URL("../web/design-system/components.js", import.meta.url), "utf8"),
    readFile(new URL("../stories/patterns/Navigation.stories.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /nav-section-label">ÁREA DE TRABALHO/);
  assert.match(html, /nav-section-label">DOCUMENTOS/);
  assert.match(html, /nav-section-label">ADMINISTRAÇÃO/);
  assert.match(html, /data-navigation-page="commercialProposals"[^>]*>[\s\S]*?Propostas comerciais/);
  assert.match(html, /data-navigation-page="declarations"[^>]*>[\s\S]*?Declarações/);
  assert.match(html, /id="navDesignSystemButton"[^>]+data-navigation-page="designSystem"/);
  assert.doesNotMatch(html, /navDocumentsButton|documentsNavigationItems|Gerar Documentos/);

  for (const iconName of ["layoutDashboard", "briefcaseBusiness", "clipboardList", "fileText", "fileCheck2", "package", "lucideUsers", "settings2", "bookOpen", "menu", "chevronRight", "chevronDown", "bell", "search"]) {
    assert.match(icons, new RegExp(`\\b${iconName}: icon\\(`));
  }
  assert.match(app, /function updateWorkspaceSummary\(\)[\s\S]*?refs\.workspaceName\.textContent = organizationName/);
  assert.doesNotMatch(html, /navBidsCount|class="nav-count"/);
  assert.doesNotMatch(app, /navBidsCount/);
  assert.doesNotMatch(story, /class="nav-count"/);
  assert.match(app, /updateNotificationsIndicator\(\)/);
  assert.match(app, /iconMarkup\("chevronRight"\)/);
  assert.match(app, /mobileNavigationScrim\.hidden = !isMobile \|\| !isExpanded/);
  assert.match(story, /Primary Navigation/);
  assert.match(styles, /--color-primary/);

  assert.match(tokens, /--color-primary:\s*var\(--gll-forest\)/);
  assert.match(tokens, /--color-secondary:\s*var\(--gll-forest\)/);
  assert.match(tokens, /--color-background:\s*var\(--gll-canvas\)/);
  assert.match(tokens, /--sidebar-width:\s*var\(--gll-sidebar-width\)/);
  assert.match(tokens, /--gll-sidebar-width:\s*258px/);
  assert.match(tokens, /--gll-forest:\s*#183d35/);
  assert.match(tokens, /--gll-selection-bg:\s*#e8eee4/);
});
