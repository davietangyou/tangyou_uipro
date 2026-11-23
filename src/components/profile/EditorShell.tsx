import {
  createContext,
  useLayoutEffect,
  useRef,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, useIsPresent, useReducedMotion } from 'motion/react';
import { motionEnter, motionExit } from '../DeviceModal';
import { lockAppInteraction } from '../appInteractionLock';
import { BackIcon } from "../icons";
import { ProfileVoiceSlot } from "./ProfileVoice";
import type {ProfileSubmitIntent} from "../../data/basicInfoDraft";
import { useAppViewport } from '../../hooks/useAppViewport';
import {inputViewportAttributes,inputViewportStyle} from '../inputViewportSurface';
export const SetupChrome = createContext<{
  step: number;
  error: string;
  go: (action: "next" | "back" | "exit", save: (intent:ProfileSubmitIntent) => void) => void;
} | null>(null);
export function EditorShell({
  title,
  onBack,
  onSave,
  saveLabel = "儲存",
  children,
}: {
  title: string;
  onBack: () => void;
  onSave: (intent:ProfileSubmitIntent) => void;
  saveLabel?: string;
  children: ReactNode;
}) {
  const setup = useContext(SetupChrome);
  const present = useIsPresent();
  const viewport = useAppViewport();
  const compact = !!viewport?.inputCompact;
  const reduced = useReducedMotion();
  const [saveError, setSaveError] = useState('');
  const perform = (action: 'next' | 'back' | 'exit' | 'save') => {
    setSaveError('');
    try {
      if(setup && action !== 'save') setup.go(action,onSave);
      else if(action === 'back') onBack();
      else onSave('save');
    } catch { setSaveError('未能儲存資料，輸入內容已保留，請再試一次。'); }
  };
  const heading=useRef<HTMLHeadingElement>(null);
  const scroll=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockAppInteraction();
    scroll.current?.scrollTo({top:0});heading.current?.focus({preventScroll:true});
    return () => {
      unlock();
      if (trigger?.isConnected && !trigger.closest('[hidden],[inert]')) trigger.focus({preventScroll:true});
    };
  },[]);
  const submissionError = saveError || setup?.error;
  const footer = <footer className="profile-save-bar" data-voice-avoid>
    {submissionError && <p className="profile-field-error" role="alert">{submissionError}</p>}
    <button type="button" onClick={() => perform(setup ? 'next' : 'save')} className="profile-save">
      {setup ? setup.step === 4 ? "完成，進入糖友導航" : "下一步" : saveLabel}
    </button>
    {setup && <button type="button" className="profile-setup-later" onClick={() => perform('exit')}>稍後填寫</button>}
  </footer>;
  return createPortal(
    <motion.div
      {...inputViewportAttributes(viewport)} className="input-viewport-surface profile-scope profile-editor"
      data-compact-viewport={compact || undefined}
      style={inputViewportStyle(viewport,true)}
      inert={!present}
      initial={{opacity:0,x:reduced?0:16}}
      animate={{opacity:1,x:0,transition:{duration:reduced?0:.24,ease:motionEnter}}}
      exit={{opacity:0,x:reduced?0:16,transition:{duration:reduced?0:.2,ease:motionExit}}}
    >
      <header className="profile-editor-header">
        {setup && (
          <div className="profile-setup-progress">
            <div className="profile-progress-title">
              <span className="profile-help">初次見面，認識一下您</span>
              <span className="profile-help tnum">{setup.step + 1} / 5</span>
            </div>
            <div
              className="profile-progress-track"
              role="progressbar"
              aria-label="首次資料設定進度"
              aria-valuenow={setup.step + 1}
              aria-valuemin={1}
              aria-valuemax={5}
            >
              <div style={{ width: `${(setup.step + 1) * 20}%` }} />
            </div>
          </div>
        )}
        <div className="profile-header-row">
          <button
            type="button"
            disabled={!!setup && setup.step === 0}
            onClick={() => perform('back')}
            aria-label={setup ? "返回上一步" : "返回"}
            className="profile-back"
          >
            <BackIcon width={24} height={24} />
          </button>
          <h1 ref={heading} tabIndex={-1} className="profile-editor-title">{title}{setup && compact && <span className="profile-compact-step">{setup.step + 1} / 5</span>}</h1>
          <ProfileVoiceSlot
            id={setup ? `setup:${setup.step}` : `profile:${title}`}
          />
        </div>
      </header>
      <div ref={scroll} className="profile-editor-scroll">
        <div className="profile-editor-content">{children}</div>
        {footer}
      </div>
    </motion.div>,
    document.getElementById("device-overlay-layer") || document.body,
  );
}
