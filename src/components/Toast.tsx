import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "./icons";
import { X } from 'lucide-react';
import { waitForStorageSync } from '../services/storage';

// 就近成功反饋（spec：4.5 秒成功訊息）。可被輔助科技感知，不閃動。
export function Toast({
  message,
  onDone,
  duration = 4500,
  kind = 'success',
}: {
  message: string;
  onDone: () => void;
  duration?: number;
  kind?: 'success' | 'error';
}) {
  const [state, setState] = useState<'waiting' | 'success' | 'error'>(kind === 'error' ? 'error' : 'waiting');
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    setLeaving(false);
    if (kind === 'error') { setState('error'); return; }
    let active = true;
    setState('waiting');
    void waitForStorageSync().then(() => { if(active) setState('success'); }, () => { if(active) setState('error'); });
    return () => { active = false; };
  }, [message, kind]);
  useEffect(() => {
    if (!duration || state !== 'success') return;
    let finish: ReturnType<typeof setTimeout>;
    const t = setTimeout(() => {
      setLeaving(true);
      finish = setTimeout(() => done.current(), 200);
    }, duration);
    return () => { clearTimeout(t); clearTimeout(finish); };
  }, [message, duration, state]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-50 flex justify-center px-4"
    >
      <div data-leaving={leaving} className={`toast-feedback flex max-w-full items-center gap-2.5 rounded-[16px] border px-4 py-2 shadow-[0_8px_24px_rgba(46,70,120,0.12)] ${state === 'success' ? 'border-positive/25 bg-positive-surface text-positive' : 'border-border bg-surface text-ink'}`}>
        {state === 'success' && <CheckIcon width={22} height={22} className="shrink-0" />}
        <span className="t-body font-semibold">{kind === 'error' ? message : state === 'waiting' ? '正在確認儲存…' : state === 'error' ? '修改已保留在此裝置，未能同步。請到「我的」重試。' : message}</span>
        <button type="button" className="toast-dismiss" aria-label="關閉提示" onClick={onDone}><X size={20} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
