import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("agrupa propostas comerciais e declarações em Geração de Documentos", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("../web/index.html", import.meta.url), "utf8"),
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../web/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /id="navDocumentsButton"[^>]+aria-expanded="false"/);
  assert.match(html, /Geração de Documentos/);
  assert.match(html, /id="documentsNavigationItems"[^>]+hidden/);
  assert.match(html, /documentsNavigationItems[\s\S]+data-navigation-page="commercialProposals"[\s\S]+data-navigation-page="declarations"/);
  assert.match(app, /navDocumentsButton\.addEventListener\("click", toggleDocumentsNavigation\)/);
  assert.match(app, /const isDocumentsPage = \["commercialProposals", "declarations"/);
  assert.match(styles, /\.nav-submenu\[hidden\]/);
});
