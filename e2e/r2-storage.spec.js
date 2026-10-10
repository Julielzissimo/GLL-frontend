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
  await page.waitForFunction(() => {
    const badge = document.querySelector("#environmentBadge");
    const loadingModal = document.querySelector("#blockingLoadingModal");
    return badge?.dataset.environment === "homolog" && !loadingModal?.open &&
      Boolean(document.querySelector("#loginForm button[type='submit']"));
  }, null, { timeout: 30_000 });

  await page.locator("#loginEmail").fill(email);
  await page.locator("#loginPassword").fill(password);
  const authResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/auth/v1/token") && response.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.locator("#loginForm button[type='submit']").click();
  const authResponse = await authResponsePromise;
  if (!authResponse.ok()) throw new Error("Login da conta de teste foi recusado.");
  const session = await authResponse.json();
  if (!session.access_token || session.user?.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error("A sessão não corresponde à conta de teste.");
  }
  let signedPutUrl = "";
  const networkFailures = [];
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("Network.enable");
  devtools.on("Network.loadingFailed", (event) => {
    networkFailures.push({
      error: event.errorText,
      cors: event.corsErrorStatus?.corsError || "",
      blocked: event.blockedReason || "",
    });
  });
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).hostname.endsWith(".r2.cloudflarestorage.com")) {
      signedPutUrl = request.url();
    }
  });

  try {
    let result;
    try {
      result = await page.evaluate(async ({ supabaseUrl, anonKey, accessToken }) => {
      const authHeaders = { apikey: anonKey, Authorization: `Bearer ${accessToken}` };
      const fetchStage = async (stage, url, options) => {
        try { return await fetch(url, options); }
        catch (error) { throw new Error(`${stage}: ${error instanceof Error ? error.message : "falha de rede"}`); }
      };
      const orgResponse = await fetchStage("organização", `${supabaseUrl}/rest/v1/organizations?select=id`, { headers: authHeaders });
      const organizations = orgResponse.ok ? await orgResponse.json() : [];
      if (organizations.length !== 1) throw new Error("Organização de teste não está isolada.");

      const endpoint = `${supabaseUrl}/functions/v1/file-storage`;
      const bucket = "declaration-assets";
      let uploadedPath = "";
      const invoke = async (action, path, extra = {}) => {
        const response = await fetchStage(action, endpoint, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ action, bucket, path, ...extra }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.error) throw new Error(`${action}: HTTP ${response.status} ${body.error || "erro"}`);
        return body;
      };
        // PNG de 1×1 pixel; nunca contém dados de usuários ou arquivos reais.
        const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII="), (char) => char.charCodeAt(0));
        const requestedPath = `${organizations[0].id}/test-r2-smoke-${crypto.randomUUID()}.png`;
        const upload = await invoke("request-upload", requestedPath, {
          fileName: "test-r2-smoke.png", size: png.length,
        });
        window.__gllR2SmokeUpload = { url: upload.url, path: upload.path };
        uploadedPath = upload.path;
        const put = await fetchStage("PUT R2", upload.url, {
          method: "PUT",
          headers: { "Content-Type": upload.contentType, "If-None-Match": "*" },
          body: png,
        });
        if (!put.ok) throw new Error(`PUT R2: HTTP ${put.status}`);
        await invoke("complete-upload", uploadedPath);
        const download = await invoke("download-url", uploadedPath);
        if (download.legacy) throw new Error("Arquivo novo foi classificado como legado.");
        const get = await fetchStage("GET R2", download.url);
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
      }, { supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey, accessToken: session.access_token });
    } catch (error) {
      for (const failure of networkFailures.slice(-3)) {
        console.log(`Falha do navegador: ${failure.error}; CORS=${failure.cors || "não indicado"}; bloqueio=${failure.blocked || "não indicado"}`);
      }
      signedPutUrl ||= await page.evaluate(() => window.__gllR2SmokeUpload?.url || "");
      if (signedPutUrl) {
        const preflight = await page.request.fetch(signedPutUrl, {
          method: "OPTIONS",
          headers: {
            Origin: "https://julielzissimo.github.io",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "content-type,if-none-match",
          },
        });
        console.log(`R2 preflight: HTTP ${preflight.status()}, origin=${preflight.headers()["access-control-allow-origin"] || "ausente"}, headers=${preflight.headers()["access-control-allow-headers"] || "ausentes"}`);
        const directPut = await page.request.fetch(signedPutUrl, {
          method: "PUT",
          headers: {
            Origin: "https://julielzissimo.github.io",
            "Content-Type": "image/png",
            "If-None-Match": "*",
          },
          data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=", "base64"),
        });
        const code = (await directPut.text()).match(/<Code>([^<]+)<\/Code>/)?.[1] || "sem código XML";
        console.log(`R2 PUT direto: HTTP ${directPut.status()}, código=${code}, CORS=${directPut.headers()["access-control-allow-origin"] || "ausente"}`);
      }
      throw error;
    }
    if (!result.uploaded || !result.downloaded || !result.deleted) throw new Error("Fluxo R2 incompleto.");
    console.log("R2 homologação: upload, download, exclusão e leitura após exclusão validados com PNG sintético.");
  } finally {
    await page.evaluate(async ({ supabaseUrl, anonKey, accessToken }) => {
      const upload = window.__gllR2SmokeUpload;
      if (upload?.path) {
        await fetch(`${supabaseUrl}/functions/v1/file-storage`, {
          method: "POST",
          headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", bucket: "declaration-assets", path: upload.path }),
        }).catch(() => undefined);
      }
      delete window.__gllR2SmokeUpload;
      await fetch(`${supabaseUrl}/auth/v1/logout?scope=local`, {
        method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
      localStorage.clear();
      sessionStorage.clear();
    }, { supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey, accessToken: session.access_token });
  }
});
