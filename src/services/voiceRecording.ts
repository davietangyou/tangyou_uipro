import { startDictation, type DictationCallbacks, type DictationSession } from './dictation';

export type VoiceStage = 'idle' | 'starting' | 'listening' | 'processing';

/** Own one recording through permission, transcription and cancellation. */
export function createVoiceRecording(callbacks: {
  onStage: (stage: VoiceStage) => void;
  onText: (text: string, submit: boolean) => void;
  onError: (message: string) => void;
}, start: (callbacks: DictationCallbacks) => DictationSession = startDictation) {
  let current: { session?: DictationSession; stopped: boolean; submit: boolean; text: string; failed: boolean } | null = null;
  return {
    start() {
      if (current) return;
      const recording = { session: undefined as DictationSession | undefined, stopped: false, submit: false, text: '', failed: false };
      current = recording;
      callbacks.onStage('starting');
      const valid = () => current === recording;
      const session = start({
        onListening: () => { if (valid() && !recording.stopped) callbacks.onStage('listening'); },
        onProcessing: () => { if (valid()) callbacks.onStage('processing'); },
        onText: text => { if (valid()) recording.text = text; },
        onError: message => { if (valid()) { recording.failed = true; callbacks.onError(message); } },
        onEnd: () => {
          if (!valid()) return;
          current = null;
          callbacks.onStage('idle');
          if (!recording.failed && recording.text.trim()) callbacks.onText(recording.text.trim(), recording.submit);
        },
      });
      if (valid()) {
        recording.session = session;
        if (recording.stopped) session.stop();
      } else session.cancel();
    },
    stop(submit = false) {
      if (!current || current.stopped) return;
      current.stopped = true;
      current.submit = submit;
      callbacks.onStage('processing');
      current.session?.stop();
    },
    cancel() {
      const recording = current;
      current = null;
      recording?.session?.cancel();
      if (recording) callbacks.onStage('idle');
    },
  };
}
