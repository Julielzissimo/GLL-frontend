import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
const application = source.slice(0, source.lastIndexOf('withBlockingLoading(main, "Verificando sessão…")'));
const user = { email: "test@example.test", name: "Teste" };

test("número do edital é separado do identificador interno e aceita repetição", () => {
  const app = client();
  const first = app.normalizeBidRecord({ id: "internal-1", edital_number: "10/2026" });
  const second = app.normalizeBidRecord({ id: "internal-2", edital_number: "10/2026" });
  assert.notEqual(first.id, second.id);
  assert.equal(app.bidDisplayNumber(first), "10/2026");
  assert.equal(app.bidDisplayNumber(second), "10/2026");
});

test("arquivo legado é preservado como primeiro anexo do edital", () => {
  const app = client();
  const bid = app.normalizeBidRecord({
    id: "internal-1",
    edital_file_path: "legacy/edital.pdf",
    edital_file_name: "edital.pdf",
    edital_file_type: "application/pdf",
    edital_file_size: 2048,
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(bid.edital_files)),
    [{ path: "legacy/edital.pdf", name: "edital.pdf", type: "application/pdf", size: 2048 }],
  );
});

test("lista moderna vazia não restaura um anexo legado removido", () => {
  const app = client();
  assert.deepEqual(
    JSON.parse(JSON.stringify(app.normalizeBidAttachments({ edital_files: [], edital_file_path: "legacy/removido.pdf" }))),
    [],
  );
});

test("edital aceita quatro arquivos e rejeita o quinto", () => {
  const app = client();
  const files = Array.from({ length: 4 }, (_, index) => ({ name: `arquivo-${index + 1}.pdf`, size: 1024 }));
  assert.doesNotThrow(() => app.validateEditalFiles(files, 0));
  assert.throws(
    () => app.validateEditalFiles([{ name: "quinto.pdf", size: 1024 }], 4),
    /no máximo 4 arquivos/,
  );
});

test("cada arquivo do edital mantém o limite individual de 20 MB", () => {
  const app = client();
  assert.throws(
    () => app.validateEditalFiles([{ name: "grande.pdf", size: 20 * 1024 * 1024 + 1 }], 0),
    /grande\.pdf.*20 MB/,
  );
});

test("modal de orçamento exibe somente orçamentos ainda não vinculados a edital", () => {
  const app = client();
  const quotations = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const bids = [
    { id: "edital-1", quotation_id: 1 },
    { id: "edital-2", quotation_id: null },
    { id: "edital-3", quotation_id: "3" },
  ];
  assert.deepEqual(
    JSON.parse(JSON.stringify(app.availableBidQuotations(quotations, bids))),
    [{ id: 2 }],
  );
});

test("aba do edital usa o fluxo de orçamento com vínculo, criação e cadastro de itens", () => {
  assert.match(html, /id="itemsTabButton"[^>]*>Orçamento<\/button>/);
  assert.match(html, /id="linkExistingBidQuotationButton"/);
  assert.match(html, /Vincular orçamento existente/);
  assert.match(html, /id="createBidQuotationButton"/);
  assert.match(html, /Criar novo orçamento/);
  assert.match(html, /id="quotationCep"/);
  assert.match(html, /id="quotationDeliveryDeadline"/);
  assert.match(html, /id="openQuotationItemModalButton"[^>]*>Cadastrar Item<\/button>/);
  assert.match(source, /await store\.setBidQuotation\(bidContextId, savedId\)/);
  assert.match(source, /async function startBidQuotationCreation\(\)[\s\S]*await store\.saveQuotation\([\s\S]*openQuotationItemModal\(\)/);
});

test("operações remotas de orçamento e edital usam a transação do servidor", () => {
  assert.match(source, /rpc\("save_bid_item_consistently"/);
  assert.doesNotMatch(
    source.slice(source.indexOf("class SupabaseStore"), source.indexOf("const store = createStore()")),
    /await this\.syncBidWithQuotation\(data\.id, data\.quotation_id\)/,
  );
  assert.match(
    source,
    /Ele deixará de aparecer no sistema, mas seus itens e demais dados permanecerão preservados\./,
  );
  assert.doesNotMatch(source, /Excluir o orçamento do edital \$\{quotation\.edital\} e todos os seus itens\?/);
});

test("itens não carregam nem enviam os campos antigos de frete", () => {
  const collectItemSource = source.slice(source.indexOf("function collectItemData"), source.indexOf("async function deleteCurrentItem"));
  const normalizeItemSource = source.slice(source.indexOf("function normalizeItemRecord"), source.indexOf("function parseItemExtraPayload"));

  assert.doesNotMatch(collectItemSource, /freight_included|unit_freight/);
  assert.doesNotMatch(normalizeItemSource, /freight_included|unit_freight/);
});

function backend() {
  return {
    tables: { bids: [{ id: "TEST-1", buyer_agency: "Original" }], items: [], documents: [], failure_history: [], quotations: [{ id: 1, edital: "Original" }], quotation_items: [], suppliers: [] },
    users: [user], channels: new Set(),
  };
}

function client(db = backend(), auth = { session: { user } }) {
  const elements = new Map();
  const listeners = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const location = { pathname: "/homolog/", search: "", hash: "" };
  const updateLocation = (url) => {
    const parsed = new URL(url, "https://example.test");
    location.pathname = parsed.pathname;
    location.search = parsed.search;
    location.hash = parsed.hash;
  };
  const history = {
    entries: [],
    pushState: (_state, _title, url) => { history.entries.push(url); updateLocation(url); },
    replaceState: (_state, _title, url) => { history.entries.splice(-1, 1, url); updateLocation(url); },
  };
  const storage = auth.storage ||= new Map();
  const localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const element = (id) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        id, value: "", textContent: "", classList: {
          add: (...values) => values.forEach((v) => classes.add(v)),
          remove: (...values) => values.forEach((v) => classes.delete(v)),
          contains: (v) => classes.has(v),
          toggle: (v, on = !classes.has(v)) => on ? classes.add(v) : classes.delete(v),
        },
        querySelectorAll: () => [], setAttribute() {}, prepend() {}, reset() {}, close() {},
      });
    }
    return elements.get(id);
  };
  const events = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const context = vm.createContext({
    console, URL, URLSearchParams, Intl, Date,
    window: { GLL_CONFIG: { supabaseUrl: "https://test.invalid", supabaseAnonKey: "test", sessionIdleTimeoutMinutes: 30, sessionMaxLifetimeHours: 8 }, location, history, localStorage, ...events },
    document: { hidden: false, getElementById: element, querySelectorAll: () => [], createElement: () => element("syncNotice"), ...events },
    setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearInterval: (id) => timers.delete(id),
  });
  vm.runInContext(application, context);
  const api = vm.runInContext(`({ store, appState, restoreSession, logout, reloadData, refreshInBackground, startLiveUpdates, stopLiveUpdates, resetAuthenticatedView, scheduleLiveRefresh, calculateBidSummary, calculateLineTotal, calculateItemProfit, calculateProfitMargin, calculateValueWithMargin, parseDecimal, parseProfitMargin, money, formatDateTime, toDateTimeInputValue, fromDateTimeInputValue, readNavigationRoute, writeNavigationRoute, normalizeBidRecord, normalizeBidAttachments, validateEditalFiles, bidDisplayNumber, creatorName, creatorInitials, creatorTagMarkup, normalizeQuotationRecord, normalizeQuotationItemRecord, quotationItemToBidItem, bidItemToQuotationItem, normalizeTechnicalSpecifications, quotationSaveError, sessionPolicyStorageKey, enforceSessionPolicy, availableBidQuotations })`, context);
  vm.runInContext(`
    renderSuppliers = renderBids = renderDetails = renderQuotations = renderUsers = () => {};
    clearBidForm = clearQuotationForm = setPage = updateMainNavigationState = () => {};
  `, context);
  api.store.getAll = async (table) => structuredClone(db.tables[table]);
  api.store.getUsers = async () => structuredClone(db.users);
  api.store.getUser = async () => db.users[0] || null;
  api.store.client = {
    auth: {
      getSession: async () => ({ data: { session: auth.session }, error: null }),
      signOut: async ({ scope }) => { assert.equal(scope, "local"); auth.session = null; return { error: null }; },
    },
    channel: () => {
      const channel = {
        on: (_type, _filter, handler) => { channel.receive = handler; return channel; },
        subscribe: (callback) => { db.channels.add(channel); callback("SUBSCRIBED"); return channel; },
        send: async (message) => {
          assert.deepEqual(Object.keys(message.payload), []);
          for (const other of db.channels) if (other !== channel) other.receive();
        },
      };
      return channel;
    },
    removeChannel: async (channel) => db.channels.delete(channel),
  };
  return { ...api, db, auth, context, elements, element, timers, listeners, location, history,
    flush: async () => {
      const pending = [...timers.values()]; timers.clear();
      for (const fn of pending) await fn();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test("navigation writes readable URLs without discarding unrelated parameters", () => {
  const app = client();
  app.appState.authenticated = true;
  app.location.search = "?origem=email";
  app.appState.currentBidId = "PE 12/2026";
  app.writeNavigationRoute("documents");
  assert.equal(app.location.search, "?origem=email&page=documentos&licitacao=PE+12%2F2026");
  const route = app.readNavigationRoute();
  assert.equal(route.page, "documents");
  assert.equal(route.bidId, "PE 12/2026");
  assert.equal(route.quotationId, null);
});

test("quotation normalization preserves the delivery deadline", () => {
  const app = client();
  const quotation = app.normalizeQuotationRecord({ edital: "PE 12/2026", delivery_deadline: "30 dias" });
  assert.equal(quotation.delivery_deadline, "30 dias");
});

test("valores monetários, quantidades e margens seguem uma precisão única", () => {
  const app = client();
  assert.equal(app.parseDecimal("1.234,567", "Valor"), 1234.57);
  assert.equal(app.parseDecimal("1,23456", "Quantidade", true, 4), 1.2346);
  assert.equal(app.parseProfitMargin("-12,34567%"), -12.3457);
  assert.equal(app.calculateLineTotal(10.005, 3), 30.02);
  assert.equal(app.calculateItemProfit(9.99, 10, 2.5), -0.03);
  assert.equal(app.calculateProfitMargin(8, 10), -25);
  assert.equal(app.calculateProfitMargin(10, 8), 20);
  assert.equal(app.calculateProfitMargin(10, 0), 100);
  assert.equal(app.calculateProfitMargin(0, 10), null);
  assert.equal(app.calculateValueWithMargin(10, 20), 12.5);
  assert.equal(app.calculateValueWithMargin(10, -25), 8);
  assert.equal(app.calculateValueWithMargin(10, 100), null);
  assert.equal(app.money(1.005), "R$ 1,01");
});

test("datas são persistidas em UTC e exibidas no fuso de São Paulo", () => {
  const app = client();
  const stored = app.fromDateTimeInputValue("2026-09-23T14:30");
  assert.equal(stored, "2026-09-23T17:30:00.000Z");
  assert.equal(app.toDateTimeInputValue(stored), "2026-09-23T14:30");
  assert.equal(app.formatDateTime(stored), "23/09/2026, 14:30");
  assert.equal(app.toDateTimeInputValue("2026-09-23 14:30:00"), "2026-09-23T14:30");
});

test("quotation RLS errors are translated into an actionable message", () => {
  const app = client();
  assert.match(
    app.quotationSaveError({ code: "42501", message: 'new row violates row-level security policy for table "quotations"' }).message,
    /confirmar seu acesso à organização/,
  );
});

test("exclusão lógica preserva o edital e oculta seus dados da interface", async () => {
  const db = backend();
  db.tables.items.push({ id: 1, bid_id: "TEST-1", item_number: 1 });
  db.tables.documents.push({ id: 1, bid_id: "TEST-1", document_type: "Certidão" });
  db.tables.failure_history.push({ id: 1, bid_id: "TEST-1", failure_type: "Preço" });
  const app = client(db);
  app.store.client.from = (table) => {
    assert.equal(table, "bids");
    return {
      update: (changes) => ({
        eq: async (_column, bidId) => {
          const bid = db.tables.bids.find((row) => row.id === bidId);
          Object.assign(bid, changes);
          return { error: null };
        },
      }),
    };
  };

  await app.store.deleteBid("TEST-1");
  assert.equal(db.tables.bids.length, 1);
  assert.ok(db.tables.bids[0].deleted_at);
  assert.equal(db.tables.items.length, 1);
  assert.equal(db.tables.documents.length, 1);
  assert.equal(db.tables.failure_history.length, 1);

  await app.restoreSession();
  assert.equal(app.appState.bids.length, 0);
  assert.equal(app.appState.items.length, 0);
  assert.equal(app.appState.documents.length, 0);
  assert.equal(app.appState.failureHistory.length, 0);
});

test("quotation normalization preserves creator and analyst assignment", () => {
  const app = client();
  const quotation = app.normalizeQuotationRecord({ edital: "PE 12/2026", created_by: "creator-id", assigned_to: "analyst-id" });
  assert.equal(quotation.created_by, "creator-id");
  assert.equal(quotation.assigned_to, "analyst-id");
});

test("creator tag prioritizes the editable stored name", () => {
  const app = client();
  app.appState.users = [{ auth_user_id: "creator-id", name: "Maria Silva" }];
  assert.equal(app.creatorName({ created_by: "creator-id", created_by_name: "Nome ajustado" }), "Nome ajustado");
  assert.equal(app.creatorInitials({ created_by: "creator-id", created_by_name: "Nome ajustado" }), "NA");
  assert.equal(app.creatorName({ created_by: "creator-id" }), "Maria Silva");
  assert.equal(app.creatorInitials({ created_by: "creator-id" }), "MS");
  assert.match(app.creatorTagMarkup({ created_by: "creator-id" }), /creator-avatar[^>]*>MS<.*Criado por.*Maria Silva/s);
  assert.equal(app.creatorName({ created_by: "removed-user-id" }), "Usuário Removido");
  assert.equal(app.creatorInitials({ created_by: "removed-user-id" }), "UR");
  assert.match(app.creatorTagMarkup({ created_by: "removed-user-id" }), /creator-avatar[^>]*>UR<.*Criado por.*Usuário Removido/s);
});

test("quotation item normalization and bid synchronization preserve the minimum bid", () => {
  const app = client();
  const quotationItem = app.normalizeQuotationItemRecord({ quotation_id: 1, item_number: 2, minimum_bid: "125.50" });
  assert.equal(quotationItem.minimum_bid, 125.5);
  const bidItem = app.quotationItemToBidItem(quotationItem);
  assert.equal(bidItem.minimum_bid, 125.5);
  assert.equal(app.bidItemToQuotationItem(bidItem).minimum_bid, 125.5);
});

test("navigation replaces the current URL when requested", () => {
  const app = client();
  app.appState.authenticated = true;
  app.writeNavigationRoute("bids");
  app.writeNavigationRoute("quotations", "replace");
  assert.equal(app.history.entries.length, 1);
  assert.equal(app.location.search, "?page=orcamentos");
});

test("reload restores a persisted session without entering a password", async () => {
  const auth = { session: { user } };
  const first = client(backend(), auth);
  await first.restoreSession();
  first.stopLiveUpdates();
  const reloaded = client(first.db, auth);
  await reloaded.restoreSession();
  assert.equal(reloaded.appState.authenticated, true);
  assert.equal(reloaded.appState.currentUserEmail, user.email);
  assert.equal(reloaded.element("loginView").classList.contains("hidden"), true);
  assert.equal(reloaded.appState.bids.length, 1);
});

test("empty remote database stays empty after authentication", async () => {
  const db = backend();
  for (const table of Object.keys(db.tables)) db.tables[table] = [];
  const app = client(db);
  await app.restoreSession();
  app.stopLiveUpdates();
  assert.equal(app.appState.authenticated, true);
  assert.deepEqual(structuredClone(app.appState.bids), []);
  assert.deepEqual(structuredClone(app.appState.quotations), []);
  assert.deepEqual(structuredClone(db.tables.bids), []);
});

test("missing session stays at login without reading protected tables", async () => {
  const app = client(backend(), { session: null });
  app.store.getAll = () => { throw new Error("must not read"); };
  await app.restoreSession();
  assert.equal(app.appState.authenticated, false);
});

test("persisted session expires after the inactivity limit before protected data is read", async () => {
  const auth = { session: { user } };
  const app = client(backend(), auth);
  auth.storage.set(app.sessionPolicyStorageKey, JSON.stringify({
    email: user.email,
    startedAt: Date.now() - 60 * 60 * 1000,
    lastActivityAt: Date.now() - 31 * 60 * 1000,
  }));
  app.store.getAll = () => { throw new Error("must not read"); };
  await app.restoreSession();
  assert.equal(app.appState.authenticated, false);
  assert.equal(auth.session, null);
  assert.match(app.element("loginError").textContent, /inatividade/);
});

test("persisted session expires after the absolute lifetime even with recent activity", async () => {
  const auth = { session: { user } };
  const app = client(backend(), auth);
  auth.storage.set(app.sessionPolicyStorageKey, JSON.stringify({
    email: user.email,
    startedAt: Date.now() - 9 * 60 * 60 * 1000,
    lastActivityAt: Date.now(),
  }));
  await app.restoreSession();
  assert.equal(app.appState.authenticated, false);
  assert.equal(auth.session, null);
  assert.match(app.element("loginError").textContent, /limite de duração/);
});

test("logout ends session, clears cached data/listeners and prevents restoration", async () => {
  const app = client();
  await app.restoreSession();
  await app.logout();
  assert.equal(app.auth.session, null);
  assert.equal(app.appState.authenticated, false);
  assert.equal(app.appState.bids.length, 0);
  assert.equal(app.db.channels.size, 0);
  assert.equal(app.timers.size, 0);
  assert.equal(app.listeners.size, 0);
  await app.restoreSession();
  assert.equal(app.appState.authenticated, false);
});

test("two independent sessions receive bid, quotation, item and deletion changes", async () => {
  const db = backend();
  const a = client(db), b = client(db);
  await a.restoreSession(); await b.restoreSession();
  await a.flush(); await b.flush();
  db.tables.bids[0].buyer_agency = "Atualizado";
  db.tables.quotations[0].edital = "Atualizado";
  db.tables.quotation_items.push({ id: 1, quotation_id: 1, item_number: 1, quantity: 2, final_bid: 15 });
  await a.reloadData(); await b.flush();
  assert.equal(b.appState.bids[0].buyer_agency, "Atualizado");
  assert.equal(b.appState.quotations[0].edital, "Atualizado");
  assert.equal(b.appState.quotationItems.length, 1);
  db.tables.bids = [];
  await a.reloadData(); await b.flush();
  assert.equal(b.appState.bids.length, 0);
});

test("technical specifications are normalized and incomplete values are preserved", () => {
  const app = client();
  assert.deepEqual(
    structuredClone(app.normalizeTechnicalSpecifications([
      { name: "  Memória RAM  ", required: " Mínimo 12 GB ", offered: " 16 GB " },
      { name: "Armazenamento", required: "", offered: "512 GB" },
      { name: "", required: "", offered: "" },
      null,
    ])),
    [
      { name: "Memória RAM", required: "Mínimo 12 GB", offered: "16 GB" },
      { name: "Armazenamento", required: "", offered: "512 GB" },
    ]
  );
});

test("remote edits and deletes preserve drafts and show a persistent warning", async () => {
  const app = client(); await app.restoreSession();
  app.appState.currentBidId = "TEST-1";
  app.appState.currentQuotationId = 1;
  app.element("buyerAgency").value = "Meu rascunho";
  app.element("quotationEdital").value = "Outro rascunho";
  app.db.tables.bids = [];
  app.db.tables.quotations[0].edital = "Remoto";
  await app.refreshInBackground();
  assert.equal(app.element("buyerAgency").value, "Meu rascunho");
  assert.equal(app.element("quotationEdital").value, "Outro rascunho");
  assert.match(app.element("syncNotice").textContent, /alterado ou excluído/);
});

test("polling recovers changes when no realtime notification arrives", async () => {
  const app = client(); await app.restoreSession(); await app.flush();
  app.db.tables.bids[0].buyer_agency = "Sem aviso";
  app.scheduleLiveRefresh(); await app.flush();
  assert.equal(app.appState.bids[0].buyer_agency, "Sem aviso");
});

test("network failure keeps session and data; retry applies a complete snapshot", async () => {
  const app = client(); await app.restoreSession();
  const getAll = app.store.getAll;
  app.db.tables.bids[0].buyer_agency = "Novo";
  app.store.getAll = async (name) => { if (name === "items") throw new Error("offline"); return getAll(name); };
  await app.refreshInBackground();
  assert.equal(app.appState.authenticated, true);
  assert.equal(app.appState.bids[0].buyer_agency, "Original");
  app.store.getAll = getAll;
  await app.refreshInBackground();
  assert.equal(app.appState.bids[0].buyer_agency, "Novo");
});

test("late responses after logout cannot repopulate private data", async () => {
  const app = client(); await app.restoreSession();
  let release;
  app.store.getAll = () => new Promise((resolve) => { release ??= []; release.push(resolve); });
  const pending = app.reloadData({ background: true });
  await app.logout();
  release.forEach((resolve) => resolve([{ id: 99 }]));
  await pending;
  assert.equal(app.appState.authenticated, false);
  assert.equal(app.appState.bids.length, 0);
});

test("a newer refresh wins over a slow earlier request", async () => {
  const app = client(); await app.restoreSession();
  const getAll = app.store.getAll;
  const releases = [];
  app.store.getAll = (table) => new Promise((resolve) => releases.push(async () => resolve(await getAll(table))));
  const old = app.reloadData({ background: true });
  app.store.getAll = getAll;
  app.db.tables.bids[0].buyer_agency = "Mais novo";
  await app.reloadData();
  app.db.tables.bids[0].buyer_agency = "Antigo";
  await Promise.all(releases.map((fn) => fn())); await old;
  assert.equal(app.appState.bids[0].buyer_agency, "Mais novo");
});

test("background refresh pauses in hidden tabs and during a save", async () => {
  const app = client(); await app.restoreSession();
  app.store.getAll = () => { throw new Error("must not query"); };
  app.context.document.hidden = true;
  await app.refreshInBackground();
  app.context.document.hidden = false;
  vm.runInContext("blockingOperationActive = true", app.context);
  await app.refreshInBackground();
  assert.equal(app.appState.bids[0].buyer_agency, "Original");
});

test("access removal closes the authenticated view", async () => {
  const app = client(); await app.restoreSession();
  app.db.users = [];
  await app.refreshInBackground();
  assert.equal(app.appState.authenticated, false);
  assert.equal(app.appState.bids.length, 0);
});

test("supplier search normalizes accents and tags without duplicates", () => {
  const c = client();
  const tags = vm.runInContext('parseSupplierTags("Informática, informática; papel A4, , LIMPEZA")', c.context);
  assert.deepEqual(Array.from(tags), ["Informática", "papel A4", "LIMPEZA"]);
  assert.equal(vm.runInContext('supplierSearchText("INFORMÁTICA")', c.context), "informatica");
});

test("supplier updates synchronize between sessions and clear on logout", async () => {
  const db = backend();
  const a = client(db);
  const b = client(db);
  await a.restoreSession();
  await b.restoreSession();
  db.tables.suppliers.push({ id: 1, name: "Loja de teste", website: "", contact: "", tags: ["papelaria"] });
  await a.reloadData();
  await b.flush();
  assert.equal(b.appState.suppliers[0].name, "Loja de teste");
  await b.logout();
  assert.equal(b.appState.suppliers.length, 0);
});

test("bid revenue uses only won items for approved, billed, disputed, and discarded bids", () => {
  const app = client();
  app.appState.bids = [
    { id: "APPROVED", status: "Aprovada" },
    { id: "DISPUTED", status: "Disputada" },
    { id: "ANALYSIS", status: "Em Analise" },
    { id: "DISCARDED", status: "Descartada" },
    { id: "DISQUALIFIED", status: "Desclassificado" },
    { id: "BILLED", status: "Faturado" },
  ];
  app.appState.items = app.appState.bids.flatMap((bid) => [
    { bid_id: bid.id, max_acceptable_value: 100, required_quantity: 2, is_won: 1 },
    { bid_id: bid.id, max_acceptable_value: 50, required_quantity: 3, is_won: 0 },
  ]);

  assert.equal(app.calculateBidSummary("APPROVED").totalFinal, 200);
  assert.equal(app.calculateBidSummary("DISPUTED").totalFinal, 200);
  assert.equal(app.calculateBidSummary("ANALYSIS").totalFinal, 350);
  assert.equal(app.calculateBidSummary("DISCARDED").totalFinal, 200);
  assert.equal(app.calculateBidSummary("DISQUALIFIED").totalFinal, 350);
  assert.equal(app.calculateBidSummary("BILLED").totalFinal, 200);
  assert.equal(app.calculateBidSummary("APPROVED").itemCount, 2);
});
