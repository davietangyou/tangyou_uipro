import { preparePhoto } from './photoRecognition';
import { parseChatResult, parseOrganizeResult, type OrganizeRequest, type ChatRequest, type ChatResult, type OrganizeResult } from '../../shared/ai';
import { apiPath } from './apiPath';
import {backend} from './backendClient';
import {storageKey} from './storage';
import {newRecordId} from '../data/id';
import { checkSafetyGate } from './safetyGate';
export type { OrganizeResult } from '../../shared/ai';
async function post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  const started = performance.now();
  let response: Response;
  try {
    response = await fetch(apiPath(path), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(630_000)]) : AbortSignal.timeout(630_000) });
  } catch (e) {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.ai.error',
      path,
      aborted: !!signal?.aborted,
      name: (e as Error)?.name,
      message: (e as Error)?.message,
      durationMs: Math.round(performance.now() - started),
    }));
    if (signal?.aborted) throw e;
    if ((e as Error).name === 'TimeoutError') throw new Error('AI 回應逾時，請再試一次。');
    throw new Error('暫時未能連接 AI 服務，請稍後再試。');
  }
  const requestId = response.headers.get('X-Request-ID') ?? undefined;
  let result: any;
  try { result = await response.json(); } catch {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.ai.request',
      path,
      status: response.status,
      code: 'INVALID_JSON',
      requestId,
      durationMs: Math.round(performance.now() - started),
    }));
    const error = new Error('AI 服務未能回應，請稍後再試。') as Error & { requestId?: string };
    error.requestId = requestId;
    throw error;
  }
  if (import.meta.env?.DEV) console.info(JSON.stringify({
    event: 'client.ai.request',
    path,
    status: response.status,
    code: result?.error?.code,
    requestId,
    durationMs: Math.round(performance.now() - started),
  }));
  if (!response.ok) {
    const error = new Error(result?.error?.message || 'AI 服務暫時未能使用，請稍後再試。') as Error & { requestId?: string };
    error.requestId = requestId;
    throw error;
  }
  return result;
}
export async function chat(request: ChatRequest, signal: AbortSignal, photo?: Blob, localConversationId?: string, localMessageId?: string): Promise<ChatResult> {
  // Deterministic safety gate — executes before any AI call
  const safetyResult = checkSafetyGate(request.message, request.health);
  if (safetyResult) {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.safety.hit',
      template: safetyResult.reply.slice(0, 12),
      messageLen: request.message.length,
    }));
    return safetyResult;
  }

  let image: Awaited<ReturnType<typeof preparePhoto>> | undefined;
  if (photo) {
    try {
      image = await preparePhoto(photo, signal);
    } catch (error) {
      if (import.meta.env?.DEV) console.info(JSON.stringify({
        event: 'client.ai.prepare_failed',
        aborted: !!signal.aborted,
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        photoBytes: photo.size,
        photoType: photo.type,
      }));
      throw error;
    }
  }
  if (signal.aborted) {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.ai.error',
      path: 'prepare',
      aborted: true,
    }));
    throw new DOMException('Cancelled','AbortError');
  }
  if(import.meta.env?.VITE_CLOUD_MODE === 'true') {
    const key=storageKey('ai_conversation_map');
    const map=JSON.parse(localStorage.getItem(key)||'{}') as Record<string,string>;
    const localId=localConversationId||'default';
    if(!map[localId]){
      const created=await backend<{id:string}>('/ai/conversations',{method:'POST',idempotencyKey:`conv-${localId}`,signal});
      map[localId]=created.id;localStorage.setItem(key,JSON.stringify(map));
    }
    const cloudSignal=AbortSignal.any([signal,AbortSignal.timeout(630_000)]);
    const result=await backend<ChatResult>(`/ai/conversations/${map[localId]}/messages`,{method:'POST',body:{message:request.message,...(image?{image}:{})},idempotencyKey:`chat-${localMessageId||newRecordId()}`,signal:cloudSignal});
    try{return parseChatResult(result);}catch(error){
      if (import.meta.env?.DEV) console.info(JSON.stringify({
        event: 'client.ai.parse_failed',
        mode: 'cloud',
        keys: result && typeof result === 'object' ? Object.keys(result as object).slice(0, 20) : typeof result,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw new Error('AI 回應格式不完整，請再試一次。');
    }
  }
  const result = await post(image ? '/api/ai/chat/photo' : '/api/ai/chat', image ? {...request,image} : request, signal);
  try { return parseChatResult(result); } catch (error) {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.ai.parse_failed',
      mode: 'local',
      keys: result && typeof result === 'object' ? Object.keys(result as object).slice(0, 20) : typeof result,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw new Error('AI 回應格式不完整，請再試一次。');
  }
}
export async function organize(request: OrganizeRequest, signal: AbortSignal): Promise<OrganizeResult> {
  if(import.meta.env?.VITE_CLOUD_MODE === 'true') {
    const result=await backend<OrganizeResult>('/ai/questions/organize',{method:'POST',body:request,signal});
    try{return parseOrganizeResult(result,request.questions.length);}catch(error){
      if (import.meta.env?.DEV) console.info(JSON.stringify({
        event: 'client.ai.parse_failed',
        mode: 'cloud-organize',
        keys: result && typeof result === 'object' ? Object.keys(result as object).slice(0, 20) : typeof result,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw new Error('AI 整理結果不完整，請再試一次。');
    }
  }
  const result = await post('/api/ai/questions/organize', request, signal);
  try { return parseOrganizeResult(result, request.questions.length); } catch (error) {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.ai.parse_failed',
      mode: 'local-organize',
      keys: result && typeof result === 'object' ? Object.keys(result as object).slice(0, 20) : typeof result,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw new Error('AI 整理結果不完整，請再試一次。');
  }
}