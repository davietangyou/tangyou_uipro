import {useRef, useState} from 'react';
import {backend, BackendError, requestKey} from '../../services/backendClient';

type ExportJob = {id: string; status: string; expiresAt?: string | null};
type SavedExport = {job: ExportJob | null; requestKey: string | null};

function restore(key: string): SavedExport {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    return {job: saved?.job?.id ? saved.job : null, requestKey: typeof saved?.requestKey === 'string' ? saved.requestKey : null};
  } catch { return {job: null, requestKey: null}; }
}

export default function DataExport({userId, syncStatus}: {userId: string; syncStatus: string}) {
  const storageKey = `dia_cloud_${userId}_export`;
  const initial = useRef(restore(storageKey));
  const [job, setJob] = useState<ExportJob | null>(initial.current.job);
  const pendingKey = useRef(initial.current.requestKey);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const expired = job?.status === 'expired' || !!(job?.expiresAt && Date.parse(job.expiresAt) <= Date.now());
  const ready = job?.status === 'ready' && !expired;
  const waiting = job && !ready && !expired && job.status !== 'failed';

  function remember(next: ExportJob | null) {
    setJob(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify({job: next, requestKey: pendingKey.current})); }
    catch { /* Export remains usable even when browser storage is unavailable. */ }
  }
  async function run(task: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try { await task(); }
    catch (e) { setError((e as Error).message || '暫時未能匯出資料，請重試。'); }
    finally { running.current = false; setBusy(false); }
  }
  function requestExport() {
    void run(async () => {
      pendingKey.current ??= requestKey();
      remember(job);
      const result = await backend<ExportJob>('/data/exports', {method: 'POST', idempotencyKey: pendingKey.current});
      pendingKey.current = null; setDownloaded(false); remember(result);
    });
  }
  function checkExport() {
    if (!job) return;
    void run(async () => {
      try { remember(await backend<ExportJob>(`/data/exports/${job.id}`)); }
      catch (e) {
        if (e instanceof BackendError && e.status === 404) { remember({...job, status: 'expired'}); return; }
        throw e;
      }
    });
  }
  function downloadExport() {
    if (!job) return;
    void run(async () => {
      let data: unknown;
      try { data = await backend<unknown>(`/data/exports/${job.id}/download`); }
      catch (e) {
        if (e instanceof BackendError && e.status === 404) { remember({...job, status: 'expired'}); return; }
        throw e;
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url; link.download = `DiaGuide-資料匯出-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloaded(true);
    });
  }
  return <div className="cloud-export" aria-labelledby="cloud-export-title">
    <h3 id="cloud-export-title">匯出我的資料</h3>
    <p>下載已同步的健康紀錄及帳戶資料。</p>
    {syncStatus !== 'synced' && <p role="status">請待資料同步完成，再準備新的匯出檔案。</p>}
    {(!job || expired || job.status === 'failed') && <button disabled={busy || syncStatus !== 'synced'} onClick={requestExport}>
      {busy ? '正在準備…' : job ? '重新準備匯出檔案' : error ? '重試匯出資料' : '匯出資料'}
    </button>}
    {waiting && <><p role="status">正在準備檔案，稍後按「查看進度」。</p><button disabled={busy} onClick={checkExport}>{busy ? '正在查詢…' : '查看進度'}</button></>}
    {ready && <><p role="status">檔案已準備好，請在有效期內下載。</p>
      {job.expiresAt && <p>下載有效期至 {new Date(job.expiresAt).toLocaleString('zh-HK', {timeZone: 'Asia/Hong_Kong'})}（香港時間）。</p>}
      <button disabled={busy} onClick={downloadExport}>{busy ? '正在下載…' : '下載資料檔案'}</button>
      <button className="secondary" disabled={busy || syncStatus !== 'synced'} onClick={requestExport}>重新準備最新資料</button>
      {downloaded && <p role="status">已開始下載，請查看瀏覽器下載項目。</p>}
    </>}
    {expired && <p role="status">原有檔案已過期，請重新準備。</p>}
    {job?.status === 'failed' && <p role="status">這次未能準備檔案，請重試。</p>}
    {error && <p role="alert" className="cloud-error">{error}</p>}
  </div>;
}
