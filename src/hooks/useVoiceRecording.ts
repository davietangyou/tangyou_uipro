import { useEffect, useRef, useState } from 'react';
import { createVoiceRecording, type VoiceStage } from '../services/voiceRecording';

export function useVoiceRecording(callbacks: {
  onText: (text: string, submit: boolean) => void;
  onError: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [stage, setStage] = useState<VoiceStage>('idle');
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const recording = useRef<ReturnType<typeof createVoiceRecording> | null>(null);
  if (!recording.current) recording.current = createVoiceRecording({
    onStage: next => { setStage(next); latest.current.onBusyChange?.(next !== 'idle'); },
    onText: (text, submit) => latest.current.onText(text, submit),
    onError: message => latest.current.onError(message),
  });
  useEffect(() => () => recording.current?.cancel(), []);
  return { stage, busy: stage !== 'idle', ...recording.current };
}
