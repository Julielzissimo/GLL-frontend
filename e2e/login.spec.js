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

async function submitRadarSearch(page, predicate) {
  const responsePromise = radarSearchResponse(page, predicate);
  await page.locator("#radarSearchButton").click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`A pesquisa real do Radar retornou HTTP ${response.status()}.`);
  const body = await response.json();
  if (!Array.isArray(body.results) || !body.pagination || !body.coverage) {
    throw new Error("A pesquisa real do Radar retornou uma resposta incompatível.");
  }
  return { payload: response.request().postDataJSON(), body };
}

async function validateRadarSearchPage(page) {
  await page.locator("#navRadarSearchButton").click();
  await expect(page.locator("#radarSearchPage")).toBeVisible();
  await expect(page.locator("#radarWorkbench")).toBeVisible();
  await expect(page.locator("#radarFilterRail")).toBeVisible();
  await expect(page.locator(".radar-results-panel")).toBeVisible();
  await expect(page.locator("#radarSearchPage")).toHaveCSS("max-width", "none");
  await expect(page.locator("#radarPlatformSummary")).toHaveText("Selecionar plataformas");
  await expect(page.locator("#radarPlatformSearch")).toHaveCount(0);
  await expect(page.locator('[data-radar-action="add-tag"]')).toHaveCount(0);
  await expect(page.locator("#radarTagInput")).toHaveAttribute("placeholder", "Digite um termo e pressione Enter");
  const filterBounds = await page.locator("#radarFilterRail").boundingBox();
  const resultsBounds = await page.locator(".radar-results-panel").boundingBox();
  if (!filterBounds || !resultsBounds || resultsBounds.x <= filterBounds.x + filterBounds.width) {
    throw new Error("Os filtros do Radar não estão posicionados ao lado dos resultados como no protótipo.");
  }
  await expect.poll(() => page.locator('#radarModalities input[name="radarModality"]').count()).toBeGreaterThan(0);
  await expect.poll(() => page.locator("#radarUf option").count()).toBeGreaterThan(1);
  const defaultDates = {
    from: await page.locator("#radarPublishedFrom").inputValue(),
    to: await page.locator("#radarPublishedTo").inputValue(),
  };
  if (!defaultDates.from || !defaultDates.to) throw new Error("O Radar não aplicou as datas iniciais de publicação.");
  await expect(page.locator("#radarSituation")).toHaveValue("open");

  await page.locator("#radarPublishedTo").fill("");
  await page.locator("#radarSituation").selectOption("closed");
  await page.locator("#radarUf").selectOption("ES");
  await expect.poll(() => page.locator("#radarMunicipality option").count()).toBeGreaterThan(1);
  const firstMunicipality = await page.locator('#radarMunicipality option[value]:not([value=""])').first().getAttribute("value");
  if (!firstMunicipality) throw new Error("O catálogo do Radar não retornou município para a UF selecionada.");
  await page.locator("#radarMunicipality").selectOption(firstMunicipality);
  await page.locator('[data-radar-action="clear"]').click();
  await expect(page.locator("#radarPublishedFrom")).toHaveValue(defaultDates.from);
  await expect(page.locator("#radarPublishedTo")).toHaveValue(defaultDates.to);
  await expect(page.locator("#radarSituation")).toHaveValue("open");
  await expect(page.locator("#radarUf")).toHaveValue("");

  const modalityDetails = page.locator("#radarModalityDetails");
  await modalityDetails.locator("summary").click();
  const modalityMenu = modalityDetails.locator(".radar-modality-menu");
  const modalityToggle = page.locator("#radarModalityToggle");
  const toggleBounds = await modalityToggle.boundingBox();
  const menuBounds = await modalityMenu.boundingBox();
  if (!toggleBounds || !menuBounds || Math.abs((toggleBounds.x + toggleBounds.width / 2) - (menuBounds.x + menuBounds.width / 2)) > 2) {
    throw new Error("A opção para marcar modalidades não está centralizada no campo.");
  }
  const modalityBoxes = page.locator('#radarModalities input[name="radarModality"]');
  await expect(modalityBoxes.first()).toBeChecked();
  await modalityBoxes.first().uncheck();
  await expect(modalityBoxes.first()).not.toBeChecked();
  await expect(modalityToggle).toHaveText("Marcar todas");
  await modalityToggle.click();
  await expect(modalityToggle).toHaveText("Desmarcar todas");
  await expect(modalityBoxes.first()).toBeChecked();
  await modalityToggle.click();
  await expect(modalityToggle).toHaveText("Marcar todas");
  await expect(modalityBoxes.first()).not.toBeChecked();
  await modalityToggle.click();
  await expect(modalityToggle).toHaveText("Desmarcar todas");
  await expect(modalityBoxes.first()).toBeChecked();
  await modalityDetails.locator("summary").click();

  await page.locator("#radarUf").selectOption("ES");
  await expect.poll(() => page.locator("#radarMunicipality option").count()).toBeGreaterThan(1);
  await page.locator("#radarSituation").selectOption("all");
  await page.locator("#radarPublishedFrom").fill("");
  await page.locator("#radarPublishedTo").fill("");
  await page.locator("#radarTagInput").fill("pavimentação");
  await page.locator("#radarTagInput").press("Enter");
  await expect(page.locator("#radarTagList li")).toHaveCount(1);
  const simple = await submitRadarSearch(page, (payload) => payload.tags?.length === 1);
  if (simple.body.results.length === 0) throw new Error("A busca real por pavimentação no Espírito Santo não retornou registros conhecidos.");
  const resultCard = page.locator("#radarResultsContent .radar-result-card").first();
  await expect(resultCard).toBeVisible();
  await expect(resultCard).toContainText("Município - UF");
  await expect(resultCard).toContainText("Abertura das propostas");
  await expect(resultCard).toContainText("Encerramento das propostas");
  await expect(resultCard).toContainText("Órgão responsável");
  await expect(resultCard).toContainText("Modalidade");
  await expect(resultCard.locator(".radar-result-fields > div")).toHaveCount(6);
  await expect(resultCard.locator(".radar-result-number")).toContainText("PNCP");
  await expect(resultCard.locator(".radar-result-value")).toContainText("Valor estimado");
  await expect(resultCard).toContainText("Ver itens");
  await expect(resultCard.locator(".radar-receipt-status")).toHaveCSS("border-top-style", "solid");
  const longDescription = Array.from({ length: 8 }, () => "Contratação de serviços especializados para fornecimento, instalação e manutenção de equipamentos destinados às unidades administrativas do município.").join(" ");
  const objectDisclosureState = await resultCard.evaluate(async (card, text) => {
    const heading = card.querySelector(".radar-result-object");
    const disclosure = heading?.nextElementSibling;
    if (!heading || !disclosure?.matches(".radar-object-details")) throw new Error("O card não contém a descrição completa do objeto.");
    heading.textContent = text;
    disclosure.querySelector("p").textContent = text;
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const isTruncated = heading.classList.contains("is-truncated");
    const isVisible = !disclosure.hidden;
    disclosure.querySelector("summary").click();
    return { isTruncated, isVisible, isOpen: disclosure.open, description: disclosure.querySelector("p").textContent };
  }, longDescription);
  expect(objectDisclosureState).toEqual({ isTruncated: true, isVisible: true, isOpen: true, description: longDescription });

  await page.locator("#radarTagInput").fill("aquisição");
  await page.locator("#radarTagInput").press("Enter");
  const multiple = await submitRadarSearch(page, (payload) => payload.tags?.length === 2);
  await expect(multiple.payload.tags).toEqual(["pavimentação", "aquisição"]);
  if (multiple.body.results.length === 0) throw new Error("A pesquisa OR do Radar não retornou resultados para os termos de teste.");

  await page.locator('[data-radar-action="clear"]').click();
  await page.locator("#radarSituation").selectOption("all");
  await page.locator("#radarPublishedFrom").fill("");
  await page.locator("#radarPublishedTo").fill("");
  const firstPage = await submitRadarSearch(page, (payload) => payload.tags === undefined && payload.page === 1);
  if (!firstPage.body.pagination.hasMore) throw new Error("O conjunto de teste do Radar não oferece uma segunda página para validação.");
  const nextPageResponse = radarSearchResponse(page, (payload) => payload.page === 2);
  await page.locator('#radarPagination [data-radar-page="2"]').click();
  const nextPage = await nextPageResponse;
  if (!nextPage.ok()) throw new Error(`A segunda página do Radar retornou HTTP ${nextPage.status()}.`);
  const nextPageBody = await nextPage.json();
  if (nextPageBody.pagination?.page !== 2 || !Array.isArray(nextPageBody.results)) {
    throw new Error("A paginação do Radar não carregou a segunda página do serviço.");
  }

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
