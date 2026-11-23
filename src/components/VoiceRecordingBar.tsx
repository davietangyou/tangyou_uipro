import { useEffect, useState } from 'react';
import { ArrowUp, Check, Square, X } from 'lucide-react';
import type { VoiceStage } from '../services/voiceRecording';

export function VoiceRecordingBar({ stage, onCancel, onStop, onSubmit, target, fill = false, numeric = false }: {
  stage: VoiceStage;
  onCancel: () => void;
  onStop: () => void;
  onSubmit: () => void;
  target?: string;
  fill?: boolean;
  numeric?: boolean;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (stage !== 'listening') return;
    const started = Date.now();
    setSeconds(0);
    const interval = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [stage]);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const processing = stage === 'processing';
  const status = stage === 'starting' ? '正在開啟麥克風…' : processing ? '正在轉成文字…' : `正在錄音${target ? ` · ${target}` : ''}`;
  return <div className="voice-recording" data-stage={stage} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onCancel(); } }}>
    <p className="voice-recording-status" role="status">{status}</p>
    <div className="voice-recording-bar" onPointerDown={event => event.preventDefault()}>
      <button type="button" aria-label="取消語音輸入" onClick={onCancel}><X size={24} aria-hidden="true" /></button>
      <div className="voice-recording-meter" aria-hidden="true">
        <div className="voice-recording-level">{[5, 8, 15, 22, 12, 7, 17, 24, 13, 7, 5].map((height, index) => <i key={index} style={{ height, animationDelay: `${index * -.12}s` }} />)}</div>
        <span>{clock}</span>
      </div>
      <button type="button" aria-label="停止錄音並轉成文字" disabled={processing} onClick={onStop}><Square size={16} fill="currentColor" aria-hidden="true" /></button>
      <button type="button" className="voice-recording-submit" aria-label={fill ? '停止錄音並填入' : '停止錄音並發送'} disabled={processing} onClick={onSubmit}>
        {fill ? numeric ? <Check size={24} aria-hidden="true" /> : '填入' : <ArrowUp size={24} aria-hidden="true" />}
      </button>
    </div>
  </div>;
}
