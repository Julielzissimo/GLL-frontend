export function isRadarCatalogReadOnly(source, environment = globalThis.window?.GLL_CONFIG?.environment) {
  return source === "production" && environment !== "production";
}
