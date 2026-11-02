import assert from 'node:assert/strict';
import test from 'node:test';
import { createBidFollowupFeature } from '../web/bid-followup.js';

function harness() {
  const elements = new Map();
  const element = () => ({ open: false, value: '', style: {}, dataset: {}, children: [], scrollHeight: 0,
    classList: { toggle() {}, add() {} }, setAttribute() {},
    replaceChildren(...rows) { this.children = rows; }, append(...rows) { this.children.push(...rows); },
    showModal() { this.open = true; }, close() { this.open = false; }, focus() {}, querySelector() { return null; } });
  globalThis.document = { hidden: false, getElementById(id) {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  }, createElement: element, createTextNode: (value) => ({textContent:value}) };
  globalThis.window = { setTimeout: () => {} };
  globalThis.requestAnimationFrame = (callback) => callback();
  let bid = null;
  let user = 'recipient';
  let rows = [];
  let calls = 0;
  let gate = null;
  const changes = [];
  const client = { async rpc(name, cursor) {
    assert.equal(name, 'list_bid_message_notifications');
    calls++;
    if (gate) { const wait = gate; gate = null; await wait; }
    const start = cursor.p_before_message_id ? rows.findIndex((r) => r.message_id === cursor.p_before_message_id) + 1 : 0;
    return { data: rows.slice(start, start + 100), error: null };
  } };
  const feature = createBidFollowupFeature({ getClient: () => client, getUserId: () => user,
    getBid: () => bid, getUsers: () => [], onNotificationsChanged: (rows, options) => changes.push({ rows, options }) });
  return { feature, changes, client, elements, setBid(v) { bid = v; }, get calls() { return calls; }, setUser(v) { user = v; },
    setRows(v) { rows = v; }, block() { let release; gate = new Promise((resolve) => { release = resolve; }); return release; } };
}
const row = (id) => ({ message_id: String(id), bid_id: 'bid', created_at: '2026-11-01T10:00:00Z', message: { id: String(id), author_id: 'author' } });

test('loads every page silently, then discovers lost events and deduplicates late events', async () => {
  const h = harness();
  const old = Array.from({length: 251}, (_, i) => row(i));
  h.setRows(old);
  await h.feature.refreshNotifications();
  assert.equal(h.calls, 3);
  assert.equal(h.changes.at(-1).rows.length, 251);
  assert.deepEqual(h.changes.at(-1).options.notifyMessageIds, []);
  h.setRows([row('new'), ...old]);
  await h.feature.refreshNotifications();
  assert.deepEqual(h.changes.at(-1).options.notifyMessageIds, ['new']);
  await h.feature.refreshNotifications({notifyMessageId: 'new'});
  assert.deepEqual(h.changes.at(-1).options.notifyMessageIds, []);
});

test('coalesces concurrent refreshes and retains an event during the initial load', async () => {
  const h = harness();
  h.setRows([row('new')]);
  const release = h.block();
  const first = h.feature.refreshNotifications();
  const second = h.feature.refreshNotifications({notifyMessageId: 'new'});
  assert.equal(first, second);
  assert.equal(h.calls, 1);
  release();
  await first;
  assert.deepEqual(h.changes.flatMap((c) => c.options.notifyMessageIds), ['new']);
});

test('logout invalidates an in-flight query and a new session starts silently', async () => {
  const h = harness();
  h.setRows([row('private')]);
  const release = h.block();
  const old = h.feature.refreshNotifications({notifyMessageId: 'private'});
  h.feature.reset();
  h.setUser('another-user');
  h.setRows([row('other')]);
  await h.feature.refreshNotifications();
  release();
  await old;
  assert.equal(h.changes.some((c) => c.rows.some((r) => r.message_id === 'private')), false);
  assert.deepEqual(h.changes.at(-1).options.notifyMessageIds, []);
});

test('failed initial query does not establish a false baseline or consume pending events', async () => {
  const h = harness();
  const rpc = h.client.rpc;
  h.client.rpc = async () => ({error: new Error('offline')});
  await assert.rejects(h.feature.refreshNotifications({notifyMessageId: 'new'}), /offline/);
  h.client.rpc = rpc;
  h.setRows([row('new')]);
  await h.feature.refreshNotifications();
  assert.deepEqual(h.changes.at(-1).options.notifyMessageIds, ['new']);
});


test('opens a notification older than the latest 250 messages with a scoped target lookup', async () => {
  const h = harness();
  h.setBid({id:'bid'});
  const target = {id:'old',bid_id:'bid',organization_id:'org',author_id:'author',body:'Historical synthetic message',created_at:'2026-01-01T00:00:00Z'};
  const latest = Array.from({length:250}, (_, i) => ({...target,id:`recent-${i}`,created_at:'2026-11-01T00:00:00Z'}));
  let targetFilters, receipts;
  h.client.from = (table) => {
    const filters = {};
    const query = {
      select() { return query; }, eq(k,v) { filters[k]=v; return query; }, order() {return query;}, limit() {return query;}, in() {return query;},
      upsert(rows) {receipts=rows; return Promise.resolve({error:null});},
      maybeSingle() { targetFilters=filters; return Promise.resolve({data:target,error:null}); },
      then(resolve,reject) { return Promise.resolve({data:table === 'bid_process_messages' ? latest : [],error:null}).then(resolve,reject); },
    };
    return query;
  };
  try {
    h.feature.open('old');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(targetFilters, {bid_id:'bid',id:'old'});
    const rendered = h.elements.get('bidFollowupMessages').children;
    assert.equal(rendered.length,251);
    assert.equal(rendered[0].dataset.messageId,'old');
    assert.equal(receipts.length,251);
  } finally { h.feature.close(); }
});
