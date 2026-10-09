import { test } from "@playwright/test";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração obrigatória ausente: ${name}.`);
  return value;
}

test("homologação envia, lê e exclui somente um arquivo sintético no R2", async ({ page }) => {
  const baseUrl = required("GLL_E2E_BASE_URL");
  const email = required("GLL_E2E_EMAIL");
  const password = required("GLL_E2E_PASSWORD");
  if (required("GLL_E2E_EXPECTED_ENVIRONMENT") !== "homolog") {
    throw new Error("O teste R2 só pode executar em homologação.");
  }
  test.setTimeout(120_000);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const config = await page.evaluate(() => window.GLL_CONFIG);
  if (config?.environment !== "homolog" || config.storageProvider !== "r2" ||
    new URL(config.supabaseUrl).hostname !== "dwotbzrjcetizyygzoty.supabase.co") {
    throw new Error("O teste R2 não está no ambiente de homologação ativado.");
  }

  await page.locator("#loginEmail").fill(email);
  await page.locator("#loginPassword").fill(password);
  const authResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/auth/v1/token") && response.request().method() === "POST",
  );
  await page.locator("#loginForm button[type='submit']").click();
  const authResponse = await authResponsePromise;
  if (!authResponse.ok()) throw new Error("Login da conta de teste foi recusado.");
  const session = await authResponse.json();
  if (!session.access_token || session.user?.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error("A sessão não corresponde à conta de teste.");
  }

  try {
    const result = await page.evaluate(async ({ supabaseUrl, anonKey, accessToken }) => {
      const authHeaders = { apikey: anonKey, Authorization: `Bearer ${accessToken}` };
      const orgResponse = await fetch(`${supabaseUrl}/rest/v1/organizations?select=id`, { headers: authHeaders });
      const organizations = orgResponse.ok ? await orgResponse.json() : [];
      if (organizations.length !== 1) throw new Error("Organização de teste não está isolada.");

      const endpoint = `${supabaseUrl}/functions/v1/file-storage`;
      const bucket = "declaration-assets";
      let uploadedPath = "";
      const invoke = async (action, path, extra = {}) => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ action, bucket, path, ...extra }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.error) throw new Error(`${action}: HTTP ${response.status} ${body.error || "erro"}`);
        return body;
      };
      try {
        // PNG de 1×1 pixel; nunca contém dados de usuários ou arquivos reais.
        const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII="), (char) => char.charCodeAt(0));
        const requestedPath = `${organizations[0].id}/test-r2-smoke-${crypto.randomUUID()}.png`;
        const upload = await invoke("request-upload", requestedPath, {
          fileName: "test-r2-smoke.png", size: png.length,
        });
        uploadedPath = upload.path;
        const put = await fetch(upload.url, {
          method: "PUT",
          headers: { "Content-Type": upload.contentType, "If-None-Match": "*" },
          body: png,
        });
        if (!put.ok) throw new Error(`PUT R2: HTTP ${put.status}`);
        await invoke("complete-upload", uploadedPath);
        const download = await invoke("download-url", uploadedPath);
        if (download.legacy) throw new Error("Arquivo novo foi classificado como legado.");
        const get = await fetch(download.url);
        if (!get.ok) throw new Error(`GET R2: HTTP ${get.status}`);
        const received = new Uint8Array(await get.arrayBuffer());
        if (received.length !== png.length || received.some((byte, index) => byte !== png[index])) {
          throw new Error("O conteúdo baixado difere do arquivo de teste.");
        }
        await invoke("delete", uploadedPath);
        const exists = await invoke("exists", uploadedPath);
        if (exists.exists) throw new Error("Arquivo continua disponível após exclusão.");
        uploadedPath = "";
        return { uploaded: true, downloaded: true, deleted: true };
      } finally {
        if (uploadedPath) await invoke("delete", uploadedPath).catch(() => undefined);
      }
    }, { supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey, accessToken: session.access_token });
    if (!result.uploaded || !result.downloaded || !result.deleted) throw new Error("Fluxo R2 incompleto.");
    console.log("R2 homologação: upload, download, exclusão e leitura após exclusão validados com PNG sintético.");
  } finally {
    await page.evaluate(async ({ supabaseUrl, anonKey, accessToken }) => {
      await fetch(`${supabaseUrl}/auth/v1/logout?scope=local`, {
        method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
      localStorage.clear();
      sessionStorage.clear();
    }, { supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey, accessToken: session.access_token });
  }
});
