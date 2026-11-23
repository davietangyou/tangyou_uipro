import {backend, BackendError} from './backendClient';
type Session = {userId:string;role:string;expiresAt?:string};
// Called only by the explicit start button. A lost response is checked, never
// retried automatically: the user must decide whether to create another file.
export async function startPrototype():Promise<Session> {
  let result:Session;
  try {
    result=await backend<Session>('/auth/guest',{method:'POST',body:{},signal:AbortSignal.timeout(15000)});
  } catch(error) {
    if (!(error instanceof BackendError && error.status===0) && !(error instanceof DOMException && ['TimeoutError','AbortError'].includes(error.name))) throw error;
    try { result=await backend<Session>('/auth/me',{signal:AbortSignal.timeout(10000)}); }
    catch { throw new Error('未能確認是否已開始，請檢查連線後再試。'); }
  }
  if(result.role!=='USER')throw new Error('此帳戶暫時未能使用。');
  return result;
}
