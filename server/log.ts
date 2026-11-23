import { AsyncLocalStorage } from 'node:async_hooks';

type Level = 'debug' | 'info' | 'warn' | 'error';
const rank: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const configured = (process.env.AI_LOG_LEVEL ?? 'info').toLowerCase();
const min = configured === 'silent' ? 100 : (rank[configured as Level] ?? 20);
const rawEnabled = process.env.AI_LOG_RAW === '1';

export const requestContext = new AsyncLocalStorage<{ rid: string }>();

type Fields = Record<string, unknown> & { rid?: string };

export function log(level: Level, event: string, fields: Fields = {}) {
  if (rank[level] < min) return;
  try {
    const { rid: explicitRid, ...rest } = fields;
    const rid = explicitRid ?? requestContext.getStore()?.rid;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      rid,
      ...rest,
    });
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
  } catch {
    /* Logging must never affect the request. */
  }
}

/** Model output only: records length by default; AI_LOG_RAW=1 adds a truncated sample. */
export function logModelText(event: string, text: unknown, fields: Fields = {}) {
  const value = typeof text === 'string' ? text : '';
  log('debug', event, {
    ...fields,
    modelTextLen: typeof text === 'string' ? text.length : -1,
    ...(rawEnabled && value ? { modelTextSample: value.slice(0, 2000) } : {}),
  });
}