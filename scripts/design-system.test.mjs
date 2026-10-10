import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [html, tokens, theme, componentsSource, app, build, packageSource, workflow] = await Promise.all([
  readFile(new URL("web/index.html", root), "utf8"),
  readFile(new URL("web/design-system/tokens.css", root), "utf8"),
  readFile(new URL("web/design-system/prototype-theme.css", root), "utf8"),
  readFile(new URL("web/design-system/components.js", root), "utf8"),
  readFile(new URL("web/app.js", root), "utf8"),
  readFile(new URL("scripts/build-web.mjs", root), "utf8"),
  readFile(new URL("package.json", root), "utf8"),
  readFile(new URL(".github/workflows/pages.yml", root), "utf8"),
]);

test("design tokens expose the required semantic foundations", () => {
  for (const token of [
    "--color-primary", "--color-secondary", "--color-background", "--color-surface",
    "--color-border", "--color-text-primary", "--color-text-secondary", "--color-muted",
    "--color-success", "--color-warning", "--color-danger", "--color-info",
    "--font-family-sans", "--space-xs", "--space-2xl", "--radius-lg", "--shadow-lg",
    "--z-dropdown", "--z-modal", "--z-tooltip",
  ]) assert.match(tokens, new RegExp(`${token.replaceAll("-", "\\-")}:`));
  for (const [token, value] of [
    ["--gll-ink", "#182923"], ["--gll-ink-soft", "#4c5d55"],
    ["--gll-forest", "#183d35"], ["--gll-forest-hover", "#28564a"],
    ["--gll-accent", "#b57b43"], ["--gll-canvas", "#f5f3ed"],
    ["--gll-paper", "#fffefa"], ["--gll-paper-muted", "#efeee7"],
    ["--gll-line", "#d9dcd2"], ["--gll-line-strong", "#b8c2b5"],
    ["--gll-success", "#256a4f"], ["--gll-warning", "#895a1a"],
    ["--gll-danger", "#9c4c42"], ["--gll-info", "#35647c"],
    ["--gll-selection-bg", "#e8eee4"], ["--gll-focus", "#ad7237"],
  ]) assert.match(tokens, new RegExp(`${token.replaceAll("-", "\\-")}:\\s*${value.replaceAll("#", "\\#")}`));
  assert.match(html, /href="\.\/design-system\/prototype-theme\.css"/);
  assert.match(theme, /\.check-line:has\(input\[type="radio"\]:checked\)[\s\S]*?background:\s*var\(--gll-selection-bg\)/);
  assert.match(tokens, /font-family:\s*"IBM Plex Sans"/);
});

test("the catalog uses the application component source", () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(componentsSource, context);
  const ds = context.window.GLLDesignSystem;
  assert.ok(ds);
  assert.match(ds.COMPONENTS.button({ label: "Salvar" }), /primary-action/);
  assert.match(ds.COMPONENTS.formField({ id: "field", error: "Obrigatório" }), /aria-invalid="true"/);
  assert.match(ds.COMPONENTS.alert({ tone: "danger" }), /role="alert"/);
  assert.ok(Object.keys(ds.ICONS).length >= 10);
});

test("foundation samples comply with the app content security policy", () => {
  const context = vm.createContext({
    window: {},
    document: { documentElement: {} },
    getComputedStyle: () => ({ getPropertyValue: () => "token-value" }),
  });
  vm.runInContext(componentsSource, context);
  const foundations = context.window.GLLDesignSystem.foundationsMarkup();
  assert.doesNotMatch(foundations, /style=/);
  assert.match(foundations, /data-color="forest"/);
  assert.match(foundations, /data-color="danger"/);
});

test("the internal catalog is wired to the administrator-only route", () => {
  assert.match(html, /id="designSystemAccessCard"[^>]*hidden/);
  assert.match(html, /id="designSystemPage"[^>]*hidden/);
  assert.match(app, /designSystem:\s*"configuracoes\/design-system"/);
  assert.match(app, /page === "designSystem" && !isCurrentUserAdmin\(\)\) return "settings"/);
  assert.match(app, /designSystemAccessCard\.classList\.toggle\("hidden", !showDesignSystemAccess\)/);
});

test("production hides and blocks the internal Design System while homologation keeps it enabled", () => {
  const homologTarget = build.slice(build.indexOf("homolog: {"), build.indexOf("production: {"));
  const productionTarget = build.slice(build.indexOf("production: {"), build.indexOf("prod: null"));
  assert.match(homologTarget, /designSystemEnabled:\s*true/);
  assert.match(productionTarget, /commercialProposalsEnabled:\s*false/);
  assert.match(productionTarget, /designSystemEnabled:\s*false/);
  assert.match(app, /page === "designSystem" && GLL_CONFIG\.designSystemEnabled === false\) return "home"/);
  assert.match(app, /const showDesignSystemAccess = showUserManagement && GLL_CONFIG\.designSystemEnabled !== false/);
});

test("storybook is local-only and not part of the Pages artifact", () => {
  const packageJson = JSON.parse(packageSource);
  assert.equal(packageJson.scripts.storybook, "storybook dev -p 6006");
  assert.match(packageJson.scripts["build-storybook"], /storybook build/);
  assert.doesNotMatch(workflow, /build-storybook|storybook-static/);
});
