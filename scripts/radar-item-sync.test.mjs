import assert from "node:assert/strict";
import test from "node:test";
import {
  canRequestRadarItemSyncUpdate,
  createRadarItemSyncPoller,
  isCompleteRadarItemSnapshot,
  radarItemSyncPollDelay,
  radarItemSyncPresentation,
  radarItemSyncProgress,
  retainCompleteRadarItemSnapshot,
  shouldPollRadarItemSync,
  RADAR_ITEM_SYNC_ERROR_MESSAGE,
  RADAR_ITEM_SYNC_PENDING_MESSAGE,
  RADAR_ITEM_SYNC_RUNNING_MESSAGE,
} from "../web/radar-item-sync.js";

function fakeClock() {
  let time = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => time,
    schedule(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, dueAt: time + delay, delay });
      return id;
    },
    cancel(id) { timers.delete(id); },
    delays() { return [...timers.values()].map((timer) => timer.delay); },
    get pendingCount() { return timers.size; },
    async runNext() {
      const next = [...timers.entries()].sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      if (!next) return false;
      const [id, timer] = next;
      timers.delete(id);
      time = timer.dueAt;
      await timer.callback();
      return true;
    },
  };
}

test("pending items get the automatic update message without claiming confirmed absence", () => {
  const presentation = radarItemSyncPresentation(
    { status: "pending", items: [], complete: false },
    { status: "pending", sourceAvailability: "unknown" },
  );
  assert.equal(presentation.message, RADAR_ITEM_SYNC_PENDING_MESSAGE);
  assert.doesNotMatch(presentation.message, /confirmou|não possui itens/u);
  assert.equal(shouldPollRadarItemSync({ status: "pending" }, { status: "pending" }), true);
});

test("processing reports reliable page progress and stale snapshots remain visible", () => {
  const pending = radarItemSyncPresentation(
    { status: "pending", items: [], complete: false },
    { status: "processing", pagesProcessed: 3, pagesTotal: 7 },
  );
  assert.equal(pending.kind, "running");
  assert.equal(pending.message, RADAR_ITEM_SYNC_RUNNING_MESSAGE);
  assert.equal(pending.progress, "Páginas processadas: 3 de 7.");

  const stale = radarItemSyncPresentation(
    { status: "available", complete: true, items: [{ number: "1" }] },
    { status: "processing", retrievedAt: "2026-10-11T15:00:00.000Z", pagesProcessed: 3, pagesTotal: 7 },
  );
  assert.match(stale.message, /^Última atualização: .+\. Verificando novas informações\.$/u);
  assert.equal(stale.runningMessage, RADAR_ITEM_SYNC_RUNNING_MESSAGE);
  assert.equal(stale.progress, "Páginas processadas: 3 de 7.");
  assert.equal(stale.hasSnapshot, true);
  assert.equal(radarItemSyncProgress({ pagesProcessed: 2, pagesTotal: 1 }), "");
});

test("a complete snapshot survives a status read error and remains importable", () => {
  const snapshot = { status: "available", complete: true, items: [{ number: "4" }] };
  const failedRead = { status: "unavailable", complete: false, items: [] };
  assert.equal(retainCompleteRadarItemSnapshot(snapshot, failedRead), snapshot);
  assert.equal(isCompleteRadarItemSnapshot(retainCompleteRadarItemSnapshot(snapshot, failedRead)), true);

  const presentation = radarItemSyncPresentation(snapshot, { status: "complete" }, { communicationError: true });
  assert.equal(presentation.message, RADAR_ITEM_SYNC_ERROR_MESSAGE);
  assert.equal(presentation.hasSnapshot, true);
});

test("an empty complete result is confirmed; not-published is not treated as absence", () => {
  const unpublished = radarItemSyncPresentation(
    { status: "not_published", items: [], complete: false },
    { status: "pending", sourceAvailability: "not_published" },
  );
  assert.equal(unpublished.kind, "not-published");
  assert.match(unpublished.message, /ainda não disponibilizou/u);
  assert.doesNotMatch(unpublished.message, /confirmou/u);
  assert.equal(shouldPollRadarItemSync(
    { status: "not_published" },
    { status: "pending", sourceAvailability: "not_published" },
  ), false);

  const emptyConfirmed = radarItemSyncPresentation(
    { status: "available", items: [], complete: true },
    { status: "complete", sourceAvailability: "no_items_confirmed" },
  );
  assert.equal(emptyConfirmed.kind, "empty-confirmed");
  assert.match(emptyConfirmed.message, /confirmou/u);

  const emptyUnknown = radarItemSyncPresentation(
    { status: "available", items: [], complete: true },
    { status: "complete", sourceAvailability: "unknown" },
  );
  assert.equal(emptyUnknown.kind, "empty-unconfirmed");
  assert.doesNotMatch(emptyUnknown.message, /confirmou|não possui itens/u);
});

test("not-published items remain eligible for a retry only after retryAt", () => {
  const itemsState = { status: "not_published", complete: false, items: [] };
  const itemSync = {
    status: "pending",
    sourceAvailability: "not_published",
    retryAt: "2026-10-11T18:00:00.000Z",
  };
  assert.equal(canRequestRadarItemSyncUpdate(itemsState, itemSync, Date.parse("2026-10-11T17:59:59.000Z")), false);
  assert.equal(canRequestRadarItemSyncUpdate(itemsState, itemSync, Date.parse("2026-10-11T18:00:00.000Z")), true);
});

test("incomplete sets cannot be imported and refresh requests respect the retry window", () => {
  assert.equal(isCompleteRadarItemSnapshot({ status: "available", complete: false, items: [{ number: "1" }] }), false);
  assert.equal(isCompleteRadarItemSnapshot({ status: "available", complete: true, items: [{ number: "1" }] }), true);

  const retryAt = "2026-10-11T18:00:00.000Z";
  assert.equal(canRequestRadarItemSyncUpdate(
    { status: "unavailable" },
    { status: "failed", retryAt },
    Date.parse("2026-10-11T17:59:59.000Z"),
  ), false);
  assert.equal(canRequestRadarItemSyncUpdate(
    { status: "unavailable" },
    { status: "failed", retryAt },
    Date.parse("2026-10-11T18:00:00.000Z"),
  ), true);
  assert.equal(canRequestRadarItemSyncUpdate(
    { status: "pending" },
    { status: "processing" },
    Date.parse("2026-10-11T18:00:00.000Z"),
  ), false);
});

test("polling waits four seconds, backs off, and stops when the task completes", async () => {
  const clock = fakeClock();
  let polls = 0;
  let active = true;
  const poller = createRadarItemSyncPoller({
    poll: async () => { polls += 1; if (polls === 2) active = false; },
    shouldContinue: () => active,
    schedule: clock.schedule,
    cancel: clock.cancel,
    now: clock.now,
  });

  assert.equal(poller.start(), true);
  assert.deepEqual(clock.delays(), [4_000]);
  await clock.runNext();
  assert.deepEqual(clock.delays(), [6_000]);
  await clock.runNext();
  assert.equal(polls, 2);
  assert.equal(clock.pendingCount, 0);
  assert.equal(poller.isRunning, false);
  assert.equal(radarItemSyncPollDelay(20), 30_000);
});

test("closing or switching details cancels a scheduled poll and ignores an in-flight response", async () => {
  const clock = fakeClock();
  let finishPoll;
  let polls = 0;
  const poller = createRadarItemSyncPoller({
    poll: () => new Promise((resolve) => { polls += 1; finishPoll = resolve; }),
    shouldContinue: () => true,
    schedule: clock.schedule,
    cancel: clock.cancel,
    now: clock.now,
  });

  poller.start();
  const pendingPoll = clock.runNext();
  await Promise.resolve();
  assert.equal(polls, 1);
  poller.stop();
  finishPoll();
  await pendingPoll;
  assert.equal(clock.pendingCount, 0);
  assert.equal(poller.isRunning, false);
});

test("a long-running sync offers another watch window after two minutes", async () => {
  const clock = fakeClock();
  let expired = 0;
  const poller = createRadarItemSyncPoller({
    poll: async () => {},
    shouldContinue: () => true,
    onWindowExpired: () => { expired += 1; },
    schedule: clock.schedule,
    cancel: clock.cancel,
    now: clock.now,
    maxDurationMs: 10_000,
  });

  poller.start();
  await clock.runNext();
  assert.deepEqual(clock.delays(), [6_000]);
  await clock.runNext();
  assert.equal(expired, 1);
  assert.equal(poller.isRunning, false);
  assert.equal(clock.pendingCount, 0);
});
