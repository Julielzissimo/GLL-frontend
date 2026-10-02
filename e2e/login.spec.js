import { test } from "@playwright/test";

const expectedOrganization = "ORGANIZAÇÃO TESTE";

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

test("o login de teste acessa somente a organização de teste", async ({ page }) => {
  const baseUrl = requiredSetting("GLL_E2E_BASE_URL");
  const email = requiredSetting("GLL_E2E_EMAIL");
  const password = requiredSetting("GLL_E2E_PASSWORD");
  const expectedEnvironment = requiredSetting("GLL_E2E_EXPECTED_ENVIRONMENT");
  let authenticated = false;

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
    const organizationLabel = (await page.locator("#usersOrganizationLabel").textContent())?.split("·")[0]?.trim();
    if (normalizedOrganizationName(organizationLabel || "") !== normalizedOrganizationName(expectedOrganization)) {
      throw new Error("A organização exibida para a conta não é a organização de teste.");
    }

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
    if (normalizedOrganizationName(organizationQuery.rows[0].name || "") !== normalizedOrganizationName(expectedOrganization)) {
      throw new Error("A política de acesso retornou uma organização diferente da organização de teste.");
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
      const bidRowsAreScoped = bidScoped.every((result) => result.rows.every((row) => bidIds.has(row.bid_id)));
      const quotationRowsAreScoped = quotationScoped.every((result) =>
        result.rows.every((row) => quotationIds.has(row.quotation_id)),
      );

      return {
        passed: allQueriesSucceeded && organizationRowsAreScoped && bidRowsAreScoped && quotationRowsAreScoped,
        tablesChecked: allResults.length + 1,
        rowsChecked: allResults.reduce((count, result) => count + result.rows.length, 1),
      };
    }, { supabaseUrl: runtime.supabaseUrl, anonKey: runtime.supabaseAnonKey, accessToken: authSession.access_token });

    if (!isolationCheck.passed) {
      throw new Error("A sessão não passou na verificação de isolamento das tabelas da organização.");
    }

    await page.locator("#logoutButton").click();
    await page.locator("#confirmLogoutButton").click();
    await page.locator("#loginForm").waitFor({ state: "visible" });
    authenticated = false;

    console.log(`Login validado em ${expectedEnvironment}; ${isolationCheck.tablesChecked} tabelas retornaram apenas dados permitidos pela organização.`);
  } finally {
    if (authenticated) {
      await page.locator("#logoutButton").click({ timeout: 5_000 }).catch(() => {});
      await page.locator("#confirmLogoutButton").click({ timeout: 5_000 }).catch(() => {});
      await page.locator("#loginForm").waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
    }
  }
});
