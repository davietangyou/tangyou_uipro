import {newRecordId} from '../data/id';

export type ApiError = { error: { code: string; message: string; requestId?: string } };
export class BackendError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) { super(message); }
}
export const isSessionFailure = (error: unknown) => error instanceof BackendError && (error.status === 401 || error.code === 'SESSION_CHANGED');
let activeUser: string | undefined;
export function setBackendUser(user?: string) { activeUser = user; }
export async function backend<T>(path: string, options: {method?: string; body?: unknown; reason?: string; version?: number; idempotencyKey?: string; signal?: AbortSignal; expectedUserId?: string} = {}): Promise<T> {
  const started = performance.now();
  const headers: Record<string,string> = { 'Accept': 'application/json', 'X-Session-Scope': typeof location !== 'undefined' && location.pathname.endsWith('/admin.html') ? 'admin' : 'app' };
  const expectedUserId = options.expectedUserId ?? (path.startsWith('/auth/') ? undefined : activeUser);
  if (expectedUserId) headers['X-Expected-User-Id'] = expectedUserId;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.reason) headers['X-Audit-Reason'] = encodeURIComponent(options.reason);
  if (options.version !== undefined) headers['If-Match'] = String(options.version);
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {method: options.method ?? 'GET', headers, credentials: 'same-origin', signal:options.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)});
  } catch (error) {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.api.error',
      method: options.method ?? 'GET',
      path,
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(performance.now() - started),
    }));
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new BackendError(0, 'NETWORK_ERROR', '暫時未能連接伺服器，請稍後再試。');
  }
  if (import.meta.env?.DEV) console.info(JSON.stringify({
    event: 'client.api.request',
    method: options.method ?? 'GET',
    path,
    status: response.status,
    requestId: response.headers.get('X-Request-ID') ?? undefined,
    durationMs: Math.round(performance.now() - started),
  }));
  if (!response.ok) {
    options.signal?.throwIfAborted();
    const payload = await response.json().catch(() => null) as ApiError | null;
    options.signal?.throwIfAborted();
    const error = new BackendError(response.status, payload?.error?.code ?? 'HTTP_ERROR', payload?.error?.message ?? '服務暫時未能處理。', payload?.error?.requestId || response.headers.get('X-Request-ID') || undefined);
    if (isSessionFailure(error) && expectedUserId && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('diaguide-session-invalid', {detail: {userId: expectedUserId}}));
    throw error;
  }
  const ensureCurrent = () => {
    options.signal?.throwIfAborted();
    if (!options.expectedUserId && expectedUserId && expectedUserId !== activeUser) throw new DOMException('Session stopped', 'AbortError');
  };
  ensureCurrent();
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  ensureCurrent();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
// randomUUID is unavailable in some browsers on plain HTTP. getRandomValues is
// still available there and newRecordId provides the same UUID v4 semantics.
export const requestKey = () => newRecordId();