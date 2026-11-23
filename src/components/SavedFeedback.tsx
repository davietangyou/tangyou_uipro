import { useEffect, useState } from 'react';
import { CheckIcon } from './icons';
import { waitForStorageSync } from '../services/storage';

export function SavedFeedback({ message = '已儲存' }: { message?: string }) {
  const [status, setStatus] = useState<'waiting' | 'saved' | 'error'>('waiting');
  useEffect(() => {
    let active = true;
    void waitForStorageSync().then(() => { if(active) setStatus('saved'); }, () => { if(active) setStatus('error'); });
    return () => { active = false; };
  }, []);
  return <span role="status" className="saved-feedback" data-status={status}>
    {status === 'saved' && <CheckIcon width={18} height={18} aria-hidden="true" />}
    {status === 'waiting' ? '正在確認儲存…' : status === 'error' ? '已保留在此裝置，尚未同步' : message}
  </span>;
}
