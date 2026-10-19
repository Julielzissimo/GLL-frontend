import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const chatSource = await readFile(new URL("../web/organization-chat.js", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../web/styles.css", import.meta.url), "utf8");

function createElement() {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  const children = [];
  return {
    hidden: false,
    textContent: "",
    title: "",
    value: "",
    open: false,
    style: {},
    scrollHeight: 0,
    scrollTop: 0,
    clientHeight: 0,
    classList: {
      add: (value) => classes.add(value),
      remove: (value) => classes.delete(value),
      contains: (value) => classes.has(value),
    },
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: (name) => attributes.get(name),
    addEventListener: (name, listener) => listeners.set(name, listener),
    listener: (name) => listeners.get(name),
    focus() {},
    showModal() { this.open = true; },
    close() { this.open = false; },
    replaceChildren(...items) { children.splice(0, children.length, ...items); },
    append(...items) { children.push(...items); },
  };
}

function createChatHarness() {
  const button = createElement();
  const counter = createElement();
  const elements = new Map([
    ["organizationChatButton", button],
    ["organizationChatUnreadCount", counter],
  ]);
  let incomingCount = 0;
  let readCount = 0;
  const document = { getElementById: (id) => elements.get(id) || null };
  const window = {};
  const context = {
    window,
    document,
    crypto: { randomUUID: () => "test-session" },
    console: { warn() {} },
    setTimeout,
    clearTimeout,
    Intl,
    Date,
    Map,
    Set,
    Promise,
  };
  runInNewContext(chatSource, context);

  const client = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        neq() { return query; },
        then(resolve, reject) {
          const count = table === "organization_messages" ? incomingCount : readCount;
          return Promise.resolve({ count, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const chat = window.GLLOrganizationChat.createOrganizationChat({
    getClient: () => client,
    getOrganizationId: () => "org-1",
    getOrganizationName: () => "Organização",
    getUserId: () => "user-1",
  });

  return {
    button,
    counter,
    chat,
    setCounts(messages, reads) {
      incomingCount = messages;
      readCount = reads;
    },
  };
}

function createRefreshRaceHarness() {
  const elementIds = [
    "organizationChatButton",
    "closeOrganizationChatButton",
    "organizationChatDialog",
    "organizationChatMessages",
    "organizationChatCancelReplyButton",
    "organizationChatForm",
    "organizationChatInput",
    "organizationChatReplyPreview",
    "organizationChatReplyAuthor",
    "organizationChatReplyBody",
    "organizationChatTyping",
    "organizationChatSubtitle",
    "organizationChatError",
  ];
  const elements = new Map(elementIds.map((id) => [id, createElement()]));
  const firstMessageQuery = {};
  firstMessageQuery.promise = new Promise((resolve) => { firstMessageQuery.resolve = resolve; });
  let resolveFirstQueryStarted;
  const firstQueryStarted = new Promise((resolve) => { resolveFirstQueryStarted = resolve; });
  let messageRefreshQueries = 0;
  let intervalId = 0;
  const document = {
    hidden: false,
    getElementById: (id) => elements.get(id) || null,
    createElement: () => createElement(),
  };
  const window = { addEventListener() {} };
  const context = {
    window,
    document,
    crypto: { randomUUID: () => "test-session" },
    console: { warn() {} },
    setTimeout,
    clearTimeout,
    setInterval: () => ++intervalId,
    clearInterval() {},
    Intl,
    Date,
    Map,
    Set,
    Promise,
  };
  runInNewContext(chatSource, context);

  const client = {
    from(table) {
      let countQuery = false;
      const query = {
        select(_columns, options) { countQuery = Boolean(options?.head); return query; },
        eq() { return query; },
        neq() { return query; },
        order() { return query; },
        limit() { return query; },
        upsert() { return Promise.resolve({ error: null }); },
        delete() { return query; },
        then(resolve, reject) {
          if (table === "organization_messages" && !countQuery) {
            messageRefreshQueries += 1;
            if (messageRefreshQueries === 1) {
              resolveFirstQueryStarted();
              return firstMessageQuery.promise.then(resolve, reject);
            }
          }
          const result = { data: [], count: 0, error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const chat = window.GLLOrganizationChat.createOrganizationChat({
    getClient: () => client,
    getOrganizationId: () => "org-1",
    getOrganizationName: () => "Organização",
    getUserId: () => "user-1",
  });
  chat.bind();

  return {
    chat,
    elements,
    firstQueryStarted,
    startUnreadTracking: () => chat.startUnreadTracking(),
    releaseFirstQuery: () => firstMessageQuery.resolve({ data: [], count: 0, error: null }),
    getMessageRefreshQueries: () => messageRefreshQueries,
  };
}

test("keeps the unread animation active until all messages are read", async () => {
  const { button, counter, chat, setCounts } = createChatHarness();
  setCounts(8, 5);

  await chat.startUnreadTracking();

  assert.equal(counter.textContent, "3");
  assert.equal(counter.hidden, false);
  assert.equal(button.getAttribute("aria-label"), "Mensagens da organização, 3 mensagens não lidas");
  assert.equal(button.classList.contains("has-unread"), true);
  assert.equal(counter.classList.contains("has-unread"), true);

  setCounts(9, 5);
  const message = { id: 20, organization_id: "org-1", sender_id: "user-2" };
  chat.handleIncomingMessage({ new: message });
  chat.handleIncomingMessage({ new: message });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(counter.textContent, "4");
  assert.equal(button.classList.contains("has-unread"), true);
  assert.equal(counter.classList.contains("has-unread"), true);

  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(counter.textContent, "4");

  chat.handleIncomingMessage({ new: { id: 21, organization_id: "org-1", sender_id: "user-1" } });
  assert.equal(counter.textContent, "4");

  setCounts(9, 9);
  await chat.refreshUnreadCount();
  assert.equal(counter.hidden, true);
  assert.equal(button.classList.contains("has-unread"), false);
  assert.equal(counter.classList.contains("has-unread"), false);
  chat.stopUnreadTracking();
});

test("starts the unread animation when a background refresh discovers unread messages", async () => {
  const { button, counter, chat, setCounts } = createChatHarness();
  setCounts(4, 4);
  await chat.startUnreadTracking();

  setCounts(5, 4);
  await chat.refreshUnreadCount();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(counter.textContent, "1");
  assert.equal(button.classList.contains("has-unread"), true);
  assert.equal(counter.classList.contains("has-unread"), true);
  chat.stopUnreadTracking();
});

test("accepts the private Broadcast payload and deduplicates the Postgres Changes fallback", async () => {
  const { button, counter, chat, setCounts } = createChatHarness();
  await chat.startUnreadTracking();
  setCounts(1, 0);

  const message = { id: 28, organization_id: "org-1", sender_id: "user-2" };
  chat.handleIncomingMessage({ type: "broadcast", event: "organization-message-inserted", payload: message });
  assert.equal(counter.textContent, "1");
  chat.handleIncomingMessage({ new: message });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(counter.textContent, "1");
  assert.equal(button.getAttribute("aria-label"), "Mensagens da organização, 1 mensagem não lida");
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(counter.textContent, "1");
  chat.stopUnreadTracking();
});

test("repeats a realtime refresh requested while another chat refresh is loading", async () => {
  const harness = createRefreshRaceHarness();
  await harness.startUnreadTracking();

  harness.elements.get("organizationChatButton").listener("click")();
  await harness.firstQueryStarted;
  harness.chat.handleIncomingMessage({ new: { id: 50, organization_id: "org-1", sender_id: "user-2" } });
  harness.releaseFirstQuery();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(harness.getMessageRefreshQueries(), 2);
  harness.chat.close();
});

test("repeats the unread pulse every second and honors reduced motion", () => {
  assert.match(stylesSource, /\.organization-chat-button\.has-unread::before\s*\{\s*animation:\s*organization-chat-wave 1s ease-out infinite;/);
  assert.match(stylesSource, /\.organization-chat-button\.has-unread::after\s*\{\s*animation:\s*organization-chat-wave 1s ease-out \.3s infinite;/);
  assert.match(stylesSource, /\.organization-chat-unread-count\.has-unread\s*\{\s*animation:\s*organization-chat-counter-bump 1s ease-in-out infinite;/);
  assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.organization-chat-button\.has-unread::before,[\s\S]*?\.organization-chat-unread-count\.has-unread \{ animation: none; \}/);
});
