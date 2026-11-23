import './prototypeWelcome.css';
export default function PrototypeWelcome({preparing=false,busy=false,error='',onStart,onRetry}: {
  preparing?:boolean;busy?:boolean;error?:string;onStart?:()=>void;onRetry?:()=>void;
}) {
  return <main className="prototype-welcome" aria-labelledby="welcome-title">
    <section className="prototype-welcome-content">
      <p className="prototype-welcome-brand">DiaGuide HK</p>
      <h1 id="welcome-title">歡迎使用<br/><span>糖友導航</span></h1>
      <p className="prototype-welcome-description">記錄日常健康，<br/>輕鬆準備覆診。</p>
      {error&&<p className="prototype-welcome-error" role="alert">{error}</p>}
      {preparing?<p role="status" className="prototype-welcome-status">正在準備…</p>:
        <button type="button" disabled={busy} onClick={onRetry??onStart} className="prototype-welcome-start">
          <span>{busy?'正在開始…':onRetry?'重試':'開始使用'}</span>
        </button>}
    </section>
  </main>;
}
