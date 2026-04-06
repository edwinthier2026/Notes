const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;

const rateBySource = new Map();
const idempotencyStore = new Map();

function nowMs() {
  return Date.now();
}

function trimOldEntries(currentNow) {
  for (const [sourceKey, timestamps] of rateBySource.entries()) {
    const kept = timestamps.filter((ts) => currentNow - ts <= RATE_LIMIT_WINDOW_MS);
    if (kept.length === 0) {
      rateBySource.delete(sourceKey);
    } else {
      rateBySource.set(sourceKey, kept);
    }
  }

  for (const [idemKey, entry] of idempotencyStore.entries()) {
    if (currentNow - entry.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(idemKey);
    }
  }
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function beginMailSendGuard({ sourceKey, idempotencyKey }) {
  const currentNow = nowMs();
  trimOldEntries(currentNow);

  const idem = String(idempotencyKey || '').trim();
  if (!idem) {
    throw createHttpError('Idempotency key ontbreekt.', 400);
  }

  const existing = idempotencyStore.get(idem);
  if (existing?.status === 'done') {
    return { replay: true, result: existing.result };
  }
  if (existing?.status === 'pending') {
    throw createHttpError('Deze verzending is al in behandeling.', 409);
  }

  const source = String(sourceKey || 'unknown').trim();
  const timestamps = rateBySource.get(source) || [];
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw createHttpError('Te veel verzendverzoeken. Probeer het later opnieuw.', 429);
  }
  rateBySource.set(source, [...timestamps, currentNow]);

  idempotencyStore.set(idem, {
    status: 'pending',
    createdAt: currentNow,
    result: null,
  });

  return { replay: false };
}

export function completeMailSendGuard({ idempotencyKey, result }) {
  const idem = String(idempotencyKey || '').trim();
  if (!idem) {
    return;
  }
  idempotencyStore.set(idem, {
    status: 'done',
    createdAt: nowMs(),
    result,
  });
}

export function failMailSendGuard({ idempotencyKey }) {
  const idem = String(idempotencyKey || '').trim();
  if (!idem) {
    return;
  }
  const existing = idempotencyStore.get(idem);
  if (existing?.status === 'pending') {
    idempotencyStore.delete(idem);
  }
}
