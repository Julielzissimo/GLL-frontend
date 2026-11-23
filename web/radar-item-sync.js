const ACTIVE_SYNC_STATUSES = new Set(["pending", "processing", "partial"]);
const POLL_DELAYS_MS = Object.freeze([4_000, 6_000, 10_000, 18_000, 30_000]);
export const RADAR_ITEM_SYNC_MAX_POLL_DURATION_MS = 120_000;

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export const RADAR_ITEM_SYNC_PENDING_MESSAGE = "Os itens deste edital estão sendo consultados. A atualização ocorrerá automaticamente.";
export const RADAR_ITEM_SYNC_RUNNING_MESSAGE = "Sincronizando itens do edital...";
export const RADAR_ITEM_SYNC_ERROR_MESSAGE = "Não foi possível atualizar os itens agora. O sistema tentará novamente.";

export function isCompleteRadarItemSnapshot(itemsState) {
  return itemsState?.status === "available"
    && itemsState.complete === true
    && Array.isArray(itemsState.items);
}

export function shouldPollRadarItemSync(itemsState, itemSync) {
  return ACTIVE_SYNC_STATUSES.has(itemSync?.status)
    && itemSync?.sourceAvailability !== "not_published"
    && itemsState?.status !== "not_published";
}

export function radarItemSyncProgress(itemSync = {}) {
  const processed = Number(itemSync.pagesProcessed);
  const total = itemSync.pagesTotal === null || itemSync.pagesTotal === undefined
    ? null
    : Number(itemSync.pagesTotal);
  if (!Number.isSafeInteger(processed) || processed < 0) return "";
  if (total !== null && Number.isSafeInteger(total) && total > 0 && processed <= total) {
    return `Páginas processadas: ${processed.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}.`;
  }
  if (processed > 0 && (total === null || !Number.isSafeInteger(total))) {
    return `Páginas processadas: ${processed.toLocaleString("pt-BR")}.`;
  }
  return "";
}

function formattedDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateTimeFormatter.format(date);
}

export function radarItemSyncPresentation(itemsState, itemSync = {}, { communicationError = false } = {}) {
  const hasSnapshot = isCompleteRadarItemSnapshot(itemsState);
  const hasItems = hasSnapshot && itemsState.items.length > 0;
  const syncActive = shouldPollRadarItemSync(itemsState, itemSync);
  const progress = radarItemSyncProgress(itemSync);
  const canRetry = itemSync.status === "failed"
    || itemSync.errorCode === "ITEMS_SYNC_QUEUE_FAILED"
    || itemsState?.status === "unavailable"
    || itemsState?.status === "pagination_error";

  if (communicationError || canRetry
    || itemSync.errorCode === "ITEMS_PERSISTENCE_FAILED") {
    return {
      kind: "error",
      message: RADAR_ITEM_SYNC_ERROR_MESSAGE,
      progress: "",
      syncActive,
      hasSnapshot,
    };
  }

  if (itemsState?.status === "not_published" || itemSync.sourceAvailability === "not_published") {
    return {
      kind: "not-published",
      message: "O PNCP ainda não disponibilizou itens para esta contratação.",
      progress: "",
      syncActive: false,
      hasSnapshot: false,
    };
  }

  if (hasSnapshot && !hasItems && !syncActive
    && itemSync.sourceAvailability === "no_items_confirmed") {
    return {
      kind: "empty-confirmed",
      message: "O PNCP confirmou que esta contratação não possui itens publicados.",
      progress: "",
      syncActive: false,
      hasSnapshot: true,
    };
  }

  if (hasSnapshot && !hasItems && !syncActive) {
    return {
      kind: "empty-unconfirmed",
      message: "Ainda não foi possível confirmar a disponibilidade dos itens.",
      progress: "",
      syncActive: false,
      hasSnapshot: true,
    };
  }

  if (hasSnapshot && syncActive) {
    const lastUpdated = formattedDateTime(itemSync.retrievedAt);
    return {
      kind: "stale",
      message: lastUpdated
        ? `Última atualização: ${lastUpdated}. Verificando novas informações.`
        : "Verificando novas informações.",
      runningMessage: itemSync.status === "processing" || itemSync.status === "partial"
        ? RADAR_ITEM_SYNC_RUNNING_MESSAGE
        : "",
      progress,
      syncActive: true,
      hasSnapshot: true,
    };
  }

  if (itemSync.status === "processing" || itemSync.status === "partial") {
    return {
      kind: "running",
      message: RADAR_ITEM_SYNC_RUNNING_MESSAGE,
      progress,
      syncActive: true,
      hasSnapshot: false,
    };
  }

  if (itemSync.status === "pending" || itemsState?.status === "pending") {
    return {
      kind: "pending",
      message: RADAR_ITEM_SYNC_PENDING_MESSAGE,
      progress: "",
      syncActive: true,
      hasSnapshot: false,
    };
  }

  if (hasItems) {
    return { kind: "available", message: "", progress: "", syncActive: false, hasSnapshot: true };
  }

  if (Array.isArray(itemsState?.items) && itemsState.items.length > 0) {
    return {
      kind: "incomplete",
      message: "A importação ficará disponível após a sincronização completa dos itens.",
      progress,
      syncActive,
      hasSnapshot: false,
    };
  }

  return {
    kind: "pending",
    message: RADAR_ITEM_SYNC_PENDING_MESSAGE,
    progress: "",
    syncActive: true,
    hasSnapshot: false,
  };
}

function retryWindowIsOpen(itemSync, now) {
  if (!itemSync?.retryAt) return true;
  const retryAt = Date.parse(itemSync.retryAt);
  return Number.isFinite(retryAt) && retryAt <= now;
}

export function canRequestRadarItemSyncUpdate(itemsState, itemSync = {}, now = Date.now()) {
  const currentTime = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(currentTime)) return false;

  const waitingForUnpublishedRetry = itemSync.status === "pending"
    && itemSync.sourceAvailability === "not_published";
  if (ACTIVE_SYNC_STATUSES.has(itemSync.status) && !waitingForUnpublishedRetry) return false;
  if (itemSync.status === "failed"
    || itemSync.errorCode === "ITEMS_SYNC_QUEUE_FAILED"
    || itemsState?.status === "unavailable"
    || itemsState?.status === "pagination_error"
    || waitingForUnpublishedRetry
    || itemSync.status === "complete") {
    return retryWindowIsOpen(itemSync, currentTime);
  }
  return false;
}

export function retainCompleteRadarItemSnapshot(currentItems, incomingItems) {
  if (isCompleteRadarItemSnapshot(currentItems) && !isCompleteRadarItemSnapshot(incomingItems)) {
    return currentItems;
  }
  return incomingItems;
}

export function radarItemSyncPollDelay(attempt) {
  const index = Math.max(0, Math.floor(Number(attempt) || 0));
  return POLL_DELAYS_MS[Math.min(index, POLL_DELAYS_MS.length - 1)];
}

export function createRadarItemSyncPoller({
  poll,
  shouldContinue,
  onError = () => {},
  onWindowExpired = () => {},
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout,
  now = () => Date.now(),
  maxDurationMs = RADAR_ITEM_SYNC_MAX_POLL_DURATION_MS,
} = {}) {
  if (typeof poll !== "function" || typeof shouldContinue !== "function") {
    throw new TypeError("O acompanhamento da sincronização exige uma consulta e uma condição de continuidade.");
  }
  if (typeof schedule !== "function" || typeof cancel !== "function" || typeof now !== "function") {
    throw new TypeError("O acompanhamento da sincronização exige um agendador válido.");
  }

  let active = false;
  let timer = null;
  let generation = 0;
  let startedAt = 0;
  let attempt = 0;

  function stop() {
    if (!active && timer === null) return false;
    active = false;
    generation += 1;
    if (timer !== null) cancel(timer);
    timer = null;
    return true;
  }

  function scheduleTick(runGeneration, delay) {
    let handle;
    handle = schedule(() => {
      if (timer === handle) timer = null;
      return tick(runGeneration);
    }, delay);
    timer = handle;
  }

  async function tick(runGeneration) {
    if (!active || runGeneration !== generation) return;
    try {
      await poll();
    } catch (error) {
      try { onError(error); } catch { /* Error reporting must not stop the watcher. */ }
    }

    if (!active || runGeneration !== generation) return;
    let keepGoing = false;
    try { keepGoing = shouldContinue(); } catch { keepGoing = false; }
    if (!keepGoing) {
      stop();
      return;
    }

    const elapsed = Math.max(0, Number(now()) - startedAt);
    const remaining = maxDurationMs - elapsed;
    if (remaining <= 0) {
      stop();
      onWindowExpired();
      return;
    }

    attempt += 1;
    const delay = radarItemSyncPollDelay(attempt);
    scheduleTick(runGeneration, Math.min(delay, remaining));
  }

  function start() {
    if (active) return false;
    active = true;
    generation += 1;
    startedAt = Number(now());
    attempt = 0;
    scheduleTick(generation, Math.min(radarItemSyncPollDelay(0), Math.max(0, maxDurationMs)));
    return true;
  }

  return Object.freeze({
    start,
    stop,
    get isRunning() { return active; },
  });
}
