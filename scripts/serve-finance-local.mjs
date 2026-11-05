import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const webRoot = resolve(projectRoot, "web");
const supabaseUrl = process.env.GLL_LOCAL_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.GLL_LOCAL_SUPABASE_ANON_KEY?.trim();
const listenHost = "127.0.0.1";
const listenPort = 4176;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Defina GLL_LOCAL_SUPABASE_URL e GLL_LOCAL_SUPABASE_ANON_KEY para servir o smoke local.");
}
const databaseOrigin = new URL(supabaseUrl).origin;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(databaseOrigin)) {
  throw new Error("O smoke financeiro aceita somente uma URL Supabase local.");
}

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function localEnvironmentSource(source) {
  return source
    .replace(/supabaseUrl:\s*"[^"]*"/u, `supabaseUrl: ${JSON.stringify(supabaseUrl)}`)
    .replace(/supabaseAnonKey:\s*"[^"]*"/u, `supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)}`);
}

function localContentSecurityPolicy(source) {
  return source.replace(/(<meta http-equiv="Content-Security-Policy" content=")(.*?)("\s*\/>)/u, (_match, start, policy, end) => {
    const withLocalApi = policy.replace(
      /connect-src [^;]*/u,
      `connect-src 'self' ${databaseOrigin} ${databaseOrigin.replace(/^http:/u, "ws:")}`,
    );
    return `${start}${withLocalApi.replace(/\s*upgrade-insecure-requests/u, "")}${end}`;
  });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${listenHost}:${listenPort}`);
    const relativePath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
    const filePath = resolve(webRoot, relativePath);
    if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404).end();
      return;
    }
    let body = await readFile(filePath);
    if (relativePath === "env.js") body = Buffer.from(localEnvironmentSource(body.toString("utf8")));
    if (relativePath === "index.html") body = Buffer.from(localContentSecurityPolicy(body.toString("utf8")));
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extname(filePath)) || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});

server.listen(listenPort, listenHost);
