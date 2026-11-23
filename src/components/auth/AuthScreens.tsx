import {useEffect, useRef, useState} from 'react';
import {ChevronLeft, Eye, EyeOff, LockKeyhole, Mail, UserRound, X} from 'lucide-react';
import verificationArt from '../../assets/auth/verification-source.png';
import {newPasswordError, otpDigits, registrationNameError, replaceOtpDigits} from './authInput';
import './auth.css';
import {useAppViewport} from '../../hooks/useAppViewport';
import {inputViewportAttributes,inputViewportStyle} from '../inputViewportSurface';

export type AuthDraft = {
  purpose: 'register' | 'password_reset';
  name: string;
  password: string;
};

type AuthScreensProps = {
  deliveryMode?: string;
  phase: 'contact' | 'code';
  contact: string;
  destination: string;
  code: string;
  error: string;
  busy: boolean;
  resendAvailableAt: number;
  onContactChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onLogin: (password: string) => Promise<void>;
  onSend: (draft: AuthDraft) => Promise<void>;
  onVerify: () => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  onClearError: () => void;
};

type Mode = 'login' | 'register' | 'reset';

function OtpInput({value, onChange, disabled, invalid}: {
  value: string; onChange: (value: string) => void; disabled: boolean; invalid: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  function focus(index: number) { refs.current[Math.max(0, Math.min(index, 5))]?.focus({preventScroll:true}); }
  function update(index: number, raw: string) {
    const digits = otpDigits(raw);
    if (!digits) {
      if (!raw) onChange(replaceOtpDigits(value, index, ''));
      return;
    }
    onChange(replaceOtpDigits(value, index, digits));
    focus(digits.length === 6 ? 5 : index + digits.length);
  }
  return <div className="auth-otp" role="group" aria-label="六位數驗證碼">
    {Array.from({length: 6}, (_, index) => <input key={index}
      ref={node => { refs.current[index] = node; }}
      aria-label={`第 ${index + 1} 位驗證碼`} aria-invalid={invalid || undefined}
      aria-describedby={invalid ? 'auth-error' : undefined}
      type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'}
      maxLength={6} value={value[index]?.trim() || ''} disabled={disabled}
      onFocus={event => event.target.select()}
      onChange={event => update(index, event.target.value)}
      onPaste={event => { event.preventDefault(); update(index, event.clipboardData.getData('text')); }}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); focus(index + (event.key === 'ArrowLeft' ? -1 : 1));
        }
        if (event.key === 'Backspace') {
          event.preventDefault();
          const position = value[index]?.trim() ? index : index - 1;
          if (position >= 0) { onChange(replaceOtpDigits(value, position, '')); focus(position); }
        }
      }}/>) }
  </div>;
}

function PasswordField({label, value, onChange, visible, onToggle, autoComplete, disabled}: {
  label: string; value: string; onChange: (value: string) => void; visible: boolean;
  onToggle: () => void; autoComplete: string; disabled: boolean;
}) {
  return <label className="auth-field auth-password-field">
    <LockKeyhole aria-hidden="true"/>
    <input aria-label={label} type={visible ? 'text' : 'password'} autoComplete={autoComplete}
      placeholder={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}/>
    <button className="auth-eye" type="button" aria-label={visible ? `隱藏${label}` : `顯示${label}`} disabled={disabled} onClick={onToggle}>
      {visible ? <Eye aria-hidden="true"/> : <EyeOff aria-hidden="true"/>}
    </button>
  </label>;
}

export default function AuthScreens(props: AuthScreensProps) {
  const viewport=useAppViewport();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [now, setNow] = useState(Date.now());
  const heading = useRef<HTMLHeadingElement>(null);
  const lastView = useRef(`${props.phase}-${mode}`);
  const countdown = Math.max(0, Math.ceil((props.resendAvailableAt - now) / 1000));
  useEffect(() => {
    if (props.phase !== 'code' || props.resendAvailableAt <= Date.now()) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [props.phase, props.resendAvailableAt]);
  useEffect(() => {
    const view = `${props.phase}-${mode}`;
    if (view !== lastView.current) { setNotice('');setFormError('');heading.current?.focus({preventScroll:true});lastView.current = view; }
  }, [props.phase, mode]);

  function switchMode(next: Mode) {
    if (props.busy) return;
    setMode(next);setNotice('');setFormError('');setPassword('');setConfirmation('');setPasswordVisible(false);props.onClearError();
  }
  function submit() {
    if (props.busy) return;
    setNotice('');setFormError('');props.onClearError();
    if (mode === 'login') {
      if (!password) { setFormError('請輸入密碼。');return; }
      void props.onLogin(password);return;
    }
    const passwordProblem=newPasswordError(password,confirmation);
    if (passwordProblem) { setFormError(passwordProblem);return; }
    if (mode === 'register') {
      const nameProblem=registrationNameError(name);
      if (nameProblem) { setFormError(nameProblem);return; }
    }
    void props.onSend({purpose:mode === 'register' ? 'register' : 'password_reset',name:name.trim(),password});
  }

  const error=props.error||formError;
  const errorMessage = error ? <p className="auth-error" role="alert" id="auth-error">{error}</p> : null;
  const isCode = props.phase === 'code';
  const title=mode==='register'?'註冊':mode==='reset'?'設定密碼':'登入';
  const subtitle=mode==='register'?'建立帳戶，開始你的健康管理':mode==='reset'?'驗證已綁定的電郵地址，設定新密碼':<>歡迎回來，請登入以繼續使用<br/>DiaGuide HK</>;
  return <div {...inputViewportAttributes(viewport)} className="input-viewport-surface auth-gate" style={inputViewportStyle(viewport,true)}>
    <main className={`auth-screen ${isCode ? 'auth-screen--code' : mode === 'register' ? 'auth-screen--register' : 'auth-screen--login'}`} aria-labelledby="auth-title">
      {isCode ? <>
        <button type="button" className="auth-back" aria-label="返回" disabled={props.busy} onClick={props.onBack}><ChevronLeft size={23}/></button>
        <div className="auth-verification-art" aria-hidden="true"><img src={verificationArt} alt=""/></div>
        <header className="auth-heading">
          <h1 id="auth-title" tabIndex={-1} ref={heading}>{mode==='register'?'驗證聯絡方式':'驗證身分'}</h1>
          <p>{props.deliveryMode==='local'?'本機測試模式：不會寄出電郵':'驗證請求已受理，請查看電郵'}<br/><span className="auth-destination">{props.destination}</span><br/>請輸入本次申請的驗證碼</p>
        </header>
        <form className="auth-code-form" onSubmit={event => { event.preventDefault();if (!props.busy && /^[0-9]{6}$/.test(props.code)) void props.onVerify(); }}>
          <OtpInput value={props.code} onChange={props.onCodeChange} disabled={props.busy} invalid={!!error}/>
          {errorMessage}
          <button className="auth-primary" disabled={props.busy || !/^[0-9]{6}$/.test(props.code)} type="submit">{props.busy ? '處理中…' : mode==='register'?'驗證並建立帳戶':'驗證並設定密碼'}</button>
        </form>
        <p className="auth-resend">未收到驗證碼？ <button type="button" className="auth-text-button" disabled={props.busy || countdown > 0} onClick={() => void props.onResend()}>{countdown > 0 ? `重新發送（${countdown}秒）` : '重新發送'}</button></p>
      </> : <>
        <header className="auth-heading">
          <div className="auth-logo-space" aria-hidden="true"/>
          <p className="auth-brand">DiaGuide HK</p>
          <h1 id="auth-title" tabIndex={-1} ref={heading}>{title}</h1>
          <p>{subtitle}</p>
        </header>
        <form className="auth-contact-form" onSubmit={event => { event.preventDefault();submit(); }} noValidate>
          <div className="auth-fields">
            {mode === 'register' && <label className="auth-field"><UserRound aria-hidden="true"/><input aria-label="姓名" autoComplete="name" placeholder="姓名" value={name} disabled={props.busy} onChange={event => {setName(event.target.value);setFormError('');}}/></label>}
            <label className="auth-field"><Mail aria-hidden="true"/><input aria-label="電郵地址" autoComplete="username" autoCapitalize="none" spellCheck={false} type="email" inputMode="email" placeholder="電郵地址" value={props.contact} disabled={props.busy} onChange={event => {props.onContactChange(event.target.value);setFormError('');}} aria-invalid={!!error || undefined} aria-describedby={error ? 'auth-error' : undefined}/></label>
            <PasswordField label={mode==='reset'?'新密碼':'密碼'} value={password} onChange={value=>{setPassword(value);setFormError('');}} visible={passwordVisible} onToggle={()=>setPasswordVisible(!passwordVisible)} autoComplete={mode==='login'?'current-password':'new-password'} disabled={props.busy}/>
            {mode !== 'login' && <PasswordField label={mode==='reset'?'確認新密碼':'確認密碼'} value={confirmation} onChange={value=>{setConfirmation(value);setFormError('');}} visible={passwordVisible} onToggle={()=>setPasswordVisible(!passwordVisible)} autoComplete="new-password" disabled={props.busy}/>}
          </div>
          {mode!=='login'&&<p className="auth-resend">請使用電郵地址接收驗證碼。</p>}
          {props.deliveryMode==='local'&&<p className="auth-resend">本機測試環境 · 不會寄出真實電郵</p>}
          {errorMessage}
          {mode === 'login' && <div className="auth-forgot"><button className="auth-text-button" type="button" onClick={() => switchMode('reset')}>首次設定／忘記密碼？</button></div>}
          {mode === 'reset' && <div className="auth-forgot"><button className="auth-text-button" type="button" onClick={() => switchMode('login')}>返回登入</button></div>}
          <button className="auth-primary" type="submit" disabled={props.busy}>{props.busy ? '處理中…' : mode==='login'?'登入':mode==='register'?'發送驗證碼':'發送重設驗證碼'}</button>
        </form>
        {mode !== 'reset' && <>
          <p className="auth-switch">{mode==='register'?'已有帳戶？':'還沒有帳戶？'}<button type="button" className="auth-text-button" disabled={props.busy} onClick={() => switchMode(mode==='register'?'login':'register')}>{mode==='register'?'立即登入':'立即註冊'}</button></p>
        </>}
      </>}
      {notice && <div className="auth-notice" role="status"><p>{notice}</p><button aria-label="關閉提示" onClick={() => setNotice('')}><X size={19}/></button></div>}
    </main>
  </div>;
}
