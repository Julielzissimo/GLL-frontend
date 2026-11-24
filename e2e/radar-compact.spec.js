import { test, expect } from '@playwright/test';

const base = process.env.GLL_RADAR_FIXTURE_URL || 'http://127.0.0.1:4187';
async function setup(page, options = {}) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.evaluate(async (options) => {
    const html = await (await fetch('/web/index.html')).text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    document.body.replaceChildren(parsed.querySelector('#radarSearchPage'));
    document.body.style.padding = 'var(--space-lg)';
    for (const href of ['/web/design-system/tokens.css', '/web/styles.css', '/web/design-system/prototype-theme.css']) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.append(link);
    }
    const { mountRadarFixture } = await import('/stories/fixtures/radar-fixture.js');
    window.fixture = await mountRadarFixture(document.querySelector('#radarSearchPage'), options);
    await document.fonts.ready;
  }, options);
  await expect(page.locator('#radarSearchButton')).toBeEnabled();
  return errors;
}
async function search(page) {
  await page.locator('#radarSearchButton').click();
  await expect(page.locator('.radar-result-card')).toHaveCount(2);
}
async function openDetails(page, resultIndex = 0) {
  const result = await page.evaluate((index) => window.fixture.results[index], resultIndex);
  await page.evaluate(async (numberControlPncp) => {
    await window.fixture.details.open(numberControlPncp, { pushHistory: false });
  }, result.numberControlPncp);
  await expect(page.locator('#radarDetailsView')).toBeVisible();
  return page.locator('#radarDetailsContent');
}

test('plataforma preserva classificação, conflito e links sem expor método ou evidências', async ({ page }) => {
  const errors = await setup(page, { platformConflict: true });
  await search(page);
  const first = page.locator('.radar-result-card').first();
  await expect(first).toContainText('Portal de Compras Públicas');
  await expect(first).toContainText('Fontes divergentes; confira o edital.');
  await expect(first).not.toContainText(/confiança|método|evidências/i);

  await page.evaluate(async () => {
    await window.fixture.details.open(window.fixture.results[0], { pushHistory: false });
  });
  const details = page.locator('#radarDetailsContent');
  await expect(details).toContainText('Portal de Compras Públicas');
  await expect(details).toContainText('As fontes consultadas indicam plataformas diferentes.');
  await expect(details).toContainText('Link de origem informado pelo PNCP');
  await expect(details).toContainText('Abrir processo');
  await expect(details).not.toContainText(/evidências do edital|fonte da identificação|confiança|método de confirmação|identificação automática anterior|confirmar plataforma/i);
  await expect(details.locator('[data-radar-platform-confirm]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('chips, modalidades transacionais, UF e contrato OU', async ({ page }) => {
  const errors = await setup(page);
  const input = page.locator('#radarTagInput');
  await input.fill('Material'); await input.press('Enter');
  await input.fill('material'); await input.press('Enter');
  await expect(page.locator('.radar-tag')).toHaveCount(1);
  await input.fill('papel'); await input.press(','); await input.press('Backspace');
  await expect(page.locator('.radar-tag')).toHaveCount(1);
  await page.locator('#radarModalityOpen').click();
  await expect(page.locator('#radarModalities input')).toHaveCount(5);
  await expect(page.locator('#radarModalities input:disabled')).toHaveCount(2);
  await page.locator('#radarModalities input[value="6"]').uncheck();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.locator('#radarModalityOpen').click();
  await expect(page.locator('#radarModalities input[value="6"]')).toBeChecked();
  await page.locator('#radarModalities input[value="6"]').uncheck();
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.locator('#radarModalitySummary')).toHaveText('2 selecionadas');
  await page.locator('#radarUf').selectOption('ES');
  await expect(page.locator('#radarMunicipality')).toBeEnabled();
  await page.locator('#radarMunicipality').selectOption('1');
  await search(page);
  const payload = await page.evaluate(() => window.fixture.calls.find((c) => c.name === 'radar-search').body);
  expect(payload.tags).toEqual(['Material']); expect(payload.modalities).toEqual([8, 9]);
  expect(payload.municipalityIbgeId).toBe(1);
  expect(errors).toEqual([]);
});

test('itens persistidos, seleção por edital e importação no fluxo de detalhes', async ({ page }) => {
  const errors = await setup(page);
  await search(page);
  const cards = page.locator('.radar-result-card');
  await expect(cards.nth(1).locator('.radar-receipt-status')).toHaveCount(0);
  for (const card of [cards.first(), cards.nth(1)]) {
    const object = card.locator('[data-radar-object-toggle]');
    await object.focus(); await object.press('Enter'); await expect(object).toHaveAttribute('aria-expanded', 'true');
    await object.press('Space'); await expect(object).toHaveAttribute('aria-expanded', 'false');
    await card.locator('[data-radar-organization-toggle]').click();
    await expect(object).toHaveAttribute('aria-expanded', 'false');
  }
  const first = cards.first();
  const itemsButton = first.locator('[data-radar-card-view="items"]');
  await expect(itemsButton).toHaveText('Itens (45)');
  const resultsUrl = page.url();
  let popupOpened = false;
  page.on('popup', () => { popupOpened = true; });
  await itemsButton.focus();
  await itemsButton.press('Enter');
  await expect(itemsButton).toHaveAttribute('aria-expanded', 'true');
  await expect(first.locator('#radarDetailsView')).toBeVisible();
  expect(page.url()).toBe(resultsUrl);
  expect(popupOpened).toBe(false);
  await itemsButton.press('Space');
  await expect(itemsButton).toHaveAttribute('aria-expanded', 'false');
  await expect(first.locator('#radarDetailsView')).toBeHidden();
  const details = await openDetails(page, 0);
  await expect(details.locator('[data-radar-select-item]')).toHaveCount(45);
  await expect(details.locator('[data-radar-select-item="4"]')).toBeDisabled();
  await details.locator('[data-radar-select-item="45"]').check();
  await openDetails(page, 1);
  await expect(details.locator('[data-radar-select-item="45"]')).not.toBeChecked();
  await openDetails(page, 0);
  await expect(details.locator('[data-radar-select-item="45"]')).toBeChecked();
  await details.locator('[data-radar-import-start]').click();
  await expect(page.locator('#radarImportConfirmItems tbody tr')).toHaveCount(1);
  await expect(page.locator('#radarImportConfirmItems')).toContainText('30,85');
  await expect(page.locator('#radarImportConfirmItems th')).toHaveText(['Item', 'Descrição', 'Unidade', 'Quantidade', 'Valor estimado unitário', 'Valor total']);
  await page.locator('[data-radar-import-cancel]').click();
  await expect(details.locator('[data-radar-select-item="45"]')).toBeChecked();
  await details.locator('[data-radar-import-start]').click();
  await page.locator('[data-radar-import-confirm]').click();
  await expect(details.locator('[data-radar-select-item="45"]')).toBeDisabled();
  const calls = await page.evaluate(() => window.fixture.calls.filter((c) => c.name === 'radar-import'));
  expect(calls).toHaveLength(2);
  expect(calls[0].body.action).toBe('import');
  expect(calls[0].body.selectedItemNumbers).toEqual(['45']);
  expect(calls[1].body.action).toBe('attach-documents');
  expect(calls[1].body.selectedDocumentIds).toBeUndefined();
  await page.locator('#radarDetailsBackButton').click();
  await page.locator('[data-radar-page="2"]').click();
  await expect(page.locator('#radarPagination')).toContainText('Página 2');
  expect(errors).toEqual([]);
});

test('cadastro permite escolher até quatro documentos do edital', async ({ page }) => {
  const errors = await setup(page, { previousImport: false, itemCount: 6, documentCount: 6 });
  await search(page);
  const details = await openDetails(page, 0);
  await details.locator('[data-radar-select-item="1"]').check();
  await details.locator('[data-radar-import-start]').click();
  await expect(page.locator('.radar-import-document-option')).toHaveCount(6);
  await expect(page.locator('[data-radar-import-document="1"]')).toBeChecked();
  await expect(page.locator('[data-radar-import-document="5"]')).toBeDisabled();
  await page.locator('[data-radar-import-document="1"]').uncheck();
  await page.locator('[data-radar-import-document="5"]').check();
  await expect(page.locator('#radarImportDocumentCount')).toHaveText('4 de 4 selecionados.');
  await page.locator('#radarImportConfirmButton').click();
  await expect.poll(async () => page.evaluate(() => window.fixture.calls
    .find((call) => call.name === 'radar-import' && call.body.action === 'attach-documents')
    ?.body.selectedDocumentIds)).toEqual([2, 3, 4, 5]);
  expect(errors).toEqual([]);
});

for (const width of [1440, 1024, 768, 390]) {
  test(`layout, teclado e overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = await setup(page);
    await search(page);
    await expect(page.locator('#radarFilterRail')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#radarFilterToggleButton')).toBeVisible();
    await page.locator('#radarFilterToggleButton').click();
    const filters = await page.locator('#radarFilterRail').boundingBox();
    const results = await page.locator('.radar-results-panel').boundingBox();
    if (width >= 761) {
      expect(filters.x + filters.width).toBeLessThanOrEqual(results.x);
    } else {
      expect(filters.y + filters.height).toBeLessThanOrEqual(results.y);
    }
    await page.screenshot({ path: `test-results/radar-${width}.png`, fullPage: true });
    const details = await openDetails(page, 0);
    await expect(details.locator('[data-radar-select-item]')).toHaveCount(45);
    await details.locator('[data-radar-select-all]').click();
    await expect(details.locator('[data-radar-select-item]:checked')).toHaveCount(44);
    await details.locator('[data-radar-import-start]').click();
    await expect(page.locator('#radarImportConfirmItems tbody tr')).toHaveCount(44);
    const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width && r.right > innerWidth && !e.closest('.table-wrap');
    }).map((e) => ({ tag: e.tagName, id: e.id, className: e.className, right: e.getBoundingClientRect().right })));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow)).toBe(true);
    await page.screenshot({ path: `test-results/radar-confirm-${width}.png`, fullPage: false });
    await page.keyboard.press('Escape');
    await details.locator('[data-radar-select-none]').click();
    await expect(details.locator('[data-radar-import-start]')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('sincronização informativa e permissões do Analista', async ({ page }) => {
  const errors = await setup(page, { role: 'Analista', pending: true });
  await search(page);
  await expect(page.getByRole('link', { name: 'PNCP', exact: true }).first()).toBeVisible();
  const details = await openDetails(page, 0);
  await expect(details).toContainText('sincronização');
  await expect(details.locator('[data-radar-select-item]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Atualizar dados do Radar|Solicitar atualização|Contingência PNCP/ })).toHaveCount(0);
  await expect(page.locator('[data-radar-card-view="platform"]')).toHaveCount(0);
  await expect(page.locator('#radarCardDialog')).not.toBeVisible();
  await expect(page.locator('[data-radar-platform-confirm]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('limite de 25 termos, remoção, Escape e limpeza preservam regras', async ({ page }) => {
  await setup(page);
  const input = page.locator('#radarTagInput');
  for (let i = 0; i < 25; i++) { await input.fill(`termo ${i}`); await input.press('Enter'); }
  await input.fill('termo excedente'); await input.press('Enter');
  await expect(page.locator('.radar-tag')).toHaveCount(25);
  await expect(page.locator('#radarTagsError')).not.toBeEmpty();
  await page.locator('[data-radar-remove-tag]').first().click();
  await expect(page.locator('.radar-tag')).toHaveCount(24);
  await page.locator('#radarModalityOpen').click();
  await page.locator('#radarModalities input[value="6"]').uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('#radarModalityOpen')).toBeFocused();
  await page.locator('#radarModalityOpen').click();
  await expect(page.locator('#radarModalities input[value="6"]')).toBeChecked();
  await page.keyboard.press('Escape');
  await page.locator('[data-radar-action="clear"]').click();
  await expect(page.locator('.radar-tag')).toHaveCount(0);
  await expect(input).toHaveValue('');
  await expect(page.locator('#radarMunicipality')).toBeDisabled();
});

test('documentos permitem nova consulta após erro e favoritos mantêm acesso ao PNCP', async ({ page }) => {
  const errors = await setup(page);
  await page.evaluate(() => window.fixture.failDocuments());
  await search(page);
  await page.locator('[data-radar-card-view="documents"]').first().click();
  await expect(page.locator('#radarCardDialog')).toBeVisible();
  await expect(page.locator('[data-radar-documents-refresh]')).toBeVisible();
  await page.evaluate(() => window.fixture.failDocuments(false));
  await page.locator('[data-radar-documents-refresh]').click();
  await expect(page.locator('#radarCardDialog a')).toHaveAttribute('href', 'https://pncp.gov.br/documento-teste-1.pdf');
  await page.keyboard.press('Escape');
  await page.locator('[data-radar-favorite]').first().click();
  await expect(page.locator('[data-radar-favorite]').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-radar-action="show-favorites"]').click();
  await expect(page.locator('.radar-result-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'PNCP', exact: true })).toHaveAttribute('href', 'https://pncp.gov.br/app/editais/00000000000000/2026/1');
  expect(errors).toEqual([]);
});

test('PNCP abre diretamente o edital em nova guia sem modal ou consulta de detalhes', async ({ page, context }) => {
  await setup(page);
  await search(page);
  const pncpUrl = 'https://pncp.gov.br/app/editais/00000000000000/2026/1';
  await context.route(pncpUrl, (route) => route.fulfill({ contentType: 'text/html', body: '<title>PNCP fictício</title>' }));
  const card = page.locator('.radar-result-card').first();
  const link = card.getByRole('link', { name: 'PNCP', exact: true });
  await expect(link).toHaveCount(1);
  await expect(card.getByRole('button', { name: 'Plataforma', exact: true })).toHaveCount(0);
  const callsBefore = await page.evaluate(() => window.fixture.calls.length);
  const popupPromise = page.waitForEvent('popup');
  await link.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(pncpUrl);
  await expect(page.locator('#radarCardDialog')).not.toBeVisible();
  expect(await page.evaluate(() => window.fixture.calls.length)).toBe(callsBefore);
  await popup.close();
});

test('novo cadastro confirma apenas os itens selecionados', async ({ page }) => {
  await setup(page, { previousImport: false });
  await search(page);
  const details = await openDetails(page, 0);
  await details.locator('[data-radar-select-item="2"]').check();
  await details.locator('[data-radar-import-start]').click();
  await expect(page.locator('#radarImportConfirmTitle')).toHaveText('Confirmar cadastro');
  await expect(page.locator('#radarImportConfirmItems tbody tr')).toHaveCount(1);
  await expect(page.locator('#radarImportConfirmItems td').first()).toHaveText('2');
  await page.keyboard.press('Escape');
  await expect(details.locator('[data-radar-select-item="2"]')).toBeChecked();
});


test('homologação lê produção sem permitir importação do catálogo remoto', async ({ page }) => {
  const errors = await setup(page, { catalogSource: 'production', environment: 'homolog', previousImport: false });
  await search(page);
  const details = await openDetails(page);
  await expect(details).toContainText('esta sessão tem acesso somente de leitura');
  await expect(details.locator('[data-radar-select-item]')).toHaveCount(0);
  await expect(details.locator('[data-radar-import-start]')).toHaveCount(0);
  expect(await page.evaluate(() => window.fixture.calls.filter((c) => c.name === 'radar-import'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('produção permite importar seu próprio catálogo com cache completo', async ({ page }) => {
  const errors = await setup(page, { catalogSource: 'production', environment: 'production', previousImport: false });
  await search(page);
  const details = await openDetails(page);
  await expect(details).toContainText('Dados do catálogo de produção.');
  await expect(details).not.toContainText('esta sessão tem acesso somente de leitura');
  await details.locator('[data-radar-select-item="2"]').check();
  await details.locator('[data-radar-import-start]').click();
  await page.locator('[data-radar-import-confirm]').click();
  await expect.poll(() => page.evaluate(() => window.fixture.calls.filter((c) => c.name === 'radar-import' && c.body.action !== 'attach-documents').length)).toBe(1);
  expect(errors).toEqual([]);
});
