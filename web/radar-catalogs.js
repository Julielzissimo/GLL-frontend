/**
 * @typedef {Object} RadarCatalogModality
 * @property {number} pncp_id
 * @property {string} name
 * @property {string|null} description
 * @property {boolean} is_active
 * @property {boolean|null} irp
 * @property {string|null} source_updated_at
 * @property {string} synced_at
 *
 * @typedef {Object} RadarCatalogState
 * @property {number} ibge_id
 * @property {string} uf
 * @property {string} name
 * @property {number|null} region_ibge_id
 * @property {string|null} region_sigla
 * @property {string|null} region_name
 *
 * @typedef {Object} RadarCatalogMunicipality
 * @property {number} ibge_id
 * @property {number} state_ibge_id
 * @property {string} state_uf
 * @property {string} name
 *
 * @typedef {Object} RadarApiEndpoint
 * @property {string} id
 * @property {string} api_name
 * @property {string} host
 * @property {string} base_path
 * @property {string} path_template
 * @property {"GET"} http_method
 * @property {string} contract_version
 * @property {Record<string, unknown>} response_schema
 * @property {string} source_documentation_url
 * @property {string|null} last_validated_at
 *
 * @typedef {Object} RadarApiParameter
 * @property {string} id
 * @property {string} endpoint_id
 * @property {string} parameter_name
 * @property {string} official_name
 * @property {string|null} description
 * @property {"string"|"integer"|"number"|"boolean"} data_type
 * @property {string|null} openapi_format
 * @property {boolean} is_required
 * @property {unknown} default_value
 * @property {unknown} allowed_values
 * @property {string|null} catalog_table
 * @property {string|null} catalog_column
 * @property {number|null} minimum
 * @property {number|null} maximum
 * @property {number|null} min_length
 * @property {number|null} max_length
 * @property {string|null} pattern
 * @property {Record<string, unknown>} validation_rules
 * @property {string} contract_version
 */

function resultOrThrow(result, message) {
  if (result?.error) throw new Error(result.error.message || message);
  return Array.isArray(result?.data) ? result.data : [];
}

function normalizeUf(value) {
  const uf = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z]{2}$/.test(uf)) throw new TypeError("Informe uma UF válida para consultar municípios.");
  return uf;
}

function normalizeEndpointId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 120) throw new TypeError("Informe um identificador de endpoint válido.");
  return id;
}

/**
 * Reads Radar values from the GLL database. RLS limits these lookups to active
 * GLL profiles; synchronization is additionally protected by the Edge Function.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{currentUserRole?: string}} [options]
 */
export function createRadarCatalogsService(client, options = {}) {
  if (!client || typeof client.from !== "function" || !client.functions?.invoke) {
    throw new TypeError("Informe um cliente Supabase válido para consultar os catálogos do Radar.");
  }

  return Object.freeze({
    /** @returns {Promise<RadarCatalogModality[]>} */
    async listModalities() {
      const result = await client.from("radar_catalog_modalities")
        .select("pncp_id, name, description, is_active, irp, source_updated_at, synced_at")
        .eq("is_active", true)
        .order("name", { ascending: true });
      return resultOrThrow(result, "Não foi possível consultar as modalidades do Radar.");
    },

    /** @returns {Promise<RadarCatalogState[]>} */
    async listStates() {
      const result = await client.from("radar_catalog_states")
        .select("ibge_id, uf, name, region_ibge_id, region_sigla, region_name")
        .eq("is_active", true)
        .order("uf", { ascending: true });
      return resultOrThrow(result, "Não foi possível consultar os estados do Radar.");
    },

    /** @param {string} uf @returns {Promise<RadarCatalogMunicipality[]>} */
    async listMunicipalitiesByUf(uf) {
      const stateUf = normalizeUf(uf);
      const result = await client.from("radar_catalog_municipalities")
        .select("ibge_id, state_ibge_id, state_uf, name")
        .eq("state_uf", stateUf)
        .eq("is_active", true)
        .order("name", { ascending: true });
      return resultOrThrow(result, "Não foi possível consultar os municípios do Radar.");
    },

    /** @returns {Promise<RadarApiEndpoint[]>} */
    async listEndpoints() {
      const result = await client.from("radar_api_endpoints")
        .select("id, api_name, host, base_path, path_template, http_method, contract_version, response_schema, source_documentation_url, last_validated_at")
        .order("id", { ascending: true });
      return resultOrThrow(result, "Não foi possível consultar os endpoints do PNCP.");
    },

    /** @param {string} endpointId @returns {Promise<RadarApiParameter[]>} */
    async listParameters(endpointId) {
      const id = normalizeEndpointId(endpointId);
      const result = await client.from("radar_api_parameters")
        .select("id, endpoint_id, parameter_name, official_name, description, data_type, openapi_format, is_required, default_value, allowed_values, catalog_table, catalog_column, minimum, maximum, min_length, max_length, pattern, validation_rules, contract_version")
        .eq("endpoint_id", id)
        .order("parameter_name", { ascending: true });
      return resultOrThrow(result, "Não foi possível consultar os parâmetros do PNCP.");
    },

    async syncCatalogs() {
      if (options.currentUserRole !== "Administrador") {
        throw new Error("Somente um Administrador pode solicitar sincronização dos catálogos.");
      }
      const { data, error } = await client.functions.invoke("radar-catalogs", { body: { action: "sync" } });
      if (error) throw new Error(error.message || "Não foi possível sincronizar os catálogos do Radar.");
      return data;
    },
  });
}

if (typeof window !== "undefined") {
  window.GLLRadarCatalogs = Object.freeze({ createRadarCatalogsService });
}
