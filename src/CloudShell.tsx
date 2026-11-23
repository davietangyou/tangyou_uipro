import {useEffect,useRef,useState} from 'react';
import App from '../App';
import {ConfirmDialog} from './components/ConfirmDialog';
import {startPrototype} from './services/prototypeOnboarding';
import {backend,isSessionFailure,setBackendUser} from './services/backendClient';
import {CloudSync} from './services/cloudSync';
import {loadProfile,loadGlucose,loadHbA1c,setCloudStorageUser,hasLocalImportData} from './services/storage';
import {migrateConversations} from './data/chat';
import PrototypeWelcome from './components/auth/PrototypeWelcome';
import './cloud.css';
import type {UserProfile} from './data/types';
import AuthScreens,{type AuthDraft} from './components/auth/AuthScreens';
import {AccountSettingsContext} from './components/account/AccountSettingsContext';
function loginContact(raw: string): {channel: 'email'; value: string} {
  const value = raw.trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('請填寫有效的電郵地址。');
  return {channel: 'email', value};
}

type Phase='checking'|'contact'|'code'|'import'|'loading'|'ready'|'error';
type Snapshot={source:'local';demo:false;profile:UserProfile;glucose:unknown[];hba1c:unknown[];medications:unknown[];medicationIntakes:unknown[];questions:unknown[];conversations:unknown[]};
type Preview={ownerUserId:string;counts:Record<string,number>;checksum:string};
function oldSnapshot():Snapshot {
  const profile=loadProfile(),glucose=loadGlucose(),hba1c=loadHbA1c();
  const selected=new Set(profile.nextClinicQuestions||[]);
  const chatRaw=localStorage.getItem('dia_v2_conversations');
  const conversations=chatRaw?migrateConversations(JSON.parse(chatRaw)).map(c=>({...c,messages:c.messages.filter(m=>m.source!=='demo')})).filter(c=>c.messages.length):[];
  return {source:'local',demo:false,profile,glucose,hba1c,medications:profile.medications||[],medicationIntakes:profile.medicationIntakes||[],
    questions:(profile.savedDoctorQuestions||[]).map(text=>({text,selected:selected.has(text)})),conversations};
}
export default function CloudShell(){
  const [phase,setPhase]=useState<Phase>('checking');const [emailOrPhone,setEmailOrPhone]=useState('');
  const [channel,setChannel]=useState<'email'|'phone'>('email');
  const [destination,setDestination]=useState('');const [resendAvailableAt,setResendAvailableAt]=useState(0);
  const authPending=useRef(false);const [challengeId,setChallengeId]=useState('');const [code,setCode]=useState('');const [pendingAuth,setPendingAuth]=useState<AuthDraft|null>(null);
  const [userId,setUserId]=useState('');const [snapshot,setSnapshot]=useState<Snapshot|null>(null);const [preview,setPreview]=useState<Preview|null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [status,setStatus]=useState('synced');
  const [prototypeEnabled,setPrototypeEnabled]=useState(false);
  const [capabilityState,setCapabilityState]=useState<'loading'|'ready'|'failed'>('loading');
  const [confirmRestart,setConfirmRestart]=useState(false);
  const [sessionExpired,setSessionExpired]=useState(false);
  const [confirmLogout,setConfirmLogout]=useState(false);
  const currentUser=useRef('');
  const [deliveryMode,setDeliveryMode]=useState<string>('');
  async function loadCapabilities(){
    setCapabilityState('loading');
    try {
      const config=await backend<{deliveryMode:string;prototypeOnboardingEnabled?:boolean}>('/auth/capabilities');
      setDeliveryMode(config.deliveryMode);setPrototypeEnabled(config.prototypeOnboardingEnabled===true);setCapabilityState('ready');
    } catch {setCapabilityState('failed');}
  }
  useEffect(()=>{void loadCapabilities();},[]);
  const sync=useRef<CloudSync|null>(null);
  function invalidate(){
    sync.current?.stop();sync.current=null;currentUser.current='';setBackendUser();setCloudStorageUser(null);
    const previous=localStorage.getItem('dia_cloud_last_user');
    setSessionExpired(!!previous&&sessionStorage.getItem('dia_logout_ack')!==previous);setPhase('contact');setError('');
  }
  useEffect(()=>{
    const invalid=(event:Event)=>{if((event as CustomEvent).detail.userId===currentUser.current)invalidate();};
    window.addEventListener('diaguide-session-invalid',invalid);
    return()=>window.removeEventListener('diaguide-session-invalid',invalid);
  },[]);
  async function act(task:()=>Promise<void>){setBusy(true);setError('');try{await task();}catch(e){if(isSessionFailure(e)&&currentUser.current)invalidate();else setError((e as Error).message);}finally{setBusy(false);}}
  async function begin(user:string){
    sync.current?.stop();sync.current=null;
    setUserId(user);currentUser.current=user;setBackendUser(user);
    localStorage.setItem('dia_cloud_last_user',user);sessionStorage.removeItem('dia_logout_ack');
    setCloudStorageUser(null);
    let local:Snapshot;
    try{local=oldSnapshot();}catch(e){setError((e as Error).message);setPhase('error');return;}
    setCloudStorageUser(user);
    if(hasLocalImportData(local)&&!localStorage.getItem(`dia_cloud_${user}_import_decision`)){
      const result=await backend<Preview>('/data/imports/preview',{method:'POST',body:{snapshot:local},expectedUserId:user});
      if(currentUser.current!==user)return;
      setSnapshot(local);setPreview(result);setPhase('import');return;
    }
    await loadCloud(user);
  }
  async function loadCloud(user:string){
    sync.current?.stop();setPhase('loading');setCloudStorageUser(user);
    const worker=new CloudSync(user,setStatus);sync.current=worker;
    try{
      await worker.start();
      if(sync.current===worker&&currentUser.current===user)setPhase('ready');
    }catch(e){worker.stop();if(isSessionFailure(e)){if(currentUser.current===user)invalidate();return;}if(sync.current===worker){setError((e as Error).message);setPhase('error');}}
  }
  useEffect(()=>{
    let active=true;
    void backend<{userId:string;role:string}>('/auth/me').then(me=>{
      if(!active)return;
      if(me.role!=='USER'){setPhase('contact');setError('此帳戶暫時未能使用。');return;}
      return begin(me.userId);
    }).catch(e=>{if(!active)return;if(isSessionFailure(e))invalidate();else{setPhase('error');setError((e as Error).message);}});
    return()=>{active=false;sync.current?.stop();setBackendUser();};
  },[]);
  async function sendChallenge(purpose:'register'|'password_reset',value:string,selected:'email'|'phone'){
    if(selected!=='email')throw new Error('短訊驗證已停用，請使用已綁定的電郵；新帳戶請以電郵註冊。');
    return backend<{challengeId:string}>('/auth/challenges',{method:'POST',body:{channel:selected,value,purpose}});
  }
  async function authAction(task:()=>Promise<void>){
    if(authPending.current)return;
    authPending.current=true;
    try{await act(task);}finally{authPending.current=false;}
  }
  async function logout(){
    await authAction(async()=>{
      await backend('/auth/sessions/current',{method:'DELETE'});
      if(prototypeEnabled||localStorage.getItem(`dia_cloud_${userId}_prototype`))sessionStorage.setItem('dia_logout_ack',userId);
      sync.current?.stop();setBackendUser();setCloudStorageUser(null);location.reload();
    });
  }
  async function start(){
    await authAction(async()=>{
      const result=await startPrototype();
      localStorage.setItem(`dia_cloud_${result.userId}_prototype`,'true');
      setSessionExpired(false);await begin(result.userId);
    });
  }
  return <>
    <ConfirmDialog appearance="profile" open={confirmLogout} title="登出此演示檔案？" message="演示版不支援找回原檔案；登出後重新開始會建立新的空白檔案。" confirmText="確認登出" onCancel={()=>setConfirmLogout(false)} onConfirm={()=>{setConfirmLogout(false);void logout();}}/>
    <ConfirmDialog open={confirmRestart} title="開始新的檔案？" message="原來的登入狀態已失效。開始後會建立空白檔案，原檔案無法找回。" confirmText="開始新檔案" onCancel={()=>setConfirmRestart(false)} onConfirm={()=>{setConfirmRestart(false);void start();}}/>
    {(phase==='checking'||(phase==='contact'&&capabilityState!=='ready'))&&<PrototypeWelcome
      preparing={phase==='checking'||capabilityState==='loading'}
      error={phase==='contact'&&capabilityState==='failed'?'暫時未能連接，請再試一次。':''}
      onRetry={()=>void loadCapabilities()}/>}
    {phase==='contact'&&capabilityState==='ready'&&prototypeEnabled&&<PrototypeWelcome busy={busy} error={error}
      onStart={()=>{if(sessionExpired)setConfirmRestart(true);else void start();}}/>}
    {(phase==='code'||(phase==='contact'&&capabilityState==='ready'&&!prototypeEnabled))&&<AuthScreens deliveryMode={deliveryMode} phase={phase} contact={emailOrPhone} destination={destination} code={code} error={error} busy={busy} resendAvailableAt={resendAvailableAt}
      onContactChange={value=>{setEmailOrPhone(value);setError('');}} onCodeChange={value=>{setCode(value);setError('');}}
      onClearError={()=>setError('')}
      onBack={()=>{if(authPending.current)return;setPhase('contact');setCode('');setError('');}}
      onLogin={password=>authAction(async()=>{
        const contact=loginContact(emailOrPhone);
        const result=await backend<{userId:string;role:string}>('/auth/sessions',{method:'POST',body:{channel:contact.channel,value:contact.value,password}});
        if(result.role!=='USER')throw new Error('此帳戶暫時未能使用。');
        await begin(result.userId);
      })}
      onSend={draft=>authAction(async()=>{
        const contact=loginContact(emailOrPhone);
        const result=await sendChallenge(draft.purpose,contact.value,contact.channel);
        setPendingAuth(draft);
        setChannel(contact.channel);setDestination(contact.value);setChallengeId(result.challengeId);setCode('');
        setResendAvailableAt(Date.now()+30000);setPhase('code');
      })}
      onResend={()=>authAction(async()=>{
        if(Date.now()<resendAvailableAt||!pendingAuth)return;
        const result=await sendChallenge(pendingAuth.purpose,destination,channel);
        setChallengeId(result.challengeId);setCode('');setResendAvailableAt(Date.now()+30000);
      })}
      onVerify={()=>authAction(async()=>{
        if(!/^[0-9]{6}$/.test(code))throw new Error('請輸入六位數驗證碼。');
        if(!pendingAuth)throw new Error('驗證資料已失效，請重新開始。');
        const path=pendingAuth.purpose==='register'?'/auth/registrations':'/auth/password-resets';
        const body=pendingAuth.purpose==='register'?{challengeId,code,name:pendingAuth.name,password:pendingAuth.password}:{challengeId,code,password:pendingAuth.password};
        const result=await backend<{userId:string;role:string}>(path,{method:'POST',body});
        if(result.role!=='USER')throw new Error('此帳戶暫時未能使用。');
        await begin(result.userId);
      })}/> }
    {phase!=='ready'&&phase!=='contact'&&phase!=='code'&&phase!=='checking'&&<div className="cloud-gate"><section className="cloud-card"><h1>DiaGuide</h1>
      {phase==='loading'?<p>正在載入安全帳戶資料…</p>:null}
      {phase==='import'&&preview&&<><h2>確認本機資料歸屬</h2><p>目前登入帳戶：<strong>{preview.ownerUserId}</strong></p><p>請確認本機紀錄屬於這個帳戶；演示資料不會匯入。</p><ul>{Object.entries(preview.counts).map(([name,count])=><li key={name}>{name}：{count}</li>)}</ul><button disabled={busy} onClick={()=>act(async()=>{await backend('/data/imports',{method:'POST',body:{clientBatchId:`import-${preview.checksum.slice(0,32)}`,confirmed:true,snapshot},expectedUserId:userId});localStorage.setItem(`dia_cloud_${userId}_import_decision`,'imported');await loadCloud(userId);})}>確認匯入</button><button className="secondary" disabled={busy} onClick={()=>act(async()=>{localStorage.setItem(`dia_cloud_${userId}_import_decision`,'skipped');await loadCloud(userId);})}>略過，使用雲端資料</button></>}
      {phase==='error'&&<><h2>暫時未能載入</h2><button onClick={()=>location.reload()}>重試</button></>}
      {error&&<p role="alert" className="cloud-error">{error}</p>}
    </section></div>}
    {phase==='ready'&&<AccountSettingsContext.Provider value={{
      syncFeedback: (status==='conflict'||status==='offline'||status==='invalid'||!!error)&&<section className="profile-sync-feedback" aria-label="同步狀態" data-voice-avoid>
        {status==='conflict'&&<><p>雲端紀錄已變更，本機修改已保留。</p><button className="profile-resume-setup" disabled={busy} onClick={()=>void act(async()=>{await sync.current?.useCloudAfterConflict();})}>保留本機備份並載入雲端</button></>}
        {status==='offline'&&<><p>暫時未能同步，修改已保留在此裝置。</p><button className="profile-resume-setup" disabled={busy} onClick={()=>void act(async()=>{await sync.current?.flush();})}>重試同步</button></>}
        {status==='invalid'&&<p role="alert">部分修改未能同步，請檢查剛才填寫的資料；本機內容已保留。</p>}
        {error&&<p role="alert" className="cloud-error">{error}</p>}
      </section>,
      logoutAction: <button className="profile-logout" data-voice-avoid disabled={busy} onClick={()=>{if(prototypeEnabled||localStorage.getItem(`dia_cloud_${userId}_prototype`))setConfirmLogout(true);else void logout();}}>登出</button>
    }}><App/></AccountSettingsContext.Provider>}
  </>;
}
