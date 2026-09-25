const STATUS_OPTIONS = ["Em Analise", "Aprovada", "Desclassificado", "Disputada"];
const WON_ITEM_STATUSES = ["Aprovada", "Faturado", "Desclassificado", "Disputada"];
STATUS_OPTIONS.splice(1, 0, "Descartada");
STATUS_OPTIONS.splice(3, 0, "Faturado");
const WON_ITEM_TOTAL_STATUSES = ["Descartada", "Aprovada", "Faturado", "Disputada"];
const FINAL_BID_STATUS = "Faturado";
const BID_STATUS_TRANSITIONS = Object.freeze({
  "Em Analise": ["Descartada", "Aprovada", "Desclassificado", "Disputada"],
  Descartada: ["Em Analise", "Disputada"],
  Aprovada: ["Em Analise", "Faturado", "Desclassificado", "Disputada"],
  Faturado: ["Aprovada"],
  Desclassificado: ["Em Analise", "Disputada"],
  Disputada: ["Em Analise", "Descartada", "Aprovada", "Desclassificado"],
});
const BID_TYPE_OPTIONS = [
  "Pregao Eletronico",
  "Pregao Presencial",
  "Concorrencia",
  "Dispensa",
  "Inexigibilidade",
  "Tomada de Precos",
  "Outro",
];
const SALES_UNIT_OPTIONS = ["Unidade", "Pacote", "Caixa", "Kilo", "Metro", "Litro", "Par", "Servico", "Outro"];
const BID_EDITAL_BUCKET = "bid-edital-files";
const MAX_EDITAL_FILE_SIZE = 20 * 1024 * 1024;
const MAX_EDITAL_FILES = 4;
const SUPABASE_CLIENT_VERSION = "2.57.4";
const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const MONEY_FRACTION_DIGITS = 2;
const QUANTITY_FRACTION_DIGITS = 4;
const MARGIN_FRACTION_DIGITS = 4;
const USER_ROLES = { ADMIN: "Administrador", ANALYST: "Analista" };
const DEFAULT_ADMIN = {
  email: "demo@gll.local",
  name: "Usuário local",
  password: "gll-demo-local",
  role: USER_ROLES.ADMIN,
  auth_user_id: "local-admin",
  organization_id: "local-lsms",
  organization: { name: "LSMS Suprimentos", cnpj: "66.693.364/0001-02" },
};
const DEFAULT_GLL_CONFIG = {
  environment: "local",
  label: "Local",
  description: "Ambiente web de validação local",
  storageLabel: "IndexedDB local",
  storageSuffix: "local",
  appName: "GLL Web",
  supabaseUrl: "",
  supabaseAnonKey: "",
  sessionIdleTimeoutMinutes: 30,
  sessionMaxLifetimeHours: 8,
  suppliersEnabled: true,
};
const GLL_CONFIG = {
  ...DEFAULT_GLL_CONFIG,
  ...(window.GLL_CONFIG || {}),
};

const PAGE_ROUTE_NAMES = {
  home: "visao-geral",
  bids: "licitacoes",
  edit: "nova-licitacao",
  items: "itens",
  documents: "documentos",
  failures: "falhas",
  quotations: "orcamentos",
  suppliers: "fornecedores",
  users: "usuarios",
  settings: "configuracoes",
};
const ROUTE_PAGE_NAMES = Object.fromEntries(Object.entries(PAGE_ROUTE_NAMES).map(([page, route]) => [route, page]));

const appState = {
  authenticated: false,
  activePage: "home",
  currentUserEmail: null,
  currentUserAuthId: null,
  currentUserRole: null,
  currentOrganizationId: null,
  currentOrganizationName: null,
  currentBidId: null,
  originalBidId: null,
  selectedBidQuotationId: null,
  currentItemId: null,
  currentDocumentId: null,
  currentFailureId: null,
  currentQuotationId: null,
  quotationListCollapsed: false,
  currentQuotationItemId: null,
  quotationItemFormBaseline: "",
  supplierLinksDraft: [],
  quotationSupplierLinksDraft: [],
  quotationTechnicalSpecificationsDraft: [],
  supplierProductSpecificationsDraft: [],
  currentSupplierId: null,
  currentSupplierProductId: null,
  sidebarCollapsed: false,
  appNavigationCollapsed: false,
  bids: [],
  items: [],
  documents: [],
  failureHistory: [],
  statusHistory: [],
  quotations: [],
  quotationItems: [],
  users: [],
  suppliers: [],
  supplierProducts: [],
};

const $ = (id) => document.getElementById(id);

const refs = {
  loginView: $("loginView"),
  appView: $("appView"),
  loginForm: $("loginForm"),
  loginEmail: $("loginEmail"),
  loginPassword: $("loginPassword"),
  loginError: $("loginError"),
  loginHint: $("loginHint"),
  environmentLabel: $("environmentLabel"),
  environmentBadge: $("environmentBadge"),
  storageStatus: $("storageStatus"),
  sessionPolicyStatus: $("sessionPolicyStatus"),
  authClientVersion: $("authClientVersion"),
  appSidebar: $("appSidebar"),
  homeIconButton: $("homeIconButton"),
  navHomeButton: $("navHomeButton"),
  navBidsButton: $("navBidsButton"),
  navQuotationsButton: $("navQuotationsButton"),
  navSuppliersButton: $("navSuppliersButton"),
  navUsersButton: $("navUsersButton"),
  navSettingsButton: $("navSettingsButton"),
  menuToggleButton: $("menuToggleButton"),
  breadcrumbLabel: $("breadcrumbLabel"),
  currentUserName: $("currentUserName"),
  currentUserRole: $("currentUserRole"),
  toggleSidebarButton: $("toggleSidebarButton"),
  sidebarPanel: $("sidebarPanel"),
  bidsPage: $("bidsPage"),
  homePage: $("homePage"),
  bidCatalogPage: $("bidCatalogPage"),
  upcomingBidsList: $("upcomingBidsList"),
  pendingDocumentsList: $("pendingDocumentsList"),
  viewAllBidsButton: $("viewAllBidsButton"),
  homeTotalBids: $("homeTotalBids"),
  homeAnalysisBids: $("homeAnalysisBids"),
  homeDiscardedBids: $("homeDiscardedBids"),
  homeApprovedBids: $("homeApprovedBids"),
  homeBilledBids: $("homeBilledBids"),
  homeDisqualifiedBids: $("homeDisqualifiedBids"),
  homeDisputedBids: $("homeDisputedBids"),
  bidWorkspaceHeader: $("bidWorkspaceHeader"),
  currentBidTitle: $("currentBidTitle"),
  currentBidCreatorTag: $("currentBidCreatorTag"),
  currentBidAgency: $("currentBidAgency"),
  usersPage: $("usersPage"),
  settingsPage: $("settingsPage"),
  suppliersPage: $("suppliersPage"),
  suppliersList: $("suppliersList"),
  supplierTagFilter: $("supplierTagFilter"),
  supplierSort: $("supplierSort"),
  supplierDetailContent: $("supplierDetailContent"),
  supplierEmptyDetail: $("supplierEmptyDetail"),
  supplierDetailAvatar: $("supplierDetailAvatar"),
  supplierDetailName: $("supplierDetailName"),
  supplierDetailSubtitle: $("supplierDetailSubtitle"),
  supplierContactLinks: $("supplierContactLinks"),
  supplierDetailTags: $("supplierDetailTags"),
  supplierProductTotal: $("supplierProductTotal"),
  supplierProductSearch: $("supplierProductSearch"),
  supplierProductTagFilter: $("supplierProductTagFilter"),
  supplierProductsTableBody: $("supplierProductsTableBody"),
  supplierProductsStatus: $("supplierProductsStatus"),
  supplierModal: $("supplierModal"),
  supplierProductModal: $("supplierProductModal"),
  supplierProductForm: $("supplierProductForm"),
  supplierProductModalTitle: $("supplierProductModalTitle"),
  supplierProductName: $("supplierProductName"),
  supplierProductSku: $("supplierProductSku"),
  supplierProductModel: $("supplierProductModel"),
  supplierProductManufacturer: $("supplierProductManufacturer"),
  supplierProductTags: $("supplierProductTags"),
  supplierProductAveragePrice: $("supplierProductAveragePrice"),
  supplierProductTechnicalText: $("supplierProductTechnicalText"),
  supplierProductSpecificationsSection: $("supplierProductSpecificationsSection"),
  supplierProductSpecificationsList: $("supplierProductSpecificationsList"),
  supplierProductFormError: $("supplierProductFormError"),
  deleteSupplierProductButton: $("deleteSupplierProductButton"),
  logoutButton: $("logoutButton"),
  resetDataButton: $("resetDataButton"),
  filterForm: $("filterForm"),
  filterAgency: $("filterAgency"),
  filterDate: $("filterDate"),
  filterStatus: $("filterStatus"),
  clearFiltersButton: $("clearFiltersButton"),
  bidList: $("bidList"),
  bidForm: $("bidForm"),
  bidId: $("bidId"),
  buyerAgency: $("buyerAgency"),
  sessionDatetime: $("sessionDatetime"),
  proposalDeadline: $("proposalDeadline"),
  deliveryPlace: $("deliveryPlace"),
  publicSessionLink: $("publicSessionLink"),
  publicSessionLinkInputGroup: $("publicSessionLinkInputGroup"),
  publicSessionLinkPanel: $("publicSessionLinkPanel"),
  openPublicSessionButton: $("openPublicSessionButton"),
  removePublicSessionLinkButton: $("removePublicSessionLinkButton"),
  editalFile: $("editalFile"),
  editalAttachmentHelp: $("editalAttachmentHelp"),
  editalAttachmentList: $("editalAttachmentList"),
  bidType: $("bidType"),
  bidStatus: $("bidStatus"),
  bidStatusReasonField: $("bidStatusReasonField"),
  bidStatusReason: $("bidStatusReason"),
  bidStatusHistory: $("bidStatusHistory"),
  bidQuotation: $("bidQuotation"),
  clearBidQuotationButton: $("clearBidQuotationButton"),
  bidQuotationModal: $("bidQuotationModal"),
  closeBidQuotationModalButton: $("closeBidQuotationModalButton"),
  bidQuotationFilterId: $("bidQuotationFilterId"),
  bidQuotationFilterAgency: $("bidQuotationFilterAgency"),
  bidQuotationResultsBody: $("bidQuotationResultsBody"),
  selectedBidLabel: $("selectedBidLabel"),
  bidFormError: $("bidFormError"),
  deleteBidButton: $("deleteBidButton"),
  clearBidButton: $("clearBidButton"),
  metricsSection: $("metricsSection"),
  detailsArea: $("detailsArea"),
  metricItemCount: $("metricItemCount"),
  metricMargin: $("metricMargin"),
  metricTotalProfit: $("metricTotalProfit"),
  metricTotalProfitMargin: $("metricTotalProfitMargin"),
  itemsTabButton: $("itemsTabButton"),
  documentsTabButton: $("documentsTabButton"),
  failuresTabButton: $("failuresTabButton"),
  itemsPanel: $("itemsPanel"),
  documentsPanel: $("documentsPanel"),
  failuresPanel: $("failuresPanel"),
  itemForm: $("itemForm"),
  itemNumber: $("itemNumber"),
  itemName: $("itemName"),
  salesUnit: $("salesUnit"),
  estimatedValue: $("estimatedValue"),
  supplierCost: $("supplierCost"),
  profitMargin: $("profitMargin"),
  valueWithMargin: $("valueWithMargin"),
  maxValue: $("maxValue"),
  minimumBid: $("minimumBid"),
  requiredQuantity: $("requiredQuantity"),
  itemProfit: $("itemProfit"),
  brandModel: $("brandModel"),
  technicalRegistrationText: $("technicalRegistrationText"),
  supplierLinkInput: $("supplierLinkInput"),
  addSupplierLinkButton: $("addSupplierLinkButton"),
  supplierLinksList: $("supplierLinksList"),
  selectedItemLabel: $("selectedItemLabel"),
  itemFormError: $("itemFormError"),
  deleteItemButton: $("deleteItemButton"),
  clearItemButton: $("clearItemButton"),
  itemsTableBody: $("itemsTableBody"),
  itemWonHeader: $("itemWonHeader"),
  downloadBidItemsButton: $("downloadBidItemsButton"),
  documentForm: $("documentForm"),
  documentType: $("documentType"),
  hasDocument: $("hasDocument"),
  documentDescription: $("documentDescription"),
  selectedDocumentLabel: $("selectedDocumentLabel"),
  documentFormError: $("documentFormError"),
  deleteDocumentButton: $("deleteDocumentButton"),
  clearDocumentButton: $("clearDocumentButton"),
  documentsTableBody: $("documentsTableBody"),
  failureForm: $("failureForm"),
  failureType: $("failureType"),
  failureDescription: $("failureDescription"),
  failureActionPlan: $("failureActionPlan"),
  selectedFailureLabel: $("selectedFailureLabel"),
  failureFormError: $("failureFormError"),
  deleteFailureButton: $("deleteFailureButton"),
  clearFailureButton: $("clearFailureButton"),
  failuresTableBody: $("failuresTableBody"),
  quotationsPage: $("quotationsPage"),
  newQuotationButton: $("newQuotationButton"),
  quotationsListPanel: $("quotationsListPanel"),
  quotationsListToggle: $("quotationsListToggle"),
  quotationsListContent: $("quotationsListContent"),
  quotationsListToggleLabel: $("quotationsListToggleLabel"),
  selectedQuotationSummary: $("selectedQuotationSummary"),
  quotationCountLabel: $("quotationCountLabel"),
  quotationsTableBody: $("quotationsTableBody"),
  quotationForm: $("quotationForm"),
  selectedQuotationLabel: $("selectedQuotationLabel"),
  quotationId: $("quotationId"),
  quotationOpeningDate: $("quotationOpeningDate"),
  quotationEdital: $("quotationEdital"),
  quotationAgency: $("quotationAgency"),
  quotationCity: $("quotationCity"),
  quotationCep: $("quotationCep"),
  quotationDeliveryDeadline: $("quotationDeliveryDeadline"),
  quotationFormError: $("quotationFormError"),
  deleteQuotationButton: $("deleteQuotationButton"),
  clearQuotationButton: $("clearQuotationButton"),
  quotationItemsSection: $("quotationItemsSection"),
  quotationItemsStatus: $("quotationItemsStatus"),
  quotationGrandTotal: $("quotationGrandTotal"),
  downloadQuotationItemsButton: $("downloadQuotationItemsButton"),
  openQuotationItemModalButton: $("openQuotationItemModalButton"),
  quotationItemModal: $("quotationItemModal"),
  quotationItemModalTitle: $("quotationItemModalTitle"),
  closeQuotationItemModalButton: $("closeQuotationItemModalButton"),
  quotationItemDiscardModal: $("quotationItemDiscardModal"),
  continueEditingQuotationItemButton: $("continueEditingQuotationItemButton"),
  discardQuotationItemChangesButton: $("discardQuotationItemChangesButton"),
  quotationItemForm: $("quotationItemForm"),
  quotationItemNumber: $("quotationItemNumber"),
  quotationItemDescription: $("quotationItemDescription"),
  quotationItemModel: $("quotationItemModel"),
  quotationItemManufacturer: $("quotationItemManufacturer"),
  quotationItemTechnicalText: $("quotationItemTechnicalText"),
  quotationItemSupplierInput: $("quotationItemSupplierInput"),
  addQuotationItemSupplierButton: $("addQuotationItemSupplierButton"),
  quotationItemSuppliersList: $("quotationItemSuppliersList"),
  quotationTechnicalSpecificationsSection: $("quotationTechnicalSpecificationsSection"),
  quotationTechnicalSpecificationsList: $("quotationTechnicalSpecificationsList"),
  addQuotationTechnicalSpecificationButton: $("addQuotationTechnicalSpecificationButton"),
  quotationItemEstimatedValue: $("quotationItemEstimatedValue"),
  quotationItemSupplierCost: $("quotationItemSupplierCost"),
  quotationItemProfitMargin: $("quotationItemProfitMargin"),
  quotationItemValueWithMargin: $("quotationItemValueWithMargin"),
  quotationItemFinalBid: $("quotationItemFinalBid"),
  quotationItemMinimumBid: $("quotationItemMinimumBid"),
  quotationFinalBidMarginIndicator: $("quotationFinalBidMarginIndicator"),
  quotationItemQuantity: $("quotationItemQuantity"),
  quotationItemTotal: $("quotationItemTotal"),
  quotationItemTotalProfit: $("quotationItemTotalProfit"),
  quotationItemFormError: $("quotationItemFormError"),
  deleteQuotationItemButton: $("deleteQuotationItemButton"),
  clearQuotationItemButton: $("clearQuotationItemButton"),
  quotationItemsTableBody: $("quotationItemsTableBody"),
  userCountLabel: $("userCountLabel"),
  usersTotalLabel: $("usersTotalLabel"),
  userSearchInput: $("userSearchInput"),
  userRoleFilter: $("userRoleFilter"),
  usersTableBody: $("usersTableBody"),
  usersOrganizationLabel: $("usersOrganizationLabel"),
  userAssignmentsModal: $("userAssignmentsModal"),
  userAssignmentsForm: $("userAssignmentsForm"),
  userAssignmentsTitle: $("userAssignmentsTitle"),
  userAssignmentsDescription: $("userAssignmentsDescription"),
  userAssignmentsList: $("userAssignmentsList"),
  userAssignmentsError: $("userAssignmentsError"),
  closeUserAssignmentsButton: $("closeUserAssignmentsButton"),
  cancelUserAssignmentsButton: $("cancelUserAssignmentsButton"),
  toast: $("toast"),
};

function createStore() {
  if (hasSupabaseConfig()) return new SupabaseStore();
  return new IndexedDbStore();
}

function hasSupabaseConfig() {
  return Boolean(GLL_CONFIG.supabaseUrl && GLL_CONFIG.supabaseAnonKey);
}

async function loadSupabaseClientFactory() {
  const module = await import(`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_CLIENT_VERSION}/+esm`);
  return module;
}

function assertSupabase(error) {
  if (!error) return;
  throw new Error(error.message || "Erro ao acessar o Supabase.");
}

function quotationSaveError(error) {
  const message = String(error?.message || "");
  if (error?.code === "42501" || /row-level security|organiza[cç][aã]o v[aá]lida/i.test(message)) {
    return new Error(
      "Não foi possível confirmar seu acesso à organização para salvar o orçamento. Atualize a página e, se o problema persistir, contate o administrador.",
    );
  }
  return new Error(message || "Não foi possível salvar o orçamento.");
}

async function deleteAllSupabaseRows(client, tableName, columnName) {
  const { error } = await client.from(tableName).delete().not(columnName, "is", null);
  assertSupabase(error);
}

async function deleteOptionalSupabaseRows(client, tableName, columnName) {
  const { error } = await client.from(tableName).delete().not(columnName, "is", null);
  if (isMissingFailureHistoryTableError(error)) return;
  assertSupabase(error);
}

async function insertSupabaseRows(client, tableName, rows) {
  if (!rows.length) return;
  const { error } = await client.from(tableName).insert(rows);
  if (tableName === "failure_history" && isMissingFailureHistoryTableError(error)) return;
  if (tableName === "items" && isMissingSupabaseColumnError(error)) {
    const { error: legacyError } = await client.from(tableName).insert(rows.map(legacySupabaseItemRecord));
    assertSupabase(legacyError);
    return;
  }
  assertSupabase(error);
}

function removeEmptyId(record) {
  const nextRecord = { ...record };
  if (!nextRecord.id) delete nextRecord.id;
  return nextRecord;
}

class IndexedDbStore {
  constructor() {
    this.requiresAuthenticationBeforeData = false;
    const storageSuffix = sanitizeStorageSuffix(GLL_CONFIG.storageSuffix || GLL_CONFIG.environment);
    this.dbName = `gll-web-data-v4-${storageSuffix}`;
    this.version = 6;
    this.authDbName = `gll-web-auth-v2-${storageSuffix}`;
    this.authVersion = 1;
    this.db = null;
    this.authDb = null;
  }

  async initialize() {
    await this.openAuth();
    await this.ensureDefaultUser();
    await this.open();
  }

  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const request = this.version ? indexedDB.open(this.dbName, this.version) : indexedDB.open(this.dbName);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("bids")) db.createObjectStore("bids", { keyPath: "id" });
        if (!db.objectStoreNames.contains("items")) {
          const store = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
          store.createIndex("bid_id", "bid_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("documents")) {
          const store = db.createObjectStore("documents", { keyPath: "id", autoIncrement: true });
          store.createIndex("bid_id", "bid_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("failure_history")) {
          const store = db.createObjectStore("failure_history", { keyPath: "id", autoIncrement: true });
          store.createIndex("bid_id", "bid_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("bid_status_history")) {
          const store = db.createObjectStore("bid_status_history", { keyPath: "id", autoIncrement: true });
          store.createIndex("bid_id", "bid_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("suppliers")) db.createObjectStore("suppliers", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("supplier_products")) {
          const store = db.createObjectStore("supplier_products", { keyPath: "id", autoIncrement: true });
          store.createIndex("supplier_id", "supplier_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("quotations")) db.createObjectStore("quotations", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("quotation_items")) {
          const store = db.createObjectStore("quotation_items", { keyPath: "id", autoIncrement: true });
          store.createIndex("quotation_id", "quotation_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  async openAuth() {
    if (this.authDb) return this.authDb;
    this.authDb = await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.authDbName, this.authVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("users")) db.createObjectStore("users", { keyPath: "email" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Feche outras abas antigas do GLL e recarregue esta página."));
    });
    return this.authDb;
  }

  async tx(storeNames, mode, callback) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);
      const stores = Array.isArray(storeNames)
        ? storeNames.map((name) => transaction.objectStore(name))
        : transaction.objectStore(storeNames);
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      result = callback(stores);
    });
  }

  request(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    const db = await this.open();
    return this.request(db.transaction(storeName).objectStore(storeName).getAll());
  }

  async authTx(storeName, mode, callback) {
    const db = await this.openAuth();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const storeRef = transaction.objectStore(storeName);
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      result = callback(storeRef);
    });
  }

  async getUsers() {
    const db = await this.openAuth();
    return this.request(db.transaction("users").objectStore("users").getAll());
  }

  async clearAll() {
    await this.tx(
      ["bids", "items", "documents", "failure_history", "bid_status_history", "quotations", "quotation_items", "suppliers", "supplier_products", "meta"],
      "readwrite",
      ([bids, items, documents, failures, statusHistory, quotations, quotationItems, suppliers, supplierProducts, meta]) => {
      bids.clear();
      items.clear();
      documents.clear();
      failures.clear();
      statusHistory.clear();
      quotations.clear();
      quotationItems.clear();
      suppliers.clear();
      supplierProducts.clear();
      meta.clear();
    });
  }

  async seedIfEmpty(seedData) {
    const db = await this.open();
    const meta = await this.request(db.transaction("meta").objectStore("meta").get("seeded"));
    if (meta?.value) return;
    await this.applySeed(seedData);
  }

  async applySeed(seedData) {
    await this.clearAll();
    await this.tx(["bids", "items", "documents", "failure_history", "meta"], "readwrite", ([bids, items, documents, failures, meta]) => {
      for (const bid of seedData.bids || []) bids.put(normalizeBidRecord(bid));
      for (const item of seedData.bid_items || []) items.put(normalizeItemRecord(item));
      for (const documentRow of seedData.bid_documents || []) documents.put(normalizeDocumentRecord(documentRow));
      for (const failure of seedData.failure_history || []) failures.put(normalizeFailureRecord(failure));
      meta.put({ key: "seeded", value: true, seededAt: new Date().toISOString() });
    });
  }

  async ensureDefaultUser() {
    const existing = await this.getUser(DEFAULT_ADMIN.email);
    const validPassword = existing ? await verifyPassword(DEFAULT_ADMIN.password, existing.salt, existing.password_hash) : false;
    if (validPassword) return;
    const record = await createLocalUserRecord(DEFAULT_ADMIN);
    await this.authTx("users", "readwrite", (users) => {
      users.put(record);
    });
  }

  async getUser(email) {
    const db = await this.openAuth();
    return this.request(db.transaction("users").objectStore("users").get(normalizeEmail(email)));
  }

  async authenticate(email, password) {
    const user = await this.getUser(email);
    const validPassword = user ? await verifyPassword(password, user.salt, user.password_hash) : false;
    return validPassword ? user : null;
  }

  async saveUser(userData) {
    const email = normalizeEmail(userData.email);
    const existing = await this.getUser(email);
    if (existing) throw new Error("Já existe um usuário cadastrado com este e-mail.");
    const record = await createLocalUserRecord(userData);
    await this.authTx("users", "readwrite", (users) => users.put(record));
  }

  async deleteUser(email) {
    await this.authTx("users", "readwrite", (users) => users.delete(normalizeEmail(email)));
  }

  async assignAccessToAnalyst(analystId, selectedBidIds, selectedQuotationIds) {
    const selected = new Set(selectedBidIds);
    await this.tx("bids", "readwrite", (bids) => {
      const request = bids.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const bid = cursor.value;
        if (bid.created_by !== analystId) {
          const assignedTo = selected.has(bid.id)
            ? analystId
            : bid.assigned_to === analystId ? null : bid.assigned_to;
          if (assignedTo !== bid.assigned_to) cursor.update({ ...bid, assigned_to: assignedTo, updated_at: timestampNow() });
        }
        cursor.continue();
      };
    });
    const selectedQuotations = new Set(selectedQuotationIds.map(Number));
    await this.tx("quotations", "readwrite", (quotations) => {
      const request = quotations.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const quotation = cursor.value;
        if (quotation.created_by !== analystId) {
          const assignedTo = selectedQuotations.has(Number(quotation.id))
            ? analystId
            : quotation.assigned_to === analystId ? null : quotation.assigned_to;
          if (assignedTo !== quotation.assigned_to) cursor.update({ ...quotation, assigned_to: assignedTo, updated_at: timestampNow() });
        }
        cursor.continue();
      };
    });
  }

  async saveBid(data, originalId, statusReason = "") {
    const now = timestampNow();
    let wasBilled = false;
    await this.tx(["bids", "items", "documents", "failure_history", "bid_status_history"], "readwrite", ([bids, items, documents, failures, statusHistory]) => {
      const request = bids.get(originalId || data.id);
      request.onsuccess = () => {
        const existing = request.result;
        wasBilled = existing?.status === FINAL_BID_STATUS;
        if (existing && existing.status !== data.status) {
          validateBidStatusTransition(existing.status, data.status, statusReason);
          const historyRecord = normalizeStatusHistoryRecord({
            bid_id: existing.id,
            from_status: existing.status,
            to_status: data.status,
            reason: statusReason,
            changed_by: appState.currentUserAuthId,
            changed_by_name: currentUserProfile()?.name || appState.currentUserEmail,
            changed_by_email: appState.currentUserEmail,
            changed_at: new Date().toISOString(),
          });
          delete historyRecord.id;
          statusHistory.add(historyRecord);
        }
        bids.put(wasBilled
          ? { ...existing, status: data.status, updated_at: now }
          : {
              ...existing,
              ...data,
              organization_id: existing?.organization_id || appState.currentOrganizationId,
              created_by: existing?.created_by || appState.currentUserAuthId,
              assigned_to: existing?.assigned_to || null,
              created_at: existing?.created_at || now,
              updated_at: now,
            });
      };
    });
    if (!wasBilled) await this.syncBidWithQuotation(data.id, data.quotation_id);
  }

  async syncBidWithQuotation(bidId, quotationId) {
    const existingItems = (await this.getAll("items")).map(normalizeItemRecord).filter((item) => item.bid_id === bidId);
    const quotationItems = (await this.getAll("quotation_items")).map(normalizeQuotationItemRecord);
    if (!quotationId) {
      await this.tx("items", "readwrite", (items) => {
        for (const item of existingItems.filter((row) => row.quotation_item_id)) items.put({ ...item, quotation_item_id: null });
      });
      return;
    }
    const targetItems = quotationItems.filter((item) => Number(item.quotation_id) === Number(quotationId));
    const targetIds = new Set(targetItems.map((item) => Number(item.id)));
    await this.tx("items", "readwrite", (items) => {
      for (const item of existingItems) {
        if (item.quotation_item_id && !targetIds.has(Number(item.quotation_item_id))) items.delete(Number(item.id));
      }
      for (const quotationItem of targetItems) {
        const existing = existingItems.find(
          (item) =>
            Number(item.quotation_item_id) === Number(quotationItem.id) ||
            (Number(item.item_number) === Number(quotationItem.item_number) &&
              (!item.quotation_item_id || targetIds.has(Number(item.quotation_item_id))))
        );
        const record = quotationItemToBidItem(quotationItem, { ...existing, bid_id: bidId });
        if (!record.id) delete record.id;
        items.put(record);
      }
    });
  }

  async saveBidAttachments(bidId, files) {
    const db = await this.open();
    const existing = await this.request(db.transaction("bids").objectStore("bids").get(bidId));
    if (!existing) throw new Error("Salve o edital antes de anexar o arquivo.");
    const currentAttachments = normalizeBidAttachments(existing);
    if (currentAttachments.length + files.length > MAX_EDITAL_FILES) {
      throw new Error(`Cada edital pode ter no máximo ${MAX_EDITAL_FILES} arquivos anexados.`);
    }
    const newAttachments = files.map((file) => ({
      path: `indexeddb:${bidId}:${crypto.randomUUID()}`,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      blob: file,
    }));
    const editalFiles = [...currentAttachments, ...newAttachments];
    await this.tx("bids", "readwrite", (bids) => bids.put({
      ...existing,
      edital_files: editalFiles,
      updated_at: timestampNow(),
    }));
    return editalFiles;
  }

  async downloadBidAttachment(attachment) {
    if (!attachment?.blob) throw new Error("O arquivo anexado não está disponível neste navegador.");
    return attachment.blob;
  }

  async deleteBidAttachment(bidId, attachmentPath) {
    const db = await this.open();
    const existing = await this.request(db.transaction("bids").objectStore("bids").get(bidId));
    if (!existing) throw new Error("Edital não encontrado.");
    const editalFiles = normalizeBidAttachments(existing).filter((attachment) => attachment.path !== attachmentPath);
    await this.tx("bids", "readwrite", (bids) => bids.put({
      ...existing,
      edital_files: editalFiles,
      updated_at: timestampNow(),
    }));
  }

  async deleteBid(bidId) {
    const db = await this.open();
    const existing = await this.request(db.transaction("bids").objectStore("bids").get(bidId));
    if (!existing) throw new Error("Edital não encontrado.");
    await this.tx("bids", "readwrite", (bids) => {
      bids.put({ ...existing, deleted_at: timestampNow(), updated_at: timestampNow() });
    });
  }

  async saveItem(bidId, itemData, itemId) {
    const existingItems = (await this.getAll("items")).map(normalizeItemRecord);
    const duplicate = existingItems.find(
      (item) => item.bid_id === bidId && Number(item.item_number) === Number(itemData.item_number) && Number(item.id) !== Number(itemId)
    );
    if (duplicate) throw new Error("Já existe um item com este número neste edital.");
    const bid = (await this.getAll("bids")).map(normalizeBidRecord).find((row) => row.id === bidId);
    const existingItem = existingItems.find((item) => Number(item.id) === Number(itemId));
    let quotationItemId = existingItem?.quotation_item_id || null;
    if (bid?.quotation_id) {
      const quotationItems = (await this.getAll("quotation_items")).map(normalizeQuotationItemRecord);
      const existingQuotationItem = quotationItems.find(
        (item) =>
          Number(item.id) === Number(quotationItemId) ||
          (Number(item.quotation_id) === Number(bid.quotation_id) && Number(item.item_number) === Number(itemData.item_number))
      );
      const quotationRecord = bidItemToQuotationItem(
        normalizeItemRecord({ ...existingItem, ...itemData, bid_id: bidId, quotation_item_id: quotationItemId }),
        { ...existingQuotationItem, quotation_id: Number(bid.quotation_id) }
      );
      quotationItemId = await this.putQuotationItem(quotationRecord);
    }
    const record = normalizeItemRecord({ ...itemData, id: itemId || undefined, bid_id: bidId, quotation_item_id: quotationItemId });
    await this.tx("items", "readwrite", (items) => {
      if (!record.id) delete record.id;
      items.put(record);
    });
    if (quotationItemId) await this.syncQuotationItemToBids(quotationItemId);
  }

  async setItemWon(itemId, isWon) {
    const existingItems = await this.getAll("items");
    const item = existingItems.find((record) => Number(record.id) === Number(itemId));
    if (!item) throw new Error("Item não encontrado.");
    await this.tx("items", "readwrite", (items) => items.put({ ...item, is_won: isWon ? 1 : 0 }));
  }

  async deleteItem(itemId) {
    const item = (await this.getAll("items")).map(normalizeItemRecord).find((row) => Number(row.id) === Number(itemId));
    if (item?.quotation_item_id) {
      await this.deleteQuotationItem(item.quotation_item_id);
      return;
    }
    await this.tx("items", "readwrite", (items) => items.delete(Number(itemId)));
  }

  async saveDocument(bidId, documentData, documentId) {
    const record = normalizeDocumentRecord({ ...documentData, id: documentId || undefined, bid_id: bidId });
    await this.tx("documents", "readwrite", (documents) => {
      if (!record.id) delete record.id;
      documents.put(record);
    });
  }

  async deleteDocument(documentId) {
    await this.tx("documents", "readwrite", (documents) => documents.delete(Number(documentId)));
  }

  async saveFailure(bidId, failureData, failureId) {
    const record = normalizeFailureRecord({ ...failureData, id: failureId || undefined, bid_id: bidId });
    await this.tx("failure_history", "readwrite", (failures) => {
      if (!record.id) delete record.id;
      failures.put(record);
    });
  }

  async deleteFailure(failureId) {
    await this.tx("failure_history", "readwrite", (failures) => failures.delete(Number(failureId)));
  }

  async saveSupplier(record, id) {
    const existing = id ? (await this.getAll("suppliers")).find((supplier) => Number(supplier.id) === Number(id)) : null;
    const data = {
      ...existing,
      ...record,
      organization_id: existing?.organization_id || appState.currentOrganizationId,
      created_at: existing?.created_at || timestampNow(),
      updated_at: timestampNow(),
    };
    if (id) data.id = Number(id);
    let savedId;
    await this.tx("suppliers", "readwrite", (suppliers) => {
      const request = suppliers.put(data);
      request.onsuccess = () => { savedId = request.result; };
    });
    return Number(savedId);
  }

  async saveSupplierProduct(supplierId, productData, productId) {
    const existing = productId
      ? (await this.getAll("supplier_products")).find((product) => Number(product.id) === Number(productId))
      : null;
    const record = normalizeSupplierProductRecord({
      ...existing,
      ...productData,
      id: productId || undefined,
      supplier_id: Number(supplierId),
      organization_id: existing?.organization_id || appState.currentOrganizationId,
      created_at: existing?.created_at || timestampNow(),
      updated_at: timestampNow(),
    });
    let savedId;
    await this.tx("supplier_products", "readwrite", (products) => {
      if (!record.id) delete record.id;
      const request = products.put(record);
      request.onsuccess = () => { savedId = request.result; };
    });
    return Number(savedId);
  }

  async deleteSupplierProduct(productId) {
    await this.tx("supplier_products", "readwrite", (products) => products.delete(Number(productId)));
  }

  async saveQuotation(quotationData, quotationId) {
    const existing = quotationId
      ? (await this.getAll("quotations")).find((quotation) => Number(quotation.id) === Number(quotationId))
      : null;
    const now = timestampNow();
    const record = normalizeQuotationRecord({
      ...existing,
      ...quotationData,
      id: quotationId || undefined,
      organization_id: existing?.organization_id || appState.currentOrganizationId,
      created_by: existing?.created_by || appState.currentUserAuthId,
      assigned_to: existing?.assigned_to || null,
      created_at: existing?.created_at || now,
      updated_at: now,
    });
    let savedId;
    await this.tx("quotations", "readwrite", (quotations) => {
      if (!record.id) delete record.id;
      const request = quotations.put(record);
      request.onsuccess = () => {
        savedId = request.result;
      };
    });
    return Number(savedId);
  }

  async deleteQuotation(quotationId) {
    const existing = (await this.getAll("quotations")).find((row) => Number(row.id) === Number(quotationId));
    if (!existing) throw new Error("Orçamento não encontrado.");
    await this.tx("quotations", "readwrite", (quotations) => {
      quotations.put({ ...existing, deleted_at: timestampNow(), updated_at: timestampNow() });
    });
  }

  async saveQuotationItem(quotationId, itemData, itemId) {
    const existingItems = await this.getAll("quotation_items");
    const duplicate = existingItems.find(
      (item) =>
        Number(item.quotation_id) === Number(quotationId) &&
        Number(item.item_number) === Number(itemData.item_number) &&
        Number(item.id) !== Number(itemId)
    );
    if (duplicate) throw new Error("Já existe um item com este número neste orçamento.");
    const record = normalizeQuotationItemRecord({ ...itemData, id: itemId || undefined, quotation_id: quotationId });
    const savedId = await this.putQuotationItem(record);
    await this.syncQuotationItemToBids(savedId);
    return savedId;
  }

  async deleteQuotationItem(itemId) {
    const linkedItems = (await this.getAll("items")).filter((item) => Number(item.quotation_item_id) === Number(itemId));
    await this.tx(["items", "quotation_items"], "readwrite", ([items, quotationItems]) => {
      quotationItems.delete(Number(itemId));
      for (const item of linkedItems) items.delete(Number(item.id));
    });
  }

  async putQuotationItem(itemData) {
    const record = normalizeQuotationItemRecord(itemData);
    let savedId;
    await this.tx("quotation_items", "readwrite", (quotationItems) => {
      if (!record.id) delete record.id;
      const request = quotationItems.put(record);
      request.onsuccess = () => {
        savedId = Number(request.result);
      };
    });
    return savedId;
  }

  async syncQuotationItemToBids(quotationItemId) {
    const quotationItem = (await this.getAll("quotation_items"))
      .map(normalizeQuotationItemRecord)
      .find((item) => Number(item.id) === Number(quotationItemId));
    if (!quotationItem) return;
    const linkedBids = (await this.getAll("bids"))
      .map(normalizeBidRecord)
      .filter((bid) => !bid.deleted_at)
      .filter((bid) => Number(bid.quotation_id) === Number(quotationItem.quotation_id));
    const allItems = (await this.getAll("items")).map(normalizeItemRecord);
    await this.tx("items", "readwrite", (items) => {
      for (const bid of linkedBids) {
        const existing = allItems.find(
          (item) =>
            item.bid_id === bid.id &&
            (Number(item.quotation_item_id) === Number(quotationItem.id) || Number(item.item_number) === Number(quotationItem.item_number))
        );
        const record = quotationItemToBidItem(quotationItem, { ...existing, bid_id: bid.id });
        if (!record.id) delete record.id;
        items.put(record);
      }
    });
  }
}

class SupabaseStore {
  constructor() {
    this.requiresAuthenticationBeforeData = true;
    this.client = null;
  }

  async initialize() {
    await this.open();
  }

  async open() {
    if (this.client) return this.client;
    const { createClient } = await loadSupabaseClientFactory();
    this.client = createClient(GLL_CONFIG.supabaseUrl, GLL_CONFIG.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    });
    return this.client;
  }

  async openAuth() {
    return this.open();
  }

  async ensureDefaultUser() {
    return undefined;
  }

  async authenticate(email, password) {
    const client = await this.open();
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error || !data.user) return null;
    const profile = await this.getUser(data.user.email);
    if (profile) return profile;
    await client.auth.signOut();
    return null;
  }

  async getAll(tableName) {
    const client = await this.open();
    const query = client.from(tableName).select("*");
    const { data, error } = ["bids", "quotations"].includes(tableName) ? await query.is("deleted_at", null) : await query;
    if (tableName === "failure_history" && isMissingFailureHistoryTableError(error)) return [];
    assertSupabase(error);
    return data || [];
  }

  async getUsers() {
    const client = await this.open();
    const { data, error } = await client.from("app_users").select("*, organization:organizations(name, cnpj)");
    assertSupabase(error);
    return data || [];
  }

  async getUser(email) {
    const client = await this.open();
    const { data, error } = await client.from("app_users").select("*, organization:organizations(name, cnpj)").eq("email", normalizeEmail(email)).maybeSingle();
    assertSupabase(error);
    return data;
  }

  async seedIfEmpty(seedData) {
    const client = await this.open();
    const { data, error } = await client.from("bids").select("id").limit(1);
    assertSupabase(error);
    if (data?.length) return;
    await this.applySeed(seedData);
  }

  async applySeed(seedData) {
    const client = await this.open();
    await deleteAllSupabaseRows(client, "quotation_items", "id");
    await deleteAllSupabaseRows(client, "quotations", "id");
    await deleteOptionalSupabaseRows(client, "failure_history", "id");
    await deleteAllSupabaseRows(client, "documents", "id");
    await deleteAllSupabaseRows(client, "items", "id");
    await deleteAllSupabaseRows(client, "bids", "id");

    const bids = (seedData.bids || []).map(normalizeBidRecord);
    const items = (seedData.bid_items || []).map((item) => {
      const record = normalizeItemRecord(item);
      delete record.id;
      return record;
    });
    const documents = (seedData.bid_documents || []).map((documentRow) => {
      const record = normalizeDocumentRecord(documentRow);
      delete record.id;
      return record;
    });
    const failures = (seedData.failure_history || []).map((failure) => {
      const record = normalizeFailureRecord(failure);
      delete record.id;
      return record;
    });

    await insertSupabaseRows(client, "bids", bids);
    await insertSupabaseRows(client, "items", items);
    await insertSupabaseRows(client, "documents", documents);
    await insertSupabaseRows(client, "failure_history", failures);
  }

  async saveUser(userData) {
    const client = await this.open();
    const email = normalizeEmail(userData.email);
    const existing = await this.getUser(email);
    if (existing) throw new Error("Já existe um usuário cadastrado com este e-mail.");

    const { createClient } = await loadSupabaseClientFactory();
    const signupClient = createClient(GLL_CONFIG.supabaseUrl, GLL_CONFIG.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const { error: signupError } = await signupClient.auth.signUp({
      email,
      password: userData.password,
      options: {
        data: {
          name: userData.name?.trim() || email,
          role: userData.role || USER_ROLES.ANALYST,
        },
      },
    });
    assertSupabase(signupError);

    const { error } = await client.from("app_users").insert({
      email,
      name: userData.name?.trim() || email,
      role: userData.role || USER_ROLES.ANALYST,
      created_at: timestampNow(),
    });
    assertSupabase(error);
  }

  async deleteUser(email) {
    const client = await this.open();
    const { error } = await client.from("app_users").delete().eq("email", normalizeEmail(email));
    assertSupabase(error);
  }

  async assignAccessToAnalyst(analystId, selectedBidIds, selectedQuotationIds) {
    const client = await this.open();
    const selected = new Set(selectedBidIds);
    const changes = appState.bids
      .filter((bid) => bid.created_by !== analystId)
      .map((bid) => ({
        bid,
        assignedTo: selected.has(bid.id)
          ? analystId
          : bid.assigned_to === analystId ? null : bid.assigned_to,
      }))
      .filter(({ bid, assignedTo }) => assignedTo !== bid.assigned_to);

    for (const { bid, assignedTo } of changes) {
      const { error } = await client
        .from("bids")
        .update({ assigned_to: assignedTo, updated_at: timestampNow() })
        .eq("id", bid.id);
      assertSupabase(error);
    }
    const selectedQuotations = new Set(selectedQuotationIds.map(Number));
    const quotationChanges = appState.quotations
      .filter((quotation) => quotation.created_by !== analystId)
      .map((quotation) => ({
        quotation,
        assignedTo: selectedQuotations.has(Number(quotation.id))
          ? analystId
          : quotation.assigned_to === analystId ? null : quotation.assigned_to,
      }))
      .filter(({ quotation, assignedTo }) => assignedTo !== quotation.assigned_to);

    for (const { quotation, assignedTo } of quotationChanges) {
      const { error } = await client
        .from("quotations")
        .update({ assigned_to: assignedTo, updated_at: timestampNow() })
        .eq("id", Number(quotation.id));
      assertSupabase(error);
    }
  }

  async saveBid(data, originalId, statusReason = "") {
    const client = await this.open();
    const now = timestampNow();
    if (originalId) {
      const { data: existing, error: readError } = await client.from("bids").select("created_at, status").eq("id", originalId).maybeSingle();
      assertSupabase(readError);
      const statusChanged = existing?.status !== data.status;
      if (statusChanged) validateBidStatusTransition(existing.status, data.status, statusReason);
      const changes = existing?.status === FINAL_BID_STATUS
        ? { updated_at: now }
        : { ...data, status: existing?.status || data.status, created_at: existing?.created_at || now, updated_at: now };
      if (existing?.status !== FINAL_BID_STATUS) {
        const { error } = await client
          .from("bids")
          .update(changes)
          .eq("id", originalId);
        assertSupabase(error);
      }
      if (statusChanged) {
        const { error: statusError } = await client.rpc("change_bid_status", {
          target_bid_id: originalId,
          target_status: data.status,
          change_reason: statusReason.trim(),
        });
        assertSupabase(statusError);
      }
      return;
    }
    const { error } = await client.from("bids").insert({
      ...data,
      created_at: now,
      updated_at: now,
    });
    assertSupabase(error);
  }

  async syncBidWithQuotation(bidId, quotationId) {
    const client = await this.open();
    const { data: currentRows, error: currentError } = await client.from("items").select("*").eq("bid_id", bidId);
    assertSupabase(currentError);
    const currentItems = (currentRows || []).map(normalizeItemRecord);
    if (!quotationId) {
      const linkedIds = currentItems.filter((item) => item.quotation_item_id).map((item) => item.id);
      if (linkedIds.length) {
        const { error } = await client.from("items").update({ quotation_item_id: null }).in("id", linkedIds);
        assertSupabase(error);
      }
      return;
    }
    const { data: quotationRows, error: quotationError } = await client
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", Number(quotationId));
    assertSupabase(quotationError);
    const quotationItems = (quotationRows || []).map(normalizeQuotationItemRecord);
    const targetIds = new Set(quotationItems.map((item) => Number(item.id)));
    const staleIds = currentItems
      .filter((item) => item.quotation_item_id && !targetIds.has(Number(item.quotation_item_id)))
      .map((item) => item.id);
    if (staleIds.length) {
      const { error } = await client.from("items").delete().in("id", staleIds);
      assertSupabase(error);
    }
    for (const quotationItem of quotationItems) {
      const existing = currentItems.find(
        (item) =>
          Number(item.quotation_item_id) === Number(quotationItem.id) ||
          (Number(item.item_number) === Number(quotationItem.item_number) &&
            (!item.quotation_item_id || targetIds.has(Number(item.quotation_item_id))))
      );
      const record = quotationItemToBidItem(quotationItem, { ...existing, bid_id: bidId });
      const operation = record.id ? client.from("items").upsert(record) : client.from("items").insert(removeEmptyId(record));
      const { error } = await operation;
      assertSupabase(error);
    }
  }

  async saveBidAttachments(bidId, files) {
    const client = await this.open();
    const { data: bid, error: readError } = await client
      .from("bids")
      .select("edital_files, edital_file_path, edital_file_name, edital_file_type, edital_file_size")
      .eq("id", bidId)
      .maybeSingle();
    assertSupabase(readError);
    if (!bid) throw new Error("Salve o edital antes de anexar o arquivo.");
    const currentAttachments = normalizeBidAttachments(bid);
    if (currentAttachments.length + files.length > MAX_EDITAL_FILES) {
      throw new Error(`Cada edital pode ter no máximo ${MAX_EDITAL_FILES} arquivos anexados.`);
    }

    const uploadedAttachments = [];
    try {
      for (const file of files) {
        const fileName = sanitizeStorageFileName(file.name);
        if (!appState.currentOrganizationId) throw new Error("Não foi possível identificar a organização do usuário.");
        const filePath = `${appState.currentOrganizationId}/${bidId}/${crypto.randomUUID()}/${fileName}`;
        const { error: uploadError } = await client.storage.from(BID_EDITAL_BUCKET).upload(filePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        assertSupabase(uploadError);
        uploadedAttachments.push({
          path: filePath,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
        });
      }
    } catch (error) {
      if (uploadedAttachments.length) {
        await client.storage.from(BID_EDITAL_BUCKET).remove(uploadedAttachments.map((attachment) => attachment.path));
      }
      throw error;
    }

    const editalFiles = [...currentAttachments, ...uploadedAttachments].map(attachmentMetadata);
    const { error: updateError } = await client.from("bids").update({ edital_files: editalFiles }).eq("id", bidId);
    if (updateError) {
      await client.storage.from(BID_EDITAL_BUCKET).remove(uploadedAttachments.map((attachment) => attachment.path));
      assertSupabase(updateError);
    }
    return editalFiles;
  }

  async downloadBidAttachment(attachment) {
    if (!attachment?.path) throw new Error("Este arquivo não está disponível.");
    const client = await this.open();
    const { data, error } = await client.storage.from(BID_EDITAL_BUCKET).download(attachment.path);
    assertSupabase(error);
    return data;
  }

  async deleteBidAttachment(bidId, attachmentPath) {
    const client = await this.open();
    const { data: bid, error: readError } = await client
      .from("bids")
      .select("edital_files, edital_file_path, edital_file_name, edital_file_type, edital_file_size")
      .eq("id", bidId)
      .maybeSingle();
    assertSupabase(readError);
    if (!bid) throw new Error("Edital não encontrado.");
    const currentAttachments = normalizeBidAttachments(bid);
    if (!currentAttachments.some((attachment) => attachment.path === attachmentPath)) {
      throw new Error("Arquivo do edital não encontrado.");
    }
    const editalFiles = currentAttachments
      .filter((attachment) => attachment.path !== attachmentPath)
      .map(attachmentMetadata);
    const { error: updateError } = await client.from("bids").update({ edital_files: editalFiles }).eq("id", bidId);
    assertSupabase(updateError);
    const { error: removeError } = await client.storage.from(BID_EDITAL_BUCKET).remove([attachmentPath]);
    if (removeError) console.warn("Não foi possível remover o arquivo do armazenamento.", removeError);
  }

  async deleteBid(bidId) {
    const client = await this.open();
    const now = timestampNow();
    const { error } = await client
      .from("bids")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", bidId);
    assertSupabase(error);
  }

  async saveItem(bidId, itemData, itemId) {
    const client = await this.open();
    const record = normalizeItemRecord({ ...itemData, id: itemId || undefined, bid_id: bidId });
    const { error } = await client.rpc("save_bid_item_consistently", {
      p_bid_id: bidId,
      p_item: removeEmptyId(record),
      p_item_id: itemId ? Number(itemId) : null,
    });
    assertSupabase(error);
  }

  async setItemWon(itemId, isWon) {
    const client = await this.open();
    const { error } = await client.from("items").update({ is_won: isWon ? 1 : 0 }).eq("id", Number(itemId));
    assertSupabase(error);
  }

  async deleteItem(itemId) {
    const client = await this.open();
    const { data: item, error: readError } = await client.from("items").select("quotation_item_id").eq("id", Number(itemId)).maybeSingle();
    assertSupabase(readError);
    if (item?.quotation_item_id) {
      const { error } = await client.from("quotation_items").delete().eq("id", Number(item.quotation_item_id));
      assertSupabase(error);
      return;
    }
    const { error } = await client.from("items").delete().eq("id", Number(itemId));
    assertSupabase(error);
  }

  async saveDocument(bidId, documentData, documentId) {
    const client = await this.open();
    const record = normalizeDocumentRecord({ ...documentData, id: documentId || undefined, bid_id: bidId });
    const operation = record.id ? client.from("documents").upsert(record) : client.from("documents").insert(removeEmptyId(record));
    const { error } = await operation;
    assertSupabase(error);
  }

  async deleteDocument(documentId) {
    const client = await this.open();
    const { error } = await client.from("documents").delete().eq("id", Number(documentId));
    assertSupabase(error);
  }

  async saveFailure(bidId, failureData, failureId) {
    const client = await this.open();
    const record = normalizeFailureRecord({ ...failureData, id: failureId || undefined, bid_id: bidId });
    const operation = record.id ? client.from("failure_history").upsert(record) : client.from("failure_history").insert(removeEmptyId(record));
    const { error } = await operation;
    if (isMissingFailureHistoryTableError(error)) {
      throw new Error("A tabela Histórico de Falhas ainda não foi criada no Supabase deste ambiente. Execute supabase/schema.sql antes de salvar falhas.");
    }
    assertSupabase(error);
  }

  async deleteFailure(failureId) {
    const client = await this.open();
    const { error } = await client.from("failure_history").delete().eq("id", Number(failureId));
    if (isMissingFailureHistoryTableError(error)) {
      throw new Error("A tabela Histórico de Falhas ainda não foi criada no Supabase deste ambiente. Execute supabase/schema.sql antes de salvar falhas.");
    }
    assertSupabase(error);
  }

  async saveSupplier(record, id) {
    const client = await this.open();
    const data = { ...record, updated_at: new Date().toISOString() };
    const query = id ? client.from("suppliers").update(data).eq("id", Number(id)) : client.from("suppliers").insert(data);
    const { data: saved, error } = await query.select("id").single();
    assertSupabase(error);
    return Number(saved.id);
  }

  async saveSupplierProduct(supplierId, productData, productId) {
    const client = await this.open();
    const record = normalizeSupplierProductRecord({
      ...productData,
      id: productId || undefined,
      supplier_id: Number(supplierId),
      organization_id: appState.currentOrganizationId,
      updated_at: timestampNow(),
    });
    const { id, ...payload } = record;
    const operation = id
      ? client.from("supplier_products").update(payload).eq("id", Number(id)).select("id").single()
      : client.from("supplier_products").insert(payload).select("id").single();
    const { data, error } = await operation;
    assertSupabase(error);
    return Number(data.id);
  }

  async deleteSupplierProduct(productId) {
    const client = await this.open();
    const { error } = await client.from("supplier_products").delete().eq("id", Number(productId));
    assertSupabase(error);
  }

  async saveQuotation(quotationData, quotationId) {
    const client = await this.open();
    const now = timestampNow();
    if (quotationId) {
      const { data, error } = await client
        .from("quotations")
        .update({ ...quotationData, updated_at: now })
        .eq("id", Number(quotationId))
        .select("id")
        .single();
      assertSupabase(error);
      return Number(data.id);
    }
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user?.id || !appState.currentOrganizationId) {
      throw quotationSaveError(authError || { code: "42501" });
    }
    const { data, error } = await client
      .from("quotations")
      .insert({
        ...quotationData,
        organization_id: appState.currentOrganizationId,
        created_by: authData.user.id,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (error) throw quotationSaveError(error);
    return Number(data.id);
  }

  async deleteQuotation(quotationId) {
    const client = await this.open();
    const now = timestampNow();
    const { data, error } = await client.from("quotations")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", Number(quotationId))
      .is("deleted_at", null)
      .select("id");
    assertSupabase(error);
    if (!data?.length) throw new Error("Orçamento não encontrado.");
  }

  async saveQuotationItem(quotationId, itemData, itemId) {
    const record = normalizeQuotationItemRecord({ ...itemData, id: itemId || undefined, quotation_id: quotationId });
    return this.putQuotationItem(record);
  }

  async deleteQuotationItem(itemId) {
    const client = await this.open();
    const { error } = await client.from("quotation_items").delete().eq("id", Number(itemId));
    assertSupabase(error);
  }

  async putQuotationItem(itemData) {
    const client = await this.open();
    const record = normalizeQuotationItemRecord(itemData);
    const { id, total, ...payload } = record;
    const operation = id
      ? client.from("quotation_items").update(payload).eq("id", Number(id)).select("id").single()
      : client.from("quotation_items").insert(payload).select("id").single();
    const { data, error } = await operation;
    assertSupabase(error);
    return Number(data.id);
  }

  async syncQuotationItemToBids(quotationItemId) {
    const client = await this.open();
    const { data: quotationRow, error: quotationError } = await client
      .from("quotation_items")
      .select("*")
      .eq("id", Number(quotationItemId))
      .maybeSingle();
    assertSupabase(quotationError);
    if (!quotationRow) return;
    const quotationItem = normalizeQuotationItemRecord(quotationRow);
    const { data: bids, error: bidsError } = await client
      .from("bids")
      .select("id")
      .eq("quotation_id", Number(quotationItem.quotation_id))
      .is("deleted_at", null);
    assertSupabase(bidsError);
    for (const bid of bids || []) {
      const { data: itemRows, error: itemsError } = await client
        .from("items")
        .select("*")
        .eq("bid_id", bid.id);
      assertSupabase(itemsError);
      const existing = (itemRows || [])
        .map(normalizeItemRecord)
        .find(
          (item) =>
            Number(item.quotation_item_id) === Number(quotationItem.id) || Number(item.item_number) === Number(quotationItem.item_number)
        );
      const record = quotationItemToBidItem(quotationItem, { ...existing, bid_id: bid.id });
      const operation = record.id ? client.from("items").upsert(record) : client.from("items").insert(removeEmptyId(record));
      const { error } = await operation;
      assertSupabase(error);
    }
  }
}

const store = createStore();

const SESSION_ACTIVITY_EVENTS = ["pointerdown", "keydown", "input"];
const SESSION_POLICY_CHECK_INTERVAL_MS = 60 * 1000;
const SESSION_ACTIVITY_WRITE_INTERVAL_MS = 30 * 1000;
const sessionPolicyStorageKey = `gll-session-policy-v1-${sanitizeStorageSuffix(GLL_CONFIG.storageSuffix || GLL_CONFIG.environment)}`;
let sessionPolicyTimer = null;
let lastSessionActivityWrite = 0;

function sessionPolicyLimits() {
  return {
    idleMs: Math.max(1, Number(GLL_CONFIG.sessionIdleTimeoutMinutes) || 30) * 60 * 1000,
    lifetimeMs: Math.max(1, Number(GLL_CONFIG.sessionMaxLifetimeHours) || 8) * 60 * 60 * 1000,
  };
}

function readSessionPolicy() {
  try {
    const value = JSON.parse(window.localStorage.getItem(sessionPolicyStorageKey));
    if (!value || !Number.isFinite(value.startedAt) || !Number.isFinite(value.lastActivityAt)) return null;
    return value;
  } catch {
    return null;
  }
}

function writeSessionPolicy(value) {
  window.localStorage.setItem(sessionPolicyStorageKey, JSON.stringify(value));
}

function beginSessionPolicy(email, { forceNew = false } = {}) {
  if (!store.requiresAuthenticationBeforeData) return;
  const now = Date.now();
  const current = readSessionPolicy();
  if (forceNew || !current || normalizeEmail(current.email) !== normalizeEmail(email)) {
    writeSessionPolicy({ email: normalizeEmail(email), startedAt: now, lastActivityAt: now });
    lastSessionActivityWrite = now;
  }
}

function sessionPolicyExpiration(now = Date.now()) {
  const policy = readSessionPolicy();
  if (!policy) return null;
  const { idleMs, lifetimeMs } = sessionPolicyLimits();
  if (now - policy.startedAt >= lifetimeMs) return "Sua sessão atingiu o limite de duração. Entre novamente.";
  if (now - policy.lastActivityAt >= idleMs) return "Sua sessão expirou por inatividade. Entre novamente.";
  return null;
}

function recordSessionActivity() {
  if (!appState.authenticated) return;
  const now = Date.now();
  if (now - lastSessionActivityWrite < SESSION_ACTIVITY_WRITE_INTERVAL_MS) return;
  const policy = readSessionPolicy();
  if (!policy) return;
  policy.lastActivityAt = now;
  writeSessionPolicy(policy);
  lastSessionActivityWrite = now;
}

async function enforceSessionPolicy() {
  if (!appState.authenticated) return false;
  const message = sessionPolicyExpiration();
  if (!message) return true;
  await expireSession(message);
  return false;
}

function handleSessionVisibility() {
  if (!document.hidden) enforceSessionPolicy().catch(() => resetAuthenticatedView());
}

function startSessionPolicyMonitoring() {
  stopSessionPolicyMonitoring();
  for (const eventName of SESSION_ACTIVITY_EVENTS) window.addEventListener(eventName, recordSessionActivity);
  document.addEventListener("visibilitychange", handleSessionVisibility);
  sessionPolicyTimer = setInterval(() => enforceSessionPolicy().catch(() => resetAuthenticatedView()), SESSION_POLICY_CHECK_INTERVAL_MS);
}

function stopSessionPolicyMonitoring() {
  if (sessionPolicyTimer) clearInterval(sessionPolicyTimer);
  sessionPolicyTimer = null;
  for (const eventName of SESSION_ACTIVITY_EVENTS) window.removeEventListener(eventName, recordSessionActivity);
  document.removeEventListener("visibilitychange", handleSessionVisibility);
}

async function expireSession(message) {
  try {
    if (store.requiresAuthenticationBeforeData) await store.client.auth.signOut({ scope: "local" });
  } finally {
    resetAuthenticatedView();
    refs.loginError.textContent = message;
  }
}

async function main() {
  applyEnvironmentConfig();
  populateOptions();
  bindEvents();
  if (!hasSupabaseConfig()) refs.loginEmail.value = DEFAULT_ADMIN.email;
  await store.initialize();
  if (store.requiresAuthenticationBeforeData) {
    store.client.auth.onAuthStateChange((event) => {
      // Auth callbacks run under the client's lock; do not query Supabase here.
      if (event === "SIGNED_OUT") resetAuthenticatedView();
      if (event === "SIGNED_IN") {
        setTimeout(() => {
          if (!appState.authenticated && !blockingOperationActive) {
            restoreSession().catch((error) => { refs.loginError.textContent = error.message; });
          }
        }, 0);
      }
    });
    try {
      await restoreSession();
    } catch (error) {
      refs.loginError.textContent = "Não foi possível recuperar sua sessão. Verifique a conexão e tente novamente.";
    }
  }
  if (!store.requiresAuthenticationBeforeData) {
    const seedData = await loadSeedData();
    await store.seedIfEmpty(seedData);
  }
}

function applyEnvironmentConfig() {
  document.title = `${GLL_CONFIG.appName} - ${GLL_CONFIG.label}`;
  refs.environmentLabel.textContent = GLL_CONFIG.description;
  refs.environmentBadge.textContent = GLL_CONFIG.label;
  refs.environmentBadge.dataset.environment = GLL_CONFIG.environment;
  refs.storageStatus.textContent = GLL_CONFIG.storageLabel;
  refs.sessionPolicyStatus.textContent = hasSupabaseConfig()
    ? `${GLL_CONFIG.sessionIdleTimeoutMinutes} min inativa / ${GLL_CONFIG.sessionMaxLifetimeHours} h total`
    : "Não aplicável ao modo demonstrativo";
  refs.authClientVersion.textContent = hasSupabaseConfig() ? `Supabase JS ${SUPABASE_CLIENT_VERSION}` : "Autenticação local demonstrativa";
  refs.resetDataButton.classList.toggle("hidden", hasSupabaseConfig());
  refs.loginHint.classList.toggle("hidden", hasSupabaseConfig());
  const suppliersEnabled = GLL_CONFIG.suppliersEnabled !== false;
  refs.navSuppliersButton.disabled = !suppliersEnabled;
  refs.navSuppliersButton.classList.toggle("nav-link-disabled", !suppliersEnabled);
  refs.navSuppliersButton.setAttribute("aria-disabled", String(!suppliersEnabled));
  refs.navSuppliersButton.title = suppliersEnabled ? "" : "Fornecedores temporariamente indisponível";
}

function populateOptions() {
  refs.filterStatus.innerHTML = optionList(["Todos", ...STATUS_OPTIONS]);
  refs.bidStatus.innerHTML = optionList(STATUS_OPTIONS);
  refs.bidType.innerHTML = optionList(BID_TYPE_OPTIONS);
  refs.salesUnit.innerHTML = optionList(SALES_UNIT_OPTIONS);
}

function optionList(values) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

// Wrap complete UI operations, including their data refresh, rather than individual requests.
let blockingOperationActive = false;

function withBlockingLoading(operation, message) {
  return async function (event) {
    event?.preventDefault();
    if (blockingOperationActive) return;
    blockingOperationActive = true;
    const modal = document.getElementById("blockingLoadingModal");
    const previousFocus = document.activeElement;
    try {
      document.getElementById("blockingLoadingMessage").textContent = message;
      document.documentElement.classList.add("is-loading");
      modal.showModal();
      await operation.call(this, event);
    } catch (error) {
      showToast(error.message || "Não foi possível concluir a operação. Tente novamente.");
    } finally {
      modal.close();
      document.documentElement.classList.remove("is-loading");
      blockingOperationActive = false;
      if (previousFocus?.isConnected && !previousFocus.disabled && previousFocus.getClientRects().length) {
        previousFocus.focus({ preventScroll: true });
      }
    }
  };
}

function bindEvents() {
  $("supplierForm").addEventListener("submit", withBlockingLoading(saveSupplier, "Salvando fornecedor…"));
  $("newSupplierButton").addEventListener("click", () => openSupplierModal());
  $("editSupplierButton").addEventListener("click", () => openSupplierModal(currentSupplier()));
  $("cancelSupplierButton").addEventListener("click", closeSupplierModal);
  $("closeSupplierModalButton").addEventListener("click", closeSupplierModal);
  refs.supplierModal.addEventListener("cancel", (event) => { event.preventDefault(); closeSupplierModal(); });
  $("supplierSearch").addEventListener("input", renderSuppliers);
  refs.supplierTagFilter.addEventListener("change", renderSuppliers);
  refs.supplierSort.addEventListener("change", renderSuppliers);
  refs.suppliersList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-supplier-id]");
    if (!button) return;
    appState.currentSupplierId = Number(button.dataset.supplierId);
    refs.supplierProductSearch.value = "";
    refs.supplierProductTagFilter.value = "";
    renderSuppliers();
  });
  $("newSupplierProductButton").addEventListener("click", () => openSupplierProductModal());
  $("closeSupplierProductModalButton").addEventListener("click", closeSupplierProductModal);
  $("clearSupplierProductButton").addEventListener("click", () => clearSupplierProductForm({ focus: true }));
  refs.supplierProductModal.addEventListener("cancel", (event) => { event.preventDefault(); closeSupplierProductModal(); });
  refs.supplierProductForm.addEventListener("submit", withBlockingLoading(saveSupplierProduct, "Salvando produto do fornecedor…"));
  refs.supplierProductSearch.addEventListener("input", renderSupplierProducts);
  refs.supplierProductTagFilter.addEventListener("change", renderSupplierProducts);
  refs.supplierProductsTableBody.addEventListener("click", handleSupplierProductTableClick);
  $("addSupplierProductSpecificationButton").addEventListener("click", addSupplierProductSpecification);
  refs.supplierProductSpecificationsList.addEventListener("input", updateSupplierProductSpecificationDraft);
  refs.supplierProductSpecificationsList.addEventListener("click", handleSupplierProductSpecificationAction);
  refs.deleteSupplierProductButton.addEventListener("click", deleteCurrentSupplierProduct);
  bindAutoGrowTextareas(refs.supplierProductForm);
  document.getElementById("blockingLoadingModal").addEventListener("cancel", (event) => event.preventDefault());
  refs.loginForm.addEventListener("submit", withBlockingLoading(handleLogin, "Entrando no sistema…"));
  window.addEventListener("popstate", () => {
    if (appState.authenticated) applyNavigationRoute();
  });
  refs.homeIconButton.addEventListener("click", () => setPage("home"));
  document.querySelectorAll("[data-navigation-page]").forEach((button) => {
    button.addEventListener("click", () => setPage(button.dataset.navigationPage));
  });
  document.querySelectorAll("[data-open-new]").forEach((button) => {
    button.addEventListener("click", () => clearBidForm({ openEditor: true }));
  });
  refs.viewAllBidsButton.addEventListener("click", () => setPage("bids"));
  refs.menuToggleButton.addEventListener("click", toggleMainNavigation);
  window.addEventListener("resize", updateMainNavigationState);
  refs.toggleSidebarButton.addEventListener("click", toggleSidebar);
  refs.toggleSidebarButton.addEventListener("mouseenter", previewSidebar);
  refs.toggleSidebarButton.addEventListener("mouseleave", clearSidebarPreview);
  refs.toggleSidebarButton.addEventListener("focus", previewSidebar);
  refs.toggleSidebarButton.addEventListener("blur", clearSidebarPreview);
  refs.sidebarPanel.addEventListener("click", collapseSidebarFromEmptyArea);
  refs.logoutButton.addEventListener("click", withBlockingLoading(logout, "Saindo do sistema…"));
  if (!hasSupabaseConfig()) {
    refs.resetDataButton.addEventListener("click", withBlockingLoading(resetSeedData, "Restaurando a base…"));
  }
  refs.filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderBids();
  });
  refs.clearFiltersButton.addEventListener("click", clearFilters);
  document.querySelectorAll("[data-home-status]").forEach((button) => {
    button.addEventListener("click", () => applyHomeStatusFilter(button.dataset.homeStatus));
  });
  refs.bidForm.addEventListener("submit", withBlockingLoading(saveBid, "Salvando edital…"));
  refs.bidQuotation.addEventListener("click", openBidQuotationModal);
  refs.bidQuotation.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openBidQuotationModal();
    }
  });
  refs.clearBidQuotationButton.addEventListener("click", clearBidQuotationSelection);
  refs.openPublicSessionButton.addEventListener("click", openPublicSession);
  refs.removePublicSessionLinkButton.addEventListener("click", removePublicSessionLink);
  refs.closeBidQuotationModalButton.addEventListener("click", closeBidQuotationModal);
  refs.bidQuotationModal.addEventListener("cancel", closeBidQuotationModal);
  refs.bidQuotationModal.addEventListener("click", (event) => {
    if (event.target === refs.bidQuotationModal) closeBidQuotationModal();
  });
  refs.bidQuotationFilterId.addEventListener("input", renderBidQuotationResults);
  refs.bidQuotationFilterAgency.addEventListener("input", renderBidQuotationResults);
  refs.editalAttachmentList.addEventListener("click", (event) => {
    if (!event.target.closest("[data-attachment-action]")) return;
    withBlockingLoading(handleBidAttachmentAction, "Processando arquivo…")(event);
  });
  refs.clearBidButton.addEventListener("click", () => clearBidForm({ openEditor: true }));
  refs.deleteBidButton.addEventListener("click", requestDeleteCurrentBid);
  $("cancelDeleteBidButton").addEventListener("click", () => $("deleteBidModal").close());
  $("confirmDeleteBidButton").addEventListener("click", () => {
    const modal = $("deleteBidModal");
    if (!modal.open) return;
    const bidId = modal.dataset.bidId;
    modal.close();
    withBlockingLoading(() => deleteCurrentBid(bidId), "Excluindo edital…")();
  });
  refs.itemForm.addEventListener("submit", withBlockingLoading(saveItem, "Salvando item…"));
  refs.addSupplierLinkButton.addEventListener("click", addSupplierLink);
  refs.supplierLinkInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSupplierLink();
    }
  });
  refs.clearItemButton.addEventListener("click", clearItemForm);
  refs.deleteItemButton.addEventListener("click", withBlockingLoading(deleteCurrentItem, "Excluindo item…"));
  refs.downloadBidItemsButton.addEventListener("click", downloadCurrentBidItemsCsv);
  refs.documentForm.addEventListener("submit", withBlockingLoading(saveDocument, "Salvando documento…"));
  refs.clearDocumentButton.addEventListener("click", clearDocumentForm);
  refs.deleteDocumentButton.addEventListener("click", withBlockingLoading(deleteCurrentDocument, "Excluindo documento…"));
  refs.failureForm.addEventListener("submit", withBlockingLoading(saveFailure, "Salvando registro de falha…"));
  refs.clearFailureButton.addEventListener("click", clearFailureForm);
  refs.deleteFailureButton.addEventListener("click", withBlockingLoading(deleteCurrentFailure, "Excluindo registro de falha…"));
  refs.bidStatus.addEventListener("change", handleBidStatusChange);
  refs.newQuotationButton.addEventListener("click", clearQuotationForm);
  refs.quotationsListToggle.addEventListener("click", () => setQuotationListCollapsed(!appState.quotationListCollapsed));
  refs.quotationForm.addEventListener("submit", withBlockingLoading(saveQuotation, "Salvando orçamento…"));
  refs.clearQuotationButton.addEventListener("click", clearQuotationForm);
  refs.deleteQuotationButton.addEventListener("click", withBlockingLoading(deleteCurrentQuotation, "Excluindo orçamento…"));
  refs.quotationCep.addEventListener("input", formatQuotationCepInput);
  refs.downloadQuotationItemsButton.addEventListener("click", downloadCurrentQuotationItemsCsv);
  refs.openQuotationItemModalButton.addEventListener("click", openQuotationItemModal);
  refs.closeQuotationItemModalButton.addEventListener("click", requestCloseQuotationItemModal);
  refs.quotationItemModal.addEventListener("close", () => clearQuotationItemForm());
  refs.quotationItemModal.addEventListener("cancel", (event) => {
    event.preventDefault();
    setTimeout(requestCloseQuotationItemModal, 0);
  });
  refs.quotationItemModal.addEventListener("click", (event) => {
    if (event.target === refs.quotationItemModal) requestCloseQuotationItemModal();
  });
  refs.continueEditingQuotationItemButton.addEventListener("click", () => refs.quotationItemDiscardModal.close());
  refs.discardQuotationItemChangesButton.addEventListener("click", discardQuotationItemChanges);
  bindAutoGrowTextareas(refs.quotationItemForm);
  refs.quotationItemForm.addEventListener("submit", withBlockingLoading(saveQuotationItem, "Salvando item do orçamento…"));
  refs.addQuotationItemSupplierButton.addEventListener("click", addQuotationItemSupplier);
  refs.addQuotationTechnicalSpecificationButton.addEventListener("click", addQuotationTechnicalSpecification);
  refs.quotationTechnicalSpecificationsList.addEventListener("input", updateQuotationTechnicalSpecificationDraft);
  refs.quotationTechnicalSpecificationsList.addEventListener("click", handleQuotationTechnicalSpecificationAction);
  refs.quotationItemSupplierInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addQuotationItemSupplier();
    }
  });
  refs.clearQuotationItemButton.addEventListener("click", () => clearQuotationItemForm({ focus: true }));
  refs.deleteQuotationItemButton.addEventListener("click", withBlockingLoading(deleteCurrentQuotationItem, "Excluindo item do orçamento…"));
  refs.quotationItemProfitMargin.addEventListener("input", updateQuotationValueWithMarginFromMargin);
  refs.quotationItemProfitMargin.addEventListener("focus", () => {
    refs.quotationItemProfitMargin.value = refs.quotationItemProfitMargin.value.replace("%", "");
  });
  refs.quotationItemProfitMargin.addEventListener("blur", formatQuotationProfitMarginInput);
  refs.quotationItemFinalBid.addEventListener("input", () => {
    updateQuotationFinalBidMarginIndicator();
    updateQuotationItemTotals();
  });
  refs.quotationItemSupplierCost.addEventListener("input", () => {
    updateQuotationValueWithMargin();
    updateQuotationFinalBidMarginIndicator();
    updateQuotationItemTotals();
  });
  refs.quotationItemQuantity.addEventListener("input", updateQuotationItemTotals);
  for (const input of [refs.quotationItemEstimatedValue, refs.quotationItemSupplierCost, refs.quotationItemFinalBid, refs.quotationItemMinimumBid]) {
    input.addEventListener("blur", () => {
      if (input.value.trim()) input.value = money(parseDecimal(input.value, "valor", false));
      if (input === refs.quotationItemSupplierCost) updateQuotationValueWithMargin();
      if (input === refs.quotationItemSupplierCost || input === refs.quotationItemFinalBid) updateQuotationFinalBidMarginIndicator();
      updateQuotationItemTotals();
    });
  }
  refs.userAssignmentsForm.addEventListener("submit", withBlockingLoading(saveUserAssignments, "Salvando atribuições…"));
  refs.closeUserAssignmentsButton.addEventListener("click", closeUserAssignments);
  refs.cancelUserAssignmentsButton.addEventListener("click", closeUserAssignments);
  refs.userAssignmentsModal.addEventListener("cancel", closeUserAssignments);
  refs.userSearchInput.addEventListener("input", renderUsers);
  refs.userRoleFilter.addEventListener("change", renderUsers);
  refs.itemsTabButton.addEventListener("click", () => setPage("items"));
  refs.documentsTabButton.addEventListener("click", () => setPage("documents"));
  refs.failuresTabButton.addEventListener("click", () => setPage("failures"));
  for (const input of [refs.estimatedValue, refs.supplierCost, refs.maxValue, refs.minimumBid]) {
    input.addEventListener("blur", () => {
      if (input.value.trim()) input.value = money(parseDecimal(input.value, "valor", false));
      updateItemProfit();
    });
  }
  refs.profitMargin.addEventListener("input", updateValueWithMarginFromMargin);
  refs.profitMargin.addEventListener("focus", () => {
    refs.profitMargin.value = refs.profitMargin.value.replace("%", "");
  });
  refs.profitMargin.addEventListener("blur", formatProfitMarginInput);
  refs.maxValue.addEventListener("input", updateItemProfit);
  refs.supplierCost.addEventListener("input", updateItemPricingFromCost);
  refs.requiredQuantity.addEventListener("input", updateItemProfit);
}

async function handleLogin(event) {
  event.preventDefault();
  refs.loginError.textContent = "";
  const email = refs.loginEmail.value.trim();
  const password = refs.loginPassword.value;
  try {
    const user = await store.authenticate(email, password);
    if (!user) {
      refs.loginError.textContent = "E-mail ou senha inválidos.";
      return;
    }
    beginSessionPolicy(user.email, { forceNew: true });
    await enterAuthenticatedView(user);
    showToast("Login realizado.");
  } catch (error) {
    refs.loginError.textContent = error.message;
  }
}

async function restoreSession() {
  const epoch = sessionEpoch;
  const { data, error } = await store.client.auth.getSession();
  assertSupabase(error);
  if (!data.session) return;
  beginSessionPolicy(data.session.user.email);
  const expirationMessage = sessionPolicyExpiration();
  if (expirationMessage) {
    await expireSession(expirationMessage);
    return;
  }
  const user = await store.getUser(data.session.user.email);
  if (epoch !== sessionEpoch) return;
  if (!user) {
    await logout();
    return;
  }
  await enterAuthenticatedView(user);
}

async function enterAuthenticatedView(user) {
  const epoch = ++sessionEpoch;
  appState.authenticated = true;
  appState.currentUserEmail = user.email;
  appState.currentUserAuthId = user.auth_user_id || user.email;
  appState.currentUserRole = normalizeUserRole(user.role);
  appState.currentOrganizationId = user.organization_id || user.organization?.id || null;
  appState.currentOrganizationName = user.organization?.name || "LSMS Suprimentos";
  try {
    updateAccessInterface();
    await reloadData();
    if (epoch !== sessionEpoch) return;
    refs.currentUserName.textContent = user.name || user.email;
    refs.currentUserRole.textContent = appState.currentUserRole;
    refs.loginView.classList.add("hidden");
    refs.appView.classList.remove("hidden");
    refs.loginPassword.value = "";
    clearBidForm({ history: "none" });
    clearQuotationForm();
    applyNavigationRoute({ replaceInvalid: true });
    startLiveUpdates();
    startSessionPolicyMonitoring();
  } catch (error) {
    if (epoch === sessionEpoch) resetAuthenticatedView();
    throw error;
  }
}

async function logout() {
  refs.loginError.textContent = "";
  try {
    if (store.requiresAuthenticationBeforeData) {
      const { error } = await store.client.auth.signOut({ scope: "local" });
      assertSupabase(error);
    }
  } finally {
    resetAuthenticatedView();
  }
}

function resetAuthenticatedView() {
  sessionEpoch += 1;
  stopSessionPolicyMonitoring();
  window.localStorage.removeItem(sessionPolicyStorageKey);
  stopLiveUpdates();
  appState.authenticated = false;
  appState.currentUserEmail = null;
  appState.currentUserAuthId = null;
  appState.currentUserRole = null;
  appState.currentOrganizationId = null;
  appState.currentOrganizationName = null;
  refs.appView.classList.add("hidden");
  refs.loginView.classList.remove("hidden");
  refs.loginPassword.value = "";
  refs.appView.classList.remove("mobile-nav-open");
  updateMainNavigationState();
  for (const key of DATA_KEYS) appState[key] = [];
  document.querySelectorAll("dialog[open]").forEach((dialog) => {
    if (dialog.id !== "blockingLoadingModal") dialog.close();
  });
  document.querySelectorAll("#appView form").forEach((form) => form.reset());
  refs.currentUserName.textContent = "";
  refs.currentUserRole.textContent = "";
  setSyncNotice("");
}

function isMobileNavigation() {
  return window.matchMedia("(max-width: 620px)").matches;
}

function toggleMainNavigation() {
  if (isMobileNavigation()) {
    refs.appView.classList.toggle("mobile-nav-open");
  } else {
    appState.appNavigationCollapsed = !appState.appNavigationCollapsed;
  }
  updateMainNavigationState();
}

function updateMainNavigationState() {
  const isMobile = isMobileNavigation();
  refs.appView.classList.toggle("desktop-nav-collapsed", !isMobile && appState.appNavigationCollapsed);
  if (!isMobile) refs.appView.classList.remove("mobile-nav-open");

  const isExpanded = isMobile
    ? refs.appView.classList.contains("mobile-nav-open")
    : !appState.appNavigationCollapsed;
  const actionLabel = isExpanded ? "Recolher menu" : "Expandir menu";
  refs.menuToggleButton.setAttribute("aria-expanded", String(isExpanded));
  refs.menuToggleButton.setAttribute("aria-label", actionLabel);
  refs.menuToggleButton.title = actionLabel;
  refs.appSidebar.setAttribute("aria-hidden", String(!isExpanded));
  refs.appSidebar.inert = !isExpanded;
}

function normalizeUserRole(role) {
  return role === USER_ROLES.ANALYST ? USER_ROLES.ANALYST : USER_ROLES.ADMIN;
}

function isCurrentUserAdmin() {
  return appState.currentUserRole === USER_ROLES.ADMIN;
}

function creatorName(record) {
  const storedName = String(record?.created_by_name || "").trim();
  if (storedName) return storedName;
  const creator = appState.users.find((user) => user.auth_user_id === record?.created_by);
  return creator?.name || "Usuário Removido";
}

function creatorInitials(record) {
  const parts = creatorName(record).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const initials = parts.length === 1 ? parts[0][0] : `${parts[0][0]}${parts.at(-1)[0]}`;
  return initials.toLocaleUpperCase("pt-BR");
}

function creatorTagMarkup(record) {
  const name = creatorName(record);
  return `<span class="creator-avatar" aria-hidden="true">${escapeHtml(creatorInitials(record))}</span><span class="creator-tag-copy"><span>Criado por</span><strong>${escapeHtml(name)}</strong></span>`;
}

function updateAccessInterface() {
  const showUserManagement = isCurrentUserAdmin();
  refs.navUsersButton.classList.toggle("hidden", !showUserManagement);
  refs.navUsersButton.disabled = !showUserManagement;
  refs.navUsersButton.setAttribute("aria-hidden", String(!showUserManagement));
  refs.usersOrganizationLabel.textContent = `${appState.currentOrganizationName || "Organização"} · usuários vinculados no Supabase.`;
}

async function resetSeedData() {
  if (!confirm("Restaurar a base inicial de demonstração? As alterações locais deste protótipo serão perdidas.")) return;
  const seedData = await loadSeedData();
  await store.applySeed(seedData);
  await reloadData();
  clearBidForm();
  showToast("Base inicial restaurada.");
}

const DATA_KEYS = ["bids", "items", "documents", "failureHistory", "statusHistory", "quotations", "quotationItems", "users", "suppliers", "supplierProducts"];
let sessionEpoch = 0;
let dataRequest = 0;
let liveChannel = null;
let liveTimer = null;
let liveDebounce = null;
let backgroundRefreshActive = false;

function setSyncNotice(message) {
  let notice = $("syncNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "syncNotice";
    notice.className = "sync-notice hidden";
    notice.setAttribute("role", "status");
    refs.appView.prepend(notice);
  }
  notice.textContent = message;
  notice.classList.toggle("hidden", !message);
  if (message && refs.quotationItemModal.open) refs.quotationItemFormError.textContent = message;
}

function dataSignature(rows) {
  return JSON.stringify([...rows].sort((a, b) => String(a.id ?? a.email).localeCompare(String(b.id ?? b.email))));
}

function selectedDataSignature(data) {
  return JSON.stringify([
    data.bids.find((row) => row.id === appState.currentBidId),
    data.items.find((row) => Number(row.id) === Number(appState.currentItemId)),
    data.documents.find((row) => Number(row.id) === Number(appState.currentDocumentId)),
    data.failureHistory.find((row) => Number(row.id) === Number(appState.currentFailureId)),
    data.quotations.find((row) => Number(row.id) === Number(appState.currentQuotationId)),
    data.quotationItems.find((row) => Number(row.id) === Number(appState.currentQuotationItemId)),
    data.suppliers.find((row) => Number(row.id) === Number(appState.currentSupplierId)),
    data.supplierProducts.find((row) => Number(row.id) === Number(appState.currentSupplierProductId)),
  ]);
}

function scheduleLiveRefresh() {
  if (!appState.authenticated || liveDebounce) return;
  liveDebounce = setTimeout(() => {
    liveDebounce = null;
    void refreshInBackground();
  }, 500);
}

async function refreshInBackground() {
  if (!appState.authenticated || document.hidden || blockingOperationActive || backgroundRefreshActive) return;
  const epoch = sessionEpoch;
  backgroundRefreshActive = true;
  try {
    await reloadData({ background: true });
  } catch (error) {
    // Temporary connectivity failures must not discard the current session or drafts.
    console.warn("Não foi possível atualizar os dados. Uma nova tentativa será feita automaticamente.");
  } finally {
    if (epoch === sessionEpoch) backgroundRefreshActive = false;
  }
}

function startLiveUpdates() {
  stopLiveUpdates();
  if (!store.requiresAuthenticationBeforeData) return;
  // Only invalidations travel over this channel. Actual records remain protected by RLS.
  liveChannel = store.client.channel("gll-data-updates", { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "data-changed" }, scheduleLiveRefresh)
    .subscribe((status) => { if (status === "SUBSCRIBED") scheduleLiveRefresh(); });
  liveTimer = setInterval(scheduleLiveRefresh, 15000);
  window.addEventListener("online", scheduleLiveRefresh);
  window.addEventListener("focus", scheduleLiveRefresh);
  document.addEventListener("visibilitychange", scheduleLiveRefresh);
}

function stopLiveUpdates() {
  clearInterval(liveTimer);
  clearTimeout(liveDebounce);
  liveTimer = null;
  liveDebounce = null;
  backgroundRefreshActive = false;
  if (liveChannel) void store.client.removeChannel(liveChannel);
  liveChannel = null;
  window.removeEventListener("online", scheduleLiveRefresh);
  window.removeEventListener("focus", scheduleLiveRefresh);
  document.removeEventListener("visibilitychange", scheduleLiveRefresh);
}

async function reloadData({ background = false } = {}) {
  const epoch = sessionEpoch;
  const request = ++dataRequest;
  const rows = await Promise.all([
    store.getAll("bids"), store.getAll("items"), store.getAll("documents"),
    store.getAll("failure_history"), store.getAll("quotations"), store.getAll("quotation_items"),
    store.getUsers(), store.getAll("suppliers"), store.getAll("supplier_products"), store.getAll("bid_status_history"),
  ]);
  // Discard stale responses after logout, another login, or a newer refresh.
  if (epoch !== sessionEpoch || request !== dataRequest || !appState.authenticated) return;
  if (background && blockingOperationActive) return;
  const next = {};
  next.bids = rows[0]
    .map(normalizeBidRecord)
    .filter((bid) => !bid.deleted_at)
    .sort((a, b) => parseStoredDateTime(a.session_datetime) - parseStoredDateTime(b.session_datetime));
  const visibleBidIds = new Set(next.bids.map((bid) => bid.id));
  next.items = rows[1]
    .map(normalizeItemRecord)
    .filter((item) => visibleBidIds.has(item.bid_id))
    .sort((a, b) => Number(a.item_number) - Number(b.item_number));
  next.documents = rows[2]
    .filter((documentRow) => visibleBidIds.has(documentRow.bid_id))
    .sort((a, b) => String(a.document_type).localeCompare(String(b.document_type)));
  next.failureHistory = rows[3]
    .map(normalizeFailureRecord)
    .filter((failure) => visibleBidIds.has(failure.bid_id))
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  next.statusHistory = (rows[9] || [])
    .map(normalizeStatusHistoryRecord)
    .filter((entry) => visibleBidIds.has(entry.bid_id))
    .sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at)));
  next.quotations = rows[4]
    .map(normalizeQuotationRecord)
    .filter((quotation) => !quotation.deleted_at)
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  next.quotationItems = rows[5]
    .map(normalizeQuotationItemRecord)
    .sort((a, b) => Number(a.item_number || 0) - Number(b.item_number || 0));
  next.suppliers = rows[7].map(normalizeSupplierRecord).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  next.supplierProducts = (rows[8] || []).map(normalizeSupplierProductRecord).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  next.users = rows[6].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (store.requiresAuthenticationBeforeData && !next.users.some((user) => normalizeEmail(user.email) === normalizeEmail(appState.currentUserEmail))) {
    resetAuthenticatedView();
    refs.loginError.textContent = "Seu acesso não está mais disponível. Entre novamente ou contate o administrador.";
    return;
  }
  const changed = DATA_KEYS.some((key) => dataSignature(appState[key]) !== dataSignature(next[key]));
  if (background && !changed) return;
  if (background && selectedDataSignature(appState) !== selectedDataSignature(next)) {
    setSyncNotice("O registro aberto foi alterado ou excluído em outra sessão. Seu formulário foi preservado. Reabra o registro pela lista para conferir a versão atual antes de salvar.");
  }
  Object.assign(appState, next);
  renderBids();
  renderDetails();
  renderQuotations();
  renderSuppliers();
  renderUsers();
  if (!background && changed && liveChannel) {
    void liveChannel.send({ type: "broadcast", event: "data-changed", payload: {} }).catch(() => {});
  }
}

function readNavigationRoute() {
  const params = new URLSearchParams(window.location.search);
  const page = ROUTE_PAGE_NAMES[params.get("page")] || "home";
  return {
    page,
    bidId: params.get("licitacao"),
    quotationId: params.get("orcamento"),
  };
}

function writeNavigationRoute(page, mode = "push") {
  if (mode === "none" || !appState.authenticated) return;
  const params = new URLSearchParams(window.location.search);
  params.set("page", PAGE_ROUTE_NAMES[page] || PAGE_ROUTE_NAMES.home);
  if (["items", "documents", "failures"].includes(page) && appState.currentBidId) {
    params.set("licitacao", appState.currentBidId);
  } else {
    params.delete("licitacao");
  }
  if (page === "quotations" && appState.currentQuotationId) {
    params.set("orcamento", String(appState.currentQuotationId));
  } else {
    params.delete("orcamento");
  }
  const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;
  window.history[mode === "replace" ? "replaceState" : "pushState"]({}, "", nextUrl);
}

function applyNavigationRoute(options = {}) {
  const route = readNavigationRoute();
  let routeIsValid = true;
  if (["items", "documents", "failures"].includes(route.page)) {
    const bid = appState.bids.find((row) => row.id === route.bidId);
    if (bid) loadBid(bid.id, { history: "none" });
    else routeIsValid = false;
  } else if (route.page === "quotations" && route.quotationId) {
    const quotation = appState.quotations.find((row) => Number(row.id) === Number(route.quotationId));
    if (quotation) loadQuotation(quotation.id, { history: "none", scroll: false });
    else routeIsValid = false;
  }
  setPage(routeIsValid ? route.page : "home", { history: "none" });
  if (options.replaceInvalid || !routeIsValid) writeNavigationRoute(appState.activePage, "replace");
}

function setPage(page, options = {}) {
  const detailPages = ["items", "documents", "failures"];
  if (page === "suppliers" && GLL_CONFIG.suppliersEnabled === false) page = "home";
  if (page === "users" && !isCurrentUserAdmin()) page = "home";
  if (detailPages.includes(page) && !appState.currentBidId) {
    page = "home";
  }
  if (page === "failures" && !shouldShowFailureHistory()) {
    page = appState.currentBidId ? "items" : "home";
  }
  appState.activePage = page;
  const showUsers = page === "users";
  const showSettings = page === "settings";
  const showSuppliers = page === "suppliers";
  $("suppliersPage").classList.toggle("hidden", !showSuppliers);
  const showQuotations = page === "quotations";
  const showHome = page === "home";
  const showCatalog = page === "bids";
  const showEditor = page === "edit";
  const showDetail = detailPages.includes(page);
  refs.bidsPage.classList.toggle("hidden", showUsers || showSettings || showQuotations || showSuppliers);
  refs.usersPage.classList.toggle("hidden", !showUsers);
  refs.settingsPage.classList.toggle("hidden", !showSettings);
  refs.quotationsPage.classList.toggle("hidden", !showQuotations);
  refs.homePage.classList.toggle("hidden", !showHome);
  refs.bidCatalogPage.classList.toggle("hidden", !showCatalog);
  refs.bidForm.classList.toggle("hidden", !showEditor && !showDetail);
  refs.bidWorkspaceHeader.classList.toggle("hidden", !showEditor && !showDetail);
  refs.metricsSection.classList.toggle("hidden", page !== "items");
  refs.detailsArea.classList.toggle("hidden", !showDetail);
  refs.itemsPanel.classList.toggle("hidden", page !== "items");
  refs.documentsPanel.classList.toggle("hidden", page !== "documents");
  refs.failuresPanel.classList.toggle("hidden", page !== "failures");
  refs.appView.classList.toggle("users-active", showUsers || showSettings || showQuotations || showSuppliers);
  refs.itemsTabButton.classList.toggle("active", page === "items");
  refs.documentsTabButton.classList.toggle("active", page === "documents");
  refs.failuresTabButton.classList.toggle("active", page === "failures");
  refs.failuresTabButton.classList.toggle("hidden", !shouldShowFailureHistory());
  const primaryPage = showSuppliers ? "suppliers" : showUsers ? "users" : showSettings ? "settings" : showQuotations ? "quotations" : showHome ? "home" : "bids";
  const pageLabels = { suppliers: "Fornecedores", home: "Visão geral", bids: "Licitações", quotations: "Orçamento", users: "Usuários", settings: "Configurações" };
  refs.breadcrumbLabel.textContent = pageLabels[primaryPage];
  document.querySelectorAll("[data-navigation-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.navigationPage === primaryPage);
  });
  refs.appView.classList.remove("mobile-nav-open");
  updateMainNavigationState();
  updateBidWorkspaceHeader();
  updateSidebarVisibility();
  if (showUsers) renderUsers();
  if (showQuotations) renderQuotations();
  if (showSuppliers) renderSuppliers();
  writeNavigationRoute(page, options.history || "push");
}

function updateBidWorkspaceHeader() {
  const bid = currentBid();
  refs.currentBidTitle.textContent = bidDisplayNumber(bid) || "Novo edital";
  refs.currentBidCreatorTag.innerHTML = bid ? creatorTagMarkup(bid) : "";
  refs.currentBidCreatorTag.classList.toggle("hidden", !bid);
  refs.currentBidAgency.textContent = bid?.buyer_agency || "Preencha os dados para cadastrar um novo edital.";
}

function handleBidStatusChange() {
  updateBidStatusControls();
  refs.failuresTabButton.classList.toggle("hidden", !shouldShowFailureHistory());
  renderMetrics(currentItems());
  renderItems(currentItems());
  if (appState.activePage === "failures" && !shouldShowFailureHistory()) setPage("items");
}

function allowedBidStatusTargets(status) {
  return BID_STATUS_TRANSITIONS[status] || [];
}

function validateBidStatusTransition(fromStatus, toStatus, reason) {
  if (fromStatus === toStatus) return;
  if (!allowedBidStatusTargets(fromStatus).includes(toStatus)) {
    throw new Error(`Não é permitido alterar o status de ${statusDisplay(fromStatus)} para ${statusDisplay(toStatus)}.`);
  }
  if (!String(reason || "").trim()) throw new Error("Informe o motivo da alteração de status.");
}

function updateBidStatusControls() {
  const bid = currentBid();
  const statusChanged = Boolean(bid && refs.bidStatus.value !== bid.status);
  for (const option of refs.bidStatus.options) {
    option.disabled = Boolean(bid) && option.value !== bid.status && !allowedBidStatusTargets(bid.status).includes(option.value);
  }
  refs.bidStatusReasonField.classList.toggle("hidden", !statusChanged);
  refs.bidStatusReason.required = statusChanged;
  if (!statusChanged) refs.bidStatusReason.value = "";
}

function shouldShowFailureHistory() {
  return Boolean(appState.currentBidId) && refs.bidStatus.value === "Desclassificado";
}

function shouldUseWonItems() {
  return Boolean(appState.currentBidId) && WON_ITEM_STATUSES.includes(refs.bidStatus.value);
}

function isCurrentBidReadOnly() {
  return currentBid()?.status === FINAL_BID_STATUS;
}

function guardCurrentBidReadOnly(errorElement = refs.bidFormError) {
  if (!isCurrentBidReadOnly()) return false;
  const message = "Este edital está faturado e disponível apenas para visualização.";
  if (errorElement) errorElement.textContent = message;
  showToast(message);
  return true;
}

function shouldCalculateWonItemsTotal(status) {
  return WON_ITEM_TOTAL_STATUSES.includes(status);
}

function applyHomeStatusFilter(status) {
  refs.filterStatus.value = status || "Todos";
  setPage("bids");
  renderBids();
}

function toggleSidebar() {
  appState.sidebarCollapsed = !appState.sidebarCollapsed;
  clearSidebarPreview();
  updateSidebarVisibility();
}

function previewSidebar() {
  if (!appState.sidebarCollapsed || appState.activePage === "users") return;
  refs.bidsPage.classList.add("sidebar-previewing");
}

function clearSidebarPreview() {
  refs.bidsPage.classList.remove("sidebar-previewing");
}

function collapseSidebarFromEmptyArea(event) {
  if (event.target !== refs.sidebarPanel || appState.activePage === "users" || appState.sidebarCollapsed) return;
  appState.sidebarCollapsed = true;
  updateSidebarVisibility();
}

function updateSidebarVisibility() {
  refs.bidsPage.classList.remove("sidebar-hidden", "sidebar-previewing");
  refs.appView.classList.remove("sidebar-collapsed");
  refs.toggleSidebarButton.classList.add("hidden");
}

function renderBids() {
  renderHomeSummary();
  const agencyFilter = refs.filterAgency.value.trim().toLowerCase();
  const dateFilter = refs.filterDate.value;
  const statusFilter = refs.filterStatus.value;
  const rows = appState.bids.filter((bid) => {
    const matchesAgency = !agencyFilter || String(bid.buyer_agency || "").toLowerCase().includes(agencyFilter);
    const matchesDate = !dateFilter || toDateInputValue(bid.session_datetime) === dateFilter;
    const matchesStatus = statusFilter === "Todos" || bid.status === statusFilter;
    return matchesAgency && matchesDate && matchesStatus;
  });

  if (!rows.length) {
    refs.bidList.innerHTML = `<tr><td colspan="8" class="empty-state">Nenhuma licitação encontrada.</td></tr>`;
    return;
  }

  refs.bidList.innerHTML = rows
    .map((bid) => {
      const summary = calculateBidSummary(bid.id);
      const active = bid.id === appState.currentBidId ? " active" : "";
      return `
        <tr class="selectable bid-row${active}" data-bid-id="${escapeHtml(bid.id)}" tabindex="0">
          <td><div class="bid-number-cell"><strong class="table-link">${escapeHtml(bidDisplayNumber(bid))}</strong><span class="creator-tag compact">${creatorTagMarkup(bid)}</span></div></td>
          <td>${escapeHtml(bid.buyer_agency || "")}</td>
          <td>${formatDateTime(bid.session_datetime)}</td>
          <td>${escapeHtml(bid.bid_type || "")}</td>
          <td><span class="status-pill ${statusBadgeClass(bid.status)}">${escapeHtml(statusDisplay(bid.status))}</span></td>
          <td class="numeric">${summary.itemCount}</td>
          <td class="numeric"><strong>${money(summary.totalFinal)}</strong></td>
          <td><button class="icon-button row-action" type="button" aria-label="Abrir ${escapeHtml(bidDisplayNumber(bid))}">→</button></td>
        </tr>
      `;
    })
    .join("");

  refs.bidList.querySelectorAll("[data-bid-id]").forEach((row) => {
    row.addEventListener("click", () => loadBid(row.dataset.bidId));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") loadBid(row.dataset.bidId);
    });
  });
}

function clearFilters() {
  refs.filterAgency.value = "";
  refs.filterDate.value = "";
  refs.filterStatus.value = "Todos";
  renderBids();
}

function openBidQuotationModal() {
  refs.bidQuotationFilterId.value = "";
  refs.bidQuotationFilterAgency.value = "";
  renderBidQuotationResults();
  refs.bidQuotationModal.showModal();
  requestAnimationFrame(() => refs.bidQuotationFilterId.focus());
}

function closeBidQuotationModal(event) {
  event?.preventDefault();
  if (refs.bidQuotationModal.open) refs.bidQuotationModal.close();
}

function availableBidQuotations(quotations, bids) {
  const linkedQuotationIds = new Set(
    bids
      .map((bid) => Number(bid.quotation_id))
      .filter((quotationId) => Number.isFinite(quotationId) && quotationId > 0),
  );
  return quotations.filter((quotation) => !linkedQuotationIds.has(Number(quotation.id)));
}

function renderBidQuotationResults() {
  const idFilter = refs.bidQuotationFilterId.value.trim().toLowerCase();
  const agencyFilter = refs.bidQuotationFilterAgency.value.trim().toLowerCase();
  const quotations = availableBidQuotations(appState.quotations, appState.bids).filter((quotation) => {
    const matchesId = !idFilter || String(quotation.id).toLowerCase().includes(idFilter);
    const matchesAgency = !agencyFilter || String(quotation.agency || "").toLowerCase().includes(agencyFilter);
    return matchesId && matchesAgency;
  });
  if (!quotations.length) {
    refs.bidQuotationResultsBody.innerHTML = `<tr><td colspan="4"><div class="empty-state compact-empty">Nenhum orçamento encontrado.</div></td></tr>`;
    return;
  }
  refs.bidQuotationResultsBody.innerHTML = quotations
    .map((quotation) => {
      const selected = Number(quotation.id) === Number(appState.selectedBidQuotationId) ? " selected" : "";
      return `<tr class="selectable${selected}" data-select-bid-quotation="${quotation.id}" tabindex="0">
        <td><strong>${escapeHtml(quotation.id)}</strong></td>
        <td>${escapeHtml(quotation.agency || "—")}</td>
        <td>${escapeHtml(quotation.edital || "—")}</td>
        <td><button class="text-action" type="button">Selecionar</button></td>
      </tr>`;
    })
    .join("");
  refs.bidQuotationResultsBody.querySelectorAll("[data-select-bid-quotation]").forEach((row) => {
    const select = () => selectBidQuotation(Number(row.dataset.selectBidQuotation));
    row.addEventListener("click", select);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });
}

function selectBidQuotation(quotationId) {
  appState.selectedBidQuotationId = Number(quotationId);
  renderBidQuotationSelection();
  closeBidQuotationModal();
}

function clearBidQuotationSelection() {
  appState.selectedBidQuotationId = null;
  renderBidQuotationSelection();
}

function renderBidQuotationSelection() {
  const quotation = appState.quotations.find((row) => Number(row.id) === Number(appState.selectedBidQuotationId));
  refs.bidQuotation.value = quotation ? `#${quotation.id} · ${quotation.agency || quotation.edital}` : "";
  refs.bidQuotation.title = quotation ? `Orçamento #${quotation.id} — ${quotation.agency || quotation.edital}` : "Selecionar orçamento";
  refs.clearBidQuotationButton.classList.toggle("hidden", !quotation);
}

function loadBid(bidId, options = {}) {
  const bid = appState.bids.find((row) => row.id === bidId);
  if (!bid) return;
  setSyncNotice("");
  appState.currentBidId = bid.id;
  appState.originalBidId = bid.id;
  appState.selectedBidQuotationId = bid.quotation_id;
  refs.bidId.value = bidDisplayNumber(bid);
  refs.buyerAgency.value = bid.buyer_agency || "";
  refs.sessionDatetime.value = toDateTimeInputValue(bid.session_datetime);
  refs.proposalDeadline.value = toDateTimeInputValue(bid.proposal_deadline);
  refs.deliveryPlace.value = bid.delivery_place || "";
  refs.publicSessionLink.value = bid.public_session_link || "";
  refs.bidType.value = bid.bid_type || BID_TYPE_OPTIONS[0];
  refs.bidStatus.value = bid.status || STATUS_OPTIONS[0];
  refs.bidStatusReason.value = "";
  updateBidStatusControls();
  renderBidQuotationSelection();
  refs.editalFile.value = "";
  renderBidAttachment(bid);
  renderPublicSessionLink();
  refs.selectedBidLabel.textContent = bidDisplayNumber(bid);
  refs.bidFormError.textContent = "";
  clearItemForm();
  clearDocumentForm();
  clearFailureForm();
  renderBids();
  renderDetails();
  if (["home", "bids", "edit"].includes(appState.activePage)) setPage("items", { history: options.history });
}

function renderHomeSummary() {
  const counts = appState.bids.reduce(
    (acc, bid) => {
      acc.total += 1;
      if (bid.status === "Em Analise") acc.analysis += 1;
      if (bid.status === "Descartada") acc.discarded += 1;
      if (bid.status === "Aprovada") acc.approved += 1;
      if (bid.status === "Faturado") acc.billed += 1;
      if (bid.status === "Desclassificado") acc.disqualified += 1;
      if (bid.status === "Disputada") acc.disputed += 1;
      return acc;
    },
    { total: 0, analysis: 0, discarded: 0, approved: 0, billed: 0, disqualified: 0, disputed: 0 }
  );
  refs.homeTotalBids.textContent = String(counts.total);
  refs.homeAnalysisBids.textContent = String(counts.analysis);
  refs.homeDiscardedBids.textContent = String(counts.discarded);
  refs.homeApprovedBids.textContent = String(counts.approved);
  refs.homeBilledBids.textContent = String(counts.billed);
  refs.homeDisqualifiedBids.textContent = String(counts.disqualified);
  refs.homeDisputedBids.textContent = String(counts.disputed);
  document.querySelectorAll("[data-home-status]").forEach((button) => {
    button.classList.toggle("active", refs.filterStatus.value === button.dataset.homeStatus);
  });

  const upcoming = appState.bids
    .filter((bid) => parseStoredDateTime(bid.session_datetime).getTime() >= Date.now() - 86400000)
    .sort((a, b) => parseStoredDateTime(a.session_datetime) - parseStoredDateTime(b.session_datetime))
    .slice(0, 4);
  refs.upcomingBidsList.innerHTML = upcoming.length
    ? upcoming.map((bid) => {
        const date = parseStoredDateTime(bid.session_datetime);
        const dateParts = zonedDateTimeParts(date);
        return `<button class="timeline-item" type="button" data-upcoming-bid="${escapeHtml(bid.id)}">
          <span class="date-box"><strong>${dateParts.day}</strong><small>${dateParts.monthShort.toUpperCase()}</small></span>
          <span class="timeline-copy"><span class="bid-title-line"><strong>${escapeHtml(bidDisplayNumber(bid))}</strong><span class="creator-tag compact">${creatorTagMarkup(bid)}</span></span><span>${escapeHtml(bid.buyer_agency || "")}</span><small>${dateParts.time} • ${escapeHtml(bid.bid_type || "")}</small></span>
          <span class="status-pill ${statusBadgeClass(bid.status)}">${escapeHtml(statusDisplay(bid.status))}</span>
        </button>`;
      }).join("")
    : `<div class="empty-state compact-empty">Nenhuma sessão futura cadastrada.</div>`;
  refs.upcomingBidsList.querySelectorAll("[data-upcoming-bid]").forEach((button) => {
    button.addEventListener("click", () => loadBid(button.dataset.upcomingBid));
  });

  const pending = appState.documents
    .filter((document) => !document.has_document)
    .slice(0, 5);
  refs.pendingDocumentsList.innerHTML = pending.length
    ? pending.map((document) => {
        const bid = appState.bids.find((row) => row.id === document.bid_id);
        return `<button class="pending-item" type="button" data-pending-bid="${escapeHtml(document.bid_id)}"><span class="pending-icon">!</span><span><strong>${escapeHtml(document.document_type || "Documento")}</strong><small>${escapeHtml(bidDisplayNumber(bid) || document.bid_id || "")}</small></span></button>`;
      }).join("")
    : `<div class="empty-state compact-empty">Nenhuma pendência documental.</div>`;
  refs.pendingDocumentsList.querySelectorAll("[data-pending-bid]").forEach((button) => {
    button.addEventListener("click", () => {
      loadBid(button.dataset.pendingBid);
      setPage("documents");
    });
  });
}

function clearBidForm(options = {}) {
  appState.currentBidId = null;
  appState.originalBidId = null;
  appState.selectedBidQuotationId = null;
  appState.currentFailureId = null;
  refs.bidForm.reset();
  renderBidQuotationSelection();
  renderBidAttachment(null);
  renderPublicSessionLink();
  refs.bidType.value = BID_TYPE_OPTIONS[0];
  refs.bidStatus.value = STATUS_OPTIONS[0];
  refs.bidStatusReason.value = "";
  updateBidStatusControls();
  refs.selectedBidLabel.textContent = "Novo edital";
  refs.bidFormError.textContent = "";
  clearItemForm();
  clearDocumentForm();
  clearFailureForm();
  renderBids();
  renderDetails();
  setPage(options.openEditor ? "edit" : "home", { history: options.history });
}

async function saveBid(event) {
  event.preventDefault();
  refs.bidFormError.textContent = "";
  try {
    const data = collectBidData();
    const previousBid = appState.bids.find((bid) => bid.id === appState.originalBidId);
    const files = Array.from(refs.editalFile.files || []);
    validateEditalFiles(files, normalizeBidAttachments(previousBid).length);
    const statusReason = refs.bidStatusReason.value.trim();
    if (previousBid) validateBidStatusTransition(previousBid.status, data.status, statusReason);
    await store.saveBid(data, appState.originalBidId, statusReason);
    if (files.length) await store.saveBidAttachments(data.id, files);
    appState.currentBidId = data.id;
    appState.originalBidId = data.id;
    await reloadData();
    loadBid(data.id);
    showToast("Edital salvo.");
  } catch (error) {
    refs.bidFormError.textContent = error.message;
  }
}

function validateEditalFiles(files, existingCount = 0) {
  if (existingCount + files.length > MAX_EDITAL_FILES) {
    throw new Error(`Cada edital pode ter no máximo ${MAX_EDITAL_FILES} arquivos anexados.`);
  }
  for (const file of files) {
    if (file.size > MAX_EDITAL_FILE_SIZE) throw new Error(`O arquivo ${file.name || "selecionado"} deve ter no máximo 20 MB.`);
    if (!file.name.trim()) throw new Error("Selecione arquivos válidos para o edital.");
  }
}

function renderBidAttachment(bid) {
  const attachments = normalizeBidAttachments(bid);
  const remaining = Math.max(0, MAX_EDITAL_FILES - attachments.length);
  const remainingMessage = remaining === 1
    ? "Você ainda pode anexar mais 1 arquivo."
    : `Você ainda pode anexar mais ${remaining} arquivos.`;
  refs.editalAttachmentHelp.textContent = attachments.length
    ? `${attachments.length} de ${MAX_EDITAL_FILES} arquivos anexados. ${remaining ? remainingMessage : "Limite atingido."}`
    : `Envie até ${MAX_EDITAL_FILES} arquivos, com no máximo 20 MB cada.`;
  refs.editalFile.disabled = attachments.length >= MAX_EDITAL_FILES;
  refs.editalAttachmentList.innerHTML = attachments.length
    ? attachments.map((attachment, index) => `
      <div class="attachment-panel">
        <span><strong>${escapeHtml(attachment.name)}</strong><small>${formatFileSize(attachment.size)}</small></span>
        <span class="attachment-actions">
          <button class="quiet-action compact-action" type="button" data-attachment-action="download" data-attachment-index="${index}">Baixar</button>
          <button class="danger-action compact-action" type="button" data-attachment-action="delete" data-attachment-index="${index}">Remover</button>
        </span>
      </div>`).join("")
    : `<div class="empty-state compact-empty">Nenhum arquivo anexado.</div>`;
}

function renderPublicSessionLink() {
  const hasLink = Boolean(normalizeUrlValue(refs.publicSessionLink.value));
  refs.publicSessionLinkInputGroup.classList.toggle("hidden", hasLink);
  refs.publicSessionLinkPanel.classList.toggle("hidden", !hasLink);
}

function openPublicSession() {
  const link = normalizeUrlValue(refs.publicSessionLink.value);
  if (!link) {
    refs.bidFormError.textContent = "Cadastre um link válido para a sessão pública.";
    renderPublicSessionLink();
    return;
  }
  window.open(link, "_blank", "noopener,noreferrer");
}

function removePublicSessionLink() {
  refs.publicSessionLink.value = "";
  renderPublicSessionLink();
  refs.publicSessionLink.focus();
  showToast("Link removido. Salve o edital para confirmar.");
}

async function handleBidAttachmentAction(event) {
  refs.bidFormError.textContent = "";
  const button = event.target.closest("[data-attachment-action]");
  if (!button) return;
  const bid = appState.bids.find((row) => row.id === appState.currentBidId);
  const attachment = normalizeBidAttachments(bid)[Number(button.dataset.attachmentIndex)];
  if (!attachment) {
    refs.bidFormError.textContent = "Arquivo do edital não encontrado.";
    return;
  }
  if (button.dataset.attachmentAction === "delete") {
    if (guardCurrentBidReadOnly()) return;
    if (!window.confirm(`Remover o arquivo ${attachment.name}?`)) return;
    await store.deleteBidAttachment(bid.id, attachment.path);
    await reloadData();
    loadBid(bid.id);
    showToast("Arquivo removido.");
    return;
  }

  button.disabled = true;
  try {
    const blob = await store.downloadBidAttachment(attachment);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = attachment.name || "edital";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    showToast("Download do edital iniciado.");
  } catch (error) {
    refs.bidFormError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function downloadCurrentBidItemsCsv() {
  const bid = currentBid();
  if (!bid) {
    showToast("Selecione um edital para baixar os itens.");
    return;
  }
  const rows = sortItemsForCsv(currentItems()).map((item) => {
    const { manufacturer, model } = splitBrandModel(item.brand_model);
    return [
      item.item_number,
      item.name,
      model,
      manufacturer,
      item.technical_registration_text || item.description,
      money(item.max_acceptable_value),
      formatSupplierLinksForCsv(item.supplier_links),
    ];
  });
  downloadItemsCsv(rows, `itens-edital-${sanitizeStorageFileName(bidDisplayNumber(bid))}.csv`);
}

function downloadCurrentQuotationItemsCsv() {
  const quotation = currentQuotation();
  if (!quotation) {
    showToast("Selecione um orçamento para baixar os itens.");
    return;
  }
  const rows = sortItemsForCsv(currentQuotationItems()).map((item) => [
    item.item_number,
    item.description,
    item.model,
    item.manufacturer,
    item.technical_text,
    money(item.final_bid),
    formatSupplierLinksForCsv(item.supplier_links),
  ]);
  const identifier = sanitizeStorageFileName(quotation.edital || quotation.id);
  downloadItemsCsv(rows, `itens-orcamento-${identifier}.csv`);
}

function sortItemsForCsv(items) {
  return [...items].sort((first, second) => {
    const numberDifference = Number(first.item_number || 0) - Number(second.item_number || 0);
    return numberDifference || Number(first.id || 0) - Number(second.id || 0);
  });
}

function formatSupplierLinksForCsv(value) {
  return normalizeSupplierLinks(value).join(" | ");
}

function downloadItemsCsv(rows, fileName) {
  const headers = ["ITEM", "DESCRIÇÃO", "MODELO", "MARCA/FABRICANTE", "TEXTO TÉCNICO", "VALOR FINAL", "LINK'S DO FORNECEDOR"];
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsvCell).join(";")).join("\r\n")}\r\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  showToast(`Download iniciado: ${rows.length} ${rows.length === 1 ? "item" : "itens"}.`);
}

function escapeCsvCell(value) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n");
  const safeValue = /^[=+\-@]/.test(normalized.trimStart()) ? `'${normalized}` : normalized;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function collectBidData() {
  if (!refs.bidId.value.trim()) throw new Error("Preencha o N° do Edital.");
  if (!refs.buyerAgency.value.trim()) throw new Error("Preencha o Órgão Comprador.");
  if (!refs.sessionDatetime.value) throw new Error("Preencha a Data e Hora da Sessão.");
  const publicSessionLink = refs.publicSessionLink.value.trim();
  const normalizedPublicSessionLink = normalizeUrlValue(publicSessionLink);
  if (publicSessionLink && !normalizedPublicSessionLink) throw new Error("Informe um Link da Sessão Pública válido.");
  return {
    id: appState.originalBidId || crypto.randomUUID(),
    edital_number: refs.bidId.value.trim(),
    buyer_agency: refs.buyerAgency.value.trim(),
    session_datetime: fromDateTimeInputValue(refs.sessionDatetime.value),
    delivery_place: refs.deliveryPlace.value.trim(),
    bid_type: refs.bidType.value,
    public_session_link: normalizedPublicSessionLink,
    proposal_deadline: fromDateTimeInputValue(refs.proposalDeadline.value),
    status: refs.bidStatus.value,
    quotation_id: appState.selectedBidQuotationId || null,
  };
}

function requestDeleteCurrentBid() {
  if (!appState.currentBidId) {
    showToast("Selecione um edital.");
    return;
  }
  if (guardCurrentBidReadOnly()) return;
  const modal = $("deleteBidModal");
  modal.dataset.bidId = appState.currentBidId;
  $("deleteBidModalDescription").textContent = `Deseja excluir o edital ${bidDisplayNumber(currentBid())}? Ele deixará de aparecer no sistema, mas seus dados permanecerão preservados.`;
  modal.showModal();
}

async function deleteCurrentBid(bidId) {
  if (!bidId) return;
  await store.deleteBid(bidId);
  await reloadData();
  clearBidForm();
  showToast("Edital excluído da visualização. Os dados foram preservados.");
}

function renderDetails() {
  const items = currentItems();
  const documents = currentDocuments();
  const failures = currentFailures();
  renderMetrics(items);
  renderItems(items);
  renderDocuments(documents);
  renderFailures(failures);
  renderBidStatusHistory();
  updateBidStatusControls();
  const hasBid = Boolean(appState.currentBidId);
  const readOnly = isCurrentBidReadOnly();
  refs.bidForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
    const remainsAvailable = el.id === "clearBidButton" || el.dataset.attachmentAction === "download" || el.id === "bidStatus" || el.type === "submit";
    if (el === refs.editalFile) {
      el.disabled = readOnly || normalizeBidAttachments(currentBid()).length >= MAX_EDITAL_FILES;
    } else if (!remainsAvailable) {
      el.disabled = readOnly;
    }
  });
  refs.downloadBidItemsButton.disabled = !hasBid;
  refs.failuresTabButton.classList.toggle("hidden", !shouldShowFailureHistory());
  refs.deleteBidButton.disabled = !hasBid || readOnly;
  refs.itemForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
    if (!["clearItemButton", "downloadBidItemsButton"].includes(el.id)) el.disabled = !hasBid || readOnly;
  });
  refs.documentForm.querySelectorAll("input, textarea, button").forEach((el) => {
    if (el.id !== "clearDocumentButton") el.disabled = !hasBid || readOnly;
  });
  refs.failureForm.querySelectorAll("input, textarea, button").forEach((el) => {
    if (el.id !== "clearFailureButton") el.disabled = !hasBid || readOnly;
  });
}

function renderBidStatusHistory() {
  const entries = appState.statusHistory.filter((entry) => entry.bid_id === appState.currentBidId);
  refs.bidStatusHistory.classList.toggle("hidden", !appState.currentBidId);
  if (!appState.currentBidId) {
    refs.bidStatusHistory.innerHTML = "";
    return;
  }
  refs.bidStatusHistory.innerHTML = `
    <h3>Histórico de status</h3>
    <div class="status-history-list">
      ${entries.length ? entries.map((entry) => `
        <article class="status-history-item">
          <div class="status-history-transition">
            <span class="status-pill ${statusBadgeClass(entry.from_status)}">${escapeHtml(statusDisplay(entry.from_status))}</span>
            <span aria-hidden="true">→</span>
            <span class="status-pill ${statusBadgeClass(entry.to_status)}">${escapeHtml(statusDisplay(entry.to_status))}</span>
          </div>
          <p>${escapeHtml(entry.reason)}</p>
          <small>${escapeHtml(entry.changed_by_name || entry.changed_by_email || "Usuário")} · ${escapeHtml(formatDateTime(entry.changed_at))}</small>
        </article>`).join("") : '<div class="empty-state compact-empty">Nenhuma alteração de status registrada.</div>'}
    </div>`;
}

function renderMetrics(items) {
  const itemsForTotals = shouldCalculateWonItemsTotal(refs.bidStatus.value)
    ? items.filter((item) => Boolean(Number(item.is_won)))
    : items;
  const missingProfitMarginMessage = "Cadastre o valor de custo e o valor final de todos os itens deste edital para calcular a margem de lucro.";
  const hasCompleteProfitValues = itemsForTotals.length > 0 && itemsForTotals.every(
    (item) => Number(item.max_acceptable_value) && Number(item.supplier_cost)
  );
  const totals = itemsForTotals.reduce(
    (acc, item) => {
      const quantity = Number(item.required_quantity || 0);
      acc.final = roundMoney(acc.final + calculateLineTotal(item.max_acceptable_value, quantity));
      acc.cost = roundMoney(acc.cost + calculateLineTotal(item.supplier_cost, quantity));
      if (Number(item.max_acceptable_value) && Number(item.supplier_cost)) {
        acc.profit = roundMoney(acc.profit + calculateItemProfit(item.max_acceptable_value, item.supplier_cost, item.required_quantity));
      }
      return acc;
    },
    { final: 0, cost: 0, profit: 0 }
  );
  refs.metricItemCount.textContent = String(items.length);
  refs.metricMargin.textContent = money(totals.final);
  refs.metricTotalProfit.textContent = money(totals.profit);
  if (hasCompleteProfitValues && totals.final) {
    refs.metricTotalProfitMargin.textContent = formatProfitMargin(calculateProfitMargin(totals.final, totals.cost));
    refs.metricTotalProfitMargin.removeAttribute("title");
  } else {
    refs.metricTotalProfitMargin.textContent = "-";
    refs.metricTotalProfitMargin.title = missingProfitMarginMessage;
  }
  refs.metricMargin.className = "";
  refs.metricTotalProfit.className = "";
  refs.metricTotalProfitMargin.className = "";
}

function renderItems(items) {
  const showWonItems = shouldUseWonItems();
  refs.itemWonHeader.classList.toggle("hidden", !showWonItems);
  refs.itemWonHeader.closest(".items-table")?.classList.toggle("shows-item-won", showWonItems);
  if (!items.length) {
    refs.itemsTableBody.innerHTML = `<tr><td colspan="${showWonItems ? 12 : 11}">Nenhum item cadastrado.</td></tr>`;
    return;
  }
  refs.itemsTableBody.innerHTML = items
    .map((item) => {
      const selected = Number(item.id) === Number(appState.currentItemId) ? " selected" : "";
      const won = Boolean(Number(item.is_won));
      const description = item.name || "";
      const descriptionTooltip = description ? ` title="${escapeHtml(description)}"` : "";
      const { manufacturer, model } = splitBrandModel(item.brand_model);
      const wonClass = showWonItems && won ? " item-won" : "";
      const wonCell = showWonItems
        ? `<td class="item-won-cell"><input class="item-won-checkbox" type="checkbox" data-item-won="${item.id}" aria-label="Marcar item ${item.item_number} como vencido" ${won ? "checked" : ""} ${isCurrentBidReadOnly() ? "disabled" : ""} /></td>`
        : "";
      return `
        <tr class="selectable${selected}${wonClass}" data-item-id="${item.id}">
          <td>${item.item_number}</td>
          <td><strong class="table-item-description"${descriptionTooltip}>${escapeHtml(description || "—")}</strong>${model ? `<small class="table-secondary">Modelo: ${escapeHtml(model)}</small>` : ""}</td>
          <td>${escapeHtml(manufacturer || "—")}</td>
          <td>${escapeHtml(item.sales_unit || "")}</td>
          <td class="numeric">${item.required_quantity}</td>
          <td class="numeric">${money(item.estimated_value)}</td>
          <td class="numeric">${money(item.supplier_cost)}</td>
          <td class="numeric">${money(item.max_acceptable_value)}</td>
          <td class="numeric">${formatStoredProfitMargin(item)}</td>
          <td class="numeric">${money(item.minimum_bid)}</td>
          <td class="numeric">${formatStoredItemProfit(item)}</td>
          ${wonCell}
        </tr>
      `;
    })
    .join("");

  refs.itemsTableBody.querySelectorAll("[data-item-id]").forEach((row) => {
    row.addEventListener("click", () => loadItem(Number(row.dataset.itemId)));
  });
  refs.itemsTableBody.querySelectorAll("[data-item-won]").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", withBlockingLoading(() => setItemWon(Number(checkbox.dataset.itemWon), checkbox.checked, checkbox), "Atualizando item…"));
  });
}

async function setItemWon(itemId, isWon, checkbox) {
  if (guardCurrentBidReadOnly(refs.itemFormError)) return;
  checkbox.disabled = true;
  refs.itemFormError.textContent = "";
  try {
    await store.setItemWon(itemId, isWon);
    await reloadData();
    showToast(isWon ? "Item marcado como vencido." : "Marcação de item vencido removida.");
  } catch (error) {
    checkbox.checked = !isWon;
    checkbox.disabled = false;
    refs.itemFormError.textContent = error.message;
  }
}

function formatStoredItemProfit(item) {
  if (!Number(item.max_acceptable_value) || !Number(item.supplier_cost)) return "";
  return money(calculateItemProfit(item.max_acceptable_value, item.supplier_cost, item.required_quantity));
}

function formatStoredProfitMargin(item) {
  if (item.profit_margin === null || item.profit_margin === undefined || item.profit_margin === "") return "";
  return formatProfitMargin(item.profit_margin);
}

function calculateItemProfit(finalValue, costValue, quantity) {
  return roundMoney((Number(finalValue) - Number(costValue)) * Number(quantity || 0));
}

function calculateProfitMargin(finalValue, costValue) {
  const final = Number(finalValue);
  const cost = Number(costValue);
  if (!final) return null;
  return roundMargin(((final - cost) / final) * 100);
}

function calculateValueWithMargin(costValue, marginValue) {
  const marginFactor = 1 - Number(marginValue) / 100;
  if (!Number.isFinite(marginFactor) || marginFactor <= 0) return null;
  return roundMoney(Number(costValue) / marginFactor);
}

function loadItem(itemId) {
  const item = currentItems().find((row) => Number(row.id) === Number(itemId));
  if (!item) return;
  appState.currentItemId = item.id;
  refs.itemNumber.value = item.item_number;
  refs.itemName.value = item.name || "";
  refs.salesUnit.value = item.sales_unit || SALES_UNIT_OPTIONS[0];
  refs.estimatedValue.value = item.estimated_value ? money(item.estimated_value) : "";
  refs.supplierCost.value = item.supplier_cost ? money(item.supplier_cost) : "";
  refs.maxValue.value = item.max_acceptable_value ? money(item.max_acceptable_value) : "";
  refs.minimumBid.value = item.minimum_bid ? money(item.minimum_bid) : "";
  refs.requiredQuantity.value = item.required_quantity ? item.required_quantity : "";
  refs.profitMargin.value = item.profit_margin === null ? "" : formatProfitMargin(item.profit_margin);
  updateValueWithMargin();
  updateItemProfit();
  refs.brandModel.value = item.brand_model || "";
  refs.technicalRegistrationText.value = item.technical_registration_text || item.description || "";
  appState.supplierLinksDraft = [...item.supplier_links];
  renderSupplierLinks();
  refs.selectedItemLabel.textContent = `Item ${item.item_number}`;
  refs.itemFormError.textContent = "";
  renderItems(currentItems());
}

function clearItemForm() {
  appState.currentItemId = null;
  refs.itemForm.reset();
  refs.salesUnit.value = SALES_UNIT_OPTIONS[0];
  appState.supplierLinksDraft = [];
  renderSupplierLinks();
  updateValueWithMargin();
  updateItemProfit();
  refs.selectedItemLabel.textContent = "Novo item";
  refs.itemFormError.textContent = "";
  renderItems(currentItems());
}

function addSupplierLink() {
  if (guardCurrentBidReadOnly(refs.itemFormError)) return;
  refs.itemFormError.textContent = "";
  const link = normalizeSupplierEntry(refs.supplierLinkInput.value);
  if (!link) {
    refs.itemFormError.textContent = "Informe um link ou nome de fornecedor.";
    return;
  }
  if (appState.supplierLinksDraft.some((currentLink) => currentLink.toLowerCase() === link.toLowerCase())) {
    refs.itemFormError.textContent = "Este fornecedor já foi cadastrado.";
    return;
  }
  appState.supplierLinksDraft.push(link);
  refs.supplierLinkInput.value = "";
  renderSupplierLinks();
  refs.supplierLinkInput.focus();
}

function removeSupplierLink(index) {
  if (guardCurrentBidReadOnly(refs.itemFormError)) return;
  appState.supplierLinksDraft.splice(index, 1);
  renderSupplierLinks();
}

function renderSupplierLinks() {
  if (!appState.supplierLinksDraft.length) {
    refs.supplierLinksList.innerHTML = `<span class="supplier-links-empty">Nenhum fornecedor cadastrado.</span>`;
    return;
  }
  refs.supplierLinksList.innerHTML = appState.supplierLinksDraft
    .map(
      (link, index) => `
        <div class="supplier-link-row">
          ${renderSupplierEntry(link)}
          <button class="delete-supplier-link" type="button" data-delete-supplier-link="${index}" aria-label="Excluir fornecedor ${index + 1}" title="Excluir fornecedor" ${isCurrentBidReadOnly() ? "disabled" : ""}>×</button>
        </div>
      `
    )
    .join("");
  refs.supplierLinksList.querySelectorAll("[data-delete-supplier-link]").forEach((button) => {
    button.addEventListener("click", () => removeSupplierLink(Number(button.dataset.deleteSupplierLink)));
  });
}

async function saveItem(event) {
  event.preventDefault();
  refs.itemFormError.textContent = "";
  if (guardCurrentBidReadOnly(refs.itemFormError)) return;
  if (!appState.currentBidId) {
    refs.itemFormError.textContent = "Salve ou selecione um edital antes de cadastrar itens.";
    return;
  }
  try {
    const data = collectItemData();
    const savedBidId = appState.currentBidId;
    const savedItemNumber = Number(data.item_number);
    await store.saveItem(savedBidId, data, appState.currentItemId);
    await reloadData();
    loadBid(savedBidId);
    const savedItem = currentItems().find((item) => Number(item.item_number) === savedItemNumber);
    if (savedItem) loadItem(savedItem.id);
    showToast("Item salvo.");
  } catch (error) {
    refs.itemFormError.textContent = error.message;
  }
}

function collectItemData() {
  const itemNumber = parseIntRequired(refs.itemNumber.value, "Número do Item");
  const name = refs.itemName.value.trim();
  if (!name) throw new Error("Preencha a Descrição.");
  const quantity = refs.requiredQuantity.value.trim()
    ? parseDecimal(refs.requiredQuantity.value, "Quantidade Exigida", false, QUANTITY_FRACTION_DIGITS)
    : 0;
  const technicalText = refs.technicalRegistrationText.value.trim();
  const supplierCost = parseDecimal(refs.supplierCost.value, "Valor de Custo", false);
  const finalValue = parseDecimal(refs.maxValue.value, "Valor Final", false);
  const profitMargin = refs.profitMargin.value.trim()
    ? parseProfitMargin(refs.profitMargin.value)
    : null;
  const currentItem = currentItems().find((item) => Number(item.id) === Number(appState.currentItemId));
  return {
    item_number: itemNumber,
    name,
    description: technicalText,
    technical_registration_text: technicalText,
    estimated_value: parseDecimal(refs.estimatedValue.value, "Estimado no Edital", false),
    max_acceptable_value: finalValue,
    minimum_bid: parseDecimal(refs.minimumBid.value, "Lance Mínimo", false),
    brand_model: refs.brandModel.value.trim(),
    is_won: Number(currentItem?.is_won || 0),
    supplier_cost: supplierCost,
    profit_margin: profitMargin,
    supplier_link: appState.supplierLinksDraft[0] || "",
    supplier_links: [...appState.supplierLinksDraft],
    freight_included: 1,
    unit_freight: 0,
    sales_unit: refs.salesUnit.value || SALES_UNIT_OPTIONS[0],
    required_quantity: quantity,
  };
}

async function deleteCurrentItem() {
  if (guardCurrentBidReadOnly(refs.itemFormError)) return;
  if (!appState.currentItemId) {
    showToast("Selecione um item.");
    return;
  }
  if (!confirm("Excluir o item selecionado?")) return;
  await store.deleteItem(appState.currentItemId);
  await reloadData();
  clearItemForm();
  loadBid(appState.currentBidId);
  showToast("Item excluído.");
}

function renderDocuments(documents) {
  if (!documents.length) {
    refs.documentsTableBody.innerHTML = `<tr><td colspan="3">Nenhum documento cadastrado.</td></tr>`;
    return;
  }
  refs.documentsTableBody.innerHTML = documents
    .map((documentRow) => {
      const selected = Number(documentRow.id) === Number(appState.currentDocumentId) ? " selected" : "";
      const warning = documentRow.has_document ? "" : " warning-row";
      return `
        <tr class="selectable${selected}${warning}" data-document-id="${documentRow.id}">
          <td>${escapeHtml(documentRow.document_type || "")}</td>
          <td>${escapeHtml(documentRow.description || "")}</td>
          <td>${documentRow.has_document ? "Sim" : "Não"}</td>
        </tr>
      `;
    })
    .join("");

  refs.documentsTableBody.querySelectorAll("[data-document-id]").forEach((row) => {
    row.addEventListener("click", () => loadDocument(Number(row.dataset.documentId)));
  });
}

function loadDocument(documentId) {
  const documentRow = currentDocuments().find((row) => Number(row.id) === Number(documentId));
  if (!documentRow) return;
  appState.currentDocumentId = documentRow.id;
  refs.documentType.value = documentRow.document_type || "";
  refs.hasDocument.checked = Boolean(documentRow.has_document);
  refs.documentDescription.value = documentRow.description || "";
  refs.selectedDocumentLabel.textContent = documentRow.document_type || "Documento";
  refs.documentFormError.textContent = "";
  renderDocuments(currentDocuments());
}

function clearDocumentForm() {
  appState.currentDocumentId = null;
  refs.documentForm.reset();
  refs.hasDocument.checked = false;
  refs.selectedDocumentLabel.textContent = "Novo documento";
  refs.documentFormError.textContent = "";
  renderDocuments(currentDocuments());
}

async function saveDocument(event) {
  event.preventDefault();
  refs.documentFormError.textContent = "";
  if (guardCurrentBidReadOnly(refs.documentFormError)) return;
  if (!appState.currentBidId) {
    refs.documentFormError.textContent = "Salve ou selecione um edital antes de cadastrar documentos.";
    return;
  }
  try {
    const data = collectDocumentData();
    await store.saveDocument(appState.currentBidId, data, appState.currentDocumentId);
    await reloadData();
    clearDocumentForm();
    loadBid(appState.currentBidId);
    showToast("Documento salvo.");
  } catch (error) {
    refs.documentFormError.textContent = error.message;
  }
}

function collectDocumentData() {
  const documentType = refs.documentType.value.trim();
  if (!documentType) throw new Error("Preencha o Tipo de Documento.");
  return {
    document_type: documentType,
    description: refs.documentDescription.value.trim(),
    has_document: refs.hasDocument.checked ? 1 : 0,
  };
}

async function deleteCurrentDocument() {
  if (guardCurrentBidReadOnly(refs.documentFormError)) return;
  if (!appState.currentDocumentId) {
    showToast("Selecione um documento.");
    return;
  }
  if (!confirm("Excluir o documento selecionado?")) return;
  await store.deleteDocument(appState.currentDocumentId);
  await reloadData();
  clearDocumentForm();
  loadBid(appState.currentBidId);
  showToast("Documento excluído.");
}

function renderFailures(failures) {
  if (!failures.length) {
    refs.failuresTableBody.innerHTML = `<tr><td colspan="3">Nenhuma falha cadastrada.</td></tr>`;
    return;
  }
  refs.failuresTableBody.innerHTML = failures
    .map((failure) => {
      const selected = Number(failure.id) === Number(appState.currentFailureId) ? " selected" : "";
      return `
        <tr class="selectable${selected}" data-failure-id="${failure.id}">
          <td>${escapeHtml(failure.failure_type || "")}</td>
          <td>${escapeHtml(failure.description || "")}</td>
          <td>${escapeHtml(failure.action_plan || "")}</td>
        </tr>
      `;
    })
    .join("");

  refs.failuresTableBody.querySelectorAll("[data-failure-id]").forEach((row) => {
    row.addEventListener("click", () => loadFailure(Number(row.dataset.failureId)));
  });
}

function loadFailure(failureId) {
  const failure = currentFailures().find((row) => Number(row.id) === Number(failureId));
  if (!failure) return;
  appState.currentFailureId = failure.id;
  refs.failureType.value = failure.failure_type || "";
  refs.failureDescription.value = failure.description || "";
  refs.failureActionPlan.value = failure.action_plan || "";
  refs.selectedFailureLabel.textContent = failure.failure_type || "Falha";
  refs.failureFormError.textContent = "";
  renderFailures(currentFailures());
}

function clearFailureForm() {
  appState.currentFailureId = null;
  refs.failureForm.reset();
  refs.selectedFailureLabel.textContent = "Nova falha";
  refs.failureFormError.textContent = "";
  renderFailures(currentFailures());
}

async function saveFailure(event) {
  event.preventDefault();
  refs.failureFormError.textContent = "";
  if (guardCurrentBidReadOnly(refs.failureFormError)) return;
  if (!appState.currentBidId) {
    refs.failureFormError.textContent = "Salve ou selecione um edital antes de cadastrar falhas.";
    return;
  }
  if (!shouldShowFailureHistory()) {
    refs.failureFormError.textContent = "Altere o status do edital para Desclassificado antes de cadastrar falhas.";
    return;
  }
  try {
    const data = collectFailureData();
    await store.saveFailure(appState.currentBidId, data, appState.currentFailureId);
    await reloadData();
    clearFailureForm();
    loadBid(appState.currentBidId);
    setPage("failures");
    showToast("Falha salva.");
  } catch (error) {
    refs.failureFormError.textContent = error.message;
  }
}

function collectFailureData() {
  const failureType = refs.failureType.value.trim();
  const description = refs.failureDescription.value.trim();
  if (!failureType) throw new Error("Preencha o Tipo de Falha.");
  if (!description) throw new Error("Preencha a Descrição.");
  return {
    failure_type: failureType,
    description,
    action_plan: refs.failureActionPlan.value.trim(),
  };
}

async function deleteCurrentFailure() {
  if (guardCurrentBidReadOnly(refs.failureFormError)) return;
  if (!appState.currentFailureId) {
    showToast("Selecione uma falha.");
    return;
  }
  if (!confirm("Excluir a falha selecionada?")) return;
  await store.deleteFailure(appState.currentFailureId);
  await reloadData();
  clearFailureForm();
  loadBid(appState.currentBidId);
  setPage("failures");
  showToast("Falha excluída.");
}

function currentQuotation() {
  return appState.quotations.find((quotation) => Number(quotation.id) === Number(appState.currentQuotationId)) || null;
}


function supplierSearchText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function parseSupplierTags(value) {
  const seen = new Set();
  return String(value).split(/[,;\n]/).map((tag) => tag.trim()).filter((tag) => {
    const key = supplierSearchText(tag);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clearSupplierForm() {
  $("supplierForm").reset();
  $("supplierId").value = "";
  $("supplierFormTitle").textContent = "Novo fornecedor";
  $("supplierMessage").textContent = "";
}

function openSupplierModal(record = null) {
  clearSupplierForm();
  if (record) {
    $("supplierId").value = record.id;
    $("supplierName").value = record.name;
    $("supplierWebsite").value = record.website;
    $("supplierContact").value = record.contact;
    $("supplierTags").value = record.tags.join(", ");
    $("supplierFormTitle").textContent = "Editar fornecedor";
  }
  if (!refs.supplierModal.open) refs.supplierModal.showModal();
  requestAnimationFrame(() => $("supplierName").focus());
}

function closeSupplierModal() {
  if (refs.supplierModal.open) refs.supplierModal.close();
  clearSupplierForm();
}

async function saveSupplier(event) {
  event.preventDefault();
  $("supplierMessage").textContent = "";
  const record = {
    name: $("supplierName").value.trim(),
    website: $("supplierWebsite").value.trim(),
    contact: $("supplierContact").value.trim(),
    tags: parseSupplierTags($("supplierTags").value),
  };
  try {
    if (!record.name) throw new Error("Informe o nome do fornecedor.");
    if (record.website && !/^https?:\/\//i.test(record.website)) throw new Error("Informe um site iniciado por https:// ou http://.");
    const savedId = await store.saveSupplier(record, $("supplierId").value);
    appState.currentSupplierId = savedId;
    await reloadData();
    closeSupplierModal();
    showToast("Fornecedor salvo com sucesso.");
  } catch (error) {
    $("supplierMessage").textContent = error.message || "Não foi possível salvar o fornecedor. Tente novamente.";
  }
}

function currentSupplier() {
  return appState.suppliers.find((supplier) => Number(supplier.id) === Number(appState.currentSupplierId)) || null;
}

function currentSupplierProducts() {
  if (!appState.currentSupplierId) return [];
  return appState.supplierProducts.filter((product) => Number(product.supplier_id) === Number(appState.currentSupplierId));
}

function supplierInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts.at(-1)[0]}`).toLocaleUpperCase("pt-BR");
}

function supplierTagsMarkup(tags, maximum = Infinity) {
  const visible = tags.slice(0, maximum);
  const hidden = tags.length - visible.length;
  return visible.map((tag) => `<span class="supplier-tag">${escapeHtml(tag)}</span>`).join("")
    + (hidden > 0 ? `<span class="supplier-tag">+${hidden}</span>` : "");
}

function populateSupplierTagFilters() {
  const selectedSupplierTag = refs.supplierTagFilter.value;
  const allTags = [...new Set([
    ...appState.suppliers.flatMap((supplier) => supplier.tags),
    ...appState.supplierProducts.flatMap((product) => product.tags),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  refs.supplierTagFilter.innerHTML = `<option value="">Todas as tags</option>${allTags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
  if (allTags.includes(selectedSupplierTag)) refs.supplierTagFilter.value = selectedSupplierTag;
}

function renderSupplierContact(supplier) {
  const parts = String(supplier.contact || "").split(/[,;\n]/).map((part) => part.trim()).filter(Boolean);
  const website = /^https?:\/\//i.test(supplier.website)
    ? `<a href="${escapeHtml(supplier.website)}" target="_blank" rel="noopener noreferrer">◎ ${escapeHtml(supplier.website)}</a>`
    : "";
  const contacts = parts.map((part) => {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) return `<a href="mailto:${escapeHtml(part)}">✉ ${escapeHtml(part)}</a>`;
    if (/^[+()\d\s-]{8,}$/.test(part)) return `<a href="tel:${escapeHtml(part.replace(/[^+\d]/g, ""))}">⌕ ${escapeHtml(part)}</a>`;
    return `<span>● ${escapeHtml(part)}</span>`;
  }).join("");
  refs.supplierContactLinks.innerHTML = website + contacts || `<span>Contato não informado</span>`;
}

function renderSuppliers() {
  populateSupplierTagFilters();
  const terms = supplierSearchText($("supplierSearch").value).trim().split(/\s+/).filter(Boolean);
  const selectedTag = supplierSearchText(refs.supplierTagFilter.value);
  const productCounts = new Map(appState.suppliers.map((supplier) => [Number(supplier.id), appState.supplierProducts.filter((product) => Number(product.supplier_id) === Number(supplier.id)).length]));
  const rows = appState.suppliers.filter((supplier) => {
    const products = appState.supplierProducts.filter((product) => Number(product.supplier_id) === Number(supplier.id));
    const searchable = supplierSearchText([
      supplier.name,
      supplier.website,
      supplier.contact,
      ...supplier.tags,
      ...products.flatMap((product) => [product.name, product.sku, product.model, product.manufacturer, ...product.tags]),
    ].join(" "));
    const tags = [...supplier.tags, ...products.flatMap((product) => product.tags)].map(supplierSearchText);
    return terms.every((term) => searchable.includes(term)) && (!selectedTag || tags.includes(selectedTag));
  });
  const sortMode = refs.supplierSort.value;
  rows.sort((a, b) => sortMode === "products-desc"
    ? productCounts.get(Number(b.id)) - productCounts.get(Number(a.id)) || a.name.localeCompare(b.name, "pt-BR")
    : sortMode === "products-asc"
      ? productCounts.get(Number(a.id)) - productCounts.get(Number(b.id)) || a.name.localeCompare(b.name, "pt-BR")
      : a.name.localeCompare(b.name, "pt-BR"));
  $("supplierCount").textContent = `${rows.length} ${rows.length === 1 ? "fornecedor" : "fornecedores"}`;
  refs.suppliersList.innerHTML = rows.length
    ? rows.map((supplier) => `<button class="supplier-list-card ${Number(supplier.id) === Number(appState.currentSupplierId) ? "active" : ""}" type="button" data-supplier-id="${supplier.id}">
        <span class="supplier-avatar" aria-hidden="true">${escapeHtml(supplierInitials(supplier.name))}</span>
        <span class="supplier-card-copy"><strong>${escapeHtml(supplier.name)}</strong><small>${productCounts.get(Number(supplier.id))} ${productCounts.get(Number(supplier.id)) === 1 ? "produto" : "produtos"}</small><span class="supplier-tags">${supplierTagsMarkup(supplier.tags, 3)}</span></span>
        <span class="supplier-card-chevron" aria-hidden="true">›</span>
      </button>`).join("")
    : `<div class="empty-state compact-empty">${appState.suppliers.length ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado."}</div>`;
  if (!currentSupplier() && rows.length) appState.currentSupplierId = Number(rows[0].id);
  renderSupplierDetail();
}

function renderSupplierDetail() {
  const supplier = currentSupplier();
  refs.supplierEmptyDetail.classList.toggle("hidden", Boolean(supplier));
  refs.supplierDetailContent.classList.toggle("hidden", !supplier);
  if (!supplier) return;
  refs.supplierDetailAvatar.textContent = supplierInitials(supplier.name);
  refs.supplierDetailName.textContent = supplier.name;
  refs.supplierDetailSubtitle.textContent = supplier.tags[0] ? `Fornecedor de ${supplier.tags[0].toLocaleLowerCase("pt-BR")}` : "Fornecedor cadastrado";
  refs.supplierDetailTags.innerHTML = supplierTagsMarkup(supplier.tags, 10) || `<span class="supplier-tag">Sem tags</span>`;
  renderSupplierContact(supplier);
  renderSupplierProducts();
}

function populateSupplierProductTagFilter(products) {
  const selected = refs.supplierProductTagFilter.value;
  const tags = [...new Set(products.flatMap((product) => product.tags))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  refs.supplierProductTagFilter.innerHTML = `<option value="">Todas as tags</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
  if (tags.includes(selected)) refs.supplierProductTagFilter.value = selected;
}

function renderSupplierProducts() {
  const products = currentSupplierProducts();
  populateSupplierProductTagFilter(products);
  const terms = supplierSearchText(refs.supplierProductSearch.value).trim().split(/\s+/).filter(Boolean);
  const selectedTag = supplierSearchText(refs.supplierProductTagFilter.value);
  const visible = products.filter((product) => {
    const searchable = supplierSearchText([product.name, product.sku, product.model, product.manufacturer, product.technical_text, ...product.tags].join(" "));
    return terms.every((term) => searchable.includes(term)) && (!selectedTag || product.tags.map(supplierSearchText).includes(selectedTag));
  });
  refs.supplierProductTotal.textContent = String(products.length);
  refs.supplierProductsStatus.textContent = `Mostrando ${visible.length} de ${products.length} ${products.length === 1 ? "produto" : "produtos"}`;
  refs.supplierProductsTableBody.innerHTML = visible.length
    ? visible.map((product) => `<tr class="supplier-product-row" data-supplier-product-id="${product.id}" tabindex="0">
        <td><span class="supplier-product-name"><strong>${escapeHtml(product.name)}</strong><small>${product.sku ? `SKU: ${escapeHtml(product.sku)}` : "SKU não informado"}</small></span></td>
        <td><div class="supplier-product-tags">${supplierTagsMarkup(product.tags, 3)}</div></td>
        <td><strong>${money(product.average_price)}</strong></td>
        <td><div class="supplier-product-actions"><button class="supplier-product-icon-action" type="button" data-edit-supplier-product="${product.id}" aria-label="Editar ${escapeHtml(product.name)}">✎</button><button class="supplier-product-icon-action danger" type="button" data-delete-supplier-product="${product.id}" aria-label="Excluir ${escapeHtml(product.name)}">♲</button></div></td>
      </tr>`).join("")
    : `<tr><td colspan="4"><div class="empty-state compact-empty">${products.length ? "Nenhum produto encontrado." : "Nenhum produto cadastrado para este fornecedor."}</div></td></tr>`;
}

function handleSupplierProductTableClick(event) {
  const deleteButton = event.target.closest("[data-delete-supplier-product]");
  if (deleteButton) {
    event.stopPropagation();
    void deleteSupplierProduct(Number(deleteButton.dataset.deleteSupplierProduct));
    return;
  }
  const target = event.target.closest("[data-edit-supplier-product], [data-supplier-product-id]");
  if (!target) return;
  const id = Number(target.dataset.editSupplierProduct || target.dataset.supplierProductId);
  const product = appState.supplierProducts.find((row) => Number(row.id) === id);
  if (product) openSupplierProductModal(product);
}

function openSupplierProductModal(product = null) {
  if (!currentSupplier()) return;
  clearSupplierProductForm();
  if (product) {
    appState.currentSupplierProductId = product.id;
    $("supplierProductId").value = product.id;
    refs.supplierProductName.value = product.name;
    refs.supplierProductSku.value = product.sku;
    refs.supplierProductModel.value = product.model;
    refs.supplierProductManufacturer.value = product.manufacturer;
    refs.supplierProductTags.value = product.tags.join(", ");
    refs.supplierProductAveragePrice.value = product.average_price ? money(product.average_price) : "";
    refs.supplierProductTechnicalText.value = product.technical_text;
    appState.supplierProductSpecificationsDraft = product.technical_specifications.map((item) => ({ ...item }));
    refs.supplierProductModalTitle.textContent = "Editar produto";
    refs.deleteSupplierProductButton.classList.remove("hidden");
    renderSupplierProductSpecifications();
  }
  if (!refs.supplierProductModal.open) refs.supplierProductModal.showModal();
  resizeTextarea(refs.supplierProductTechnicalText);
  requestAnimationFrame(() => refs.supplierProductName.focus());
}

function closeSupplierProductModal() {
  if (refs.supplierProductModal.open) refs.supplierProductModal.close();
  clearSupplierProductForm();
}

function clearSupplierProductForm(options = {}) {
  refs.supplierProductForm.reset();
  appState.currentSupplierProductId = null;
  appState.supplierProductSpecificationsDraft = [];
  $("supplierProductId").value = "";
  refs.supplierProductModalTitle.textContent = "Cadastrar produto";
  refs.supplierProductFormError.textContent = "";
  refs.deleteSupplierProductButton.classList.add("hidden");
  renderSupplierProductSpecifications();
  resizeTextarea(refs.supplierProductTechnicalText);
  if (options.focus && refs.supplierProductModal.open) refs.supplierProductName.focus();
}

async function saveSupplierProduct(event) {
  event.preventDefault();
  refs.supplierProductFormError.textContent = "";
  try {
    const supplier = currentSupplier();
    if (!supplier) throw new Error("Selecione um fornecedor.");
    const name = refs.supplierProductName.value.trim();
    if (!name) throw new Error("Informe o nome do produto.");
    const averagePrice = parseDecimal(refs.supplierProductAveragePrice.value, "Preço médio", false);
    await store.saveSupplierProduct(supplier.id, {
      name,
      sku: refs.supplierProductSku.value.trim(),
      model: refs.supplierProductModel.value.trim(),
      manufacturer: refs.supplierProductManufacturer.value.trim(),
      technical_text: refs.supplierProductTechnicalText.value.trim(),
      technical_specifications: normalizeTechnicalSpecifications(appState.supplierProductSpecificationsDraft),
      tags: parseSupplierTags(refs.supplierProductTags.value),
      average_price: averagePrice,
    }, appState.currentSupplierProductId);
    await reloadData();
    closeSupplierProductModal();
    showToast("Produto do fornecedor salvo.");
  } catch (error) {
    refs.supplierProductFormError.textContent = error.message || "Não foi possível salvar o produto.";
  }
}

async function deleteSupplierProduct(productId) {
  const product = appState.supplierProducts.find((row) => Number(row.id) === Number(productId));
  if (!product || !confirm(`Excluir o produto ${product.name}?`)) return;
  await store.deleteSupplierProduct(product.id);
  if (Number(appState.currentSupplierProductId) === Number(product.id)) closeSupplierProductModal();
  await reloadData();
  showToast("Produto excluído.");
}

async function deleteCurrentSupplierProduct() {
  if (appState.currentSupplierProductId) await deleteSupplierProduct(appState.currentSupplierProductId);
}

function addSupplierProductSpecification() {
  appState.supplierProductSpecificationsDraft.push({ name: "", required: "", offered: "" });
  refs.supplierProductSpecificationsSection.open = true;
  renderSupplierProductSpecifications();
  refs.supplierProductSpecificationsList.querySelector(`[data-supplier-specification-index="${appState.supplierProductSpecificationsDraft.length - 1}"][data-supplier-specification-field="name"]`)?.focus();
}

function updateSupplierProductSpecificationDraft(event) {
  const input = event.target.closest("[data-supplier-specification-index][data-supplier-specification-field]");
  if (!input) return;
  const specification = appState.supplierProductSpecificationsDraft[Number(input.dataset.supplierSpecificationIndex)];
  if (specification) specification[input.dataset.supplierSpecificationField] = input.value;
}

function handleSupplierProductSpecificationAction(event) {
  const button = event.target.closest("[data-delete-supplier-specification]");
  if (!button) return;
  appState.supplierProductSpecificationsDraft.splice(Number(button.dataset.deleteSupplierSpecification), 1);
  renderSupplierProductSpecifications();
}

function renderSupplierProductSpecifications() {
  refs.supplierProductSpecificationsList.innerHTML = appState.supplierProductSpecificationsDraft.length
    ? appState.supplierProductSpecificationsDraft.map((specification, index) => `<div class="quotation-specification-card">
        <div class="quotation-specification-name-row"><label>Nome da especificação<input value="${escapeHtml(specification.name)}" data-supplier-specification-index="${index}" data-supplier-specification-field="name" placeholder="Ex.: Memória RAM" /></label><button class="quotation-delete-specification" type="button" data-delete-supplier-specification="${index}" aria-label="Excluir especificação ${index + 1}">🗑</button></div>
        <div class="quotation-specification-values"><label>Requisito<input value="${escapeHtml(specification.required)}" data-supplier-specification-index="${index}" data-supplier-specification-field="required" placeholder="Ex.: Mínimo 12 GB" /></label><label>Produto ofertado<input value="${escapeHtml(specification.offered)}" data-supplier-specification-index="${index}" data-supplier-specification-field="offered" placeholder="Ex.: 16 GB" /></label></div>
      </div>`).join("")
    : `<p class="quotation-specifications-empty">Nenhuma especificação cadastrada.</p>`;
}

function currentQuotationItems() {
  if (!appState.currentQuotationId) return [];
  return appState.quotationItems.filter((item) => Number(item.quotation_id) === Number(appState.currentQuotationId));
}

function setQuotationListCollapsed(collapsed) {
  appState.quotationListCollapsed = Boolean(collapsed);
  refs.quotationsListPanel.classList.toggle("is-collapsed", appState.quotationListCollapsed);
  refs.quotationsListContent.hidden = appState.quotationListCollapsed;
  refs.selectedQuotationSummary.classList.toggle("hidden", !currentQuotation() || !appState.quotationListCollapsed);
  refs.quotationsListToggle.setAttribute("aria-expanded", String(!appState.quotationListCollapsed));
  refs.quotationsListToggleLabel.textContent = appState.quotationListCollapsed ? "Mostrar lista" : "Recolher lista";
}

function renderQuotations() {
  const count = appState.quotations.length;
  const quotation = currentQuotation();
  refs.quotationCountLabel.textContent = `${count} ${count === 1 ? "orçamento" : "orçamentos"}`;
  refs.selectedQuotationSummary.textContent = quotation ? `Edital ${quotation.edital} selecionado` : "";
  setQuotationListCollapsed(appState.quotationListCollapsed);
  if (!count) {
    refs.quotationsTableBody.innerHTML = `<tr><td colspan="5"><div class="empty-state compact-empty">Nenhum orçamento cadastrado.</div></td></tr>`;
  } else {
    refs.quotationsTableBody.innerHTML = appState.quotations
      .map((quotation) => {
        const items = appState.quotationItems.filter((item) => Number(item.quotation_id) === Number(quotation.id));
        const total = items.reduce((sum, item) => roundMoney(sum + Number(item.total || 0)), 0);
        const selected = Number(quotation.id) === Number(appState.currentQuotationId) ? " selected" : "";
        const location = [quotation.city, quotation.cep].filter(Boolean).join(" · ") || "—";
        return `
          <tr class="selectable${selected}" tabindex="0" data-quotation-id="${quotation.id}">
            <td>${escapeHtml(formatDateOnly(quotation.opening_date) || "—")}</td>
            <td><strong>${escapeHtml(quotation.edital)}</strong></td>
            <td>${escapeHtml(location)}</td>
            <td class="numeric">${items.length}</td>
            <td class="numeric"><strong>${money(total)}</strong></td>
          </tr>`;
      })
      .join("");
  }

  refs.quotationsTableBody.querySelectorAll("[data-quotation-id]").forEach((row) => {
    const open = () => loadQuotation(Number(row.dataset.quotationId));
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
  renderQuotationItems();
}

function loadQuotation(quotationId, options = {}) {
  const quotation = appState.quotations.find((row) => Number(row.id) === Number(quotationId));
  if (!quotation) return;
  setSyncNotice("");
  closeQuotationItemModal();
  appState.currentQuotationId = quotation.id;
  appState.quotationListCollapsed = true;
  appState.currentQuotationItemId = null;
  refs.quotationId.value = String(quotation.id);
  refs.quotationOpeningDate.value = toDateInputValue(quotation.opening_date);
  refs.quotationEdital.value = quotation.edital;
  refs.quotationAgency.value = quotation.agency;
  refs.quotationCity.value = quotation.city;
  refs.quotationCep.value = formatCep(quotation.cep);
  refs.quotationDeliveryDeadline.value = quotation.delivery_deadline;
  refs.selectedQuotationLabel.textContent = `Edital ${quotation.edital}`;
  refs.quotationFormError.textContent = "";
  refs.deleteQuotationButton.classList.remove("hidden");
  clearQuotationItemForm();
  renderQuotations();
  setPage("quotations", { history: options.history });
  if (options.scroll !== false) refs.quotationForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearQuotationForm() {
  closeQuotationItemModal();
  appState.currentQuotationId = null;
  appState.quotationListCollapsed = false;
  appState.currentQuotationItemId = null;
  refs.quotationForm.reset();
  refs.quotationId.value = "";
  refs.selectedQuotationLabel.textContent = "Novo orçamento";
  refs.quotationFormError.textContent = "";
  refs.deleteQuotationButton.classList.add("hidden");
  clearQuotationItemForm();
  renderQuotations();
  refs.quotationEdital.focus();
}

async function saveQuotation(event) {
  event.preventDefault();
  refs.quotationFormError.textContent = "";
  const edital = refs.quotationEdital.value.trim();
  if (!edital) {
    refs.quotationFormError.textContent = "Preencha o campo Edital.";
    refs.quotationEdital.focus();
    return;
  }
  const cepDigits = refs.quotationCep.value.replace(/\D/g, "");
  if (cepDigits && cepDigits.length !== 8) {
    refs.quotationFormError.textContent = "Informe um CEP com 8 dígitos.";
    refs.quotationCep.focus();
    return;
  }
  try {
    const savedId = await store.saveQuotation(
      {
        opening_date: refs.quotationOpeningDate.value || null,
        edital,
        agency: refs.quotationAgency.value.trim(),
        city: refs.quotationCity.value.trim(),
        cep: formatCep(cepDigits),
        delivery_deadline: refs.quotationDeliveryDeadline.value.trim(),
      },
      appState.currentQuotationId
    );
    appState.currentQuotationId = savedId;
    await reloadData();
    loadQuotation(savedId, { scroll: false });
    showToast("Orçamento salvo.");
  } catch (error) {
    refs.quotationFormError.textContent = error.message;
  }
}

async function deleteCurrentQuotation() {
  const quotation = currentQuotation();
  if (!quotation) return;
  if (!confirm(`Excluir o orçamento do edital ${quotation.edital}? Ele deixará de aparecer no sistema, mas seus itens e demais dados permanecerão preservados.`)) return;
  try {
    await store.deleteQuotation(quotation.id);
    appState.currentQuotationId = null;
    appState.currentQuotationItemId = null;
    refs.quotationForm.reset();
    await reloadData();
    clearQuotationForm();
    showToast("Orçamento excluído da visualização. Os dados foram preservados.");
  } catch (error) {
    refs.quotationFormError.textContent = error.message;
  }
}

function renderQuotationItems() {
  const quotation = currentQuotation();
  refs.quotationItemsSection.classList.toggle("hidden", !quotation);
  refs.downloadQuotationItemsButton.disabled = !quotation;
  if (!quotation) {
    refs.quotationItemsTableBody.innerHTML = "";
    refs.quotationGrandTotal.textContent = `Total: ${money(0)}`;
    return;
  }
  const items = currentQuotationItems();
  const grandTotal = items.reduce((sum, item) => roundMoney(sum + Number(item.total || 0)), 0);
  refs.quotationItemsStatus.textContent = `${items.length} ${items.length === 1 ? "item cadastrado" : "itens cadastrados"}`;
  refs.quotationGrandTotal.textContent = `Total: ${money(grandTotal)}`;
  if (!items.length) {
    refs.quotationItemsTableBody.innerHTML = `<tr><td colspan="10"><div class="empty-state compact-empty">Nenhum item cadastrado neste orçamento.</div></td></tr>`;
    return;
  }
  refs.quotationItemsTableBody.innerHTML = items
    .map((item) => {
      const selected = Number(item.id) === Number(appState.currentQuotationItemId) ? " selected" : "";
      const description = item.description || "";
      const descriptionTooltip = description ? ` title="${escapeHtml(description)}"` : "";
      return `
        <tr class="selectable${selected}" tabindex="0" data-quotation-item-id="${item.id}">
          <td><strong>${escapeHtml(formatNumber(item.item_number))}</strong></td>
          <td class="numeric">${money(item.minimum_bid)}</td>
          <td><strong class="table-item-description"${descriptionTooltip}>${escapeHtml(description || "—")}</strong>${item.model ? `<small class="table-secondary">Modelo: ${escapeHtml(item.model)}</small>` : ""}</td>
          <td>${escapeHtml(item.manufacturer || "—")}</td>
          <td class="numeric">${money(item.estimated_value)}</td>
          <td class="numeric">${money(item.supplier_cost)}</td>
          <td class="numeric">${formatQuotationFinalBidMargin(item)}</td>
          <td class="numeric">${escapeHtml(formatNumber(item.quantity))}</td>
          <td class="numeric"><strong>${money(item.total)}</strong></td>
          <td class="numeric"><strong>${money(calculateItemProfit(item.final_bid, item.supplier_cost, item.quantity))}</strong></td>
        </tr>`;
    })
    .join("");

  refs.quotationItemsTableBody.querySelectorAll("[data-quotation-item-id]").forEach((row) => {
    const open = () => loadQuotationItem(Number(row.dataset.quotationItemId));
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function openQuotationItemModal() {
  if (!currentQuotation()) return;
  clearQuotationItemForm();
  refs.quotationItemModal.showModal();
  resizeTextarea(refs.quotationItemTechnicalText);
  requestAnimationFrame(() => refs.quotationItemNumber.focus());
}

function closeQuotationItemModal() {
  if (refs.quotationItemDiscardModal.open) refs.quotationItemDiscardModal.close();
  if (refs.quotationItemModal.open) {
    refs.quotationItemModal.close();
  }
}

function requestCloseQuotationItemModal() {
  if (!refs.quotationItemModal.open) return;
  if (!quotationItemFormHasUnsavedChanges()) {
    closeQuotationItemModal();
    return;
  }
  if (!refs.quotationItemDiscardModal.open) refs.quotationItemDiscardModal.showModal();
}

function discardQuotationItemChanges() {
  refs.quotationItemDiscardModal.close();
  closeQuotationItemModal();
}

function quotationItemFormSnapshot() {
  return JSON.stringify([
    refs.quotationItemNumber.value,
    refs.quotationItemDescription.value,
    refs.quotationItemModel.value,
    refs.quotationItemManufacturer.value,
    refs.quotationItemTechnicalText.value,
    appState.quotationSupplierLinksDraft,
    appState.quotationTechnicalSpecificationsDraft,
    refs.quotationItemEstimatedValue.value,
    refs.quotationItemSupplierCost.value,
    refs.quotationItemProfitMargin.value,
    refs.quotationItemFinalBid.value,
    refs.quotationItemMinimumBid.value,
    refs.quotationItemQuantity.value,
  ]);
}

function markQuotationItemFormPristine() {
  appState.quotationItemFormBaseline = quotationItemFormSnapshot();
}

function quotationItemFormHasUnsavedChanges() {
  return quotationItemFormSnapshot() !== appState.quotationItemFormBaseline;
}

function loadQuotationItem(itemId) {
  const item = currentQuotationItems().find((row) => Number(row.id) === Number(itemId));
  if (!item) return;
  appState.currentQuotationItemId = item.id;
  refs.quotationItemNumber.value = formatNumber(item.item_number);
  refs.quotationItemDescription.value = item.description;
  refs.quotationItemModel.value = item.model;
  refs.quotationItemManufacturer.value = item.manufacturer;
  refs.quotationItemTechnicalText.value = item.technical_text;
  appState.quotationSupplierLinksDraft = [...item.supplier_links];
  appState.quotationTechnicalSpecificationsDraft = item.technical_specifications.map((specification) => ({ ...specification }));
  renderQuotationItemSuppliers();
  renderQuotationTechnicalSpecifications();
  refs.quotationItemEstimatedValue.value = money(item.estimated_value);
  refs.quotationItemSupplierCost.value = item.supplier_cost ? money(item.supplier_cost) : "";
  refs.quotationItemProfitMargin.value = item.profit_margin === null ? "" : formatProfitMargin(item.profit_margin);
  refs.quotationItemFinalBid.value = money(item.final_bid);
  refs.quotationItemMinimumBid.value = item.minimum_bid ? money(item.minimum_bid) : "";
  refs.quotationItemQuantity.value = formatNumber(item.quantity);
  refs.quotationItemFormError.textContent = "";
  refs.deleteQuotationItemButton.classList.remove("hidden");
  refs.quotationItemModalTitle.textContent = "Editar item";
  updateQuotationValueWithMargin();
  updateQuotationFinalBidMarginIndicator();
  updateQuotationItemTotals();
  renderQuotationItems();
  markQuotationItemFormPristine();
  if (!refs.quotationItemModal.open) refs.quotationItemModal.showModal();
  resizeTextarea(refs.quotationItemTechnicalText);
  requestAnimationFrame(() => refs.quotationItemNumber.focus());
}

function clearQuotationItemForm(options = {}) {
  appState.currentQuotationItemId = null;
  refs.quotationItemForm.reset();
  appState.quotationSupplierLinksDraft = [];
  appState.quotationTechnicalSpecificationsDraft = [];
  renderQuotationItemSuppliers();
  renderQuotationTechnicalSpecifications();
  refs.quotationTechnicalSpecificationsSection.open = true;
  refs.quotationItemQuantity.value = "1";
  refs.quotationItemTotal.value = money(0);
  refs.quotationItemTotalProfit.value = money(0);
  updateQuotationValueWithMargin();
  updateQuotationFinalBidMarginIndicator();
  refs.quotationItemFormError.textContent = "";
  refs.deleteQuotationItemButton.classList.add("hidden");
  refs.quotationItemModalTitle.textContent = "Cadastrar item";
  resizeTextarea(refs.quotationItemTechnicalText);
  renderQuotationItems();
  markQuotationItemFormPristine();
  if (options.focus && refs.quotationItemModal.open) refs.quotationItemNumber.focus();
}

async function saveQuotationItem(event) {
  event.preventDefault();
  refs.quotationItemFormError.textContent = "";
  if (!appState.currentQuotationId) {
    refs.quotationItemFormError.textContent = "Salve o orçamento antes de cadastrar itens.";
    return;
  }
  try {
    const isEditing = Boolean(appState.currentQuotationItemId);
    const itemNumber = parseIntRequired(refs.quotationItemNumber.value, "ITEM");
    const duplicate = currentQuotationItems().find(
      (item) => Number(item.item_number) === Number(itemNumber) && Number(item.id) !== Number(appState.currentQuotationItemId)
    );
    if (duplicate) throw new Error("Já existe um item com este número neste orçamento.");
    const linkedBidIds = new Set(
      appState.bids
        .filter((bid) => Number(bid.quotation_id) === Number(appState.currentQuotationId))
        .map((bid) => bid.id)
    );
    const linkedBidConflict = appState.items.find(
      (item) =>
        linkedBidIds.has(item.bid_id) &&
        Number(item.item_number) === Number(itemNumber) &&
        Number(item.quotation_item_id) !== Number(appState.currentQuotationItemId)
    );
    if (linkedBidConflict) throw new Error(`O item ${itemNumber} já existe em um edital vinculado a este orçamento.`);
    const quantity = refs.quotationItemQuantity.value.trim()
      ? parseDecimal(refs.quotationItemQuantity.value, "Quantidade", false, QUANTITY_FRACTION_DIGITS)
      : 1;
    const supplierCost = parseDecimal(refs.quotationItemSupplierCost.value, "Valor de Custo", false);
    const finalBid = parseDecimal(refs.quotationItemFinalBid.value, "Lance Final", false);
    const minimumBid = parseDecimal(refs.quotationItemMinimumBid.value, "Lance Mínimo", false);
    const profitMargin = refs.quotationItemProfitMargin.value.trim()
      ? parseProfitMargin(refs.quotationItemProfitMargin.value)
      : null;
    await store.saveQuotationItem(
      appState.currentQuotationId,
      {
        item_number: itemNumber,
        description: refs.quotationItemDescription.value.trim(),
        model: refs.quotationItemModel.value.trim(),
        manufacturer: refs.quotationItemManufacturer.value.trim(),
        technical_text: refs.quotationItemTechnicalText.value.trim(),
        supplier_links: [...appState.quotationSupplierLinksDraft],
        technical_specifications: normalizeTechnicalSpecifications(appState.quotationTechnicalSpecificationsDraft),
        estimated_value: parseDecimal(refs.quotationItemEstimatedValue.value, "Valor Estimado", false),
        supplier_cost: supplierCost,
        profit_margin: profitMargin,
        final_bid: finalBid,
        minimum_bid: minimumBid,
        quantity,
      },
      appState.currentQuotationItemId
    );
    await reloadData();
    clearQuotationItemForm({ focus: true });
    showToast(isEditing ? "Item do orçamento atualizado." : "Item do orçamento cadastrado.");
  } catch (error) {
    refs.quotationItemFormError.textContent = error.message;
  }
}

async function deleteCurrentQuotationItem() {
  if (!appState.currentQuotationItemId) return;
  if (!confirm("Excluir o item selecionado deste orçamento?")) return;
  try {
    await store.deleteQuotationItem(appState.currentQuotationItemId);
    appState.currentQuotationItemId = null;
    await reloadData();
    clearQuotationItemForm();
    showToast("Item excluído.");
  } catch (error) {
    refs.quotationItemFormError.textContent = error.message;
  }
}

function updateQuotationItemTotals() {
  try {
    const finalBid = parseDecimal(refs.quotationItemFinalBid.value, "Lance Final", false);
    const supplierCost = parseDecimal(refs.quotationItemSupplierCost.value, "Valor de Custo", false);
    const quantity = refs.quotationItemQuantity.value.trim()
      ? parseDecimal(refs.quotationItemQuantity.value, "Quantidade", false, QUANTITY_FRACTION_DIGITS)
      : 1;
    refs.quotationItemTotal.value = money(calculateLineTotal(finalBid, quantity));
    refs.quotationItemTotalProfit.value = money(calculateItemProfit(finalBid, supplierCost, quantity));
  } catch {
    refs.quotationItemTotal.value = money(0);
    refs.quotationItemTotalProfit.value = money(0);
  }
}

function formatQuotationFinalBidMargin(item) {
  const margin = calculateProfitMargin(item.final_bid, item.supplier_cost);
  return margin === null ? "—" : percent(margin);
}

function formatQuotationValueWithMargin(item) {
  if (!Number(item.supplier_cost) || item.profit_margin === null || item.profit_margin === undefined || item.profit_margin === "") return "—";
  const valueWithMargin = calculateValueWithMargin(item.supplier_cost, item.profit_margin);
  return valueWithMargin === null ? "—" : money(valueWithMargin);
}

function updateQuotationValueWithMarginFromMargin() {
  updateQuotationValueWithMargin();
}

function updateQuotationFinalBidMarginIndicator() {
  const hasFinalBid = Boolean(refs.quotationItemFinalBid.value.trim());
  refs.quotationFinalBidMarginIndicator.classList.toggle("hidden", !hasFinalBid);
  refs.quotationFinalBidMarginIndicator.textContent = "Margem: -%";
  if (!hasFinalBid || !refs.quotationItemSupplierCost.value.trim()) return;
  try {
    const finalBid = parseDecimal(refs.quotationItemFinalBid.value, "Lance Final", false);
    const costValue = parseDecimal(refs.quotationItemSupplierCost.value, "Valor de Custo", false);
    const margin = calculateProfitMargin(finalBid, costValue);
    if (margin !== null) refs.quotationFinalBidMarginIndicator.textContent = `Margem: ${percent(margin)}`;
  } catch {}
}

function updateQuotationValueWithMargin() {
  if (!refs.quotationItemSupplierCost.value.trim() || !refs.quotationItemProfitMargin.value.trim()) {
    refs.quotationItemValueWithMargin.value = "";
    return;
  }
  try {
    const costValue = parseDecimal(refs.quotationItemSupplierCost.value, "Valor de Custo", false);
    const margin = parseProfitMargin(refs.quotationItemProfitMargin.value);
    const valueWithMargin = calculateValueWithMargin(costValue, margin);
    refs.quotationItemValueWithMargin.value = valueWithMargin === null ? "" : money(valueWithMargin);
  } catch {
    refs.quotationItemValueWithMargin.value = "";
  }
}

function formatQuotationProfitMarginInput() {
  if (!refs.quotationItemProfitMargin.value.trim()) {
    refs.quotationItemValueWithMargin.value = "";
    return;
  }
  try {
    refs.quotationItemProfitMargin.value = formatProfitMargin(parseProfitMargin(refs.quotationItemProfitMargin.value));
    updateQuotationValueWithMargin();
  } catch {
    refs.quotationItemValueWithMargin.value = "";
  }
}

function formatQuotationCepInput() {
  refs.quotationCep.value = formatCep(refs.quotationCep.value);
}

function formatCep(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function formatDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function renderUsers() {
  if (!isCurrentUserAdmin()) return;
  const totalLabel = `${appState.users.length} ${appState.users.length === 1 ? "usuário" : "usuários"}`;
  const query = normalizeSearchText(refs.userSearchInput.value);
  const roleFilter = refs.userRoleFilter.value;
  const visibleUsers = appState.users.filter((user) => {
    const role = normalizeUserRole(user.role);
    const matchesRole = roleFilter === "all" || role === roleFilter;
    const searchableText = normalizeSearchText(`${user.name || ""} ${user.email || ""}`);
    return matchesRole && (!query || searchableText.includes(query));
  });
  refs.usersTotalLabel.textContent = totalLabel;
  refs.userCountLabel.textContent = query || roleFilter !== "all"
    ? `${visibleUsers.length} de ${totalLabel}`
    : totalLabel;
  if (!visibleUsers.length) {
    const message = appState.users.length
      ? "Nenhum usuário corresponde à busca ou ao filtro selecionado."
      : "Nenhum usuário cadastrado na organização.";
    refs.usersTableBody.innerHTML = `<tr><td colspan="5" class="users-empty-row">${message}</td></tr>`;
    return;
  }

  refs.usersTableBody.innerHTML = visibleUsers
    .map((user) => {
      const isCurrent = normalizeEmail(user.email) === normalizeEmail(appState.currentUserEmail);
      const role = normalizeUserRole(user.role);
      const canConfigure = role === USER_ROLES.ANALYST && Boolean(user.auth_user_id);
      const assignedBidCount = user.auth_user_id
        ? appState.bids.filter((bid) => bid.assigned_to === user.auth_user_id).length
        : 0;
      const initials = userInitials(user.name || user.email);
      const action = canConfigure
        ? `<button class="quiet-action compact-action configure-user-action" type="button" data-configure-user="${escapeHtml(user.auth_user_id)}"><span aria-hidden="true">⚙</span> Configurar acessos</button>`
        : isCurrent
          ? `<span class="current-user-pill"><span aria-hidden="true">♙</span> Usuário atual</span>`
          : `<span class="muted-text">—</span>`;
      const assignedBids = role === USER_ROLES.ADMIN
        ? `<span class="all-bids-label"><span aria-hidden="true">∞</span> Todos os editais</span>`
        : `<span class="assigned-bids-pill" title="Editais atribuídos diretamente pelo administrador"><span aria-hidden="true">▱</span> ${assignedBidCount} ${assignedBidCount === 1 ? "edital" : "editais"}</span>`;
      return `
        <tr>
          <td><div class="user-identity"><span class="user-avatar" aria-hidden="true">${escapeHtml(initials)}</span><span><strong>${escapeHtml(user.name || "")}</strong><small>${escapeHtml(role === USER_ROLES.ADMIN ? "Conta principal" : role)}</small></span></div></td>
          <td>${escapeHtml(user.email || "")}</td>
          <td><span class="user-role-pill ${role === USER_ROLES.ADMIN ? "admin" : "analyst"}"><span aria-hidden="true">${role === USER_ROLES.ADMIN ? "♢" : "♙"}</span> ${escapeHtml(role)}</span></td>
          <td>${assignedBids}</td>
          <td>${action}</td>
        </tr>
      `;
    })
    .join("");

  refs.usersTableBody.querySelectorAll("[data-configure-user]").forEach((button) => {
    button.addEventListener("click", () => openUserAssignments(button.dataset.configureUser));
  });
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function userInitials(value) {
  const parts = String(value || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts.at(-1)[0]}`;
  return initials.toLocaleUpperCase("pt-BR");
}

function openUserAssignments(analystId) {
  if (!isCurrentUserAdmin()) return;
  const analyst = appState.users.find((user) => user.auth_user_id === analystId && normalizeUserRole(user.role) === USER_ROLES.ANALYST);
  if (!analyst) {
    showToast("Analista não encontrado na organização.");
    return;
  }
  refs.userAssignmentsModal.dataset.analystId = analystId;
  refs.userAssignmentsTitle.textContent = `Acessos de ${analyst.name || analyst.email}`;
  refs.userAssignmentsDescription.textContent = "Marque os editais e orçamentos que este analista também poderá visualizar e editar. Registros criados por ele já ficam disponíveis.";
  refs.userAssignmentsError.textContent = "";
  const bidOptions = appState.bids.length
    ? appState.bids.map((bid) => {
        const createdByAnalyst = bid.created_by === analystId;
        const assignedToAnalyst = bid.assigned_to === analystId;
        const assignedUser = appState.users.find((user) => user.auth_user_id === bid.assigned_to);
        const note = createdByAnalyst
          ? "Criado pelo analista"
          : assignedUser && !assignedToAnalyst
            ? `Atualmente atribuído a ${assignedUser.name || assignedUser.email}`
            : assignedToAnalyst ? "Atribuído ao analista" : "Sem atribuição";
        return `<label class="user-assignment-option">
          <input type="checkbox" value="${escapeHtml(bid.id)}" ${createdByAnalyst || assignedToAnalyst ? "checked" : ""} ${createdByAnalyst ? "disabled" : ""} />
          <span><strong>${escapeHtml(bidDisplayNumber(bid))}</strong><small>${escapeHtml(bid.buyer_agency || "Órgão não informado")} · ${escapeHtml(note)}</small></span>
        </label>`;
      }).join("")
    : `<div class="empty-state compact-empty">Nenhum edital cadastrado na organização.</div>`;
  const quotationOptions = appState.quotations.length
    ? appState.quotations.map((quotation) => {
        const createdByAnalyst = quotation.created_by === analystId;
        const assignedToAnalyst = quotation.assigned_to === analystId;
        const assignedUser = appState.users.find((user) => user.auth_user_id === quotation.assigned_to);
        const note = createdByAnalyst
          ? "Criado pelo analista"
          : assignedUser && !assignedToAnalyst
            ? `Atualmente atribuído a ${assignedUser.name || assignedUser.email}`
            : assignedToAnalyst ? "Atribuído ao analista" : "Sem atribuição";
        return `<label class="user-assignment-option">
          <input type="checkbox" data-access-type="quotation" value="${quotation.id}" ${createdByAnalyst || assignedToAnalyst ? "checked" : ""} ${createdByAnalyst ? "disabled" : ""} />
          <span><strong>Orçamento #${quotation.id} · ${escapeHtml(quotation.edital)}</strong><small>${escapeHtml(quotation.agency || "Órgão não informado")} · ${escapeHtml(note)}</small></span>
        </label>`;
      }).join("")
    : `<div class="empty-state compact-empty">Nenhum orçamento cadastrado na organização.</div>`;
  refs.userAssignmentsList.innerHTML = `
    <section class="user-assignment-group"><h3>Editais</h3>${bidOptions}</section>
    <section class="user-assignment-group"><h3>Orçamentos</h3>${quotationOptions}</section>`;
  refs.userAssignmentsModal.showModal();
}

function closeUserAssignments(event) {
  event?.preventDefault();
  if (refs.userAssignmentsModal.open) refs.userAssignmentsModal.close();
  delete refs.userAssignmentsModal.dataset.analystId;
}

async function saveUserAssignments(event) {
  event.preventDefault();
  const analystId = refs.userAssignmentsModal.dataset.analystId;
  if (!analystId || !isCurrentUserAdmin()) return;
  const selectedBidIds = Array.from(refs.userAssignmentsList.querySelectorAll("input[type='checkbox']:checked:not([data-access-type])"), (input) => input.value);
  const selectedQuotationIds = Array.from(refs.userAssignmentsList.querySelectorAll("input[data-access-type='quotation']:checked"), (input) => Number(input.value));
  await store.assignAccessToAnalyst(analystId, selectedBidIds, selectedQuotationIds);
  await reloadData();
  closeUserAssignments();
  showToast("Atribuições do analista atualizadas.");
}

function currentItems() {
  if (!appState.currentBidId) return [];
  return appState.items.filter((item) => item.bid_id === appState.currentBidId);
}

function currentDocuments() {
  if (!appState.currentBidId) return [];
  return appState.documents.filter((documentRow) => documentRow.bid_id === appState.currentBidId);
}

function currentFailures() {
  if (!appState.currentBidId) return [];
  return appState.failureHistory.filter((failure) => failure.bid_id === appState.currentBidId);
}

function currentBid() {
  return appState.bids.find((row) => row.id === appState.currentBidId) || null;
}

function calculateBidSummary(bidId) {
  const bid = appState.bids.find((row) => row.id === bidId);
  const onlyWonItems = shouldCalculateWonItemsTotal(bid?.status);
  return appState.items
    .filter((item) => item.bid_id === bidId)
    .reduce(
      (acc, item) => {
        const quantity = Number(item.required_quantity || 0);
        if (!onlyWonItems || Boolean(Number(item.is_won))) {
          acc.totalFinal = roundMoney(acc.totalFinal + calculateLineTotal(item.max_acceptable_value, quantity));
        }
        acc.totalEstimated = roundMoney(acc.totalEstimated + calculateLineTotal(item.estimated_value, quantity));
        acc.itemCount += 1;
        return acc;
      },
      { totalFinal: 0, totalEstimated: 0, itemCount: 0 }
    );
}

function roundDecimal(value, fractionDigits) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** fractionDigits;
  return Math.sign(number) * Math.round(Math.abs(number) * factor + 1e-10) / factor;
}

function roundMoney(value) {
  return roundDecimal(value, MONEY_FRACTION_DIGITS);
}

function roundQuantity(value) {
  return roundDecimal(value, QUANTITY_FRACTION_DIGITS);
}

function roundMargin(value) {
  return roundDecimal(value, MARGIN_FRACTION_DIGITS);
}

function calculateLineTotal(unitValue, quantity) {
  return roundMoney(Number(unitValue || 0) * Number(quantity || 0));
}

function parseDecimal(value, fieldName, required = true, fractionDigits = MONEY_FRACTION_DIGITS) {
  let raw = String(value || "").trim();
  if (!raw) {
    if (required) throw new Error(`Preencha o campo ${fieldName}.`);
    return 0;
  }
  raw = raw.replace("R$", "").replace(/\s/g, "");
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const number = Number(raw);
  if (Number.isNaN(number)) throw new Error(`Informe um valor numérico válido para ${fieldName}.`);
  if (number < 0) throw new Error(`O campo ${fieldName} não pode ser negativo.`);
  return roundDecimal(number, fractionDigits);
}

function parseProfitMargin(value) {
  let raw = String(value || "").trim().replace("%", "").replace(/\s/g, "");
  if (!raw) return null;
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const number = Number(raw);
  if (!Number.isFinite(number)) throw new Error("Informe uma porcentagem válida para Margem.");
  return roundMargin(number);
}

function parseIntRequired(value, fieldName) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`Preencha o campo ${fieldName}.`);
  const number = Number.parseInt(raw, 10);
  if (Number.isNaN(number)) throw new Error(`Informe um número inteiro válido para ${fieldName}.`);
  if (number < 0) throw new Error(`O campo ${fieldName} não pode ser negativo.`);
  return number;
}

function parseIntOptional(value, fieldName) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const number = Number.parseInt(raw, 10);
  if (Number.isNaN(number)) throw new Error(`Informe um número inteiro válido para ${fieldName}.`);
  if (number < 0) throw new Error(`O campo ${fieldName} não pode ser negativo.`);
  return number;
}

function bindAutoGrowTextareas(scope) {
  scope.querySelectorAll(".auto-grow-textarea").forEach((textarea) => {
    textarea.addEventListener("input", () => resizeTextarea(textarea));
    resizeTextarea(textarea);
  });
}

function resizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function normalizeUrlValue(value) {
  const raw = String(value || "").trim();
  if (!raw || /\s/.test(raw)) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^www\./i, "www.")}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (!url.hostname.includes(".")) return "";
    return url.href;
  } catch {
    return "";
  }
}

function money(value) {
  return roundMoney(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: MONEY_FRACTION_DIGITS,
    maximumFractionDigits: MONEY_FRACTION_DIGITS,
  });
}

function percent(value) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatProfitMargin(value) {
  return `${roundMargin(value).toLocaleString("pt-BR", { minimumFractionDigits: MARGIN_FRACTION_DIGITS, maximumFractionDigits: MARGIN_FRACTION_DIGITS })}%`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = parseStoredDateTime(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function toDateTimeInputValue(value) {
  if (!value) return "";
  const date = parseStoredDateTime(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = dateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = parseStoredDateTime(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = dateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function fromDateTimeInputValue(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const desiredUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let instant = desiredUtc;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = dateTimeParts(new Date(instant));
    const representedUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    instant += desiredUtc - representedUtc;
  }
  return new Date(instant).toISOString();
}

function parseStoredDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)) {
    return new Date(fromDateTimeInputValue(text.replace(" ", "T").slice(0, 16)));
  }
  return new Date(text);
}

function dateTimeParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function zonedDateTimeParts(date) {
  const numeric = dateTimeParts(date);
  const monthShort = new Intl.DateTimeFormat("pt-BR", { timeZone: BUSINESS_TIME_ZONE, month: "short" })
    .format(date)
    .replace(".", "");
  return { ...numeric, monthShort, time: `${numeric.hour}:${numeric.minute}` };
}

function statusDisplay(status) {
  const normalizedStatus = normalizeBidStatus(status);
  const map = {
    "Em Analise": "ANÁLISE",
    Descartada: "DESCARTADA",
    Aprovada: "APROVADA",
    Faturado: "FATURADO",
    Desclassificado: "DESCLASSIFICADO",
    Disputada: "DISPUTADA",
  };
  return map[normalizedStatus] || String(normalizedStatus || "").toUpperCase();
}

function statusBadgeClass(status) {
  const normalizedStatus = normalizeBidStatus(status);
  return {
    "Em Analise": "analysis",
    Descartada: "discarded",
    Aprovada: "approved",
    Faturado: "billed",
    Desclassificado: "rejected",
    Disputada: "disputed",
  }[normalizedStatus] || "neutral";
}

function normalizeBidStatus(status) {
  return status === "Reprovada" ? "Desclassificado" : status || STATUS_OPTIONS[0];
}

function normalizeBidRecord(record) {
  const editalFiles = normalizeBidAttachments(record);
  return {
    id: String(record.id || "").trim(),
    edital_number: String(record.edital_number || record.id || "").trim(),
    buyer_agency: record.buyer_agency || "",
    session_datetime: record.session_datetime || "",
    delivery_place: record.delivery_place || "",
    edital_link: record.edital_link || "",
    public_session_link: record.public_session_link || "",
    bid_type: record.bid_type || BID_TYPE_OPTIONS[0],
    proposal_deadline: record.proposal_deadline || "",
    status: normalizeBidStatus(record.status),
    edital_file_path: record.edital_file_path || "",
    edital_file_name: record.edital_file_name || "",
    edital_file_type: record.edital_file_type || "",
    edital_file_size: Number(record.edital_file_size || 0),
    edital_files: editalFiles,
    quotation_id: record.quotation_id === undefined || record.quotation_id === null || record.quotation_id === "" ? null : Number(record.quotation_id),
    organization_id: record.organization_id || null,
    created_by: record.created_by || null,
    created_by_name: record.created_by_name || "",
    assigned_to: record.assigned_to || null,
    deleted_at: record.deleted_at || null,
    ...(record.edital_file_blob ? { edital_file_blob: record.edital_file_blob } : {}),
    created_at: record.created_at || timestampNow(),
    updated_at: record.updated_at || timestampNow(),
  };
}

function normalizeBidAttachments(record) {
  if (!record) return [];
  const hasModernFiles = record.edital_files !== undefined && record.edital_files !== null;
  let files = record.edital_files;
  if (typeof files === "string") {
    try {
      files = JSON.parse(files);
    } catch {
      files = [];
    }
  }
  if (!Array.isArray(files)) files = [];
  if (!hasModernFiles && !files.length && record.edital_file_path) {
    files = [{
      path: record.edital_file_path,
      name: record.edital_file_name || "edital",
      type: record.edital_file_type || "application/octet-stream",
      size: Number(record.edital_file_size || 0),
      ...(record.edital_file_blob ? { blob: record.edital_file_blob } : {}),
    }];
  }
  const paths = new Set();
  return files.flatMap((file) => {
    const path = String(file?.path || file?.edital_file_path || "").trim();
    if (!path || paths.has(path)) return [];
    paths.add(path);
    return [{
      path,
      name: String(file.name || file.edital_file_name || "edital"),
      type: String(file.type || file.edital_file_type || "application/octet-stream"),
      size: Number(file.size || file.edital_file_size || 0),
      ...(file.blob ? { blob: file.blob } : {}),
    }];
  });
}

function attachmentMetadata(attachment) {
  return {
    path: attachment.path,
    name: attachment.name,
    type: attachment.type,
    size: Number(attachment.size || 0),
  };
}

function bidDisplayNumber(bid) {
  return String(bid?.edital_number || bid?.id || "").trim();
}

function normalizeItemRecord(record) {
  const legacyExtra = parseItemExtraPayload(record.description);
  const technicalText = record.technical_registration_text ?? legacyExtra.technical_registration_text ?? record.description ?? "";
  const supplierCost = Number(record.supplier_cost || 0);
  const finalValue = Number(record.max_acceptable_value || 0);
  const storedMargin = record.profit_margin ?? legacyExtra.profit_margin;
  const profitMargin = storedMargin === undefined || storedMargin === null || storedMargin === ""
    ? supplierCost && finalValue
      ? calculateProfitMargin(finalValue, supplierCost)
      : null
    : Number(storedMargin);
  const supplierLinks = normalizeSupplierLinks(record.supplier_links ?? legacyExtra.supplier_links, record.supplier_link);
  return {
    id: record.id ? Number(record.id) : undefined,
    bid_id: record.bid_id,
    quotation_item_id:
      record.quotation_item_id === undefined || record.quotation_item_id === null || record.quotation_item_id === ""
        ? null
        : Number(record.quotation_item_id),
    item_number: Number(record.item_number || 0),
    name: record.name || "",
    description: technicalText,
    technical_registration_text: technicalText,
    estimated_value: Number(record.estimated_value ?? legacyExtra.estimated_value ?? record.max_acceptable_value ?? 0),
    max_acceptable_value: Number(record.max_acceptable_value || 0),
    minimum_bid: Number(record.minimum_bid ?? legacyExtra.minimum_bid ?? 0),
    brand_model: record.brand_model ?? legacyExtra.brand_model ?? "",
    is_won: Number(record.is_won ?? legacyExtra.is_won ?? 0),
    supplier_cost: supplierCost,
    profit_margin: profitMargin,
    supplier_link: supplierLinks[0] || "",
    supplier_links: supplierLinks,
    freight_included: Number(record.freight_included ?? 1),
    unit_freight: Number(record.unit_freight || 0),
    sales_unit: record.sales_unit || SALES_UNIT_OPTIONS[0],
    required_quantity:
      record.required_quantity === undefined || record.required_quantity === null || record.required_quantity === "" ? 0 : Number(record.required_quantity),
  };
}

function parseItemExtraPayload(value) {
  try {
    const payload = JSON.parse(String(value || ""));
    return payload?.__gll_item_v2 ? payload : {};
  } catch {
    return {};
  }
}

function normalizeSupplierLinks(value, fallbackLink = "") {
  let links = value;
  if (typeof links === "string") {
    try {
      const parsed = JSON.parse(links);
      links = Array.isArray(parsed) ? parsed : [links];
    } catch {
      links = links ? [links] : [];
    }
  }
  if (!Array.isArray(links)) links = [];
  if (fallbackLink) links = [...links, fallbackLink];
  const uniqueLinks = [];
  for (const link of links) {
    const normalizedLink = String(link || "").trim();
    if (!normalizedLink || uniqueLinks.some((currentLink) => currentLink.toLowerCase() === normalizedLink.toLowerCase())) continue;
    uniqueLinks.push(normalizedLink);
  }
  return uniqueLinks;
}

function legacySupabaseItemRecord(record) {
  const {
    technical_registration_text,
    estimated_value,
    minimum_bid,
    brand_model,
    is_won,
    profit_margin,
    supplier_links,
    quotation_item_id,
    ...legacyRecord
  } = record;
  return {
    ...legacyRecord,
    description: JSON.stringify({
      __gll_item_v2: true,
      technical_registration_text: technical_registration_text || record.description || "",
      estimated_value: Number(estimated_value || 0),
      minimum_bid: Number(minimum_bid || 0),
      brand_model: brand_model || "",
      is_won: Number(is_won || 0),
      profit_margin: profit_margin === undefined || profit_margin === null ? null : Number(profit_margin),
      supplier_links: normalizeSupplierLinks(supplier_links, legacyRecord.supplier_link),
    }),
  };
}

function isMissingSupabaseColumnError(error) {
  const message = String(error?.message || error?.details || "");
  return /schema cache|column/i.test(message) && /technical_registration_text|estimated_value|minimum_bid|brand_model|is_won|profit_margin|supplier_links/i.test(message);
}

function isMissingFailureHistoryTableError(error) {
  const message = String(error?.message || error?.details || "");
  return Boolean(error) && /failure_history|relation/i.test(message) && /does not exist|schema cache|not find|could not find/i.test(message);
}

function normalizeDocumentRecord(record) {
  return {
    id: record.id ? Number(record.id) : undefined,
    bid_id: record.bid_id,
    document_type: record.document_type || "",
    description: record.description || "",
    has_document: Number(record.has_document || 0),
  };
}

function normalizeFailureRecord(record) {
  return {
    id: record.id ? Number(record.id) : undefined,
    bid_id: record.bid_id,
    failure_type: record.failure_type || record.failure_type_text || "",
    description: record.description || "",
    action_plan: record.action_plan || "",
    created_at: record.created_at || timestampNow(),
  };
}

function normalizeStatusHistoryRecord(record) {
  return {
    id: record.id ? Number(record.id) : undefined,
    bid_id: record.bid_id,
    from_status: normalizeBidStatus(record.from_status),
    to_status: normalizeBidStatus(record.to_status),
    reason: String(record.reason || "").trim(),
    changed_by: record.changed_by || null,
    changed_by_name: record.changed_by_name || "",
    changed_by_email: record.changed_by_email || "",
    changed_at: record.changed_at || new Date().toISOString(),
  };
}

function currentUserProfile() {
  return appState.users.find((user) => normalizeEmail(user.email) === normalizeEmail(appState.currentUserEmail));
}

function normalizeQuotationRecord(record) {
  return {
    id: record.id ? Number(record.id) : undefined,
    opening_date: record.opening_date || "",
    edital: String(record.edital || "").trim(),
    agency: record.agency || "",
    city: record.city || "",
    cep: formatCep(record.cep),
    delivery_deadline: record.delivery_deadline || "",
    organization_id: record.organization_id || null,
    created_by: record.created_by || null,
    created_by_name: record.created_by_name || "",
    assigned_to: record.assigned_to || null,
    deleted_at: record.deleted_at || null,
    created_at: record.created_at || timestampNow(),
    updated_at: record.updated_at || timestampNow(),
  };
}

function normalizeQuotationItemRecord(record) {
  const finalBid = Number(record.final_bid || 0);
  const supplierCost = Number(record.supplier_cost || 0);
  const storedMargin = record.profit_margin;
  const profitMargin = storedMargin === undefined || storedMargin === null || storedMargin === "" ? null : Number(storedMargin);
  const quantity = record.quantity === undefined || record.quantity === null || record.quantity === "" ? 1 : Number(record.quantity);
  return {
    id: record.id ? Number(record.id) : undefined,
    quotation_id: Number(record.quotation_id),
    item_number: Number(record.item_number || 0),
    description: record.description || "",
    model: record.model || "",
    manufacturer: record.manufacturer || "",
    technical_text: record.technical_text || "",
    estimated_value: Number(record.estimated_value || 0),
    supplier_cost: supplierCost,
    profit_margin: profitMargin,
    supplier_links: normalizeSupplierLinks(record.supplier_links),
    technical_specifications: normalizeTechnicalSpecifications(record.technical_specifications),
    final_bid: finalBid,
    minimum_bid: Number(record.minimum_bid || 0),
    quantity,
    total: record.total === undefined || record.total === null
      ? calculateLineTotal(finalBid, quantity)
      : roundMoney(record.total),
  };
}

function normalizeSupplierRecord(record) {
  return {
    id: record.id ? Number(record.id) : undefined,
    name: String(record.name || "").trim(),
    website: String(record.website || "").trim(),
    contact: String(record.contact || "").trim(),
    tags: parseSupplierTags(Array.isArray(record.tags) ? record.tags.join(",") : record.tags),
    organization_id: record.organization_id || null,
    created_at: record.created_at || timestampNow(),
    updated_at: record.updated_at || timestampNow(),
  };
}

function normalizeSupplierProductRecord(record) {
  return {
    id: record.id ? Number(record.id) : undefined,
    supplier_id: Number(record.supplier_id),
    organization_id: record.organization_id || null,
    name: String(record.name || "").trim(),
    sku: String(record.sku || "").trim(),
    model: String(record.model || "").trim(),
    manufacturer: String(record.manufacturer || "").trim(),
    technical_text: String(record.technical_text || "").trim(),
    technical_specifications: normalizeTechnicalSpecifications(record.technical_specifications),
    tags: parseSupplierTags(Array.isArray(record.tags) ? record.tags.join(",") : record.tags),
    average_price: Number(record.average_price || 0),
    created_at: record.created_at || timestampNow(),
    updated_at: record.updated_at || timestampNow(),
  };
}

function normalizeSupplierEntry(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalizedUrl = !/\s/.test(raw) ? normalizeUrlValue(raw) : "";
  if (/^(?:https?:\/\/|www\.)/i.test(raw)) return normalizedUrl;
  return normalizedUrl || raw;
}

function supplierEntryUrl(value) {
  const raw = String(value || "").trim();
  return !/\s/.test(raw) ? normalizeUrlValue(raw) : "";
}

function addQuotationItemSupplier() {
  refs.quotationItemFormError.textContent = "";
  const supplier = normalizeSupplierEntry(refs.quotationItemSupplierInput.value);
  if (!supplier) {
    refs.quotationItemFormError.textContent = "Informe um link ou nome de fornecedor.";
    return;
  }
  if (appState.quotationSupplierLinksDraft.some((current) => current.toLowerCase() === supplier.toLowerCase())) {
    refs.quotationItemFormError.textContent = "Este fornecedor já foi cadastrado.";
    return;
  }
  appState.quotationSupplierLinksDraft.push(supplier);
  refs.quotationItemSupplierInput.value = "";
  renderQuotationItemSuppliers();
  refs.quotationItemSupplierInput.focus();
}

function removeQuotationItemSupplier(index) {
  appState.quotationSupplierLinksDraft.splice(index, 1);
  renderQuotationItemSuppliers();
}

function renderQuotationItemSuppliers() {
  if (!appState.quotationSupplierLinksDraft.length) {
    refs.quotationItemSuppliersList.innerHTML = `<span class="supplier-links-empty">Nenhum fornecedor cadastrado.</span>`;
    return;
  }
  refs.quotationItemSuppliersList.innerHTML = appState.quotationSupplierLinksDraft
    .map(
      (supplier, index) => `<div class="supplier-link-row">
        ${renderSupplierEntry(supplier)}
        <button class="delete-supplier-link" type="button" data-delete-quotation-supplier="${index}" aria-label="Excluir fornecedor ${index + 1}" title="Excluir fornecedor">×</button>
      </div>`
    )
    .join("");
  refs.quotationItemSuppliersList.querySelectorAll("[data-delete-quotation-supplier]").forEach((button) => {
    button.addEventListener("click", () => removeQuotationItemSupplier(Number(button.dataset.deleteQuotationSupplier)));
  });
}

function normalizeTechnicalSpecifications(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((specification) => specification && typeof specification === "object" && !Array.isArray(specification))
    .map((specification) => ({
      name: String(specification.name || "").trim(),
      required: String(specification.required || "").trim(),
      offered: String(specification.offered || "").trim(),
    }))
    .filter((specification) => specification.name || specification.required || specification.offered);
}

function addQuotationTechnicalSpecification() {
  appState.quotationTechnicalSpecificationsDraft.push({ name: "", required: "", offered: "" });
  refs.quotationTechnicalSpecificationsSection.open = true;
  renderQuotationTechnicalSpecifications();
  const input = refs.quotationTechnicalSpecificationsList.querySelector(`[data-specification-index="${appState.quotationTechnicalSpecificationsDraft.length - 1}"][data-specification-field="name"]`);
  input?.focus();
}

function updateQuotationTechnicalSpecificationDraft(event) {
  const input = event.target.closest("[data-specification-index][data-specification-field]");
  if (!input) return;
  const specification = appState.quotationTechnicalSpecificationsDraft[Number(input.dataset.specificationIndex)];
  if (!specification) return;
  specification[input.dataset.specificationField] = input.value;
}

function handleQuotationTechnicalSpecificationAction(event) {
  const button = event.target.closest("[data-delete-specification]");
  if (!button) return;
  appState.quotationTechnicalSpecificationsDraft.splice(Number(button.dataset.deleteSpecification), 1);
  renderQuotationTechnicalSpecifications();
}

function renderQuotationTechnicalSpecifications() {
  if (!appState.quotationTechnicalSpecificationsDraft.length) {
    refs.quotationTechnicalSpecificationsList.innerHTML = `<p class="quotation-specifications-empty">Nenhuma especificação cadastrada.</p>`;
    return;
  }
  refs.quotationTechnicalSpecificationsList.innerHTML = appState.quotationTechnicalSpecificationsDraft
    .map((specification, index) => `<div class="quotation-specification-card">
      <div class="quotation-specification-name-row">
        <label>
          Nome da especificação
          <input value="${escapeHtml(specification.name)}" data-specification-index="${index}" data-specification-field="name" placeholder="Ex.: Memória RAM" />
        </label>
        <button class="quotation-delete-specification" type="button" data-delete-specification="${index}" aria-label="Excluir especificação ${index + 1}" title="Excluir especificação">🗑</button>
      </div>
      <div class="quotation-specification-values">
        <label>
          Exigido no edital
          <input value="${escapeHtml(specification.required)}" data-specification-index="${index}" data-specification-field="required" placeholder="Ex.: Mínimo 12 GB" />
        </label>
        <label>
          Item ofertado
          <input value="${escapeHtml(specification.offered)}" data-specification-index="${index}" data-specification-field="offered" placeholder="Ex.: 16 GB" />
        </label>
      </div>
    </div>`)
    .join("");
}

function renderSupplierEntry(value) {
  const url = supplierEntryUrl(value);
  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(url)}">${escapeHtml(value)}</a>`
    : `<span class="supplier-name" title="${escapeHtml(value)}">${escapeHtml(value)}</span>`;
}

function quotationItemToBidItem(quotationItem, existingItem = {}) {
  const supplierLinks = normalizeSupplierLinks(quotationItem.supplier_links);
  return normalizeItemRecord({
    ...existingItem,
    quotation_item_id: quotationItem.id,
    item_number: quotationItem.item_number,
    name: quotationItem.description,
    description: quotationItem.technical_text,
    technical_registration_text: quotationItem.technical_text,
    estimated_value: quotationItem.estimated_value,
    max_acceptable_value: quotationItem.final_bid,
    minimum_bid: quotationItem.minimum_bid,
    brand_model: formatQuotationBrandModel(quotationItem),
    supplier_cost: quotationItem.supplier_cost,
    profit_margin: quotationItem.profit_margin,
    supplier_link: supplierLinks[0] || "",
    supplier_links: supplierLinks,
    required_quantity: quotationItem.quantity,
  });
}

function bidItemToQuotationItem(bidItem, existingQuotationItem = {}) {
  const { manufacturer, model } = splitBrandModel(bidItem.brand_model);
  return normalizeQuotationItemRecord({
    ...existingQuotationItem,
    id: existingQuotationItem.id || bidItem.quotation_item_id || undefined,
    item_number: bidItem.item_number,
    description: bidItem.name,
    model,
    manufacturer,
    technical_text: bidItem.technical_registration_text || bidItem.description,
    estimated_value: bidItem.estimated_value,
    supplier_cost: bidItem.supplier_cost,
    profit_margin: bidItem.profit_margin,
    supplier_links: bidItem.supplier_links,
    final_bid: bidItem.max_acceptable_value,
    minimum_bid: bidItem.minimum_bid,
    quantity: bidItem.required_quantity,
  });
}

function formatQuotationBrandModel(item) {
  return [item.manufacturer, item.model].map((value) => String(value || "").trim()).filter(Boolean).join(" / ");
}

function splitBrandModel(value) {
  const parts = String(value || "").split(" / ").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { manufacturer: "", model: parts[0] || "" };
  return { manufacturer: parts.shift(), model: parts.join(" / ") };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeStorageSuffix(value) {
  const suffix = String(value || "local")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return suffix || "local";
}

function updateItemProfit() {
  const missingMessage = "Preencha Valor Final e Valor de Custo para exibir o lucro do item.";
  const hasFinalValue = Boolean(refs.maxValue.value.trim());
  const hasCostValue = Boolean(refs.supplierCost.value.trim());
  if (!hasFinalValue || !hasCostValue) {
    refs.itemProfit.value = "";
    refs.itemProfit.title = missingMessage;
    return;
  }

  try {
    const finalValue = parseDecimal(refs.maxValue.value, "Valor Final", false);
    const costValue = parseDecimal(refs.supplierCost.value, "Valor de Custo", false);
    const quantity = parseIntOptional(refs.requiredQuantity.value, "Quantidade");
    refs.itemProfit.value = money(calculateItemProfit(finalValue, costValue, quantity));
    refs.itemProfit.title = "Calculado por (Valor Final - Valor de Custo) × Quantidade.";
  } catch {
    refs.itemProfit.value = "";
    refs.itemProfit.title = missingMessage;
  }
}

function updateValueWithMarginFromMargin() {
  updateValueWithMargin();
}

function updateItemPricingFromCost() {
  updateValueWithMargin();
  updateItemProfit();
}

function updateValueWithMargin() {
  if (!refs.supplierCost.value.trim() || !refs.profitMargin.value.trim()) {
    refs.valueWithMargin.value = "";
    return;
  }
  try {
    const costValue = parseDecimal(refs.supplierCost.value, "Valor de Custo", false);
    const margin = parseProfitMargin(refs.profitMargin.value);
    const valueWithMargin = calculateValueWithMargin(costValue, margin);
    refs.valueWithMargin.value = valueWithMargin === null ? "" : money(valueWithMargin);
  } catch {
    refs.valueWithMargin.value = "";
  }
}

function formatProfitMarginInput() {
  if (!refs.profitMargin.value.trim()) {
    refs.valueWithMargin.value = "";
    return;
  }
  try {
    refs.profitMargin.value = formatProfitMargin(parseProfitMargin(refs.profitMargin.value));
    updateValueWithMargin();
  } catch {
    refs.valueWithMargin.value = "";
  }
}

function sanitizeStorageFileName(value) {
  const fileName = String(value || "edital")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return fileName || "edital";
}

function formatFileSize(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createLocalUserRecord(userData) {
  const email = normalizeEmail(userData.email);
  const salt = randomSalt();
  const password_hash = await hashPassword(userData.password, salt);
  return {
    email,
    name: userData.name?.trim() || email,
    role: userData.role || USER_ROLES.ANALYST,
    salt,
    password_hash,
    created_at: timestampNow(),
  };
}

async function hashPassword(password, salt) {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password, salt, expectedHash) {
  const receivedHash = await hashPassword(password, salt);
  return receivedHash === expectedHash;
}

function updateChildrenBidId(storeRef, oldBidId, newBidId) {
  const request = storeRef.index("bid_id").getAll(oldBidId);
  request.onsuccess = () => {
    for (const row of request.result || []) {
      storeRef.put({ ...row, bid_id: newBidId });
    }
  };
}

function deleteChildrenByBid(storeRef, bidId) {
  const request = storeRef.index("bid_id").getAll(bidId);
  request.onsuccess = () => {
    for (const row of request.result || []) storeRef.delete(row.id);
  };
}

function deleteChildrenByIndex(storeRef, indexName, parentId) {
  const request = storeRef.index(indexName).getAll(parentId);
  request.onsuccess = () => {
    for (const row of request.result || []) storeRef.delete(row.id);
  };
}

async function loadSeedData() {
  const response = await fetch("./seed-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível carregar a base inicial.");
  return response.json();
}

function timestampNow() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer;
function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => refs.toast.classList.remove("show"), 2400);
}

withBlockingLoading(main, "Verificando sessão…")().catch((error) => {
  console.error(error);
  alert(error.message);
});
