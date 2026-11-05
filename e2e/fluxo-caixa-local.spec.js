import { expect, test } from "@playwright/test";

const allowedStaticHost = "cdn.jsdelivr.net";

function requiredSetting(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração local obrigatória ausente: ${name}.`);
  return value;
}

test("administrador registra despesa de terceiro e dois ressarcimentos parciais sem duplicá-la", async ({ page, baseURL }) => {
  const base = new URL(requiredSetting("GLL_FINANCE_E2E_BASE_URL"));
  if (base.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(base.hostname)) {
    throw new Error("O e2e do Fluxo de Caixa só pode executar contra um servidor HTTP local.");
  }
  if (base.origin !== baseURL) throw new Error("A URL do servidor e2e deve corresponder à origem local configurada.");
  const supabaseOrigin = new URL(requiredSetting("GLL_LOCAL_SUPABASE_URL")).origin;
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(supabaseOrigin)) {
    throw new Error("O e2e do Fluxo de Caixa só pode acessar Supabase local.");
  }
  const allowedLocalOrigins = new Set([base.origin, supabaseOrigin]);

  const offsiteRequests = [];
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const isLocal = allowedLocalOrigins.has(requestUrl.origin);
    const isPinnedStaticDependency = requestUrl.protocol === "https:" && requestUrl.hostname === allowedStaticHost;
    if (!isLocal && !isPinnedStaticDependency) {
      offsiteRequests.push(requestUrl.origin);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  const passwordInput = page.locator("#loginPassword");
  await page.locator("#loginEmail").fill(requiredSetting("GLL_E2E_EMAIL"));
  await passwordInput.fill(requiredSetting("GLL_E2E_PASSWORD"));
  const signInResponsePromise = page.waitForResponse((response) => {
    const requestUrl = new URL(response.url());
    return allowedLocalOrigins.has(requestUrl.origin) && requestUrl.pathname.endsWith("/auth/v1/token");
  });
  try {
    await page.locator('#loginForm button[type="submit"]').click();
  } finally {
    await passwordInput.fill("");
  }
  const signInResponse = await signInResponsePromise;
  expect(signInResponse.status()).toBe(200);
  await expect(page.locator("#navFinanceButton")).toBeVisible();

  await page.locator("#navFinanceButton").click();
  await expect(page.locator("#financePage")).toBeVisible();
  await expect(page.locator("#financeRoot [data-expense-form]")).toBeVisible();

  const payerName = "Pagador fictício e2e";
  await page.locator("#financeRoot .cashflow-third-party-registration summary").click();
  await page.locator('#financeRoot [data-third-party-form] [name="display_name"]').fill(payerName);
  await page.locator('#financeRoot [data-third-party-form] button[type="submit"]').click();
  await expect(page.locator("#financeStatus")).toContainText("Terceiro cadastrado.");

  const expenseDescription = "Despesa geral fictícia e2e";
  const expenseForm = page.locator("#financeRoot [data-expense-form]");
  await expenseForm.locator('[name="payer_type"]').selectOption("third_party");
  await expenseForm.locator('[name="third_party_payer_id"]').selectOption({ label: payerName });
  await expenseForm.locator('[name="paid_on"]').fill("2026-11-04");
  await expenseForm.locator('[name="amount"]').fill("14.75");
  await expenseForm.locator('[name="description"]').fill(expenseDescription);
  await expenseForm.locator('button[type="submit"]').click();
  await expect(page.locator("#financeStatus")).toContainText("Despesa registrada.");

  const expenseRow = page.locator("#financeRoot tbody tr").filter({ hasText: expenseDescription });
  await expect(expenseRow).toHaveCount(1);
  await expect(expenseRow).toContainText(payerName);
  await expect(expenseRow).toContainText("14,75");

  for (const [amount, reimbursed, pending] of [["4.25", "4,25", "10,50"], ["3.00", "7,25", "7,50"]]) {
    await expenseRow.locator("[data-open-reimbursement]").click();
    const reimbursementForm = page.locator("#financeRoot [data-reimbursement-form]");
    await expect(reimbursementForm).toBeVisible();
    await reimbursementForm.locator('[name="paid_on"]').fill("2026-11-04");
    await reimbursementForm.locator('[name="amount"]').fill(amount);
    await reimbursementForm.locator('[name="reason"]').fill("Ressarcimento parcial fictício e2e");
    await reimbursementForm.locator('button[type="submit"]').click();
    await expect(page.locator("#financeStatus")).toContainText("Ressarcimento registrado.");
    await expect(page.locator("#financeRoot tbody tr").filter({ hasText: expenseDescription })).toHaveCount(1);
    const refreshedRow = page.locator("#financeRoot tbody tr").filter({ hasText: expenseDescription });
    await expect(refreshedRow).toContainText(reimbursed);
    await expect(refreshedRow).toContainText(pending);
  }

  await expect(page.locator("#financeRoot .cashflow-audit-list")).toContainText("Ressarcimento");
  expect(offsiteRequests).toEqual([]);
});
