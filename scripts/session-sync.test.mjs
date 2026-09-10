import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
const application = source.slice(0, source.lastIndexOf('withBlockingLoading(main, "Verificando sessão…")'));
const user = { email: "test@example.test", name: "Teste" };

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
    console, URL, Intl, Date,
    window: { GLL_CONFIG: { supabaseUrl: "https://test.invalid", supabaseAnonKey: "test" }, ...events },
    document: { hidden: false, getElementById: element, querySelectorAll: () => [], createElement: () => element("syncNotice"), ...events },
    setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearInterval: (id) => timers.delete(id),
  });
  vm.runInContext(application, context);
  const api = vm.runInContext(`({ store, appState, restoreSession, logout, reloadData, refreshInBackground, startLiveUpdates, stopLiveUpdates, resetAuthenticatedView, scheduleLiveRefresh })`, context);
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
  return { ...api, db, auth, context, elements, element, timers, listeners,
    flush: async () => {
      const pending = [...timers.values()]; timers.clear();
      for (const fn of pending) await fn();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

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

test("missing session stays at login without reading protected tables", async () => {
  const app = client(backend(), { session: null });
  app.store.getAll = () => { throw new Error("must not read"); };
  await app.restoreSession();
  assert.equal(app.appState.authenticated, false);
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
