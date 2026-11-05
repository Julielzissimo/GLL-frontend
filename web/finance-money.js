const MONEY_SCALE = 2;
const PRICE_SCALE = 4;
const QUANTITY_SCALE = 6;
const PERCENT_SCALE = 6;

function parseScaled(value, scale, label) {
  if (typeof value !== "string") {
    throw new TypeError(`${label} deve ser um decimal textual.`);
  }
  const raw = String(value).trim();
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(raw);
  if (!match || (match[3]?.length ?? 0) > scale) {
    throw new TypeError(`${label} aceita no máximo ${scale} casas decimais.`);
  }
  const factor = 10n ** BigInt(scale);
  const fraction = (match[3] ?? "").padEnd(scale, "0");
  const magnitude = BigInt(match[2]) * factor + BigInt(fraction || "0");
  return match[1] ? -magnitude : magnitude;
}

function divideRoundHalfAwayFromZero(numerator, denominator) {
  if (denominator <= 0n) throw new RangeError("O divisor deve ser positivo.");
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  let quotient = magnitude / denominator;
  if ((magnitude % denominator) * 2n >= denominator) quotient += 1n;
  return negative ? -quotient : quotient;
}

function moneyFromCents(cents) {
  const negative = cents < 0n;
  const magnitude = negative ? -cents : cents;
  const whole = magnitude / 100n;
  const fraction = String(magnitude % 100n).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Converts an exact decimal string to integer cents. */
export function parseMoneyToCents(value) {
  return parseScaled(value, MONEY_SCALE, "Valor monetário");
}

/** Formats integer cents without passing through floating point. */
export function formatCents(cents) {
  if (typeof cents !== "bigint") throw new TypeError("Informe o valor em centavos como bigint.");
  return moneyFromCents(cents);
}

/** Adds decimal money strings exactly. */
export function sumMoney(values) {
  if (!Array.isArray(values)) throw new TypeError("Informe uma lista de valores monetários.");
  return moneyFromCents(values.reduce((sum, value) => sum + parseMoneyToCents(value), 0n));
}

/**
 * Mirrors the provisional P0 objective calculation with fixed point inputs.
 * The database stores unit prices at 4 decimal places, quantity at 6, and
 * rounds the objective to cents. A negative margin is capped at zero.
 */
export function calculateItemObjective({ unitPrice, supplierCost, quantity }) {
  const price = parseScaled(unitPrice, PRICE_SCALE, "Preço unitário");
  const cost = parseScaled(supplierCost, PRICE_SCALE, "Custo unitário");
  const units = parseScaled(quantity, QUANTITY_SCALE, "Quantidade");
  if (price <= 0n || cost < 0n || units <= 0n) {
    throw new RangeError("Preço e quantidade devem ser positivos; custo não pode ser negativo.");
  }
  const productScaleToCents = 10n ** BigInt(PRICE_SCALE + QUANTITY_SCALE - MONEY_SCALE);
  const receivableCents = divideRoundHalfAwayFromZero(price * units, productScaleToCents);
  if (receivableCents <= 0n) throw new RangeError("O item precisa ter base de recebimento positiva.");
  const profitRaw = (price - cost) * units;
  const profitCents = profitRaw <= 0n
    ? 0n
    : divideRoundHalfAwayFromZero(profitRaw, productScaleToCents);
  return Object.freeze({
    receivableBase: moneyFromCents(receivableCents),
    expectedProfit: moneyFromCents(profitCents),
  });
}

/**
 * Computes the incremental recognized profit for a partial receipt. The
 * caller supplies net receipts before and after the new allocation.
 */
export function calculateRecognizedProfitDelta({
  expectedProfit,
  receivableBase,
  receivedBefore,
  receiptAmount,
}) {
  const profitCents = parseMoneyToCents(expectedProfit);
  const baseCents = parseMoneyToCents(receivableBase);
  const beforeCents = parseMoneyToCents(receivedBefore);
  const amountCents = parseMoneyToCents(receiptAmount);
  if (profitCents < 0n || baseCents <= 0n || beforeCents < 0n || amountCents <= 0n) {
    throw new RangeError("Lucro, base ou recebimento fora do intervalo permitido.");
  }
  const afterCents = beforeCents + amountCents;
  if (afterCents > baseCents) throw new RangeError("Recebimentos excedem a base faturável.");
  const recognizedAt = (receivedCents) => divideRoundHalfAwayFromZero(
    profitCents * (receivedCents > baseCents ? baseCents : receivedCents),
    baseCents,
  );
  return moneyFromCents(recognizedAt(afterCents) - recognizedAt(beforeCents));
}

/**
 * Splits a recognized amount using percentage snapshots at six-decimal
 * precision. Each participant share rounds independently to cents, matching
 * the database reservation snapshot rule.
 */
export function allocateRecognizedProfit(amount, members) {
  if (!Array.isArray(members) || members.length === 0) {
    throw new TypeError("Informe os participantes e percentuais vigentes.");
  }
  const amountCents = parseMoneyToCents(amount);
  if (amountCents < 0n) throw new RangeError("O valor reservado não pode ser negativo.");
  const seen = new Set();
  let totalPercentage = 0n;
  const denominator = 100n * 10n ** BigInt(PERCENT_SCALE);
  const exactShares = members.map((member) => {
    if (!member || typeof member.participantId !== "string" || !member.participantId.trim()) {
      throw new TypeError("Cada percentual precisa de um participante.");
    }
    if (seen.has(member.participantId)) throw new TypeError("Participante repetido na versão percentual.");
    seen.add(member.participantId);
    const percentage = parseScaled(member.percentage, PERCENT_SCALE, "Percentual");
    if (percentage <= 0n || percentage > 100n * 10n ** BigInt(PERCENT_SCALE)) {
      throw new RangeError("Cada percentual deve estar entre 0 e 100.");
    }
    totalPercentage += percentage;
    const numerator = amountCents * percentage;
    return {
      participantId: member.participantId,
      percentage: member.percentage,
      baseCents: numerator / denominator,
      remainder: numerator % denominator,
    };
  });
  if (totalPercentage > 100n * 10n ** BigInt(PERCENT_SCALE)) {
    throw new RangeError("A soma dos percentuais não pode ultrapassar 100.");
  }
  const reservedCents = divideRoundHalfAwayFromZero(amountCents * totalPercentage, denominator);
  const baseTotal = exactShares.reduce((sum, share) => sum + share.baseCents, 0n);
  let centsToDistribute = reservedCents - baseTotal;
  const byRemainder = [...exactShares].sort((left, right) => {
    if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1;
    return left.participantId < right.participantId ? -1 : left.participantId > right.participantId ? 1 : 0;
  });
  const addCentTo = new Set();
  for (const share of byRemainder) {
    if (centsToDistribute <= 0n) break;
    addCentTo.add(share.participantId);
    centsToDistribute -= 1n;
  }
  if (centsToDistribute !== 0n) throw new Error("Não foi possível fechar o rateio em centavos.");
  const shares = exactShares.map((share) => ({
    participantId: share.participantId,
    percentage: String(share.percentage),
    amount: moneyFromCents(share.baseCents + (addCentTo.has(share.participantId) ? 1n : 0n)),
  }));
  const reservedAmount = shares.reduce((sum, share) => sum + parseMoneyToCents(share.amount), 0n);
  return Object.freeze({
    reservedAmount: moneyFromCents(reservedAmount),
    unallocatedAmount: moneyFromCents(amountCents - reservedAmount),
    shares: Object.freeze(shares.filter((share) => parseMoneyToCents(share.amount) > 0n)),
  });
}

/** Computes the SHA-256 digest of the original file bytes for import deduplication. */
export async function sha256Hex(source) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") {
    throw new Error("Web Crypto não está disponível neste navegador.");
  }
  let bytes;
  if (typeof source === "string") {
    bytes = new TextEncoder().encode(source);
  } else if (source instanceof ArrayBuffer) {
    bytes = source;
  } else if (ArrayBuffer.isView(source)) {
    bytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  } else if (typeof Blob !== "undefined" && source instanceof Blob) {
    bytes = await source.arrayBuffer();
  } else {
    throw new TypeError("Informe o conteúdo original do arquivo ou seus bytes.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Creates a stable digest for canonical import rows for local comparison. */
export async function hashImportRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Informe as linhas a importar.");
  if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") {
    throw new Error("Web Crypto não está disponível neste navegador.");
  }
  const canonical = JSON.stringify(rows);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
