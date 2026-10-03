import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("agrupa proposta comercial e declarações em Gerar Documentos", async () => {
  const [html, app, styles, tokens] = await Promise.all([
    readFile(new URL("../web/index.html", import.meta.url), "utf8"),
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../web/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../web/design-system/tokens.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /id="navDocumentsButton"[^>]+aria-expanded="false"/);
  assert.match(html, /Gerar Documentos/);
  assert.match(html, /class="nav-group-label">Gerar Documentos/);
  assert.match(html, /data-navigation-page="commercialProposals"[^>]*>.*Proposta Comercial<\/button>/);
  assert.match(html, /id="documentsNavigationItems"[^>]+aria-hidden="true"[^>]+inert/);
  assert.match(html, /class="nav-submenu-inner"/);
  assert.match(html, /documentsNavigationItems[\s\S]+data-navigation-page="commercialProposals"[\s\S]+data-navigation-page="declarations"/);
  assert.match(app, /navDocumentsButton\.addEventListener\("click", toggleDocumentsNavigation\)/);
  assert.match(app, /navDocumentsButton\.classList\.remove\("active"\)/);
  assert.match(app, /documentsNavigationItems\.classList\.toggle\("is-expanded", isExpanded\)/);
  assert.match(app, /documentsNavigationItems\.inert = !isExpanded/);
  assert.doesNotMatch(app, /documentsNavigationExpanded \|\| isDocumentsPage/);
  assert.match(styles, /\.nav-submenu[^}]+grid-template-rows:\s*0fr/s);
  assert.match(styles, /\.nav-submenu\.is-expanded[^}]+grid-template-rows:\s*1fr/s);
  assert.match(styles, /\.nav-submenu-inner[^}]+border-left:/s);
  assert.match(styles, /\.nav-group-toggle\[aria-expanded="true"\][^}]+rotate\(-90deg\)/s);
  assert.match(styles, /\.nav-group-toggle[^}]+max-width:\s*100%[^}]+min-width:\s*0/s);
  assert.match(styles, /\.nav-link \.nav-group-label[^}]+overflow-wrap:\s*anywhere/s);
  assert.match(tokens, /--sidebar-width:\s*300px/);
});
