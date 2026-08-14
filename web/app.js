const STATUS_OPTIONS = ["Em Analise", "Aprovada", "Desclassificado", "Disputada"];
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
const BUDGET_COLUMN_TYPES = [
  { value: "number", label: "Numérico" },
  { value: "text", label: "Texto" },
  { value: "currency", label: "Moeda (R$)" },
];
const BUDGET_SECTION_OPTIONS = [
  { value: "table", label: "Tabela de itens" },
  { value: "header", label: "Cabeçalho" },
  { value: "terms", label: "Condições" },
  { value: "signature", label: "Assinatura" },
];
const BUDGET_SOURCE_OPTIONS = [
  { value: "manual", label: "Preenchimento manual" },
  { value: "item_number", label: "Item Edital" },
  { value: "item_name", label: "Descrição do item" },
  { value: "item_description", label: "Texto cadastramento técnico" },
  { value: "unit", label: "Unidade" },
  { value: "quantity", label: "Quantidade" },
  { value: "estimated_value", label: "Estimado no Edital" },
  { value: "max_value", label: "Valor final" },
  { value: "minimum_bid", label: "Lance mínimo" },
  { value: "brand_model", label: "Marca/Modelo" },
  { value: "calculated_total", label: "Total calculado" },
];
const BUDGET_ALIGNMENT_OPTIONS = ["left", "center", "right"];
const BUDGET_BLOCK_SIZE_OPTIONS = ["small", "normal", "large"];
const DEFAULT_BUDGET_SETTINGS = {
  orientation: "portrait",
  title: "PROPOSTA COMERCIAL",
  recipient: "",
  process: "",
  object: "",
  proponent: "Preencha os dados cadastrais do proponente.",
  representative: "Preencha os dados do representante.",
  payment: "",
  terms:
    "Declaramos que nos preços propostos encontram-se incluídas todas as despesas, custos diretos e indiretos, fretes, impostos, taxas, seguros e demais encargos necessários ao fornecimento do objeto.\n\nDeclaramos estar de pleno acordo com as exigências, condições gerais e especiais estabelecidas no edital.",
  validity: "60 (sessenta) dias",
  warranty: "Conforme termo de referência, edital e seus anexos.",
  delivery: "",
  cityDate: "",
  signer: "",
  headerLogoEnabled: false,
  headerLogoImage: "",
  headerLogoName: "",
  watermarkEnabled: false,
  watermarkImage: "",
  watermarkName: "",
  watermarkOpacity: 12,
};
const DEFAULT_BUDGET_BLOCKS = [
  {
    id: "block_process",
    label: "Identificação do pregão",
    content: "PROCESSO LICITATÓRIO Nº ...\nPREGÃO ELETRÔNICO Nº ...",
    align: "center",
    bold: true,
    underline: true,
    size: "normal",
  },
  {
    id: "block_title",
    label: "Título da proposta",
    content: "PROPOSTA COMERCIAL",
    align: "center",
    bold: true,
    underline: true,
    size: "large",
  },
];
const DEFAULT_ADMIN = {
  email: "demo@gll.local",
  name: "Usuário local",
  password: "gll-demo-local",
  role: "Acesso total",
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
};
const GLL_CONFIG = {
  ...DEFAULT_GLL_CONFIG,
  ...(window.GLL_CONFIG || {}),
};

const appState = {
  authenticated: false,
  activePage: "home",
  currentUserEmail: null,
  currentBidId: null,
  originalBidId: null,
  currentItemId: null,
  currentDocumentId: null,
  currentFailureId: null,
  itemMarginCalculationSource: "margin",
  supplierLinksDraft: [],
  budgetDraftColumns: [],
  budgetDraftSettings: { ...DEFAULT_BUDGET_SETTINGS },
  budgetDraftBlocks: cloneBudgetBlocks(DEFAULT_BUDGET_BLOCKS),
  budgetModelCollapsed: false,
  budgetPreviewVisible: true,
  budgetModelDirty: false,
  sidebarCollapsed: false,
  draggedBudgetBlockId: null,
  draggedBudgetColumnId: null,
  currentBudgetRowId: null,
  bids: [],
  items: [],
  documents: [],
  failureHistory: [],
  budgetModels: [],
  budgetRows: [],
  users: [],
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
  homeIconButton: $("homeIconButton"),
  navHomeButton: $("navHomeButton"),
  navBidsButton: $("navBidsButton"),
  navUsersButton: $("navUsersButton"),
  navSettingsButton: $("navSettingsButton"),
  menuToggleButton: $("menuToggleButton"),
  breadcrumbLabel: $("breadcrumbLabel"),
  currentUserName: $("currentUserName"),
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
  homeApprovedBids: $("homeApprovedBids"),
  homeDisqualifiedBids: $("homeDisqualifiedBids"),
  homeDisputedBids: $("homeDisputedBids"),
  bidWorkspaceHeader: $("bidWorkspaceHeader"),
  currentBidTitle: $("currentBidTitle"),
  currentBidAgency: $("currentBidAgency"),
  usersPage: $("usersPage"),
  settingsPage: $("settingsPage"),
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
  editalLink: $("editalLink"),
  editalFile: $("editalFile"),
  editalAttachmentPanel: $("editalAttachmentPanel"),
  editalAttachmentName: $("editalAttachmentName"),
  downloadEditalButton: $("downloadEditalButton"),
  bidType: $("bidType"),
  bidStatus: $("bidStatus"),
  selectedBidLabel: $("selectedBidLabel"),
  bidFormError: $("bidFormError"),
  deleteBidButton: $("deleteBidButton"),
  clearBidButton: $("clearBidButton"),
  metricsSection: $("metricsSection"),
  detailsArea: $("detailsArea"),
  metricItemCount: $("metricItemCount"),
  metricProfit: $("metricProfit"),
  metricMargin: $("metricMargin"),
  itemsTabButton: $("itemsTabButton"),
  documentsTabButton: $("documentsTabButton"),
  budgetTabButton: $("budgetTabButton"),
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
  wonField: $("wonField"),
  itemWon: $("itemWon"),
  technicalRegistrationText: $("technicalRegistrationText"),
  supplierLinkInput: $("supplierLinkInput"),
  addSupplierLinkButton: $("addSupplierLinkButton"),
  supplierLinksList: $("supplierLinksList"),
  selectedItemLabel: $("selectedItemLabel"),
  itemFormError: $("itemFormError"),
  deleteItemButton: $("deleteItemButton"),
  clearItemButton: $("clearItemButton"),
  itemsTableBody: $("itemsTableBody"),
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
  budgetPage: $("budgetPage"),
  budgetBuilderLayout: $("budgetBuilderLayout"),
  budgetModelSection: $("budgetModelSection"),
  budgetModelBody: $("budgetModelBody"),
  toggleBudgetModelButton: $("toggleBudgetModelButton"),
  toggleBudgetPreviewButton: $("toggleBudgetPreviewButton"),
  budgetBidLabel: $("budgetBidLabel"),
  budgetSettingsForm: $("budgetSettingsForm"),
  budgetOrientation: $("budgetOrientation"),
  budgetTitle: $("budgetTitle"),
  budgetRecipient: $("budgetRecipient"),
  budgetProcess: $("budgetProcess"),
  budgetObject: $("budgetObject"),
  budgetProponent: $("budgetProponent"),
  budgetRepresentative: $("budgetRepresentative"),
  budgetPayment: $("budgetPayment"),
  budgetTerms: $("budgetTerms"),
  budgetValidity: $("budgetValidity"),
  budgetWarranty: $("budgetWarranty"),
  budgetDelivery: $("budgetDelivery"),
  budgetCityDate: $("budgetCityDate"),
  budgetSigner: $("budgetSigner"),
  budgetHeaderLogoEnabled: $("budgetHeaderLogoEnabled"),
  budgetHeaderLogoFile: $("budgetHeaderLogoFile"),
  budgetHeaderLogoStatus: $("budgetHeaderLogoStatus"),
  budgetWatermarkEnabled: $("budgetWatermarkEnabled"),
  budgetWatermarkFile: $("budgetWatermarkFile"),
  budgetWatermarkStatus: $("budgetWatermarkStatus"),
  budgetWatermarkOpacity: $("budgetWatermarkOpacity"),
  budgetBlockForm: $("budgetBlockForm"),
  budgetBlockLabel: $("budgetBlockLabel"),
  budgetBlockAlign: $("budgetBlockAlign"),
  budgetBlockSize: $("budgetBlockSize"),
  budgetBlockContent: $("budgetBlockContent"),
  budgetBlockBold: $("budgetBlockBold"),
  budgetBlockUnderline: $("budgetBlockUnderline"),
  addBudgetBlockButton: $("addBudgetBlockButton"),
  budgetBlocksList: $("budgetBlocksList"),
  budgetColumnForm: $("budgetColumnForm"),
  budgetColumnName: $("budgetColumnName"),
  budgetColumnType: $("budgetColumnType"),
  budgetColumnSection: $("budgetColumnSection"),
  budgetColumnSource: $("budgetColumnSource"),
  budgetColumnWidth: $("budgetColumnWidth"),
  addBudgetColumnButton: $("addBudgetColumnButton"),
  budgetModelError: $("budgetModelError"),
  budgetColumnsList: $("budgetColumnsList"),
  clearBudgetModelButton: $("clearBudgetModelButton"),
  saveBudgetModelButton: $("saveBudgetModelButton"),
  budgetFillStatus: $("budgetFillStatus"),
  importBudgetItemsButton: $("importBudgetItemsButton"),
  printBudgetPreviewButton: $("printBudgetPreviewButton"),
  budgetPreviewPanel: $("budgetPreviewPanel"),
  budgetPreviewFormat: $("budgetPreviewFormat"),
  budgetPreview: $("budgetPreview"),
  budgetEntryForm: $("budgetEntryForm"),
  budgetEntryError: $("budgetEntryError"),
  budgetTableHead: $("budgetTableHead"),
  budgetTableBody: $("budgetTableBody"),
  userForm: $("userForm"),
  userName: $("userName"),
  userEmail: $("userEmail"),
  userRole: $("userRole"),
  userPassword: $("userPassword"),
  userPasswordConfirm: $("userPasswordConfirm"),
  userFormError: $("userFormError"),
  clearUserButton: $("clearUserButton"),
  userCountLabel: $("userCountLabel"),
  usersTableBody: $("usersTableBody"),
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
  const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  return module;
}

function assertSupabase(error) {
  if (!error) return;
  throw new Error(error.message || "Erro ao acessar o Supabase.");
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
    this.version = 2;
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
        if (!db.objectStoreNames.contains("budget_models")) db.createObjectStore("budget_models", { keyPath: "bid_id" });
        if (!db.objectStoreNames.contains("budget_rows")) {
          const store = db.createObjectStore("budget_rows", { keyPath: "id", autoIncrement: true });
          store.createIndex("bid_id", "bid_id", { unique: false });
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
      ["bids", "items", "documents", "failure_history", "budget_models", "budget_rows", "meta"],
      "readwrite",
      ([bids, items, documents, failures, models, rows, meta]) => {
      bids.clear();
      items.clear();
      documents.clear();
      failures.clear();
      models.clear();
      rows.clear();
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

  async getPrivateSettings() {
    return null;
  }

  async saveBid(data, originalId) {
    const now = timestampNow();
    await this.tx(["bids", "items", "documents", "failure_history"], "readwrite", ([bids, items, documents, failures]) => {
      const request = bids.get(originalId || data.id);
      request.onsuccess = () => {
        const existing = request.result;
        bids.put({
          ...existing,
          ...data,
          created_at: existing?.created_at || now,
          updated_at: now,
        });
        if (originalId && originalId !== data.id) {
          bids.delete(originalId);
          updateChildrenBidId(items, originalId, data.id);
          updateChildrenBidId(documents, originalId, data.id);
          updateChildrenBidId(failures, originalId, data.id);
        }
      };
    });
  }

  async saveBidAttachment(bidId, file) {
    const db = await this.open();
    const existing = await this.request(db.transaction("bids").objectStore("bids").get(bidId));
    if (!existing) throw new Error("Salve o edital antes de anexar o arquivo.");
    const attachment = {
      edital_file_path: `indexeddb:${bidId}`,
      edital_file_name: file.name,
      edital_file_type: file.type || "application/octet-stream",
      edital_file_size: file.size,
      edital_file_blob: file,
      updated_at: timestampNow(),
    };
    await this.tx("bids", "readwrite", (bids) => bids.put({ ...existing, ...attachment }));
    return attachment;
  }

  async downloadBidAttachment(bid) {
    if (!bid?.edital_file_blob) throw new Error("O arquivo anexado não está disponível neste navegador.");
    return bid.edital_file_blob;
  }

  async deleteBid(bidId) {
    await this.tx(["bids", "items", "documents", "failure_history", "budget_models", "budget_rows"], "readwrite", ([bids, items, documents, failures, models, rows]) => {
      bids.delete(bidId);
      deleteChildrenByBid(items, bidId);
      deleteChildrenByBid(documents, bidId);
      deleteChildrenByBid(failures, bidId);
      models.delete(bidId);
      deleteChildrenByBid(rows, bidId);
    });
  }

  async saveItem(bidId, itemData, itemId) {
    const existingItems = await this.getAll("items");
    const duplicate = existingItems.find(
      (item) => item.bid_id === bidId && Number(item.item_number) === Number(itemData.item_number) && Number(item.id) !== Number(itemId)
    );
    if (duplicate) throw new Error("Já existe um item com este número neste edital.");
    const record = normalizeItemRecord({ ...itemData, id: itemId || undefined, bid_id: bidId });
    await this.tx("items", "readwrite", (items) => {
      if (!record.id) delete record.id;
      items.put(record);
    });
  }

  async deleteItem(itemId) {
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

  async saveBudgetModel(bidId, columns) {
    const record = {
      bid_id: bidId,
      columns,
      updated_at: timestampNow(),
    };
    await this.tx("budget_models", "readwrite", (models) => models.put(record));
  }

  async deleteBudgetModel(bidId) {
    await this.tx(["budget_models", "budget_rows"], "readwrite", ([models, rows]) => {
      models.delete(bidId);
      deleteChildrenByBid(rows, bidId);
    });
  }

  async saveBudgetRow(bidId, values, rowId) {
    await this.tx("budget_rows", "readwrite", (rows) => {
      const record = {
        bid_id: bidId,
        values,
        created_at: timestampNow(),
      };
      if (rowId) record.id = Number(rowId);
      rows.put(record);
    });
  }

  async deleteBudgetRow(rowId) {
    await this.tx("budget_rows", "readwrite", (rows) => rows.delete(Number(rowId)));
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
    const { data, error } = await client.from(tableName).select("*");
    if (tableName === "failure_history" && isMissingFailureHistoryTableError(error)) return [];
    assertSupabase(error);
    return data || [];
  }

  async getUsers() {
    const client = await this.open();
    const { data, error } = await client.from("app_users").select("*");
    assertSupabase(error);
    return data || [];
  }

  async getUser(email) {
    const client = await this.open();
    const { data, error } = await client.from("app_users").select("*").eq("email", normalizeEmail(email)).maybeSingle();
    assertSupabase(error);
    return data;
  }

  async getPrivateSettings() {
    const client = await this.open();
    const { data, error } = await client.from("app_settings").select("value").eq("key", "budget_defaults").maybeSingle();
    if (isMissingAppSettingsTableError(error)) return null;
    assertSupabase(error);
    return data?.value || null;
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
    await deleteAllSupabaseRows(client, "budget_rows", "id");
    await deleteAllSupabaseRows(client, "budget_models", "bid_id");
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
          role: userData.role || "Acesso total",
        },
      },
    });
    assertSupabase(signupError);

    const { error } = await client.from("app_users").insert({
      email,
      name: userData.name?.trim() || email,
      role: userData.role || "Acesso total",
      created_at: timestampNow(),
    });
    assertSupabase(error);
  }

  async deleteUser(email) {
    const client = await this.open();
    const { error } = await client.from("app_users").delete().eq("email", normalizeEmail(email));
    assertSupabase(error);
  }

  async saveBid(data, originalId) {
    const client = await this.open();
    const now = timestampNow();
    if (originalId) {
      const { data: existing, error: readError } = await client.from("bids").select("created_at").eq("id", originalId).maybeSingle();
      assertSupabase(readError);
      const { error } = await client
        .from("bids")
        .update({
          ...data,
          created_at: existing?.created_at || now,
          updated_at: now,
        })
        .eq("id", originalId);
      assertSupabase(error);
      return;
    }
    const { error } = await client.from("bids").insert({
      ...data,
      created_at: now,
      updated_at: now,
    });
    assertSupabase(error);
  }

  async saveBidAttachment(bidId, file, previousPath) {
    const client = await this.open();
    const fileName = sanitizeStorageFileName(file.name);
    const filePath = `${crypto.randomUUID()}/${fileName}`;
    const { error: uploadError } = await client.storage.from(BID_EDITAL_BUCKET).upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    assertSupabase(uploadError);

    const attachment = {
      edital_file_path: filePath,
      edital_file_name: file.name,
      edital_file_type: file.type || "application/octet-stream",
      edital_file_size: file.size,
    };
    const { error: updateError } = await client.from("bids").update(attachment).eq("id", bidId);
    if (updateError) {
      await client.storage.from(BID_EDITAL_BUCKET).remove([filePath]);
      assertSupabase(updateError);
    }
    if (previousPath && previousPath !== filePath) {
      const { error: removeError } = await client.storage.from(BID_EDITAL_BUCKET).remove([previousPath]);
      if (removeError) console.warn("Não foi possível remover o anexo anterior do edital.", removeError);
    }
    return attachment;
  }

  async downloadBidAttachment(bid) {
    if (!bid?.edital_file_path) throw new Error("Este edital não possui arquivo anexado.");
    const client = await this.open();
    const { data, error } = await client.storage.from(BID_EDITAL_BUCKET).download(bid.edital_file_path);
    assertSupabase(error);
    return data;
  }

  async deleteBid(bidId) {
    const client = await this.open();
    const { data: bid, error: readError } = await client.from("bids").select("edital_file_path").eq("id", bidId).maybeSingle();
    assertSupabase(readError);
    if (bid?.edital_file_path) {
      const { error: removeError } = await client.storage.from(BID_EDITAL_BUCKET).remove([bid.edital_file_path]);
      assertSupabase(removeError);
    }
    const { error } = await client.from("bids").delete().eq("id", bidId);
    assertSupabase(error);
  }

  async saveItem(bidId, itemData, itemId) {
    const client = await this.open();
    const record = normalizeItemRecord({ ...itemData, id: itemId || undefined, bid_id: bidId });
    const operation = record.id ? client.from("items").upsert(record) : client.from("items").insert(removeEmptyId(record));
    const { error } = await operation;
    if (isMissingSupabaseColumnError(error)) {
      const legacyRecord = legacySupabaseItemRecord(record);
      const legacyOperation = legacyRecord.id ? client.from("items").upsert(legacyRecord) : client.from("items").insert(removeEmptyId(legacyRecord));
      const { error: legacyError } = await legacyOperation;
      assertSupabase(legacyError);
      return;
    }
    assertSupabase(error);
  }

  async deleteItem(itemId) {
    const client = await this.open();
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

  async saveBudgetModel(bidId, columns) {
    const client = await this.open();
    const { error } = await client.from("budget_models").upsert({
      bid_id: bidId,
      columns,
      updated_at: timestampNow(),
    });
    assertSupabase(error);
  }

  async deleteBudgetModel(bidId) {
    const client = await this.open();
    const { error: rowsError } = await client.from("budget_rows").delete().eq("bid_id", bidId);
    assertSupabase(rowsError);
    const { error } = await client.from("budget_models").delete().eq("bid_id", bidId);
    assertSupabase(error);
  }

  async saveBudgetRow(bidId, values, rowId) {
    const client = await this.open();
    const operation = rowId
      ? client.from("budget_rows").update({ values }).eq("id", Number(rowId))
      : client.from("budget_rows").insert({
          bid_id: bidId,
          values,
          created_at: timestampNow(),
        });
    const { error } = await operation;
    assertSupabase(error);
  }

  async deleteBudgetRow(rowId) {
    const client = await this.open();
    const { error } = await client.from("budget_rows").delete().eq("id", Number(rowId));
    assertSupabase(error);
  }
}

const store = createStore();

async function main() {
  applyEnvironmentConfig();
  populateOptions();
  bindEvents();
  if (!hasSupabaseConfig()) refs.loginEmail.value = DEFAULT_ADMIN.email;
  await store.initialize();
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
  refs.resetDataButton.classList.toggle("hidden", hasSupabaseConfig());
  refs.loginHint.classList.toggle("hidden", hasSupabaseConfig());
}

function populateOptions() {
  refs.filterStatus.innerHTML = optionList(["Todos", ...STATUS_OPTIONS]);
  refs.bidStatus.innerHTML = optionList(STATUS_OPTIONS);
  refs.bidType.innerHTML = optionList(BID_TYPE_OPTIONS);
  refs.salesUnit.innerHTML = optionList(SALES_UNIT_OPTIONS);
  refs.budgetColumnType.innerHTML = BUDGET_COLUMN_TYPES.map((type) => `<option value="${type.value}">${type.label}</option>`).join("");
  refs.budgetColumnSection.innerHTML = BUDGET_SECTION_OPTIONS.map((section) => `<option value="${section.value}">${section.label}</option>`).join("");
  refs.budgetColumnSource.innerHTML = BUDGET_SOURCE_OPTIONS.map((source) => `<option value="${source.value}">${source.label}</option>`).join("");
}

function optionList(values) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function bindEvents() {
  refs.loginForm.addEventListener("submit", handleLogin);
  refs.homeIconButton.addEventListener("click", () => setPage("home"));
  document.querySelectorAll("[data-navigation-page]").forEach((button) => {
    button.addEventListener("click", () => setPage(button.dataset.navigationPage));
  });
  document.querySelectorAll("[data-open-new]").forEach((button) => {
    button.addEventListener("click", () => clearBidForm({ openEditor: true }));
  });
  refs.viewAllBidsButton.addEventListener("click", () => setPage("bids"));
  refs.menuToggleButton.addEventListener("click", () => {
    const isOpen = refs.appView.classList.toggle("mobile-nav-open");
    refs.menuToggleButton.setAttribute("aria-expanded", String(isOpen));
  });
  refs.toggleSidebarButton.addEventListener("click", toggleSidebar);
  refs.toggleSidebarButton.addEventListener("mouseenter", previewSidebar);
  refs.toggleSidebarButton.addEventListener("mouseleave", clearSidebarPreview);
  refs.toggleSidebarButton.addEventListener("focus", previewSidebar);
  refs.toggleSidebarButton.addEventListener("blur", clearSidebarPreview);
  refs.sidebarPanel.addEventListener("click", collapseSidebarFromEmptyArea);
  refs.logoutButton.addEventListener("click", logout);
  if (!hasSupabaseConfig()) {
    refs.resetDataButton.addEventListener("click", resetSeedData);
  }
  refs.filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderBids();
  });
  refs.clearFiltersButton.addEventListener("click", clearFilters);
  document.querySelectorAll("[data-home-status]").forEach((button) => {
    button.addEventListener("click", () => applyHomeStatusFilter(button.dataset.homeStatus));
  });
  refs.bidForm.addEventListener("submit", saveBid);
  refs.downloadEditalButton.addEventListener("click", downloadCurrentBidAttachment);
  refs.clearBidButton.addEventListener("click", () => clearBidForm({ openEditor: true }));
  refs.deleteBidButton.addEventListener("click", deleteCurrentBid);
  refs.itemForm.addEventListener("submit", saveItem);
  refs.addSupplierLinkButton.addEventListener("click", addSupplierLink);
  refs.supplierLinkInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSupplierLink();
    }
  });
  refs.clearItemButton.addEventListener("click", clearItemForm);
  refs.deleteItemButton.addEventListener("click", deleteCurrentItem);
  refs.documentForm.addEventListener("submit", saveDocument);
  refs.clearDocumentButton.addEventListener("click", clearDocumentForm);
  refs.deleteDocumentButton.addEventListener("click", deleteCurrentDocument);
  refs.failureForm.addEventListener("submit", saveFailure);
  refs.clearFailureButton.addEventListener("click", clearFailureForm);
  refs.deleteFailureButton.addEventListener("click", deleteCurrentFailure);
  refs.bidStatus.addEventListener("change", handleBidStatusChange);
  refs.addBudgetColumnButton.addEventListener("click", addBudgetColumn);
  refs.addBudgetBlockButton.addEventListener("click", addBudgetBlock);
  refs.toggleBudgetModelButton.addEventListener("click", toggleBudgetModel);
  refs.toggleBudgetPreviewButton.addEventListener("click", toggleBudgetPreview);
  refs.budgetSettingsForm.addEventListener("input", updateBudgetSettingsDraft);
  refs.budgetSettingsForm.addEventListener("change", updateBudgetSettingsDraft);
  refs.budgetHeaderLogoFile.addEventListener("change", () => handleBudgetImageUpload("headerLogo"));
  refs.budgetWatermarkFile.addEventListener("change", () => handleBudgetImageUpload("watermark"));
  document.querySelectorAll("[data-budget-shortcut-name]").forEach((button) => {
    button.addEventListener("click", () =>
      addBudgetShortcutColumn(button.dataset.budgetShortcutName, button.dataset.budgetShortcutType, button.dataset.budgetShortcutSource)
    );
  });
  refs.saveBudgetModelButton.addEventListener("click", saveBudgetModel);
  refs.clearBudgetModelButton.addEventListener("click", clearBudgetModel);
  refs.printBudgetPreviewButton.addEventListener("click", () => window.print());
  refs.budgetEntryForm.addEventListener("submit", saveBudgetEntry);
  refs.userForm.addEventListener("submit", saveUser);
  refs.clearUserButton.addEventListener("click", clearUserForm);
  refs.itemsTabButton.addEventListener("click", () => setPage("items"));
  refs.documentsTabButton.addEventListener("click", () => setPage("documents"));
  refs.budgetTabButton.addEventListener("click", () => setPage("budget"));
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
  refs.maxValue.addEventListener("input", updateMarginFromFinalValue);
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
    appState.authenticated = true;
    appState.currentUserEmail = user.email;
    const privateSettings = await store.getPrivateSettings();
    if (privateSettings) Object.assign(DEFAULT_BUDGET_SETTINGS, privateSettings);
    refs.currentUserName.textContent = user.name || user.email;
    refs.loginView.classList.add("hidden");
    refs.appView.classList.remove("hidden");
    if (store.requiresAuthenticationBeforeData) {
      const seedData = await loadSeedData();
      await store.seedIfEmpty(seedData);
    }
    setPage("home");
    await reloadData();
    clearBidForm();
    showToast("Login realizado.");
  } catch (error) {
    refs.loginError.textContent = error.message;
  }
}

function logout() {
  appState.authenticated = false;
  appState.currentUserEmail = null;
  refs.appView.classList.add("hidden");
  refs.loginView.classList.remove("hidden");
  refs.loginPassword.value = "";
  refs.appView.classList.remove("mobile-nav-open");
}

async function resetSeedData() {
  if (!confirm("Restaurar a base inicial de demonstração? As alterações locais deste protótipo serão perdidas.")) return;
  const seedData = await loadSeedData();
  await store.applySeed(seedData);
  await reloadData();
  clearBidForm();
  showToast("Base inicial restaurada.");
}

async function reloadData() {
  appState.bids = (await store.getAll("bids"))
    .map(normalizeBidRecord)
    .sort((a, b) => String(a.session_datetime).localeCompare(String(b.session_datetime)));
  appState.items = (await store.getAll("items")).map(normalizeItemRecord).sort((a, b) => Number(a.item_number) - Number(b.item_number));
  appState.documents = (await store.getAll("documents")).sort((a, b) => String(a.document_type).localeCompare(String(b.document_type)));
  appState.failureHistory = (await store.getAll("failure_history")).map(normalizeFailureRecord).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  appState.budgetModels = await store.getAll("budget_models");
  appState.budgetRows = (await store.getAll("budget_rows")).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  appState.users = (await store.getUsers()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  renderBids();
  renderDetails();
  renderUsers();
}

function setPage(page) {
  const detailPages = ["items", "documents", "budget", "failures"];
  if (page === "users") page = "settings";
  if (detailPages.includes(page) && !appState.currentBidId) {
    page = "home";
  }
  if (page === "failures" && !shouldShowFailureHistory()) {
    page = appState.currentBidId ? "items" : "home";
  }
  appState.activePage = page;
  const showUsers = page === "users";
  const showSettings = page === "settings";
  const showHome = page === "home";
  const showCatalog = page === "bids";
  const showEditor = page === "edit";
  const showDetail = detailPages.includes(page);
  refs.bidsPage.classList.toggle("hidden", showUsers || showSettings);
  refs.usersPage.classList.toggle("hidden", !showUsers);
  refs.settingsPage.classList.toggle("hidden", !showSettings);
  refs.homePage.classList.toggle("hidden", !showHome);
  refs.bidCatalogPage.classList.toggle("hidden", !showCatalog);
  refs.bidForm.classList.toggle("hidden", !showEditor && !showDetail);
  refs.bidWorkspaceHeader.classList.toggle("hidden", !showEditor && !showDetail);
  refs.metricsSection.classList.toggle("hidden", page !== "items");
  refs.detailsArea.classList.toggle("hidden", !showDetail);
  refs.itemsPanel.classList.toggle("hidden", page !== "items");
  refs.documentsPanel.classList.toggle("hidden", page !== "documents");
  refs.failuresPanel.classList.toggle("hidden", page !== "failures");
  refs.budgetPage.classList.toggle("hidden", page !== "budget");
  refs.appView.classList.toggle("users-active", showUsers || showSettings);
  refs.itemsTabButton.classList.toggle("active", page === "items");
  refs.documentsTabButton.classList.toggle("active", page === "documents");
  refs.budgetTabButton.classList.toggle("active", page === "budget");
  refs.failuresTabButton.classList.toggle("active", page === "failures");
  refs.failuresTabButton.classList.toggle("hidden", !shouldShowFailureHistory());
  const primaryPage = showUsers ? "users" : showSettings ? "settings" : showHome ? "home" : "bids";
  const pageLabels = { home: "Visão geral", bids: "Licitações", users: "Usuários", settings: "Configurações" };
  refs.breadcrumbLabel.textContent = pageLabels[primaryPage];
  document.querySelectorAll("[data-navigation-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.navigationPage === primaryPage);
  });
  refs.appView.classList.remove("mobile-nav-open");
  refs.menuToggleButton.setAttribute("aria-expanded", "false");
  updateBidWorkspaceHeader();
  updateSidebarVisibility();
  if (showUsers) renderUsers();
  if (page === "budget") renderBudgetPage();
}

function updateBidWorkspaceHeader() {
  const bid = currentBid();
  refs.currentBidTitle.textContent = bid?.id || "Novo edital";
  refs.currentBidAgency.textContent = bid?.buyer_agency || "Preencha os dados para cadastrar um novo edital.";
}

function handleBidStatusChange() {
  refs.failuresTabButton.classList.toggle("hidden", !shouldShowFailureHistory());
  updateItemWonVisibility();
  if (appState.activePage === "failures" && !shouldShowFailureHistory()) setPage("items");
}

function shouldShowFailureHistory() {
  return Boolean(appState.currentBidId) && refs.bidStatus.value === "Desclassificado";
}

function shouldShowItemWon() {
  return Boolean(appState.currentBidId) && ["Aprovada", "Desclassificado", "Disputada"].includes(refs.bidStatus.value);
}

function updateItemWonVisibility() {
  refs.wonField.classList.toggle("hidden", !shouldShowItemWon());
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
          <td><strong class="table-link">${escapeHtml(bid.id)}</strong></td>
          <td>${escapeHtml(bid.buyer_agency || "")}</td>
          <td>${formatDateTime(bid.session_datetime)}</td>
          <td>${escapeHtml(bid.bid_type || "")}</td>
          <td><span class="status-pill ${statusBadgeClass(bid.status)}">${escapeHtml(statusDisplay(bid.status))}</span></td>
          <td class="numeric">${summary.itemCount}</td>
          <td class="numeric"><strong>${money(summary.totalFinal)}</strong></td>
          <td><button class="icon-button row-action" type="button" aria-label="Abrir ${escapeHtml(bid.id)}">→</button></td>
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

function loadBid(bidId) {
  const bid = appState.bids.find((row) => row.id === bidId);
  if (!bid) return;
  appState.currentBidId = bid.id;
  appState.originalBidId = bid.id;
  refs.bidId.value = bid.id || "";
  refs.buyerAgency.value = bid.buyer_agency || "";
  refs.sessionDatetime.value = toDateTimeInputValue(bid.session_datetime);
  refs.proposalDeadline.value = toDateTimeInputValue(bid.proposal_deadline);
  refs.deliveryPlace.value = bid.delivery_place || "";
  refs.editalLink.value = bid.edital_link || "";
  refs.bidType.value = bid.bid_type || BID_TYPE_OPTIONS[0];
  refs.bidStatus.value = bid.status || STATUS_OPTIONS[0];
  refs.editalFile.value = "";
  renderBidAttachment(bid);
  refs.selectedBidLabel.textContent = bid.id;
  refs.bidFormError.textContent = "";
  const budgetModel = currentBudgetModel();
  appState.budgetDraftColumns = budgetModel?.columns ? cloneColumns(budgetModel.columns) : [];
  appState.budgetDraftSettings = budgetModel?.settings ? cloneBudgetSettings(budgetModel.settings) : defaultBudgetSettingsForBid(bid);
  appState.budgetDraftBlocks = budgetModel?.blocks?.length ? cloneBudgetBlocks(budgetModel.blocks) : cloneBudgetBlocks(DEFAULT_BUDGET_BLOCKS);
  appState.budgetModelDirty = false;
  appState.currentBudgetRowId = null;
  clearItemForm();
  clearDocumentForm();
  clearFailureForm();
  renderBids();
  renderDetails();
  if (["home", "bids", "edit"].includes(appState.activePage)) setPage("items");
}

function renderHomeSummary() {
  const counts = appState.bids.reduce(
    (acc, bid) => {
      acc.total += 1;
      if (bid.status === "Em Analise") acc.analysis += 1;
      if (bid.status === "Aprovada") acc.approved += 1;
      if (bid.status === "Desclassificado") acc.disqualified += 1;
      if (bid.status === "Disputada") acc.disputed += 1;
      return acc;
    },
    { total: 0, analysis: 0, approved: 0, disqualified: 0, disputed: 0 }
  );
  refs.homeTotalBids.textContent = String(counts.total);
  refs.homeAnalysisBids.textContent = String(counts.analysis);
  refs.homeApprovedBids.textContent = String(counts.approved);
  refs.homeDisqualifiedBids.textContent = String(counts.disqualified);
  refs.homeDisputedBids.textContent = String(counts.disputed);
  document.querySelectorAll("[data-home-status]").forEach((button) => {
    button.classList.toggle("active", refs.filterStatus.value === button.dataset.homeStatus);
  });

  const upcoming = appState.bids
    .filter((bid) => new Date(bid.session_datetime).getTime() >= Date.now() - 86400000)
    .sort((a, b) => new Date(a.session_datetime) - new Date(b.session_datetime))
    .slice(0, 4);
  refs.upcomingBidsList.innerHTML = upcoming.length
    ? upcoming.map((bid) => {
        const date = new Date(bid.session_datetime);
        return `<button class="timeline-item" type="button" data-upcoming-bid="${escapeHtml(bid.id)}">
          <span class="date-box"><strong>${String(date.getDate()).padStart(2, "0")}</strong><small>${date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</small></span>
          <span class="timeline-copy"><strong>${escapeHtml(bid.id)}</strong><span>${escapeHtml(bid.buyer_agency || "")}</span><small>${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} • ${escapeHtml(bid.bid_type || "")}</small></span>
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
        return `<button class="pending-item" type="button" data-pending-bid="${escapeHtml(document.bid_id)}"><span class="pending-icon">!</span><span><strong>${escapeHtml(document.document_type || "Documento")}</strong><small>${escapeHtml(bid?.id || document.bid_id || "")}</small></span></button>`;
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
  appState.currentFailureId = null;
  refs.bidForm.reset();
  renderBidAttachment(null);
  refs.bidType.value = BID_TYPE_OPTIONS[0];
  refs.bidStatus.value = STATUS_OPTIONS[0];
  refs.selectedBidLabel.textContent = "Novo edital";
  refs.bidFormError.textContent = "";
  appState.budgetDraftColumns = [];
  appState.budgetDraftSettings = { ...DEFAULT_BUDGET_SETTINGS };
  appState.budgetDraftBlocks = cloneBudgetBlocks(DEFAULT_BUDGET_BLOCKS);
  appState.budgetModelDirty = false;
  appState.budgetModelCollapsed = false;
  appState.currentBudgetRowId = null;
  clearItemForm();
  clearDocumentForm();
  clearFailureForm();
  renderBids();
  renderDetails();
  setPage(options.openEditor ? "edit" : "home");
}

async function saveBid(event) {
  event.preventDefault();
  refs.bidFormError.textContent = "";
  try {
    const data = collectBidData();
    const file = refs.editalFile.files[0];
    validateEditalFile(file);
    const duplicate = appState.bids.find((bid) => bid.id === data.id && bid.id !== appState.originalBidId);
    if (duplicate) throw new Error("Já existe um edital com esta identificação.");
    const previousBid = appState.bids.find((bid) => bid.id === appState.originalBidId);
    await store.saveBid(data, appState.originalBidId);
    if (file) await store.saveBidAttachment(data.id, file, previousBid?.edital_file_path);
    appState.currentBidId = data.id;
    appState.originalBidId = data.id;
    await reloadData();
    loadBid(data.id);
    showToast("Edital salvo.");
  } catch (error) {
    refs.bidFormError.textContent = error.message;
  }
}

function validateEditalFile(file) {
  if (!file) return;
  if (file.size > MAX_EDITAL_FILE_SIZE) throw new Error("O arquivo do edital deve ter no máximo 20 MB.");
  if (!file.name.trim()) throw new Error("Selecione um arquivo válido para o edital.");
}

function renderBidAttachment(bid) {
  const hasAttachment = Boolean(bid?.edital_file_name && bid?.edital_file_path);
  refs.editalAttachmentPanel.classList.toggle("hidden", !hasAttachment);
  refs.editalAttachmentName.textContent = hasAttachment
    ? `${bid.edital_file_name} (${formatFileSize(bid.edital_file_size)})`
    : "";
  refs.downloadEditalButton.disabled = !hasAttachment;
}

async function downloadCurrentBidAttachment() {
  refs.bidFormError.textContent = "";
  const bid = appState.bids.find((row) => row.id === appState.currentBidId);
  if (!bid?.edital_file_path) {
    refs.bidFormError.textContent = "Este edital não possui arquivo anexado.";
    return;
  }
  refs.downloadEditalButton.disabled = true;
  try {
    const blob = await store.downloadBidAttachment(bid);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = bid.edital_file_name || "edital";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    showToast("Download do edital iniciado.");
  } catch (error) {
    refs.bidFormError.textContent = error.message;
  } finally {
    refs.downloadEditalButton.disabled = false;
  }
}

function collectBidData() {
  if (!refs.bidId.value.trim()) throw new Error("Preencha a Identificação do Pregão.");
  if (!refs.buyerAgency.value.trim()) throw new Error("Preencha o Órgão Comprador.");
  if (!refs.sessionDatetime.value) throw new Error("Preencha a Data e Hora da Sessão.");
  return {
    id: refs.bidId.value.trim(),
    buyer_agency: refs.buyerAgency.value.trim(),
    session_datetime: fromDateTimeInputValue(refs.sessionDatetime.value),
    delivery_place: refs.deliveryPlace.value.trim(),
    bid_type: refs.bidType.value,
    edital_link: refs.editalLink.value.trim(),
    proposal_deadline: fromDateTimeInputValue(refs.proposalDeadline.value),
    status: refs.bidStatus.value,
  };
}

async function deleteCurrentBid() {
  if (!appState.currentBidId) {
    showToast("Selecione um edital.");
    return;
  }
  if (!confirm(`Excluir o edital ${appState.currentBidId} e todos os seus itens?`)) return;
  await store.deleteBid(appState.currentBidId);
  await reloadData();
  clearBidForm();
  showToast("Edital excluído.");
}

function renderDetails() {
  const items = currentItems();
  const documents = currentDocuments();
  const failures = currentFailures();
  renderMetrics(items);
  renderItems(items);
  renderDocuments(documents);
  renderFailures(failures);
  renderBudgetPage();
  const hasBid = Boolean(appState.currentBidId);
  refs.failuresTabButton.classList.toggle("hidden", !shouldShowFailureHistory());
  updateItemWonVisibility();
  refs.deleteBidButton.disabled = !hasBid;
  refs.itemForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
    if (el.id !== "clearItemButton") el.disabled = !hasBid;
  });
  refs.documentForm.querySelectorAll("input, textarea, button").forEach((el) => {
    if (el.id !== "clearDocumentButton") el.disabled = !hasBid;
  });
  refs.failureForm.querySelectorAll("input, textarea, button").forEach((el) => {
    if (el.id !== "clearFailureButton") el.disabled = !hasBid;
  });
}

function renderMetrics(items) {
  const totals = items.reduce(
    (acc, item) => {
      acc.estimated += Number(item.estimated_value || 0) * Number(item.required_quantity || 0);
      acc.final += Number(item.max_acceptable_value || 0) * Number(item.required_quantity || 0);
      return acc;
    },
    { estimated: 0, final: 0 }
  );
  refs.metricItemCount.textContent = String(items.length);
  refs.metricProfit.textContent = money(totals.estimated);
  refs.metricMargin.textContent = money(totals.final);
  refs.metricProfit.className = "";
  refs.metricMargin.className = "";
}

function renderItems(items) {
  if (!items.length) {
    refs.itemsTableBody.innerHTML = `<tr><td colspan="11">Nenhum item cadastrado.</td></tr>`;
    return;
  }
  refs.itemsTableBody.innerHTML = items
    .map((item) => {
      const selected = Number(item.id) === Number(appState.currentItemId) ? " selected" : "";
      const won = Boolean(Number(item.is_won));
      const wonClass = won ? " item-won" : "";
      const wonIcon = won ? `<span class="item-won-icon" role="img" aria-label="Item vencido" title="Item vencido">✓</span>` : "";
      return `
        <tr class="selectable${selected}${wonClass}" data-item-id="${item.id}">
          <td><span class="item-number-cell">${wonIcon}<span>${item.item_number}</span></span></td>
          <td>${escapeHtml(item.name || "")}</td>
          <td>${escapeHtml(item.brand_model || "")}</td>
          <td>${escapeHtml(item.sales_unit || "")}</td>
          <td class="numeric">${item.required_quantity}</td>
          <td class="numeric">${money(item.estimated_value)}</td>
          <td class="numeric">${money(item.supplier_cost)}</td>
          <td class="numeric">${money(item.max_acceptable_value)}</td>
          <td class="numeric">${formatStoredProfitMargin(item)}</td>
          <td class="numeric">${money(item.minimum_bid)}</td>
          <td class="numeric">${formatStoredItemProfit(item)}</td>
        </tr>
      `;
    })
    .join("");

  refs.itemsTableBody.querySelectorAll("[data-item-id]").forEach((row) => {
    row.addEventListener("click", () => loadItem(Number(row.dataset.itemId)));
  });
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
  return (Number(finalValue) - Number(costValue)) * Number(quantity || 0);
}

function calculateProfitMargin(finalValue, costValue) {
  const cost = Number(costValue);
  if (!cost) return null;
  return ((Number(finalValue) - cost) / cost) * 100;
}

function calculateValueWithMargin(costValue, marginValue) {
  return Number(costValue) * (1 + Number(marginValue) / 100);
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
  appState.itemMarginCalculationSource = "margin";
  updateValueWithMargin();
  updateItemProfit();
  refs.brandModel.value = item.brand_model || "";
  refs.itemWon.checked = Boolean(Number(item.is_won));
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
  appState.itemMarginCalculationSource = "margin";
  updateValueWithMargin();
  updateItemProfit();
  refs.selectedItemLabel.textContent = "Novo item";
  refs.itemFormError.textContent = "";
  renderItems(currentItems());
}

function addSupplierLink() {
  refs.itemFormError.textContent = "";
  const link = normalizeUrlValue(refs.supplierLinkInput.value);
  if (!link) {
    refs.itemFormError.textContent = "Informe um Link do Fornecedor válido.";
    return;
  }
  if (appState.supplierLinksDraft.some((currentLink) => currentLink.toLowerCase() === link.toLowerCase())) {
    refs.itemFormError.textContent = "Este Link do Fornecedor já foi cadastrado.";
    return;
  }
  appState.supplierLinksDraft.push(link);
  refs.supplierLinkInput.value = "";
  renderSupplierLinks();
  refs.supplierLinkInput.focus();
}

function removeSupplierLink(index) {
  appState.supplierLinksDraft.splice(index, 1);
  renderSupplierLinks();
}

function renderSupplierLinks() {
  if (!appState.supplierLinksDraft.length) {
    refs.supplierLinksList.innerHTML = `<span class="supplier-links-empty">Nenhum link de fornecedor cadastrado.</span>`;
    return;
  }
  refs.supplierLinksList.innerHTML = appState.supplierLinksDraft
    .map(
      (link, index) => `
        <div class="supplier-link-row">
          <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(link)}">${escapeHtml(link)}</a>
          <button class="delete-supplier-link" type="button" data-delete-supplier-link="${index}" aria-label="Excluir link ${index + 1}" title="Excluir link">×</button>
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
  const quantity = parseIntOptional(refs.requiredQuantity.value, "Quantidade Exigida");
  const technicalText = refs.technicalRegistrationText.value.trim();
  const supplierCost = parseDecimal(refs.supplierCost.value, "Valor de Custo", false);
  const finalValue = parseDecimal(refs.maxValue.value, "Valor Final", false);
  const profitMargin = refs.profitMargin.value.trim()
    ? parseProfitMargin(refs.profitMargin.value)
    : supplierCost && refs.maxValue.value.trim()
      ? calculateProfitMargin(finalValue, supplierCost)
      : null;
  return {
    item_number: itemNumber,
    name,
    description: technicalText,
    technical_registration_text: technicalText,
    estimated_value: parseDecimal(refs.estimatedValue.value, "Estimado no Edital", false),
    max_acceptable_value: finalValue,
    minimum_bid: parseDecimal(refs.minimumBid.value, "Lance Mínimo", false),
    brand_model: refs.brandModel.value.trim(),
    is_won: refs.itemWon.checked ? 1 : 0,
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

function addBudgetColumn() {
  refs.budgetModelError.textContent = "";
  if (!appState.currentBidId) {
    refs.budgetModelError.textContent = "Selecione um edital antes de configurar o modelo.";
    return;
  }
  const name = refs.budgetColumnName.value.trim();
  const type = refs.budgetColumnType.value;
  const section = refs.budgetColumnSection.value;
  const source = refs.budgetColumnSource.value;
  const width = parseBudgetColumnWidth(refs.budgetColumnWidth.value);
  if (!name) {
    refs.budgetModelError.textContent = "Informe o nome da coluna.";
    return;
  }
  addBudgetColumnToDraft(name, type, section, source, width);
  refs.budgetColumnName.value = "";
  refs.budgetColumnWidth.value = "";
  renderBudgetPage();
}

function addBudgetShortcutColumn(name, type, source = "manual") {
  refs.budgetModelError.textContent = "";
  if (!appState.currentBidId) {
    refs.budgetModelError.textContent = "Selecione um edital antes de configurar o modelo.";
    return;
  }
  addBudgetColumnToDraft(name, type, "table", source);
  renderBudgetPage();
}

function addBudgetColumnToDraft(name, type, section = "table", source = "manual", width = "") {
  appState.budgetDraftColumns.push({
    id: `col_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name,
    type,
    section,
    source,
    width,
  });
  markBudgetModelDirty();
}

function addBudgetBlock() {
  refs.budgetModelError.textContent = "";
  if (!appState.currentBidId) {
    refs.budgetModelError.textContent = "Selecione um edital antes de adicionar blocos.";
    return;
  }
  const block = collectBudgetBlockForm();
  if (!block.content) {
    refs.budgetModelError.textContent = "Informe o conteúdo do bloco.";
    return;
  }
  appState.budgetDraftBlocks.push(block);
  refs.budgetBlockForm.reset();
  refs.budgetBlockAlign.value = "center";
  refs.budgetBlockSize.value = "normal";
  refs.budgetBlockBold.checked = true;
  refs.budgetBlockUnderline.checked = true;
  markBudgetModelDirty();
  renderBudgetPage();
}

function toggleBudgetModel() {
  appState.budgetModelCollapsed = !appState.budgetModelCollapsed;
  renderBudgetPage();
}

function toggleBudgetPreview() {
  appState.budgetPreviewVisible = !appState.budgetPreviewVisible;
  renderBudgetPage();
}

async function saveBudgetModel() {
  refs.budgetModelError.textContent = "";
  if (!appState.currentBidId) {
    refs.budgetModelError.textContent = "Selecione um edital antes de confirmar o modelo.";
    return;
  }
  if (!appState.budgetDraftColumns.length) {
    refs.budgetModelError.textContent = "Adicione ao menos uma coluna ao modelo.";
    return;
  }
  appState.budgetDraftSettings = collectBudgetSettings();
  await store.saveBudgetModel(appState.currentBidId, {
    version: 2,
    settings: cloneBudgetSettings(appState.budgetDraftSettings),
    blocks: cloneBudgetBlocks(appState.budgetDraftBlocks),
    columns: cloneColumns(appState.budgetDraftColumns),
  });
  appState.budgetModelCollapsed = false;
  appState.budgetModelDirty = false;
  appState.currentBudgetRowId = null;
  await reloadData();
  setPage("budget");
  showToast("Modelo de orçamento confirmado.");
}

async function clearBudgetModel() {
  refs.budgetModelError.textContent = "";
  if (!appState.currentBidId) {
    refs.budgetModelError.textContent = "Selecione um edital.";
    return;
  }
  if (!confirm("Limpar o modelo e as propostas preenchidas para este edital?")) return;
  await store.deleteBudgetModel(appState.currentBidId);
  appState.budgetDraftColumns = [];
  appState.budgetDraftSettings = defaultBudgetSettingsForBid(currentBid());
  appState.budgetDraftBlocks = cloneBudgetBlocks(DEFAULT_BUDGET_BLOCKS);
  appState.budgetModelDirty = false;
  appState.budgetModelCollapsed = false;
  appState.currentBudgetRowId = null;
  await reloadData();
  setPage("budget");
  showToast("Modelo de orçamento limpo.");
}

async function saveBudgetEntry(event) {
  event.preventDefault();
  refs.budgetEntryError.textContent = "";
  const model = currentBudgetModel();
  if (!appState.currentBidId || !model?.columns?.length) {
    refs.budgetEntryError.textContent = "Confirme o modelo antes de preencher a proposta.";
    return;
  }
  try {
    const values = {};
    applyBudgetAutoTotal(model);
    for (const column of budgetTableColumns(model)) {
      const input = refs.budgetEntryForm.querySelector(`[data-budget-column="${column.id}"]`);
      values[column.id] = normalizeBudgetValue(input?.value || "", column);
    }
    await store.saveBudgetRow(appState.currentBidId, values, appState.currentBudgetRowId);
    appState.currentBudgetRowId = null;
    refs.budgetEntryForm.reset();
    await reloadData();
    loadBid(appState.currentBidId);
    setPage("budget");
    showToast("Linha da proposta salva.");
  } catch (error) {
    refs.budgetEntryError.textContent = error.message;
  }
}

async function deleteBudgetRow(rowId) {
  if (!confirm("Excluir esta linha da proposta?")) return;
  await store.deleteBudgetRow(rowId);
  if (Number(appState.currentBudgetRowId) === Number(rowId)) {
    appState.currentBudgetRowId = null;
    refs.budgetEntryForm.reset();
  }
  await reloadData();
  setPage("budget");
  showToast("Linha excluída.");
}

function renderBudgetPage() {
  const bid = appState.bids.find((row) => row.id === appState.currentBidId);
  const model = currentBudgetModel();
  const hasBid = Boolean(bid);
  if (hasBid && !appState.budgetDraftSettings) appState.budgetDraftSettings = defaultBudgetSettingsForBid(bid);
  refs.budgetBidLabel.textContent = hasBid ? bid.id : "Selecione um edital";
  refs.budgetModelBody.classList.toggle("hidden", appState.budgetModelCollapsed);
  refs.toggleBudgetModelButton.textContent = appState.budgetModelCollapsed ? "Expandir" : "Recolher";
  refs.toggleBudgetModelButton.disabled = !hasBid;
  refs.toggleBudgetPreviewButton.textContent = appState.budgetPreviewVisible ? "Ocultar prévia" : "Exibir prévia";
  refs.toggleBudgetPreviewButton.disabled = !hasBid;
  refs.budgetBuilderLayout.classList.toggle("preview-hidden", !appState.budgetPreviewVisible);
  refs.budgetPreviewPanel.classList.toggle("hidden", !appState.budgetPreviewVisible);
  updateSidebarVisibility();
  refs.budgetSettingsForm.querySelectorAll("input, select, textarea").forEach((el) => {
    el.disabled = !hasBid;
  });
  refs.budgetBlockForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
    el.disabled = !hasBid;
  });
  refs.budgetColumnForm.querySelectorAll("input, select, button").forEach((el) => {
    el.disabled = !hasBid;
  });
  document.querySelectorAll("[data-budget-shortcut-name]").forEach((button) => {
    button.disabled = !hasBid;
  });
  refs.saveBudgetModelButton.disabled = !hasBid;
  refs.clearBudgetModelButton.disabled = !hasBid;
  refs.importBudgetItemsButton.disabled = true;
  refs.printBudgetPreviewButton.disabled = !hasBid || !appState.budgetPreviewVisible;
  fillBudgetSettingsForm(hasBid ? appState.budgetDraftSettings : { ...DEFAULT_BUDGET_SETTINGS });
  renderBudgetBlocks();
  renderBudgetColumns();
  renderBudgetEntryForm(model);
  renderBudgetTable(model);
  renderBudgetPreview(draftBudgetModel());
  if (appState.budgetModelDirty && !refs.budgetModelError.textContent) {
    refs.budgetModelError.textContent = "Modelo alterado. Clique em Confirmar Modelo para salvar as mudanças.";
  }
}

function renderBudgetColumns() {
  if (!appState.currentBidId) {
    refs.budgetColumnsList.innerHTML = `<div class="empty-state">Selecione um edital para configurar o modelo.</div>`;
    return;
  }
  if (!appState.budgetDraftColumns.length) {
    refs.budgetColumnsList.innerHTML = `<div class="empty-state">Nenhuma coluna configurada para este modelo.</div>`;
    return;
  }
  refs.budgetColumnsList.innerHTML = appState.budgetDraftColumns
    .map(
      (column, index) => `
        <div class="column-row" draggable="true" data-budget-column-row="${column.id}">
          <span>${index + 1}</span>
          <div>
            <strong>${escapeHtml(column.name)}</strong>
            <small>${escapeHtml(budgetSectionLabel(column.section))} · ${escapeHtml(budgetSourceLabel(column.source))}</small>
          </div>
          <label class="inline-width-control">
            Largura %
            <input type="number" min="4" max="80" step="1" value="${escapeHtml(column.width || "")}" data-budget-column-width="${column.id}" placeholder="Auto" />
          </label>
          <button class="danger-action compact-action" type="button" data-remove-budget-column="${column.id}">Remover</button>
        </div>
      `
    )
    .join("");
  refs.budgetColumnsList.querySelectorAll("[data-remove-budget-column]").forEach((button) => {
    button.addEventListener("click", () => {
      const columnId = button.getAttribute("data-remove-budget-column");
      appState.budgetDraftColumns = appState.budgetDraftColumns.filter((column) => column.id !== columnId);
      markBudgetModelDirty();
      renderBudgetPage();
    });
  });
  refs.budgetColumnsList.querySelectorAll("[data-budget-column-width]").forEach((input) => {
    const updateColumnWidth = () => {
      const column = appState.budgetDraftColumns.find((draftColumn) => draftColumn.id === input.dataset.budgetColumnWidth);
      if (!column) return;
      column.width = parseBudgetColumnWidth(input.value);
      markBudgetModelDirty();
      renderBudgetPreview(draftBudgetModel());
    };
    input.addEventListener("input", updateColumnWidth);
    input.addEventListener("change", () => {
      updateColumnWidth();
      const column = appState.budgetDraftColumns.find((draftColumn) => draftColumn.id === input.dataset.budgetColumnWidth);
      if (column) input.value = column.width || "";
    });
  });
  refs.budgetColumnsList.querySelectorAll("[data-budget-column-row]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      appState.draggedBudgetColumnId = row.getAttribute("data-budget-column-row");
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => {
      appState.draggedBudgetColumnId = null;
      row.classList.remove("dragging");
    });
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      const targetId = row.getAttribute("data-budget-column-row");
      reorderBudgetColumn(appState.draggedBudgetColumnId, targetId);
    });
  });
}

function reorderBudgetColumn(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const sourceIndex = appState.budgetDraftColumns.findIndex((column) => column.id === sourceId);
  const targetIndex = appState.budgetDraftColumns.findIndex((column) => column.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [moved] = appState.budgetDraftColumns.splice(sourceIndex, 1);
  appState.budgetDraftColumns.splice(targetIndex, 0, moved);
  markBudgetModelDirty();
  renderBudgetPage();
}

function markBudgetModelDirty() {
  appState.budgetModelDirty = true;
}

function renderBudgetBlocks() {
  if (!appState.currentBidId) {
    refs.budgetBlocksList.innerHTML = `<div class="empty-state">Selecione um edital para configurar os blocos.</div>`;
    return;
  }
  if (!appState.budgetDraftBlocks.length) {
    refs.budgetBlocksList.innerHTML = `<div class="empty-state">Nenhum bloco configurado.</div>`;
    return;
  }
  refs.budgetBlocksList.innerHTML = appState.budgetDraftBlocks
    .map(
      (block, index) => `
        <div class="column-row block-row" draggable="true" data-budget-block-row="${block.id}">
          <span>${index + 1}</span>
          <div>
            <strong>${escapeHtml(block.label || "Bloco do documento")}</strong>
            <small>${escapeHtml(budgetBlockSummary(block))}</small>
          </div>
          <small>${escapeHtml(block.content || "").slice(0, 80)}</small>
          <button class="danger-action compact-action" type="button" data-remove-budget-block="${block.id}">Remover</button>
        </div>
      `
    )
    .join("");
  refs.budgetBlocksList.querySelectorAll("[data-remove-budget-block]").forEach((button) => {
    button.addEventListener("click", () => {
      const blockId = button.getAttribute("data-remove-budget-block");
      appState.budgetDraftBlocks = appState.budgetDraftBlocks.filter((block) => block.id !== blockId);
      markBudgetModelDirty();
      renderBudgetPage();
    });
  });
  refs.budgetBlocksList.querySelectorAll("[data-budget-block-row]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      appState.draggedBudgetBlockId = row.getAttribute("data-budget-block-row");
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => {
      appState.draggedBudgetBlockId = null;
      row.classList.remove("dragging");
    });
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      reorderBudgetBlock(appState.draggedBudgetBlockId, row.getAttribute("data-budget-block-row"));
    });
  });
}

function reorderBudgetBlock(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const sourceIndex = appState.budgetDraftBlocks.findIndex((block) => block.id === sourceId);
  const targetIndex = appState.budgetDraftBlocks.findIndex((block) => block.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [moved] = appState.budgetDraftBlocks.splice(sourceIndex, 1);
  appState.budgetDraftBlocks.splice(targetIndex, 0, moved);
  markBudgetModelDirty();
  renderBudgetPage();
}

function renderBudgetEntryForm(model) {
  const tableColumns = budgetTableColumns(model);
  if (!appState.currentBidId) {
    refs.budgetFillStatus.textContent = "Selecione um edital.";
    refs.budgetEntryForm.innerHTML = "";
    return;
  }
  if (!tableColumns.length) {
    refs.budgetFillStatus.textContent = "Configure e confirme o modelo antes de preencher.";
    refs.budgetEntryForm.innerHTML = "";
    return;
  }
  refs.budgetFillStatus.textContent = appState.currentBudgetRowId
    ? "Editando linha selecionada"
    : `${tableColumns.length} colunas da tabela configuradas`;
  refs.budgetEntryForm.innerHTML = `
    <div class="form-grid three">
      ${tableColumns.map((column) => budgetInputMarkup(column)).join("")}
    </div>
    <div class="button-row end">
      <button class="primary-action" type="submit">Salvar Linha</button>
    </div>
  `;
  bindBudgetAutoTotal(model);
  bindAutoGrowTextareas(refs.budgetEntryForm);
  const selectedRow = currentBudgetRows().find((row) => Number(row.id) === Number(appState.currentBudgetRowId));
  if (selectedRow) fillBudgetEntryForm(model, selectedRow);
}

function renderBudgetTable(model) {
  const tableColumns = budgetTableColumns(model);
  if (!tableColumns.length) {
    refs.budgetTableHead.innerHTML = "";
    refs.budgetTableBody.innerHTML = `<tr><td>Nenhum modelo confirmado.</td></tr>`;
    return;
  }
  refs.budgetTableHead.innerHTML = `
    <tr>
      ${tableColumns.map((column) => `<th>${escapeHtml(column.name)}</th>`).join("")}
      <th>Ações</th>
    </tr>
  `;
  const rows = currentBudgetRows();
  if (!rows.length) {
    refs.budgetTableBody.innerHTML = `<tr><td colspan="${tableColumns.length + 1}">Nenhuma linha preenchida.</td></tr>`;
    return;
  }
  refs.budgetTableBody.innerHTML = rows
    .map(
      (row) => {
        const selected = Number(row.id) === Number(appState.currentBudgetRowId) ? " selected" : "";
        return `
        <tr class="selectable${selected}" data-budget-row-id="${row.id}">
          ${tableColumns.map((column) => `<td>${formatBudgetCellHtml(row.values?.[column.id], column)}</td>`).join("")}
          <td><button class="danger-action compact-action" type="button" data-delete-budget-row="${row.id}">Excluir</button></td>
        </tr>
      `;
      }
    )
    .join("");
  refs.budgetTableBody.querySelectorAll("[data-budget-row-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      loadBudgetRowForEditing(row.dataset.budgetRowId);
    });
  });
  refs.budgetTableBody.querySelectorAll("[data-delete-budget-row]").forEach((button) => {
    button.addEventListener("click", () => deleteBudgetRow(button.dataset.deleteBudgetRow));
  });
}

function loadBudgetRowForEditing(rowId) {
  const model = currentBudgetModel();
  const row = currentBudgetRows().find((budgetRow) => Number(budgetRow.id) === Number(rowId));
  if (!model || !row) return;
  appState.currentBudgetRowId = row.id;
  fillBudgetEntryForm(model, row);
  renderBudgetTable(model);
  refs.budgetFillStatus.textContent = "Editando linha selecionada";
}

function fillBudgetEntryForm(model, row) {
  for (const column of model.columns) {
    const input = refs.budgetEntryForm.querySelector(`[data-budget-column="${column.id}"]`);
    if (!input) continue;
    input.value = budgetInputValue(row.values?.[column.id], column.type);
    if (input.classList.contains("auto-grow-textarea")) resizeTextarea(input);
  }
  applyBudgetAutoTotal(model);
}

async function importBudgetItemsToProposal() {
  refs.budgetEntryError.textContent = "";
  const model = currentBudgetModel();
  const tableColumns = budgetTableColumns(model);
  const items = currentItems();
  if (!appState.currentBidId || !tableColumns.length) {
    refs.budgetEntryError.textContent = "Confirme o modelo antes de importar itens.";
    return;
  }
  if (!items.length) {
    refs.budgetEntryError.textContent = "Cadastre itens neste edital antes de importar.";
    return;
  }
  const existingRows = currentBudgetRows();
  if (existingRows.length && !confirm("Substituir as linhas preenchidas pelos itens cadastrados?")) return;
  for (const row of existingRows) await store.deleteBudgetRow(row.id);
  for (const item of items) {
    const values = {};
    for (const column of tableColumns) {
      values[column.id] = normalizeBudgetValue(budgetValueFromItem(column, item), column);
    }
    await store.saveBudgetRow(appState.currentBidId, values);
  }
  await reloadData();
  setPage("budget");
  showToast("Itens importados para a proposta.");
}

function updateBudgetSettingsDraft() {
  if (!appState.currentBidId) return;
  appState.budgetDraftSettings = collectBudgetSettings();
  markBudgetModelDirty();
  renderBudgetPreview(draftBudgetModel());
}

async function handleBudgetImageUpload(kind) {
  if (!appState.currentBidId) return;
  const fileInput = kind === "headerLogo" ? refs.budgetHeaderLogoFile : refs.budgetWatermarkFile;
  const statusRef = kind === "headerLogo" ? refs.budgetHeaderLogoStatus : refs.budgetWatermarkStatus;
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    statusRef.textContent = "Selecione um arquivo de imagem.";
    fileInput.value = "";
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    appState.budgetDraftSettings = collectBudgetSettings();
    appState.budgetDraftSettings[`${kind}Image`] = dataUrl;
    appState.budgetDraftSettings[`${kind}Name`] = file.name;
    if (kind === "headerLogo") appState.budgetDraftSettings.headerLogoEnabled = true;
    if (kind === "watermark") appState.budgetDraftSettings.watermarkEnabled = true;
    markBudgetModelDirty();
    fillBudgetSettingsForm(appState.budgetDraftSettings);
    renderBudgetPreview(draftBudgetModel());
  } catch (_error) {
    statusRef.textContent = "Não foi possível carregar a imagem.";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function collectBudgetBlockForm() {
  return normalizeBudgetBlock({
    id: `block_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    label: refs.budgetBlockLabel.value.trim(),
    content: refs.budgetBlockContent.value.trim(),
    align: refs.budgetBlockAlign.value,
    bold: refs.budgetBlockBold.checked,
    underline: refs.budgetBlockUnderline.checked,
    size: refs.budgetBlockSize.value,
  });
}

function collectBudgetSettings() {
  const existingSettings = appState.budgetDraftSettings || {};
  return {
    orientation: refs.budgetOrientation.value,
    title: refs.budgetTitle.value.trim(),
    recipient: refs.budgetRecipient.value.trim(),
    process: refs.budgetProcess.value.trim(),
    object: refs.budgetObject.value.trim(),
    proponent: refs.budgetProponent.value.trim(),
    representative: refs.budgetRepresentative.value.trim(),
    payment: refs.budgetPayment.value.trim(),
    terms: refs.budgetTerms.value.trim(),
    validity: refs.budgetValidity.value.trim(),
    warranty: refs.budgetWarranty.value.trim(),
    delivery: refs.budgetDelivery.value.trim(),
    cityDate: refs.budgetCityDate.value.trim(),
    signer: refs.budgetSigner.value.trim(),
    headerLogoEnabled: refs.budgetHeaderLogoEnabled.checked,
    headerLogoImage: existingSettings.headerLogoImage || "",
    headerLogoName: existingSettings.headerLogoName || "",
    watermarkEnabled: refs.budgetWatermarkEnabled.checked,
    watermarkImage: existingSettings.watermarkImage || "",
    watermarkName: existingSettings.watermarkName || "",
    watermarkOpacity: parseBudgetWatermarkOpacity(refs.budgetWatermarkOpacity.value),
  };
}

function fillBudgetSettingsForm(settings) {
  const nextSettings = { ...DEFAULT_BUDGET_SETTINGS, ...(settings || {}) };
  refs.budgetOrientation.value = nextSettings.orientation === "landscape" ? "landscape" : "portrait";
  refs.budgetTitle.value = nextSettings.title || "";
  refs.budgetRecipient.value = nextSettings.recipient || "";
  refs.budgetProcess.value = nextSettings.process || "";
  refs.budgetObject.value = nextSettings.object || "";
  refs.budgetProponent.value = nextSettings.proponent || "";
  refs.budgetRepresentative.value = nextSettings.representative || "";
  refs.budgetPayment.value = nextSettings.payment || "";
  refs.budgetTerms.value = nextSettings.terms || "";
  refs.budgetValidity.value = nextSettings.validity || "";
  refs.budgetWarranty.value = nextSettings.warranty || "";
  refs.budgetDelivery.value = nextSettings.delivery || "";
  refs.budgetCityDate.value = nextSettings.cityDate || "";
  refs.budgetSigner.value = nextSettings.signer || "";
  refs.budgetHeaderLogoEnabled.checked = Boolean(nextSettings.headerLogoEnabled);
  refs.budgetHeaderLogoStatus.textContent = nextSettings.headerLogoName || "Nenhum arquivo selecionado";
  refs.budgetWatermarkEnabled.checked = Boolean(nextSettings.watermarkEnabled);
  refs.budgetWatermarkStatus.textContent = nextSettings.watermarkName || "Nenhum arquivo selecionado";
  refs.budgetWatermarkOpacity.value = parseBudgetWatermarkOpacity(nextSettings.watermarkOpacity);
  bindAutoGrowTextareas(refs.budgetSettingsForm);
  bindAutoGrowTextareas(refs.budgetBlockForm);
}

function renderBudgetPreview(model) {
  const bid = currentBid();
  if (!bid) {
    refs.budgetPreview.classList.remove("landscape", "portrait");
    refs.budgetBuilderLayout.classList.remove("preview-landscape");
    refs.budgetPreviewFormat.textContent = "Retrato";
    refs.budgetPreview.innerHTML = `<div class="empty-state">Selecione um edital para visualizar a proposta.</div>`;
    return;
  }
  const settings = { ...defaultBudgetSettingsForBid(bid), ...(model?.settings || {}) };
  const blocks = model?.blocks?.length ? cloneBudgetBlocks(model.blocks) : [];
  const tableColumns = budgetTableColumns(model);
  const rows = currentBudgetRows();
  const total = calculateBudgetRowsTotal(model, rows);
  const isLandscape = settings.orientation === "landscape";
  refs.budgetPreview.classList.toggle("landscape", isLandscape);
  refs.budgetPreview.classList.toggle("portrait", !isLandscape);
  refs.budgetBuilderLayout.classList.toggle("preview-landscape", isLandscape && appState.budgetPreviewVisible);
  refs.budgetPreviewFormat.textContent = isLandscape ? "Paisagem" : "Retrato";
  refs.budgetPreview.innerHTML = `
    <article class="proposal-paper ${isLandscape ? "landscape" : "portrait"}">
      ${budgetWatermarkMarkup(settings)}
      ${budgetHeaderLogoMarkup(settings)}
      ${
        blocks.length
          ? renderBudgetBlocksPreview(blocks)
          : `<header class="proposal-header">
              <p>${escapeHtml(settings.recipient || bid.buyer_agency || "")}</p>
              <h3>${escapeHtml(settings.title || "PROPOSTA COMERCIAL")}</h3>
              <span>${escapeHtml(settings.process || bid.id || "")}</span>
            </header>`
      }
      ${settings.object ? `<section><h4>Objeto</h4><p>${escapeHtml(settings.object)}</p></section>` : ""}
      <section class="proposal-two-columns">
        <div>
          <h4>Dados da proponente</h4>
          <p>${formatMultiline(settings.proponent)}</p>
        </div>
        <div>
          <h4>Representante legal</h4>
          <p>${formatMultiline(settings.representative)}</p>
        </div>
      </section>
      <section>
        <h4>Itens da proposta</h4>
        ${proposalPreviewTable(tableColumns, rows)}
        <p class="proposal-total">Valor global: ${money(total)}</p>
      </section>
      <section class="proposal-details">
        <p><strong>Validade:</strong> ${escapeHtml(settings.validity || "")}</p>
        <p><strong>Garantia:</strong> ${escapeHtml(settings.warranty || "")}</p>
        <p><strong>Entrega:</strong> ${escapeHtml(settings.delivery || bid.delivery_place || "")}</p>
        ${settings.payment ? `<p><strong>Dados bancários:</strong> ${escapeHtml(settings.payment)}</p>` : ""}
      </section>
      ${settings.terms ? `<section><h4>Declarações</h4><p>${formatMultiline(settings.terms)}</p></section>` : ""}
      <footer class="proposal-signature">
        <p>${escapeHtml(settings.cityDate || "")}</p>
        <div></div>
        <strong>${escapeHtml(settings.signer || "")}</strong>
      </footer>
    </article>
  `;
}

function budgetHeaderLogoMarkup(settings) {
  if (!settings.headerLogoEnabled || !settings.headerLogoImage) return "";
  return `
    <div class="proposal-header-logo">
      <img src="${escapeHtml(settings.headerLogoImage)}" alt="Logo da empresa" />
    </div>
  `;
}

function budgetWatermarkMarkup(settings) {
  if (!settings.watermarkEnabled || !settings.watermarkImage) return "";
  const opacity = parseBudgetWatermarkOpacity(settings.watermarkOpacity) / 100;
  return `
    <img class="proposal-watermark" src="${escapeHtml(settings.watermarkImage)}" alt="" style="opacity: ${opacity};" />
  `;
}

function renderBudgetBlocksPreview(blocks) {
  return blocks
    .map(
      (block) => `
        <section class="proposal-free-block align-${escapeHtml(block.align)} size-${escapeHtml(block.size)}${block.bold ? " is-bold" : ""}${
        block.underline ? " is-underlined" : ""
      }">
          <p>${formatMultiline(block.content)}</p>
        </section>
      `
    )
    .join("");
}

function proposalPreviewTable(columns, rows) {
  if (!columns.length) return `<div class="empty-state">Configure as colunas da tabela.</div>`;
  const previewRows = rows.length ? rows : [{ values: previewValuesForColumns(columns) }];
  return `
    <div class="proposal-table-wrap">
      <table class="proposal-table">
        ${budgetColumnGroupMarkup(columns)}
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column.name)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${previewRows
            .map((row) => `<tr>${columns.map((column) => `<td>${formatBudgetCellHtml(row.values?.[column.id], column)}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function budgetColumnGroupMarkup(columns) {
  const hasWidths = columns.some((column) => Number(column.width || 0) > 0);
  if (!hasWidths) return "";
  return `<colgroup>${columns
    .map((column) => {
      const width = Number(column.width || 0);
      return width > 0 ? `<col style="width: ${width}%;" />` : "<col />";
    })
    .join("")}</colgroup>`;
}

function previewValuesForColumns(columns) {
  return columns.reduce((acc, column) => {
    acc[column.id] = column.type === "currency" ? 0 : column.type === "number" ? 1 : "A preencher";
    return acc;
  }, {});
}

function calculateBudgetRowsTotal(model, rows) {
  const totalColumn = findBudgetColumnByName(model, "Valor Total") || findBudgetColumnByName(model, "Valor Total (R$)");
  if (!totalColumn) return 0;
  return rows.reduce((sum, row) => sum + Number(row.values?.[totalColumn.id] || 0), 0);
}

function budgetValueFromItem(column, item) {
  const unitValue = Number(item.max_acceptable_value || 0);
  const quantity = Number(item.required_quantity || 0);
  const technicalText = item.technical_registration_text || item.description || "";
  switch (column.source) {
    case "item_number":
      return item.item_number;
    case "item_name":
      return item.name || "";
    case "item_description":
      return technicalText;
    case "unit":
      return item.sales_unit || "";
    case "quantity":
      return quantity;
    case "estimated_value":
      return item.estimated_value || 0;
    case "max_value":
      return unitValue;
    case "minimum_bid":
      return item.minimum_bid || 0;
    case "brand_model":
      return item.brand_model || "";
    case "supplier_cost":
      return item.supplier_cost || 0;
    case "supplier_link":
      return item.supplier_link || "";
    case "calculated_total":
      return unitValue * quantity;
    default:
      return "";
  }
}

async function saveUser(event) {
  event.preventDefault();
  refs.userFormError.textContent = "";
  try {
    const data = collectUserData();
    await store.saveUser(data);
    await reloadData();
    clearUserForm();
    showToast("Usuário cadastrado.");
  } catch (error) {
    refs.userFormError.textContent = error.message;
  }
}

function collectUserData() {
  const email = normalizeEmail(refs.userEmail.value);
  const password = refs.userPassword.value;
  const confirmation = refs.userPasswordConfirm.value;
  if (!email) throw new Error("Preencha o e-mail do usuário.");
  if (!password) throw new Error("Preencha a senha do usuário.");
  if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
  if (password !== confirmation) throw new Error("A confirmação de senha não confere.");
  return {
    name: refs.userName.value.trim(),
    email,
    password,
    role: "Acesso total",
  };
}

function clearUserForm() {
  refs.userForm.reset();
  refs.userRole.value = "Acesso total";
  refs.userFormError.textContent = "";
}

function renderUsers() {
  refs.userCountLabel.textContent = `${appState.users.length} ${appState.users.length === 1 ? "usuário" : "usuários"}`;
  if (!appState.users.length) {
    refs.usersTableBody.innerHTML = `<tr><td colspan="5">Nenhum usuário cadastrado.</td></tr>`;
    return;
  }

  refs.usersTableBody.innerHTML = appState.users
    .map((user) => {
      const isCurrent = user.email === appState.currentUserEmail;
      const action = isCurrent
        ? `<span class="current-user-pill">Usuário atual</span>`
        : `<button class="danger-action compact-action" type="button" data-delete-user="${escapeHtml(user.email)}">Excluir</button>`;
      return `
        <tr>
          <td>${escapeHtml(user.name || "")}</td>
          <td>${escapeHtml(user.email || "")}</td>
          <td>${escapeHtml(user.role || "Acesso total")}</td>
          <td>${formatDateTime(user.created_at || "")}</td>
          <td>${action}</td>
        </tr>
      `;
    })
    .join("");

  refs.usersTableBody.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () => deleteUser(button.dataset.deleteUser));
  });
}

async function deleteUser(email) {
  if (normalizeEmail(email) === appState.currentUserEmail) {
    showToast("O usuário atual não pode ser excluído durante a sessão.");
    return;
  }
  if (appState.users.length <= 1) {
    showToast("Mantenha pelo menos um usuário cadastrado.");
    return;
  }
  if (!confirm(`Excluir o usuário ${email}?`)) return;
  await store.deleteUser(email);
  await reloadData();
  showToast("Usuário excluído.");
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

function currentBudgetModel() {
  if (!appState.currentBidId) return null;
  const model = appState.budgetModels.find((row) => row.bid_id === appState.currentBidId) || null;
  return model ? normalizeBudgetModel(model) : null;
}

function currentBudgetRows() {
  if (!appState.currentBidId) return [];
  return appState.budgetRows.filter((row) => row.bid_id === appState.currentBidId);
}

function draftBudgetModel() {
  if (!appState.currentBidId) return null;
  return {
    bid_id: appState.currentBidId,
    settings: cloneBudgetSettings(appState.budgetDraftSettings),
    blocks: cloneBudgetBlocks(appState.budgetDraftBlocks),
    columns: cloneColumns(appState.budgetDraftColumns),
  };
}

function calculateBidSummary(bidId) {
  return appState.items
    .filter((item) => item.bid_id === bidId)
    .reduce(
      (acc, item) => {
        const quantity = Number(item.required_quantity || 0);
        acc.totalFinal += Number(item.max_acceptable_value || 0) * quantity;
        acc.totalEstimated += Number(item.estimated_value || 0) * quantity;
        acc.itemCount += 1;
        return acc;
      },
      { totalFinal: 0, totalEstimated: 0, itemCount: 0 }
    );
}

function parseDecimal(value, fieldName, required = true) {
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
  return number;
}

function parseProfitMargin(value) {
  let raw = String(value || "").trim().replace("%", "").replace(/\s/g, "");
  if (!raw) return null;
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const number = Number(raw);
  if (!Number.isFinite(number)) throw new Error("Informe uma porcentagem válida para Margem.");
  return number;
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

function findBudgetColumnByName(model, expectedName) {
  const normalized = normalizeColumnName(expectedName);
  return model?.columns?.find((column) => normalizeColumnName(column.name) === normalized) || null;
}

function normalizeColumnName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseFlexibleNumber(value) {
  let raw = String(value || "").trim();
  if (!raw) return NaN;
  raw = raw.replace(/[^\d,.-]/g, "");
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const number = Number(raw);
  return Number.isFinite(number) ? number : NaN;
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

function bindBudgetAutoTotal(model) {
  const unitColumn = findBudgetColumnByName(model, "Valor Final") || findBudgetColumnByName(model, "Valor Unitário");
  const quantityColumn = findBudgetColumnByName(model, "Quantidade");
  const totalColumn = findBudgetColumnByName(model, "Valor total");
  if (!unitColumn || !quantityColumn || !totalColumn) return;
  const unitInput = refs.budgetEntryForm.querySelector(`[data-budget-column="${unitColumn.id}"]`);
  const quantityInput = refs.budgetEntryForm.querySelector(`[data-budget-column="${quantityColumn.id}"]`);
  const totalInput = refs.budgetEntryForm.querySelector(`[data-budget-column="${totalColumn.id}"]`);
  if (!unitInput || !quantityInput || !totalInput) return;
  totalInput.readOnly = true;
  totalInput.classList.add("calculated-input");
  const update = () => applyBudgetAutoTotal(model);
  unitInput.addEventListener("input", update);
  quantityInput.addEventListener("input", update);
  update();
}

function applyBudgetAutoTotal(model) {
  const unitColumn = findBudgetColumnByName(model, "Valor Final") || findBudgetColumnByName(model, "Valor Unitário");
  const quantityColumn = findBudgetColumnByName(model, "Quantidade");
  const totalColumn = findBudgetColumnByName(model, "Valor total");
  if (!unitColumn || !quantityColumn || !totalColumn) return;
  const unitInput = refs.budgetEntryForm.querySelector(`[data-budget-column="${unitColumn.id}"]`);
  const quantityInput = refs.budgetEntryForm.querySelector(`[data-budget-column="${quantityColumn.id}"]`);
  const totalInput = refs.budgetEntryForm.querySelector(`[data-budget-column="${totalColumn.id}"]`);
  if (!unitInput || !quantityInput || !totalInput) return;
  if (!unitInput.value.trim() || !quantityInput.value.trim()) {
    totalInput.value = "";
    return;
  }
  let unitValue = 0;
  try {
    unitValue = parseDecimal(unitInput.value, "Valor Final", false);
  } catch (_error) {
    totalInput.value = "";
    return;
  }
  const quantityValue = parseFlexibleNumber(quantityInput.value);
  if (!Number.isFinite(quantityValue)) {
    totalInput.value = "";
    return;
  }
  totalInput.value = money(unitValue * quantityValue);
}

function normalizeBudgetValue(value, column) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (column.type === "number") {
    const number = Number(raw.replace(",", "."));
    if (Number.isNaN(number)) throw new Error(`Informe um valor numérico válido para ${column.name}.`);
    return number;
  }
  if (column.type === "currency") {
    return parseDecimal(raw, column.name, false);
  }
  return raw;
}

function budgetInputMarkup(column) {
  if (normalizeColumnName(column.name) === "descricao") {
    return `
      <label class="full">
        ${escapeHtml(column.name)}
        <textarea class="auto-grow-textarea" data-budget-column="${column.id}" rows="2"></textarea>
      </label>
    `;
  }
  const inputType = column.type === "number" ? "number" : "text";
  const inputMode = column.type === "currency" ? "decimal" : column.type === "number" ? "decimal" : "text";
  const placeholder = column.type === "currency" ? "R$ 0,00" : "";
  return `
    <label>
      ${escapeHtml(column.name)}
      <input data-budget-column="${column.id}" type="${inputType}" inputmode="${inputMode}" placeholder="${placeholder}" />
    </label>
  `;
}

function formatBudgetValue(value, type) {
  if (value === "" || value === null || value === undefined) return "";
  if (type === "currency") return money(value);
  if (type === "number") return Number(value).toLocaleString("pt-BR");
  return String(value);
}

function budgetInputValue(value, type) {
  if (value === "" || value === null || value === undefined) return "";
  if (type === "currency") return money(value);
  return String(value);
}

function formatBudgetCellHtml(value, column) {
  const formattedValue = formatBudgetValue(value, column.type);
  if (normalizeColumnName(column.name) === "fornecedor") {
    const url = normalizeUrlValue(formattedValue);
    if (url) {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(formattedValue)}</a>`;
    }
  }
  return escapeHtml(formattedValue);
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

function budgetTypeLabel(type) {
  return BUDGET_COLUMN_TYPES.find((option) => option.value === type)?.label || type;
}

function budgetSectionLabel(section) {
  return BUDGET_SECTION_OPTIONS.find((option) => option.value === section)?.label || "Tabela de itens";
}

function budgetSourceLabel(source) {
  return BUDGET_SOURCE_OPTIONS.find((option) => option.value === source)?.label || "Preenchimento manual";
}

function budgetTableColumns(model) {
  return (model?.columns || []).filter((column) => (column.section || "table") === "table");
}

function normalizeBudgetModel(model) {
  const payload = model?.columns;
  if (Array.isArray(payload)) {
    return {
      ...model,
      settings: defaultBudgetSettingsForBid(currentBid()),
      blocks: cloneBudgetBlocks(DEFAULT_BUDGET_BLOCKS),
      columns: payload.map(normalizeBudgetColumn),
    };
  }
  const settings = {
    ...defaultBudgetSettingsForBid(currentBid()),
    ...(payload?.settings || {}),
  };
  const blocks = Array.isArray(payload?.blocks) ? payload.blocks : DEFAULT_BUDGET_BLOCKS;
  const columns = Array.isArray(payload?.columns) ? payload.columns : [];
  return {
    ...model,
    settings,
    blocks: blocks.map(normalizeBudgetBlock),
    columns: columns.map(normalizeBudgetColumn),
  };
}

function normalizeBudgetColumn(column) {
  return {
    id: column.id || `col_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: column.name || "Campo",
    type: BUDGET_COLUMN_TYPES.some((type) => type.value === column.type) ? column.type : "text",
    section: BUDGET_SECTION_OPTIONS.some((section) => section.value === column.section) ? column.section : "table",
    source: BUDGET_SOURCE_OPTIONS.some((source) => source.value === column.source) ? column.source : "manual",
    width: parseBudgetColumnWidth(column.width),
  };
}

function createBudgetColumn(name, type, section = "table", source = "manual") {
  return normalizeBudgetColumn({
    id: `col_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name,
    type,
    section,
    source,
    width: "",
  });
}

function cloneColumns(columns) {
  return (columns || []).map((column) => ({ ...normalizeBudgetColumn(column) }));
}

function cloneBudgetSettings(settings) {
  const nextSettings = { ...DEFAULT_BUDGET_SETTINGS, ...(settings || {}) };
  nextSettings.orientation = nextSettings.orientation === "landscape" ? "landscape" : "portrait";
  nextSettings.headerLogoEnabled = Boolean(nextSettings.headerLogoEnabled);
  nextSettings.watermarkEnabled = Boolean(nextSettings.watermarkEnabled);
  nextSettings.watermarkOpacity = parseBudgetWatermarkOpacity(nextSettings.watermarkOpacity);
  return nextSettings;
}

function normalizeBudgetBlock(block) {
  return {
    id: block.id || `block_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    label: block.label || "Bloco do documento",
    content: block.content || "",
    align: BUDGET_ALIGNMENT_OPTIONS.includes(block.align) ? block.align : "left",
    bold: Boolean(block.bold),
    underline: Boolean(block.underline),
    size: BUDGET_BLOCK_SIZE_OPTIONS.includes(block.size) ? block.size : "normal",
  };
}

function cloneBudgetBlocks(blocks) {
  return (blocks || []).map((block) => ({ ...normalizeBudgetBlock(block) }));
}

function budgetBlockSummary(block) {
  const styles = [
    block.align === "center" ? "Centralizado" : block.align === "right" ? "Direita" : "Esquerda",
    block.bold ? "negrito" : "",
    block.underline ? "sublinhado" : "",
    block.size === "large" ? "destaque" : block.size === "small" ? "compacto" : "",
  ].filter(Boolean);
  return styles.join(" · ");
}

function parseBudgetColumnWidth(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "";
  return Math.min(80, Math.max(4, Math.round(number)));
}

function parseBudgetWatermarkOpacity(value) {
  const number = Number(value || DEFAULT_BUDGET_SETTINGS.watermarkOpacity);
  if (!Number.isFinite(number)) return DEFAULT_BUDGET_SETTINGS.watermarkOpacity;
  return Math.min(40, Math.max(4, Math.round(number)));
}

function defaultBudgetSettingsForBid(bid) {
  return {
    ...DEFAULT_BUDGET_SETTINGS,
    recipient: bid?.buyer_agency || DEFAULT_BUDGET_SETTINGS.recipient,
    process: bid?.id || DEFAULT_BUDGET_SETTINGS.process,
    delivery: bid?.delivery_place || DEFAULT_BUDGET_SETTINGS.delivery,
  };
}

function formatMultiline(value) {
  return escapeHtml(value || "").replace(/\n/g, "<br>");
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function percent(value) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatProfitMargin(value) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`;
}

function formatDateTime(value) {
  if (!value) return "";
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function toDateTimeInputValue(value) {
  if (!value) return "";
  return String(value).replace(" ", "T").slice(0, 16);
}

function toDateInputValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function fromDateTimeInputValue(value) {
  if (!value) return "";
  return value.replace("T", " ");
}

function statusDisplay(status) {
  const normalizedStatus = normalizeBidStatus(status);
  const map = {
    "Em Analise": "ANÁLISE",
    Aprovada: "APROVADA",
    Desclassificado: "DESCLASSIFICADO",
    Disputada: "DISPUTADA",
  };
  return map[normalizedStatus] || String(normalizedStatus || "").toUpperCase();
}

function statusBadgeClass(status) {
  const normalizedStatus = normalizeBidStatus(status);
  return {
    "Em Analise": "analysis",
    Aprovada: "approved",
    Desclassificado: "rejected",
    Disputada: "disputed",
  }[normalizedStatus] || "neutral";
}

function normalizeBidStatus(status) {
  return status === "Reprovada" ? "Desclassificado" : status || STATUS_OPTIONS[0];
}

function normalizeBidRecord(record) {
  return {
    id: String(record.id || "").trim(),
    buyer_agency: record.buyer_agency || "",
    session_datetime: record.session_datetime || "",
    delivery_place: record.delivery_place || "",
    edital_link: record.edital_link || "",
    bid_type: record.bid_type || BID_TYPE_OPTIONS[0],
    proposal_deadline: record.proposal_deadline || "",
    status: normalizeBidStatus(record.status),
    edital_file_path: record.edital_file_path || "",
    edital_file_name: record.edital_file_name || "",
    edital_file_type: record.edital_file_type || "",
    edital_file_size: Number(record.edital_file_size || 0),
    ...(record.edital_file_blob ? { edital_file_blob: record.edital_file_blob } : {}),
    created_at: record.created_at || timestampNow(),
    updated_at: record.updated_at || timestampNow(),
  };
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

function isMissingAppSettingsTableError(error) {
  const message = String(error?.message || error?.details || "");
  return Boolean(error) && /app_settings|relation/i.test(message) && /does not exist|schema cache|not find|could not find/i.test(message);
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
  appState.itemMarginCalculationSource = "margin";
  updateValueWithMargin();
}

function updateMarginFromFinalValue() {
  appState.itemMarginCalculationSource = "final";
  const hasFinalValue = Boolean(refs.maxValue.value.trim());
  const hasCostValue = Boolean(refs.supplierCost.value.trim());
  if (!hasFinalValue || !hasCostValue) {
    refs.profitMargin.value = "";
    refs.valueWithMargin.value = "";
    updateItemProfit();
    return;
  }

  try {
    const finalValue = parseDecimal(refs.maxValue.value, "Valor Final", false);
    const costValue = parseDecimal(refs.supplierCost.value, "Valor de Custo", false);
    const margin = calculateProfitMargin(finalValue, costValue);
    if (margin === null) {
      refs.profitMargin.value = "";
      refs.valueWithMargin.value = "";
    } else {
      refs.profitMargin.value = formatProfitMargin(margin);
      refs.valueWithMargin.value = money(calculateValueWithMargin(costValue, margin));
    }
  } catch {
    refs.profitMargin.value = "";
    refs.valueWithMargin.value = "";
  }
  updateItemProfit();
}

function updateItemPricingFromCost() {
  if (appState.itemMarginCalculationSource === "final" && refs.maxValue.value.trim()) {
    updateMarginFromFinalValue();
  } else {
    updateValueWithMargin();
    updateItemProfit();
  }
}

function updateValueWithMargin() {
  if (!refs.supplierCost.value.trim() || !refs.profitMargin.value.trim()) {
    refs.valueWithMargin.value = "";
    return;
  }
  try {
    const costValue = parseDecimal(refs.supplierCost.value, "Valor de Custo", false);
    const margin = parseProfitMargin(refs.profitMargin.value);
    refs.valueWithMargin.value = money(calculateValueWithMargin(costValue, margin));
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
    role: userData.role || "Acesso total",
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

main().catch((error) => {
  console.error(error);
  alert(error.message);
});

