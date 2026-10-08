import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const chatSource = await readFile(new URL("../web/organization-chat.js", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../web/styles.css", import.meta.url), "utf8");

function createElement() {
  const classes = new Set();
  const attributes = new Map();
  return {
    hidden: false,
    textContent: "",
    title: "",
    classList: {
      add: (value) => classes.add(value),
      remove: (value) => classes.delete(value),
      contains: (value) => classes.has(value),
    },
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: (name) => attributes.get(name),
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

test("repeats the unread pulse every second and honors reduced motion", () => {
  assert.match(stylesSource, /\.organization-chat-button\.has-unread::before\s*\{\s*animation:\s*organization-chat-wave 1s ease-out infinite;/);
  assert.match(stylesSource, /\.organization-chat-button\.has-unread::after\s*\{\s*animation:\s*organization-chat-wave 1s ease-out \.3s infinite;/);
  assert.match(stylesSource, /\.organization-chat-unread-count\.has-unread\s*\{\s*animation:\s*organization-chat-counter-bump 1s ease-in-out infinite;/);
  assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.organization-chat-button\.has-unread::before,[\s\S]*?\.organization-chat-unread-count\.has-unread \{ animation: none; \}/);
});
