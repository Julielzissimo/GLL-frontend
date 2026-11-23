import { expect, test } from "@playwright/test";

function requiredSetting(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração obrigatória ausente: ${name}.`);
  return value;
}

function normalizedOrganizationName(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function normalizedRadarModalityName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

async function expectDefaultRadarModalities(page) {
  const checkedNames = await page.locator("#radarModalities .radar-modality-option").evaluateAll((options) => options
    .filter((option) => option.querySelector('input[name="radarModality"]')?.checked)
    .map((option) => option.querySelector("span")?.textContent?.trim() || ""));
  expect(checkedNames.map(normalizedRadarModalityName).sort()).toEqual([
    "dispensa",
    "inexigibilidade",
    "pregao eletronico",
  ]);
}

function radarSearchResponse(page, predicate = () => true) {
  return page.waitForResponse((response) => {
    const request = response.request();
    if (request.method() !== "POST" || !new URL(response.url()).pathname.endsWith("/functions/v1/radar-search")) return false;
    try {
      return predicate(request.postDataJSON());
    } catch {
      return false;
    }
  }, { timeout: 45_000 });
}

function radarCacheResponse(context, table, numberControlPncp) {
  return context.waitForEvent("response", {
    predicate(response) {
      const request = response.request();
      const url = new URL(response.url());
      return request.method() === "GET"
        && url.pathname.endsWith(`/rest/v1/${table}`)
        && url.searchParams.get("numero_controle_pncp") === `eq.${numberControlPncp}`;
    },
    timeout: 45_000,
  });
}

function radarDocumentsResponse(page, numberControlPncp) {
  return page.waitForResponse((response) => {
    const request = response.request();
    if (request.method() !== "POST" || !new URL(response.url()).pathname.endsWith("/functions/v1/radar-details")) return false;
    try {
      const payload = request.postDataJSON();
      return payload.action === "documents" && payload.numberControlPncp === numberControlPncp;
    } catch {
      return false;
    }
  }, { timeout: 45_000 });
}

async function submitRadarSearch(page, predicate, { verifyScrollPersistence = false } = {}) {
  const responsePromise = radarSearchResponse(page, predicate);
  await page.locator("#radarSearchButton").click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`A pesquisa real do Radar retornou HTTP ${response.status()}.`);
  const body = await response.json();
  const payload = response.request().postDataJSON();
  if ("platformIds" in payload || "includeUnidentified" in payload) {
    throw new Error("A pesquisa pública enviou filtros legados de plataformas.");
  }
  if (!Array.isArray(body.results) || !body.pagination || !body.coverage) {
    throw new Error("A pesquisa real do Radar retornou uma resposta incompatível.");
  }
  await expect(page.locator("#radarSearchButton")).toBeEnabled();
  const filterRail = page.locator("#radarFilterRail");
  const filterToggle = page.locator("#radarFilterToggleButton");
  await expect(filterRail).toHaveAttribute("aria-hidden", "true");
  await expect(filterToggle).toBeVisible();
  await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
  await expect(filterToggle).toHaveAccessibleName("Exibir filtros da pesquisa");
  await expect(filterToggle.locator('[data-gll-icon="slidersHorizontal"]')).toHaveCount(1);

  if (verifyScrollPersistence) {
    const previousScrollBehavior = await page.evaluate(() => document.documentElement.style.scrollBehavior);
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.id = "radarFilterScrollTestSpacer";
      spacer.style.height = "1200px";
      document.body.append(spacer);
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.body.scrollHeight);
    });
    try {
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(filterRail).toHaveAttribute("aria-hidden", "true");
      await expect(filterToggle).toBeVisible();
      await expect(filterToggle).toHaveAttribute("aria-expanded", "false");

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(filterRail).toHaveAttribute("aria-hidden", "true");
      await expect(filterToggle).toBeVisible();
      await filterToggle.click();
      await expect(filterRail).not.toHaveAttribute("aria-hidden", "true");
      await expect(filterRail).toBeVisible();
      await expect(filterToggle).toBeHidden();
    } finally {
      await page.evaluate((scrollBehavior) => {
        document.querySelector("#radarFilterScrollTestSpacer")?.remove();
        document.documentElement.style.scrollBehavior = scrollBehavior;
      }, previousScrollBehavior);
    }
  } else {
    const previousScrollBehavior = await page.evaluate(() => document.documentElement.style.scrollBehavior);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    try {
      if (await filterRail.getAttribute("aria-hidden") === "true") {
        await expect(filterToggle).toBeVisible();
        await filterToggle.click();
      }
    } finally {
      await page.evaluate((scrollBehavior) => {
        document.documentElement.style.scrollBehavior = scrollBehavior;
      }, previousScrollBehavior);
    }
    await expect(filterRail).not.toHaveAttribute("aria-hidden", "true");
    await expect(filterRail).toBeVisible();
    await expect(filterToggle).toBeHidden();
  }
  return { payload, body };
}

async function validateRadarSearchPage(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#navRadarSearchButton").click();
  await expect(page.locator("#radarSearchPage")).toBeVisible();
  await expect(page.locator("#radarWorkbench")).toBeVisible();
  await expect(page.locator("#radarFilterRail")).toBeVisible();
  await expect(page.locator(".radar-results-panel")).toBeVisible();
  await expect(page.locator("#radarPageSize")).toHaveValue("50");
  await expect(page.locator("#radarSearchPage")).toHaveCSS("max-width", "none");
  const platformSelect = page.locator("#radarPlatform");
  await expect(platformSelect).toHaveValue("portal-de-compras-publicas");
  await expect(platformSelect).toBeDisabled();
  await expect(platformSelect.locator("option")).toHaveCount(1);
  await expect(page.locator("#radarPlatformHelp")).toHaveCount(0);
  await expect(page.locator("#radarPlatformDetails, #radarPlatforms, #radarIncludeUnidentified")).toHaveCount(0);
  await expect(page.locator('[data-radar-action="add-tag"]')).toHaveCount(0);
  await expect(page.locator("#radarTagInput")).toHaveAttribute("placeholder", "Digite um termo e pressione Enter");
  const filterBounds = await page.locator("#radarFilterRail").boundingBox();
  const resultsBounds = await page.locator(".radar-results-panel").boundingBox();
  if (!filterBounds || !resultsBounds || resultsBounds.y < filterBounds.y + filterBounds.height) {
    throw new Error("Os filtros do Radar não estão posicionados acima dos resultados conforme a FEAT-005.");
  }
  const filterToggle = page.locator("#radarFilterToggleButton");
  await expect(filterToggle).toBeHidden();
  await expect(filterToggle).toHaveAttribute("aria-expanded", "true");
  await expect(filterToggle).toHaveAttribute("aria-label", "Exibir filtros da pesquisa");
  await expect(filterToggle.locator('[data-gll-icon="slidersHorizontal"]')).toHaveCount(1);
  await expect.poll(() => page.locator('#radarModalities input[name="radarModality"]').count()).toBeGreaterThan(0);
  await expect.poll(() => page.locator('#radarModalities input[name="radarModality"]:checked').count()).toBe(3);
  await expectDefaultRadarModalities(page);
  await expect.poll(() => page.locator("#radarUf option").count()).toBeGreaterThan(1);
  const defaultDates = {
    from: await page.locator("#radarBidPhaseFrom").inputValue(),
    to: await page.locator("#radarBidPhaseTo").inputValue(),
  };
  if (!defaultDates.from || !defaultDates.to) throw new Error("O Radar não aplicou as datas iniciais da fase de lances.");
  expect((Date.parse(defaultDates.to) - Date.parse(defaultDates.from)) / 86_400_000).toBe(15);
  await expect(page.locator("#radarSortBy")).toHaveValue("bidPhaseStartAt");
  await expect(page.locator("#radarSortDirection")).toHaveValue("desc");
  await expect(page.locator("#radarSituation")).toHaveValue("all");

  await page.locator("#radarBidPhaseTo").fill("");
  await page.locator("#radarSituation").selectOption("closed");
  await page.locator("#radarUf").selectOption("ES");
  await expect.poll(() => page.locator("#radarMunicipality option").count()).toBeGreaterThan(1);
  const firstMunicipality = await page.locator('#radarMunicipality option[value]:not([value=""])').first().getAttribute("value");
  if (!firstMunicipality) throw new Error("O catálogo do Radar não retornou município para a UF selecionada.");
  await page.locator("#radarMunicipality").selectOption(firstMunicipality);
  await page.locator('[data-radar-action="clear"]').click();
  await expect(page.locator("#radarBidPhaseFrom")).toHaveValue(defaultDates.from);
  await expect(page.locator("#radarBidPhaseTo")).toHaveValue(defaultDates.to);
  await expect(page.locator("#radarSituation")).toHaveValue("all");
  await expect(page.locator("#radarUf")).toHaveValue("");
  await expectDefaultRadarModalities(page);

  await page.locator('#radarModalityOpen').click();
  const modalityToggle = page.locator('#radarModalityToggle');
  const modalityBoxes = page.locator('#radarModalities input[name="radarModality"]');
  const availableModalityBoxes = page.locator('#radarModalities input[name="radarModality"]:not(:disabled)');
  const disabledModalityBoxes = page.locator('#radarModalities input[name="radarModality"]:disabled');
  const checkedModalityBoxes = page.locator('#radarModalities input[name="radarModality"]:checked');
  await expect(availableModalityBoxes).toHaveCount(3);
  await expect(disabledModalityBoxes).toHaveCount(await modalityBoxes.count() - 3);
  await expect(checkedModalityBoxes).toHaveCount(3);
  await checkedModalityBoxes.first().uncheck();
  await expect(checkedModalityBoxes).toHaveCount(2);
  await expect(modalityToggle).toHaveText("Marcar disponíveis");
  await modalityToggle.click();
  await expect(modalityToggle).toHaveText("Desmarcar disponíveis");
  await expect(checkedModalityBoxes).toHaveCount(await availableModalityBoxes.count());
  await modalityToggle.click();
  await expect(modalityToggle).toHaveText("Marcar disponíveis");
  await expect(checkedModalityBoxes).toHaveCount(0);
  await modalityToggle.click();
  await expect(modalityToggle).toHaveText("Desmarcar disponíveis");
  await expect(checkedModalityBoxes).toHaveCount(await availableModalityBoxes.count());
  await page.locator('[data-radar-action="apply-modalities"]').click();

  await page.locator("#radarUf").selectOption("ES");
  await expect.poll(() => page.locator("#radarMunicipality option").count()).toBeGreaterThan(1);
  await page.locator("#radarSituation").selectOption("all");
  await page.locator("#radarBidPhaseFrom").fill("");
  await page.locator("#radarBidPhaseTo").fill("");
  const availableProcurements = await submitRadarSearch(page, (payload) => payload.tags === undefined && payload.page === 1 && payload.proposalReceiptState === "all");
  const knownProcurement = availableProcurements.body.results[0];
  if (!knownProcurement?.numberControlPncp || !knownProcurement.object) {
    throw new Error("A busca pelas modalidades permitidas não retornou um edital para o teste do Radar.");
  }
  const searchableTerm = knownProcurement.object.match(/[\p{L}\p{N}]{4,}/u)?.[0];
  if (!searchableTerm) throw new Error("O edital disponível não contém um termo de objeto pesquisável.");
  await page.locator("#radarTagInput").fill(searchableTerm);
  await page.locator("#radarTagInput").press("Enter");
  await expect(page.locator("#radarTagList li")).toHaveCount(1);
  const simple = await submitRadarSearch(page, (payload) => payload.tags?.length === 1 && payload.proposalReceiptState === "all", { verifyScrollPersistence: true });
  if (!simple.body.results.some((result) => result.numberControlPncp === knownProcurement.numberControlPncp)) {
    throw new Error("A busca por um termo do edital disponível não retornou o edital esperado.");
  }
  if (simple.body.results.some((result) => result.platformName !== "Portal de Compras Públicas")) {
    throw new Error("A pesquisa do Radar retornou uma plataforma diferente do Portal de Compras Públicas.");
  }
  await expect(page.locator("#radarOperationalSummary, .radar-operational-card")).toHaveCount(0);
  await expect(page.getByText("Coleta indisponível", { exact: true })).toHaveCount(0);
  const resultCard = page.locator("#radarResultsContent .radar-result-card").first();
  await expect(resultCard).toBeVisible();
  await expect(resultCard).toContainText("Município - UF");
  await expect(resultCard).toContainText("Data da Disputa");
  await expect(resultCard).not.toContainText("Abertura das propostas");
  await expect(resultCard).not.toContainText("Publicação no PNCP");
  await expect(resultCard).toContainText("Limite p/ Recebimento das Propostas");
  await expect(resultCard).toContainText("Órgão responsável");
  await expect(resultCard).toContainText("Modalidade");
  await expect(resultCard).toContainText("Plataforma");
  await expect(resultCard).not.toContainText("Fonte:");
  await expect(resultCard).not.toContainText("Método:");
  await expect(resultCard.locator(".radar-result-fields > div")).toHaveCount(6);
  await expect(resultCard.locator(".radar-result-number")).toContainText("PNCP");
  await expect(resultCard.locator(".radar-result-value")).toContainText("Valor estimado");
  await expect(resultCard.locator('[data-radar-card-view="items"]')).toBeVisible();
  await expect(resultCard.getByRole('button', { name: 'Dados', exact: true })).toBeVisible();
  const favoriteBeforeDetails = await resultCard.locator("[data-radar-favorite]").getAttribute("aria-pressed");
  const numberControlPncp = simple.body.results[0].numberControlPncp;
  const context = page.context();
  const procurementResponsePromise = radarCacheResponse(context, "radar_licitacoes", numberControlPncp);
  const itemSyncResponsePromise = radarCacheResponse(context, "radar_itens_sync", numberControlPncp);
  // Keep compatibility coverage for previously shared detail URLs.
  const detailsPage = await context.newPage();
  const documentsResponsePromise = process.env.GLL_E2E_EXPECTED_ENVIRONMENT === "homolog"
    ? radarDocumentsResponse(detailsPage, numberControlPncp)
    : null;
  const detailUrl = new URL(page.url());
  detailUrl.searchParams.set('radarDetail', numberControlPncp);
  await detailsPage.goto(detailUrl.href);
  const [procurementResponse, itemSyncResponse] = await Promise.all([
    procurementResponsePromise,
    itemSyncResponsePromise,
  ]);
  if (!procurementResponse.ok()) throw new Error(`A leitura autenticada do cache do Radar retornou HTTP ${procurementResponse.status()}.`);
  if (!itemSyncResponse.ok()) throw new Error(`A leitura autenticada da sincronização do Radar retornou HTTP ${itemSyncResponse.status()}.`);
  const [procurementBody, itemSyncBody] = await Promise.all([
    procurementResponse.json(),
    itemSyncResponse.json(),
  ]);
  const procurement = Array.isArray(procurementBody) ? procurementBody[0] : procurementBody;
  const itemSync = Array.isArray(itemSyncBody) ? itemSyncBody[0] ?? null : itemSyncBody;
  const itemSyncStatuses = new Set(["pending", "processing", "complete", "partial", "failed"]);
  if (!procurement || procurement.numero_controle_pncp !== numberControlPncp) {
    throw new Error("O cache autenticado não retornou o edital solicitado pelo Radar.");
  }
  if (itemSync && !itemSyncStatuses.has(itemSync.status)) {
    throw new Error("O cache do Radar retornou um estado de sincronização de itens desconhecido.");
  }
  await expect(detailsPage.locator("#radarDetailsView")).toBeVisible();
  await expect(detailsPage.locator("#radarDetailsTitle")).toBeVisible();
  await expect(detailsPage.locator("#radarDetailsContent #radarItemsTitle")).toBeVisible();
  await expect(detailsPage.locator("#radarDetailsContent #radarImportPanelTitle")).toBeVisible();
  if (process.env.GLL_E2E_EXPECTED_ENVIRONMENT === "homolog") {
    const documentsFallbackEnabled = await detailsPage.evaluate(() => window.GLL_CONFIG?.radarDocumentsFallbackEnabled === true);
    if (!documentsFallbackEnabled) throw new Error("A consulta de documentos do Radar não está habilitada em homologação.");
    await expect(detailsPage.locator("#radarDetailsContent #radarDocumentsTitle")).toBeVisible();
    await expect(detailsPage.getByRole("button", { name: "Consultar documentos no PNCP" })).toHaveCount(0);
    const documentsResponse = await documentsResponsePromise;
    if (!documentsResponse.ok()) {
      throw new Error(`A consulta de documentos do edital retornou HTTP ${documentsResponse.status()}.`);
    }
    const documentsBody = await documentsResponse.json();
    if (documentsBody.status !== "available"
      || documentsBody.numberControlPncp !== numberControlPncp
      || !Array.isArray(documentsBody.documents?.documents)) {
      throw new Error("A resposta da consulta de documentos do Radar não segue o contrato esperado.");
    }
  }
  await expect(page.locator("#radarListView")).toBeVisible();
  await expect(page.locator("#radarDetailsView")).toBeHidden();
  const renderedItems = await detailsPage.locator("#radarDetailsContent [data-radar-select-item]").count();
  const publishedItemCount = Number(itemSync?.quantidade_itens ?? 0);
  if (itemSync?.versao_sincronizacao && publishedItemCount > 0 && renderedItems === 0) {
    throw new Error("O snapshot publicado no cache não foi exibido como itens selecionáveis.");
  }
  if (!itemSync?.versao_sincronizacao && renderedItems !== 0) {
    throw new Error("A interface permitiu selecionar itens antes de existir um snapshot completo publicado.");
  }
  const favoriteOnDetails = await detailsPage.locator("#radarDetailsFavoriteButton").getAttribute("aria-pressed");
  if (favoriteBeforeDetails !== favoriteOnDetails) {
    throw new Error("Abrir os detalhes alterou o estado do favorito da contratação.");
  }
  await detailsPage.locator("#radarDetailsBackButton").click();
  await expect(detailsPage.locator("#radarListView")).toBeVisible();
  await expect(resultCard.locator("[data-radar-favorite]")).toHaveAttribute("aria-pressed", favoriteBeforeDetails);
  await detailsPage.close();
  const longDescription = Array.from({ length: 8 }, () => "Contratação de serviços especializados para fornecimento, instalação e manutenção de equipamentos destinados às unidades administrativas do município.").join(" ");
  const objectDisclosureState = await resultCard.evaluate(async (card, text) => {
    const heading = card.querySelector(".radar-result-object");
    const objectText = heading?.querySelector(".radar-result-object-toggle, .radar-result-object-text");
    if (!heading || !objectText) throw new Error("O card não contém o texto do objeto.");
    objectText.textContent = text;
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const toggle = heading.querySelector("[data-radar-object-toggle]");
    if (!toggle) throw new Error("O objeto extenso não possui controle de expansão.");
    const isTruncated = toggle.classList.contains("is-truncated");
    const initiallyExpanded = toggle.getAttribute("aria-expanded");
    toggle.click();
    const expanded = toggle.getAttribute("aria-expanded");
    const expandedIsTruncated = toggle.classList.contains("is-truncated");
    const description = toggle.textContent;
    toggle.click();
    return {
      isTruncated,
      initiallyExpanded,
      expanded,
      expandedIsTruncated,
      collapsed: toggle.getAttribute("aria-expanded"),
      collapsedIsTruncated: toggle.classList.contains("is-truncated"),
      description,
    };
  }, longDescription);
  expect(objectDisclosureState).toEqual({
    isTruncated: true,
    initiallyExpanded: "false",
    expanded: "true",
    expandedIsTruncated: false,
    collapsed: "false",
    collapsedIsTruncated: true,
    description: longDescription,
  });

  await page.locator("#radarTagInput").fill("aquisição");
  await page.locator("#radarTagInput").press("Enter");
  const multiple = await submitRadarSearch(page, (payload) => payload.tags?.length === 2 && payload.proposalReceiptState === "all");
  await expect(multiple.payload.tags).toEqual([searchableTerm, "aquisição"]);
  if (multiple.body.results.length === 0) throw new Error("A pesquisa OR do Radar não retornou resultados para os termos de teste.");

  await page.locator('[data-radar-action="clear"]').click();
  await page.locator("#radarSituation").selectOption("all");
  await page.locator("#radarBidPhaseFrom").fill("");
  await page.locator("#radarBidPhaseTo").fill("");
  await page.locator("#radarPageSize").selectOption("20");
  const firstPage = await submitRadarSearch(page, (payload) => payload.tags === undefined && payload.page === 1 && payload.proposalReceiptState === "all");
  if (!firstPage.body.pagination.hasMore) throw new Error("O conjunto de teste do Radar não oferece uma segunda página para validação.");
  const nextPageResponse = radarSearchResponse(page, (payload) => payload.page === 2);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const scrollBeforePageChange = await page.evaluate(() => window.scrollY);
  if (scrollBeforePageChange <= 0) throw new Error("A página do Radar não rolou para validar o retorno ao início dos resultados.");
  await page.locator('#radarPagination [data-radar-page="2"]').click();
  const nextPage = await nextPageResponse;
  if (!nextPage.ok()) throw new Error(`A segunda página do Radar retornou HTTP ${nextPage.status()}.`);
  const nextPageBody = await nextPage.json();
  if (nextPageBody.pagination?.page !== 2 || !Array.isArray(nextPageBody.results)) {
    throw new Error("A paginação do Radar não carregou a segunda página do serviço.");
  }
  const resultsOffsetFromTopbar = () => page.evaluate(() => {
    const titleTop = document.querySelector("#radarResultsTitle")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
    const topbarBottom = document.querySelector("#appTopbar")?.getBoundingClientRect().bottom ?? 0;
    return titleTop - topbarBottom;
  });
  await expect.poll(resultsOffsetFromTopbar).toBeGreaterThanOrEqual(8);
  await expect.poll(resultsOffsetFromTopbar).toBeLessThanOrEqual(48);

  await page.locator("#navUsersButton").click();
  await expect(page.locator("#usersPage")).toBeVisible();
}

test("o login de teste acessa somente a organização de teste", async ({ page }) => {
  const baseUrl = requiredSetting("GLL_E2E_BASE_URL");
  const email = requiredSetting("GLL_E2E_EMAIL");
  const password = requiredSetting("GLL_E2E_PASSWORD");
  const expectedEnvironment = requiredSetting("GLL_E2E_EXPECTED_ENVIRONMENT");
  let authenticated = false;
  let loggedOut = false;
  let accessTokenForCleanup = null;

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      (environment) => {
        const badge = document.querySelector("#environmentBadge");
        const loadingModal = document.querySelector("#blockingLoadingModal");
        return badge?.dataset.environment === environment && !loadingModal?.open && Boolean(window.GLL_CONFIG?.supabaseUrl);
      },
      expectedEnvironment,
      { timeout: 30_000 },
    );
    await page.locator("#loginEmail").fill(email);
    await page.locator("#loginPassword").fill(password);

    let authRequestStarted = false;
    page.on("request", (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.pathname.endsWith("/auth/v1/token") && request.method() === "POST") authRequestStarted = true;
    });
    const authResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/auth/v1/token") && response.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.locator("#loginForm button[type='submit']").click();
    let authResponse;
    try {
      authResponse = await authResponsePromise;
    } catch {
      const reason = authRequestStarted ? "A tentativa de login não recebeu resposta do serviço." : "A aplicação não iniciou uma tentativa de login.";
      throw new Error(reason);
    }
    if (!authResponse.ok()) throw new Error("O serviço de autenticação recusou o login de teste.");

    const authSession = await authResponse.json();
    if (!authSession.access_token || !authSession.user?.email) {
      throw new Error("O login não retornou uma sessão autenticada válida.");
    }
    if (authSession.user.email.toLocaleLowerCase("pt-BR") !== email.toLocaleLowerCase("pt-BR")) {
      throw new Error("A sessão autenticada não corresponde à conta de teste configurada.");
    }
    authenticated = true;
    accessTokenForCleanup = authSession.access_token;

    await page.waitForFunction(
      () => {
        const appView = document.querySelector("#appView");
        const passwordResetView = document.querySelector("#passwordResetView");
        const loginError = document.querySelector("#loginError")?.textContent?.trim();
        return (appView && !appView.classList.contains("hidden"))
          || (passwordResetView && !passwordResetView.classList.contains("hidden"))
          || Boolean(loginError);
      },
      null,
      { timeout: 35_000 },
    ).catch(() => {});
    const postAuthState = await page.evaluate(() => {
      const loginError = document.querySelector("#loginError")?.textContent?.trim() || "";
      return {
        appVisible: !document.querySelector("#appView")?.classList.contains("hidden"),
        passwordResetRequired: !document.querySelector("#passwordResetView")?.classList.contains("hidden"),
        stillProcessing: Boolean(document.querySelector("#blockingLoadingModal")?.open),
        hasLoginError: Boolean(loginError),
        loginErrorCategory: /sess[aã]o sem identificador/i.test(loginError)
          ? "session_id_missing"
          : /sess[aã]o inv[aá]lida|sess[aã]o expirada/i.test(loginError)
            ? "session_invalid"
            : /acesso desta conta.*bloqueado/i.test(loginError)
              ? "access_blocked"
              : /sess[aã]o|bloquead/i.test(loginError)
                ? "session_other"
                : /permiss[aã]o|policy|RLS/i.test(loginError)
                  ? "authorization"
                  : /fetch|conex[aã]o|network|timeout/i.test(loginError)
                    ? "network"
                    : loginError
                      ? "application"
                      : "none",
      };
    });
    if (!postAuthState.appVisible) {
      if (postAuthState.passwordResetRequired) throw new Error("A conta exige redefinição de senha antes do acesso.");
      if (postAuthState.stillProcessing) throw new Error("O GLL não concluiu o acesso após 35 segundos.");
      throw new Error(`O Supabase autenticou, mas o GLL não concluiu o acesso (${postAuthState.loginErrorCategory}).`);
    }
    const runtime = await page.evaluate(() => ({
      environment: window.GLL_CONFIG?.environment,
      supabaseUrl: window.GLL_CONFIG?.supabaseUrl,
      supabaseAnonKey: window.GLL_CONFIG?.supabaseAnonKey,
      badge: document.querySelector("#environmentBadge")?.textContent?.trim(),
      role: document.querySelector("#currentUserRole")?.textContent?.trim(),
    }));

    if (runtime.environment !== expectedEnvironment) throw new Error("O site abriu no ambiente incorreto.");
    const expectedBadge = expectedEnvironment === "production" ? "Produção" : "Homologação";
    if (runtime.badge !== expectedBadge) throw new Error("O identificador visual do ambiente está incorreto.");
    if (runtime.role !== "Administrador") throw new Error("A conta não recebeu o perfil Administrador esperado.");
    if (!runtime.supabaseUrl || !runtime.supabaseAnonKey) {
      throw new Error("A configuração pública do Supabase não foi carregada.");
    }

    await page.locator("#navUsersButton").click();
    await page.locator("#usersPage").waitFor({ state: "visible" });
    const organizationLabel = (await page.locator("#workspaceSummary").getAttribute("title"))?.trim();
    const organizationQuery = await page.evaluate(async ({ supabaseUrl, anonKey, accessToken }) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/organizations?select=name`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return { status: response.status, rows: response.ok ? await response.json() : null };
    }, { supabaseUrl: runtime.supabaseUrl, anonKey: runtime.supabaseAnonKey, accessToken: authSession.access_token });

    if (organizationQuery.status !== 200 || !Array.isArray(organizationQuery.rows)) {
      throw new Error("Não foi possível validar o escopo de organizações pela sessão autenticada.");
    }
    if (organizationQuery.rows.length !== 1) {
      throw new Error("A sessão autenticada consegue consultar uma quantidade inesperada de organizações.");
    }
    const sessionOrganizationName = organizationQuery.rows[0].name?.trim();
    if (!sessionOrganizationName || normalizedOrganizationName(organizationLabel || "") !== normalizedOrganizationName(sessionOrganizationName)) {
      throw new Error("A organização exibida não corresponde à única organização visível para a sessão.");
    }

    const isolationCheck = await page.evaluate(async ({ supabaseUrl, anonKey, accessToken }) => {
      const headers = { apikey: anonKey, Authorization: `Bearer ${accessToken}` };
      const query = async (table, fields) => {
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${fields}`, { headers });
          if (!response.ok) return { ok: false, rows: [] };
          const rows = await response.json();
          return { ok: Array.isArray(rows), rows: Array.isArray(rows) ? rows : [] };
        } catch {
          return { ok: false, rows: [] };
        }
      };

      const [organizationRows, userRows, bidRows, quotationRows, supplierRows] = await Promise.all([
        query("organizations", "id"),
        query("app_users", "organization_id"),
        query("bids", "id,organization_id"),
        query("quotations", "id,organization_id"),
        query("suppliers", "organization_id"),
      ]);

      if (!organizationRows.ok || organizationRows.rows.length !== 1) {
        return { passed: false, tablesChecked: 0, rowsChecked: 0 };
      }

      const organizationId = organizationRows.rows[0].id;
      const bidIds = new Set(bidRows.rows.map((row) => row.id));
      const quotationIds = new Set(quotationRows.rows.map((row) => row.id));
      const [itemRows, documentRows, failureRows, budgetModelRows, budgetRows, quotationItemRows] = await Promise.all([
        query("items", "bid_id"),
        query("documents", "bid_id"),
        query("failure_history", "bid_id"),
        query("budget_models", "bid_id"),
        query("budget_rows", "bid_id"),
        query("quotation_items", "quotation_id"),
      ]);

      const organizationScoped = [userRows, bidRows, quotationRows, supplierRows];
      const bidScoped = [itemRows, documentRows, failureRows, budgetModelRows, budgetRows];
      const quotationScoped = [quotationItemRows];
      const allResults = [...organizationScoped, ...bidScoped, ...quotationScoped];
      const allQueriesSucceeded = allResults.every((result) => result.ok);
      const organizationRowsAreScoped = organizationScoped.every((result) =>
        result.rows.every((row) => row.organization_id === organizationId),
      );
      const currentProfileIsVisibleAndScoped = userRows.rows.length > 0
        && userRows.rows.every((row) => row.organization_id === organizationId);
      const bidRowsAreScoped = bidScoped.every((result) => result.rows.every((row) => bidIds.has(row.bid_id)));
      const quotationRowsAreScoped = quotationScoped.every((result) =>
        result.rows.every((row) => quotationIds.has(row.quotation_id)),
      );

      return {
        passed: allQueriesSucceeded
          && organizationRowsAreScoped
          && currentProfileIsVisibleAndScoped
          && bidRowsAreScoped
          && quotationRowsAreScoped,
        tablesChecked: allResults.length + 1,
        rowsChecked: allResults.reduce((count, result) => count + result.rows.length, 1),
      };
    }, { supabaseUrl: runtime.supabaseUrl, anonKey: runtime.supabaseAnonKey, accessToken: authSession.access_token });

    if (!isolationCheck.passed) {
      throw new Error("A sessão não passou na verificação de isolamento das tabelas da organização.");
    }

    await validateRadarSearchPage(page);
    await expect(page.locator("#editOwnProfileFooterButton")).toHaveCount(0);
    await expect(page.locator(".topbar-actions > #logoutButton")).toHaveCount(0);
    await page.locator("#profileMenuButton").click();
    await expect(page.locator("#profileMenuButton")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#profileDropdown")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#profileDropdown")).toBeHidden();
    await page.locator("#profileMenuButton").press("ArrowDown");
    await expect(page.locator("#editOwnProfileButton")).toBeFocused();
    await page.locator("#editOwnProfileButton").click();
    await expect(page.locator("#userProfilePage")).toBeVisible();
    await expect(page.locator("#userCreateForm")).toHaveAttribute("data-mode", "edit");
    await expect(page.locator("#userProfileAccessActions")).toBeHidden();
    await expect(page.locator("#ownPasswordSection")).toBeVisible();
    await expect(page.locator("#ownPasswordForm")).toBeHidden();
    await page.locator("#toggleOwnPasswordButton").click();
    await expect(page.locator("#ownPasswordForm")).toBeVisible();
    await page.locator("#ownPasswordNew").fill("SenhaTeste123!");
    await page.locator("#ownPasswordConfirm").fill("SenhaDiferente123!");
    await page.locator("#ownPasswordForm button[type='submit']").click();
    await expect(page.locator("#ownPasswordError")).toContainText("As senhas não coincidem.");
    await page.locator("#cancelOwnPasswordButton").click();
    await expect(page.locator("#ownPasswordForm")).toBeHidden();
    await expect(page).toHaveURL(/page=perfil/);
    await page.locator("#backFromUserProfileButton").click();
    await expect(page.locator("#usersPage")).toBeVisible();
    await expect(page.locator("#usersTableBody [data-configure-user], #usersTableBody [data-user-access-target]")).toHaveCount(0);

    await page.locator("#userCreateOpenButton").click();
    await expect(page.locator("#userProfilePage")).toBeVisible();
    await expect(page.locator("#userCreateForm")).toHaveAttribute("data-mode", "create");
    await expect(page.locator("#userProfileAccessActions")).toBeHidden();
    await expect(page.locator("#ownPasswordSection")).toBeHidden();
    await expect(page).toHaveURL(/novo=1/);
    await page.locator("#cancelUserCreateButton").click();
    await expect(page.locator("#usersPage")).toBeVisible();

    await page.locator("#usersTableBody [data-edit-user]").first().click();
    await expect(page.locator("#userProfilePage")).toBeVisible();
    await expect(page.locator("#userCreateForm")).toHaveAttribute("data-mode", "edit");
    await page.goBack();
    await expect(page.locator("#usersPage")).toBeVisible();

    const otherUser = await page.locator("#usersTableBody [data-edit-user]").evaluateAll(
      (buttons, currentId) => {
        const button = buttons.find((candidate) => candidate.dataset.editUser !== currentId);
        return button ? { id: button.dataset.editUser, analyst: Boolean(button.closest("tr")?.querySelector(".user-role-pill.analyst")) } : null;
      },
      authSession.user.id,
    );
    if (otherUser) {
      await page.locator(`#usersTableBody [data-edit-user="${otherUser.id}"]`).click();
      await expect(page.locator("#userProfileAccessActions")).toBeVisible();
      await expect(page.locator("#changeUserAccessButton")).toBeVisible();
      if (otherUser.analyst) {
        await expect(page.locator("#configureUserAccessButton")).toBeVisible();
        await page.locator("#configureUserAccessButton").click();
        await expect(page.locator("#userAssignmentsModal")).toBeVisible();
        await page.locator("#cancelUserAssignmentsButton").click();
      } else {
        await expect(page.locator("#configureUserAccessButton")).toBeHidden();
      }
      await page.locator("#changeUserAccessButton").click();
      await expect(page.locator("#userAccessDialog")).toBeVisible();
      await page.locator("#cancelUserAccessButton").click();
      await page.locator("#backFromUserProfileButton").click();
      await expect(page.locator("#usersPage")).toBeVisible();
    }

    if (expectedEnvironment === "homolog") {
      const profileUpdate = await page.evaluate(async ({ supabaseUrl, anonKey, accessToken, authUserId }) => {
        const headers = {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        };
        const query = new URLSearchParams({ select: "auth_user_id,name,full_name,display_name", auth_user_id: `eq.${authUserId}` });
        const currentResponse = await fetch(`${supabaseUrl}/rest/v1/app_users?${query}`, { headers });
        if (!currentResponse.ok) return { passed: false, stage: "read", status: currentResponse.status };
        const rows = await currentResponse.json();
        const profile = rows.find((row) => row.auth_user_id === authUserId);
        if (!profile) return { passed: false, stage: "read", status: currentResponse.status };

        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/app_users?auth_user_id=eq.${encodeURIComponent(authUserId)}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ name: profile.name, full_name: profile.full_name, display_name: profile.display_name }),
        });
        if (!updateResponse.ok) return { passed: false, stage: "update", status: updateResponse.status };
        const updatedRows = await updateResponse.json();
        return { passed: updatedRows.some((row) => row.auth_user_id === authUserId), stage: "update", status: updateResponse.status };
      }, {
        supabaseUrl: runtime.supabaseUrl,
        anonKey: runtime.supabaseAnonKey,
        accessToken: authSession.access_token,
        authUserId: authSession.user.id,
      });
      if (!profileUpdate.passed) {
        throw new Error(`A política de edição do perfil rejeitou ${profileUpdate.stage} (HTTP ${profileUpdate.status}).`);
      }

      const avatarUpload = await page.evaluate(async ({ supabaseUrl, anonKey, accessToken, authUserId }) => {
        const path = `${authUserId}/${crypto.randomUUID()}.webp`;
        const imageBytes = Uint8Array.from(atob("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA"), (character) => character.charCodeAt(0));
        const headers = { apikey: anonKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "image/webp", "x-upsert": "false" };
        const objectUrl = `${supabaseUrl}/storage/v1/object/profile-avatars/${path.split("/").map(encodeURIComponent).join("/")}`;
        let uploaded = false;
        let result = { passed: false, status: 0, cleanup: false, detail: "" };
        try {
          const uploadResponse = await fetch(objectUrl, { method: "POST", headers, body: imageBytes });
          const uploadError = uploadResponse.ok ? null : await uploadResponse.json().catch(() => ({}));
          uploaded = uploadResponse.ok;
          const detail = String(uploadError?.message || uploadError?.error || uploadError?.statusCode || "");
          const category = /row-level security|policy/i.test(detail)
            ? "row-level security"
            : /mime|content.?type/i.test(detail)
              ? "tipo de arquivo"
              : /bucket/i.test(detail)
                ? "bucket"
                : detail ? "erro do Storage" : "";
          result = { passed: uploadResponse.ok, status: uploadResponse.status, cleanup: false, detail: category };
        } finally {
          if (uploaded) {
            const cleanupResponse = await fetch(`${supabaseUrl}/storage/v1/object/profile-avatars`, {
              method: "DELETE",
              headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ prefixes: [path] }),
            });
            result = { passed: result.passed && cleanupResponse.ok, status: cleanupResponse.status, cleanup: true };
          }
        }
        return result;
      }, {
        supabaseUrl: runtime.supabaseUrl,
        anonKey: runtime.supabaseAnonKey,
        accessToken: authSession.access_token,
        authUserId: authSession.user.id,
      });
      if (!avatarUpload.passed) {
        const phase = avatarUpload.cleanup ? "limpeza da foto de teste" : "envio da foto de perfil";
        const detail = avatarUpload.detail ? `: ${avatarUpload.detail}` : "";
        throw new Error(`A política do Storage rejeitou a ${phase} (HTTP ${avatarUpload.status}${detail}).`);
      }
    }

    const logoutResponsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname.endsWith("/auth/v1/logout") && response.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.locator("#profileMenuButton").click();
    await page.locator("#logoutButton").click();
    const confirmLogoutButton = page.locator("#confirmLogoutButton");
    if (await confirmLogoutButton.isVisible().catch(() => false)) await confirmLogoutButton.click();
    const logoutResponse = await logoutResponsePromise;
    if (!logoutResponse.ok()) throw new Error("O Supabase não confirmou o encerramento da sessão de teste.");
    await page.locator("#loginForm").waitFor({ state: "visible" });
    loggedOut = true;

    console.log(`Login validado em ${expectedEnvironment}; ${isolationCheck.tablesChecked} tabelas retornaram apenas dados permitidos pela organização.`);
  } finally {
    if (authenticated && !loggedOut && accessTokenForCleanup) {
      const cleanupConfirmed = await page.evaluate(async (accessToken) => {
        const config = window.GLL_CONFIG;
        if (!config?.supabaseUrl || !config?.supabaseAnonKey) return false;
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
        try {
          const response = await fetch(`${config.supabaseUrl}/auth/v1/logout?scope=local`, {
            method: "POST",
            headers: {
              apikey: config.supabaseAnonKey,
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          });
          return response.ok;
        } catch {
          return false;
        } finally {
          window.clearTimeout(timeoutId);
          window.localStorage.clear();
          window.sessionStorage.clear();
        }
      }, accessTokenForCleanup).catch(() => false);
      console.log(`Encerramento de segurança no cleanup: ${cleanupConfirmed ? "confirmado" : "não confirmado"}.`);
    }
  }
});
