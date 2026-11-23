import { useEffect, useId, useRef, useState } from 'react';
import { Bookmark, ChevronDown, ChevronRight, Mic, X } from 'lucide-react';
import { DeviceModal } from './DeviceModal';
import { useVoiceRecording } from '../hooks/useVoiceRecording';
import { VoiceRecordingBar } from './VoiceRecordingBar';
import { questionComparisonKey } from '../../shared/locale';

const COMMON_QUESTIONS = [
  '服藥時間可以配合我的生活作息調整嗎？',
  '服藥後有腸胃不適，應怎樣處理？',
  '下次覆診需要驗糖化血紅素或腎功能嗎？',
  '血糖波動較大，是否適合使用連續血糖監測儀（CGM）？',
];

export function DoctorQuestionNote({ open, savedQuestions, onClose, onViewAll, onSave, onSaved }: {
  open: boolean;
  savedQuestions: string[];
  onClose: () => void;
  onViewAll: () => void;
  onSave: (question: string) => Promise<void>;
  onSaved: () => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const voiceRevision = useRef(0);
  const revision = useRef(0);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const savedCount = new Set(savedQuestions.map(questionComparisonKey)).size;
  const duplicate = !!text.trim() && savedQuestions.some(question => questionComparisonKey(question) === questionComparisonKey(text));

  const voice = useVoiceRecording({
    onText: transcript => {
      if (revision.current !== voiceRevision.current) { setVoiceMessage('內容已更改，請再點麥克風說話。'); return; }
      const combined = text.trim() ? `${text.trim()}\n${transcript}` : transcript;
      if (combined.length > 1000) { setVoiceMessage('內容超過 1,000 字，請縮短後再試。'); return; }
      revision.current++; setText(combined);
    },
    onError: setVoiceMessage,
  });
  const stage = voice.stage;
  const cancelVoice = voice.cancel;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    cancelVoice();
    if (open) { setText(''); setError(null); setVoiceMessage(null); revision.current++; }
  }, [open, cancelVoice]);
  const changeText = (next: string) => {
    revision.current++;
    setText(next); setError(null); setVoiceMessage(null);
  };
  const close = () => {
    if (submitting.current) return;
    cancelVoice(); onClose();
  };
  const revealInput = () => {
    area.current?.focus({preventScroll:true});
  };
  const recordVoice = () => {
    if (voice.busy || submitting.current) return;
    voiceRevision.current = revision.current;
    setVoiceMessage(null); setError(null); area.current?.blur(); voice.start();
  };
  const save = async () => {
    if (submitting.current || stage !== 'idle') return;
    const question = text.trim();
    if (!question) { setError('請輸入想問醫生的問題。'); revealInput(); return; }
    if (question.length > 1000) { setError('問題最多可輸入 1,000 字。'); revealInput(); return; }
    if (duplicate) { setError('這個問題已在備忘中，可按「查看全部問題」查看。'); return; }
    submitting.current = true; setSaving(true); setError(null);
    try {
      await onSave(question);
      if (mounted.current) onSaved();
    } catch {
      if (mounted.current) setError('未能保存，內容已保留，請再試一次。');
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return <DeviceModal open={open} label={`${id}-title`} onClose={close} className="chat-scope question-note-modal">
    <form className="question-note-form" noValidate onSubmit={event => {event.preventDefault(); void save();}}>
      <header className="question-note-header">
        <h2 id={`${id}-title`}>隨手記覆診問題</h2>
        <button type="button" aria-label="關閉覆診問題備忘" disabled={saving} onClick={close}><X size={24} aria-hidden="true"/></button>
      </header>
      <p className="t-support text-ink-soft">想到想問醫生的問題，先記下來。</p>
      <div className="question-note-input">
        <label htmlFor={`${id}-content`}>問題內容</label>
        <textarea ref={area} id={`${id}-content`} rows={4} maxLength={1000} placeholder="輸入想問醫生的問題" value={text} disabled={saving}
          aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : duplicate ? `${id}-duplicate` : undefined}
          onChange={event => changeText(event.target.value)}/>
        <button className="question-note-voice" type="button" onClick={recordVoice} hidden={voice.busy} disabled={saving} aria-pressed={stage === 'starting' || stage === 'listening'}>
          <Mic size={22} aria-hidden="true"/>語音輸入
        </button>
      </div>
      {voice.busy && <VoiceRecordingBar stage={stage} fill target="問題內容" onCancel={cancelVoice} onStop={() => voice.stop()} onSubmit={() => voice.stop(true)} />}
      {voiceMessage && <p className="t-support" role="status">{voiceMessage}</p>}
      {duplicate && !error && <p id={`${id}-duplicate`} className="t-support text-ink-soft">這個問題已在備忘中。</p>}
      {error && <p id={`${id}-error`} className="question-note-error" role="alert">{error}</p>}
      <div className="question-note-suggestions">
        <button type="button" className="question-note-disclosure" disabled={saving || stage !== 'idle'} aria-expanded={suggestionsOpen} aria-controls={`${id}-suggestions`} onClick={() => setSuggestionsOpen(previous => !previous)}>
          常見問題<ChevronDown size={20} aria-hidden="true"/>
        </button>
        <div id={`${id}-suggestions`} hidden={!suggestionsOpen} className="question-note-examples">
          {COMMON_QUESTIONS.map(question => <button key={question} type="button" disabled={saving || stage !== 'idle'} onClick={() => {changeText(question); setSuggestionsOpen(false);}}>{question}</button>)}
        </div>
      </div>
      <button type="submit" className="question-note-save" disabled={saving || stage !== 'idle'}><Bookmark size={22} aria-hidden="true"/>{saving ? '正在保存…' : '保存到備忘'}</button>
      <button className="question-note-view-all" type="button" disabled={saving} onClick={() => {cancelVoice(); onViewAll();}}>查看全部問題（{savedCount}）<ChevronRight size={20} aria-hidden="true"/></button>
    </form>
  </DeviceModal>;
}
