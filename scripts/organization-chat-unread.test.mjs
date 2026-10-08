import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const chatSource = await readFile(new URL("../web/organization-chat.js", import.meta.url), "utf8");

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
  let nextFrameId = 0;
  const frames = new Map();
  const document = { getElementById: (id) => elements.get(id) || null };
  const window = { matchMedia: () => ({ matches: false }) };
  const context = {
    window,
    document,
    crypto: { randomUUID: () => "test-session" },
    console: { warn() {} },
    setTimeout,
    clearTimeout,
    requestAnimationFrame(callback) {
      const id = ++nextFrameId;
      frames.set(id, setTimeout(() => {
        frames.delete(id);
        callback(Date.now());
      }, 0));
      return id;
    },
    cancelAnimationFrame(id) {
      clearTimeout(frames.get(id));
      frames.delete(id);
    },
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

test("loads existing unread messages without animation and animates each new incoming message", async () => {
  const { button, counter, chat, setCounts } = createChatHarness();
  setCounts(8, 5);

  await chat.startUnreadTracking();

  assert.equal(counter.textContent, "3");
  assert.equal(counter.hidden, false);
  assert.equal(button.getAttribute("aria-label"), "Mensagens da organização, 3 mensagens não lidas");
  assert.equal(button.classList.contains("is-notifying"), false);
  assert.equal(counter.classList.contains("is-bumping"), false);

  setCounts(9, 5);
  const message = { id: 20, organization_id: "org-1", sender_id: "user-2" };
  chat.handleIncomingMessage({ new: message });
  chat.handleIncomingMessage({ new: message });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(counter.textContent, "4");
  assert.equal(button.classList.contains("is-notifying"), true);
  assert.equal(counter.classList.contains("is-bumping"), true);

  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(counter.textContent, "4");

  chat.handleIncomingMessage({ new: { id: 21, organization_id: "org-1", sender_id: "user-1" } });
  assert.equal(counter.textContent, "4");

  chat.stopUnreadTracking();
  assert.equal(counter.hidden, true);
  assert.equal(button.classList.contains("is-notifying"), false);
});

test("animates an increase discovered by the existing background refresh", async () => {
  const { button, counter, chat, setCounts } = createChatHarness();
  setCounts(4, 4);
  await chat.startUnreadTracking();

  setCounts(5, 4);
  await chat.refreshUnreadCount({ animateIncrease: true });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(counter.textContent, "1");
  assert.equal(button.classList.contains("is-notifying"), true);
  assert.equal(counter.classList.contains("is-bumping"), true);
  chat.stopUnreadTracking();
});
