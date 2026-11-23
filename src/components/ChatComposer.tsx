import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUp, Keyboard, Mic, X } from 'lucide-react';
import { PhotoRecognitionPicker } from './PhotoRecognitionPicker';
import { VoiceRecordingBar } from './VoiceRecordingBar';
import { useVoiceRecording } from '../hooks/useVoiceRecording';

export function ChatComposer({ value, onChange, onSend, loading, conversationId, blocked, onBusyChange, photo, onPhotoChange }: {
  value: string; photo: Blob | null;
  onPhotoChange: (photo: Blob | null) => void;
  onChange: (value: string) => void;
  onSend: (text?: string) => void;
  loading: boolean; conversationId: string; blocked: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [photoPreview, setPhotoPreview] = useState('');
  const [editing, setEditing] = useState(false), [pressed, setPressed] = useState(false), [message, setMessage] = useState('');
  const root = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef<{ x: number; y: number; recording: boolean; moved: boolean } | null>(null);
  const latest = useRef({ value, conversationId, onChange, onSend });
  const revision = useRef(0);
  if (latest.current.value !== value) revision.current++;
  latest.current = { value, conversationId, onChange, onSend };
  const snapshot = useRef({ value, conversationId, revision: 0 });
  const voice = useVoiceRecording({
    onBusyChange, onError: setMessage,
    onText: (text, submit) => {
      const before = snapshot.current;
      if (latest.current.conversationId !== before.conversationId) return;
      if (revision.current !== before.revision || latest.current.value !== before.value) {
        setMessage('問題已修改，請再點麥克風說話。'); return;
      }
      const combined = before.value + (before.value && !/\s$/.test(before.value) ? ' ' : '') + text;
      latest.current.onChange(combined);
      if (submit) latest.current.onSend(combined);
    },
  });
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const cancel = () => { clearTimer(); press.current = null; setPressed(false); voice.cancel(); };
  useEffect(() => {
    if (!photo) { setPhotoPreview(''); return; }
    const url = URL.createObjectURL(photo); setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    cancel(); setEditing(false); textarea.current?.blur(); setMessage('');
  }, [conversationId, blocked]);
  useEffect(() => () => clearTimer(), []);
  useLayoutEffect(() => {
    const node = textarea.current;
    if (!node || voice.busy) return;
    const composer = root.current, page = composer?.closest<HTMLElement>('.chat-page');
    let naturalHeight = 0, measuredWidth = -1, frame = 0;
    const resize = () => {
      frame = 0;
      if (node.clientWidth !== measuredWidth || !naturalHeight) {
        measuredWidth = node.clientWidth; node.style.height = 'auto'; naturalHeight = node.scrollHeight;
      }
      const extra = composer ? composer.scrollHeight - node.offsetHeight : 0;
      const available = page ? Math.max(48, page.clientHeight * .6 - extra) : 160;
      const next = Math.max(52, Math.min(naturalHeight, 160, available));
      if (node.style.height !== `${next}px`) node.style.height = `${next}px`;
    };
    resize();
    const observer = new ResizeObserver(() => { if (!frame) frame = requestAnimationFrame(resize); });
    if (page) observer.observe(page);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [value, photoPreview, message, voice.busy]);
  const leaveEditing = () => { setEditing(false); textarea.current?.blur(); };
  const enterEditing = () => {
    if (loading || voice.busy || blocked) return;
    setMessage(''); flushSync(() => setEditing(true)); textarea.current?.focus({ preventScroll: true });
  };
  const begin = () => {
    if (loading || voice.busy || blocked) return;
    snapshot.current = { value: latest.current.value, conversationId: latest.current.conversationId, revision: revision.current };
    if (press.current) press.current.recording = true;
    leaveEditing(); setMessage(''); voice.start();
  };
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || loading || voice.busy || blocked) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    setPressed(true); press.current = { x: event.clientX, y: event.clientY, recording: false, moved: false };
    timer.current = setTimeout(begin, 380);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (p && !p.recording && Math.hypot(event.clientX - p.x, event.clientY - p.y) > 8) {
      p.moved = true; clearTimer(); setPressed(false);
    }
  };
  const release = (aborted = false) => {
    clearTimer(); const p = press.current; press.current = null; setPressed(false);
    if (p && !p.recording && !p.moved && !aborted) enterEditing();
  };
  return <div ref={root} className="chat-composer" onKeyDown={event => { if (event.key === 'Escape' && voice.busy) { event.preventDefault(); cancel(); } }}>
    <div className="chat-composer-inner">
      {!voice.busy && message && <div className="chat-voice-status" role="status">{message}</div>}
      {photoPreview && <div className="chat-photo-attachment">
        <img src={photoPreview} alt="準備發送的照片" />
        <span>已附上照片<br /><small>按發送後交給 AI；原圖不保存</small></span>
        <button type="button" aria-label="移除照片" disabled={loading || voice.busy} onClick={() => onPhotoChange(null)}><X aria-hidden="true" /></button>
      </div>}
      {voice.busy && <VoiceRecordingBar stage={voice.stage} onCancel={cancel} onStop={() => voice.stop()} onSubmit={() => voice.stop(true)} />}
      <div className="chat-entry" hidden={voice.busy} data-pressed={pressed} data-editing={editing} data-has-value={!!value.trim()}>
        <PhotoRecognitionPicker key={conversationId} label="拍照或上傳圖片給 AI" title="附上照片" className="chat-upload" disabled={loading || voice.busy || blocked} onPhotoConfirm={onPhotoChange} />
        <div className="chat-input-control">
          <textarea ref={textarea} aria-label="輸入問題" value={value} rows={1} placeholder="輸入問題…"
            disabled={voice.busy || blocked} readOnly={!editing} aria-hidden={!editing} tabIndex={editing ? 0 : -1}
            onFocus={() => setEditing(true)} onBlur={() => setEditing(false)} onChange={event => onChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') { event.preventDefault(); leaveEditing(); }
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); onSend(); }
            }} />
          <button type="button" className="chat-hold-input" hidden={editing} disabled={loading || blocked}
            aria-label="輸入問題：輕點打字，長按說話" onPointerDown={down} onPointerMove={move} onPointerUp={() => release()}
            onPointerCancel={() => release(true)} onLostPointerCapture={() => release(true)} onContextMenu={event => event.preventDefault()}
            onClick={event => { if (event.detail === 0) enterEditing(); }}><span>{value || '輸入問題…'}</span></button>
        </div>
        <div className="chat-entry-tools">
          <button type="button" className="chat-keyboard-toggle sr-only focus:not-sr-only" aria-label={editing ? '收起鍵盤' : '鍵盤輸入'}
            disabled={voice.busy || blocked || (!editing && loading)} onPointerDown={event => { if (editing) event.preventDefault(); }} onClick={() => editing ? leaveEditing() : enterEditing()}><Keyboard size={24} aria-hidden="true" /></button>
          <button type="button" className="chat-accessible-voice" aria-label="開始語音輸入" disabled={loading || blocked}
            onPointerDown={event => event.preventDefault()} onClick={begin}><Mic size={24} aria-hidden="true" /></button>
          <button type="button" className="chat-send" hidden={!value.trim() && !photo} disabled={loading || blocked}
            aria-label="發送" onPointerDown={event => { if (editing) event.preventDefault(); }} onClick={() => onSend()}><ArrowUp size={24} aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  </div>;
}
