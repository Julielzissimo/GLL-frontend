import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [html, tokens, componentsSource, app, packageSource, workflow] = await Promise.all([
  readFile(new URL("web/index.html", root), "utf8"),
  readFile(new URL("web/design-system/tokens.css", root), "utf8"),
  readFile(new URL("web/design-system/components.js", root), "utf8"),
  readFile(new URL("web/app.js", root), "utf8"),
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

test("the internal catalog is wired to the administrator-only route", () => {
  assert.match(html, /id="designSystemAccessCard"[^>]*hidden/);
  assert.match(html, /id="designSystemPage"[^>]*hidden/);
  assert.match(app, /designSystem:\s*"configuracoes\/design-system"/);
  assert.match(app, /page === "designSystem" && !isCurrentUserAdmin\(\)\) return "settings"/);
  assert.match(app, /designSystemAccessCard\.classList\.toggle\("hidden", !showUserManagement\)/);
});

test("storybook is local-only and not part of the Pages artifact", () => {
  const packageJson = JSON.parse(packageSource);
  assert.equal(packageJson.scripts.storybook, "storybook dev -p 6006");
  assert.match(packageJson.scripts["build-storybook"], /storybook build/);
  assert.doesNotMatch(workflow, /build-storybook|storybook-static/);
});
