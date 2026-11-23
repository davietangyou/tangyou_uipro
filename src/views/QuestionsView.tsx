import { DeviceModal } from '../components/DeviceModal';
import { Toast } from '../components/Toast';
import { Download, Plus, Sun, MoveHorizontal, LoaderCircle, ClipboardList, MessageCirclePlus } from "lucide-react";
import { AppointmentCard, AppointmentEditor } from '../components/AppointmentCard';
import type { VoiceDock } from "../components/FloatingVoice";
import { organize, type OrganizeResult } from "../services/ai";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { normalizeQuestion, uniqueQuestions } from "../../shared/ai";
import { questionCollection, selectQuestion, recommendationTags, questionSignatures, analysisInvalidated } from "../data/questions";
import type { UserProfile } from "../data/types";
import {
  BackIcon,
  ChevronDownIcon,
  RefreshIcon,
} from "../components/icons";


const QuestionVoiceContext=createContext<(dock:VoiceDock|null)=>void>(()=>{});
function QuestionModal({open,label,onClose,children,autoFocus=false,placement='sheet'}:{open:boolean;label:string;onClose:()=>void;children:ReactNode;autoFocus?:boolean;placement?:'sheet'|'center'}) {
  return <DeviceModal open={open} label={label} onClose={onClose} autoFocus={autoFocus}
    placement={placement} className={`questions-scope question-modal-content ${placement === 'center' ? 'question-confirm-panel' : 'question-editor-panel'}`}>{children}</DeviceModal>;
}

const normalise = normalizeQuestion;

function formatClinicDate(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10));
  if (!m) return "";
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

function PrimaryAction({ children, onClick, disabled, icon }: { children: ReactNode; onClick: () => void; disabled?: boolean; icon?: ReactNode; }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="question-primary">{icon}<span>{children}</span></button>);
}

function SecondaryAction({ children, onClick, disabled, icon }: { children: ReactNode; onClick: () => void; disabled?: boolean; icon?: ReactNode; }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="question-secondary">{icon}<span>{children}</span></button>);
}

const PlusGlyph = () => <Plus width={22} height={22} strokeWidth={2} aria-hidden="true"/>;

type AiResult = OrganizeResult;

// ── Fallback data for when AI organize fails ────────────────────────────────
const FALLBACK_SUMMARY = '你嘅問題主要圍繞用藥反應、飲食份量同血糖波動呢幾個方向。';
const FALLBACK_CATEGORIES = [
  { categoryName: '降糖用藥與反應', description: '關心食藥後的胃脹、低血糖風險及是否需調藥', frequency: '高頻關注' },
  { categoryName: '飲食份量與外食', description: '關注外出飲茶、澱粉水果份量與飯後血糖升幅', frequency: '經常諮詢' },
  { categoryName: '日常血糖波動與指標', description: '關注空腹與餐後血糖差距及糖化血色素達標情況', frequency: '持續追蹤' },
];
const FALLBACK_QUESTIONS = [
  { question: '醫生，我食完降糖藥之後有時覺得胃部唔適，想問下係咪正常反應？需唔需要調整？', categoryTag: '用藥反應' },
  { question: '醫生，我食某些食物（例如生果或澱粉類）之後血糖升得較急，份量應該點控制？', categoryTag: '飲食控制' },
  { question: '醫生，呢度係我最近記錄嘅血糖數值，想問下我目前嘅血糖波動算唔算理想？', categoryTag: '血糖波動' },
];

function UndoBar({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div role="status" className="question-undo">
      <span className="text-white">{message}</span>
      <button type="button" onClick={onUndo} className="shrink-0 rounded-[12px] px-3 py-2 hm-body font-bold text-white underline underline-offset-4 transition-transform active:scale-[0.96]">復原</button>
    </div>
  );
}

function QuestionEditorModal({ open, title, placeholder, initial, submitLabel, onSubmit, onCancel }: {
  open: boolean; title: string; placeholder: string; initial: string; submitLabel: string;
  onSubmit: (text: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitting = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const setDock=useContext(QuestionVoiceContext);
  useLayoutEffect(()=>{if(!open)return;if(dockRef.current&&areaRef.current)setDock({node:dockRef.current,target:areaRef.current});return()=>setDock(null);},[open,setDock]);
  useEffect(() => { if (open) { setText(initial); setError(null); setSaveFailed(false); submitting.current = false; } }, [open, initial]);
  useLayoutEffect(() => {
    if (!open) return;
    const resize = () => { const node = areaRef.current; if (!node) return; node.style.height = 'auto'; node.style.height = `${Math.min(240, Math.max(68, node.scrollHeight + 2))}px`; };
    resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, [text, open, initial]);
  const handleSubmit = () => {
    if (submitting.current) return; setSaveFailed(false);
    if (text.trim() === "") { setError("請輸入想問醫生的問題"); areaRef.current?.focus({preventScroll:true}); return; }
    submitting.current = true; try { onSubmit(text.trim()); } catch { setSaveFailed(true); submitting.current = false; }
  };
  return (
    <QuestionModal open={open} label="q-editor-title" onClose={onCancel} autoFocus>
      <div className="question-editor-form" onClick={(e) => e.stopPropagation()}>
        <h2 id="q-editor-title" className="hm-cardtitle text-ink">{title}</h2>
        <div ref={dockRef} hidden />
        <div className="question-editor-field">
        <label htmlFor={title === '新增問題' ? 'question-add-content' : 'question-edit-content'}>問題內容</label>
        <textarea id={title === '新增問題' ? 'question-add-content' : 'question-edit-content'} ref={areaRef} value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(null); setSaveFailed(false); }}
          rows={1} maxLength={1000} placeholder={error ? '未填寫' : placeholder} aria-label="問題內容"
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'question-field-error' : undefined} />
        {error && <p id="question-field-error" className="question-field-error" role="alert">{error}</p>}
        </div>
        <div className="question-editor-actions" data-voice-avoid>
          <button type="button" onClick={handleSubmit}>{submitLabel}</button>
          <button type="button" onClick={onCancel}>取消</button>
        </div>
      </div>
      {saveFailed && <Toast kind="error" message="暫時未能儲存，請再試。" onDone={() => setSaveFailed(false)} />}
    </QuestionModal>
  );
}

function ConfirmationDialog({ open, title, message, confirmText, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmText: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <QuestionModal open={open} label="confirm-title" onClose={onCancel} placement="center">
      <div className="question-confirm-form" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="hm-cardtitle text-ink">{title}</h2>
        <p className="mt-2 hm-body text-ink-soft">{message}</p>
        <div className="question-editor-actions">
          <button type="button" onClick={onConfirm} className="question-confirm-delete"><span>{confirmText}</span></button>
          <button type="button" onClick={onCancel}>取消</button>
        </div>
      </div>
    </QuestionModal>
  );
}

function DoctorViewMode({ dateLabel, questions, onExport, onShare, onBack }: {
  dateLabel: string; questions: string[]; onExport: () => void; onShare: () => void; onBack: () => void;
}) {
  return <div className="questions-scope question-doctor fixed inset-0 z-40 flex flex-col">
    <header className="question-doctor-header"><button type="button" onClick={onBack} aria-label="返回編輯"><BackIcon width={24} height={24}/></button><h1 className="hm-cardtitle">給醫生查看</h1></header>
    <div className="question-doctor-scroll"><article className="question-doctor-reading">
      <h2>覆診問題清單</h2><p className="question-doctor-date">覆診日期：{dateLabel || '尚未設定'}</p>
      <ol>{questions.map((q,i)=><li key={q}><span>{i+1}.</span><p>{q}</p></li>)}</ol>
    </article></div>
    <footer className="question-doctor-tools"><SecondaryAction onClick={onExport}>列印／匯出</SecondaryAction><SecondaryAction onClick={onShare}>分享</SecondaryAction></footer>
  </div>;
}

type Modal = {type:'none' | 'add' | 'date'} | {type:'edit'; original:string};
type AiState = {status:'idle' | 'loading'} | {status:'success'; result:AiResult; sources:string[]} | {status:'error'; message:string} | {status:'fallback'};

// ── Download consultation note ──────────────────────────────────────────────
function downloadConsultNote(savedQuestions: string[], clinicQuestions: string[], nextClinicDate?: string) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const lines: string[] = [
    '糖友導航 - 我的問診筆記',
    `生成日期: ${dateStr}`,
    '',
    '【已保存的問診問題】',
  ];
  if (savedQuestions.length) {
    savedQuestions.forEach((q, i) => lines.push(`${i+1}. ${q}`));
  } else {
    lines.push('(未有保存問題)');
  }
  lines.push('', '【下次問診清單】');
  if (clinicQuestions.length) {
    clinicQuestions.forEach((q, i) => lines.push(`${i+1}. ${q}`));
  } else {
    lines.push('(未勾選特定問題)');
  }
  lines.push('', `【問診日期】`, nextClinicDate || '未設定');
  lines.push('', '---', '此筆記由 AI 輔助生成，僅供參考，請務必諮詢您的醫生。');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `糖友問診筆記_${dateStr}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function QuestionsView({onVoiceDock, profile, onSaveSection, onToast}: {
  onVoiceDock:(dock:VoiceDock|null)=>void; profile:UserProfile;
  onSaveSection:(patch:Partial<UserProfile>)=>void; onToast:(message:string)=>void;
}) {
  const [modal,setModal] = useState<Modal>({type:'none'});
  const [deleteTarget,setDeleteTarget] = useState<string|null>(null);
  const [aiState,setAiState] = useState<AiState>({status:'idle'});
  const [summaryExpanded,setSummaryExpanded] = useState(false);
  const [doctorView,setDoctorView] = useState(false);
  const [undo,setUndo] = useState<{message:string; snapshot:Partial<UserProfile>; expected:string}|null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const aiRequest = useRef<AbortController|null>(null);
  const cards = useRef(new Map<string,HTMLDivElement>());
  const pendingList = useRef<HTMLDivElement>(null);
  const {questions,selectedQuestions:clinic,pending} = questionCollection(profile.savedDoctorQuestions,profile.nextClinicQuestions);
  const signatures = questionSignatures(questions,clinic);
  const requestSignature = JSON.stringify(signatures);
  const latest = useRef(requestSignature); latest.current = requestSignature;
  const previous = useRef(signatures);
  const dateLabel = formatClinicDate(profile.nextClinicDate);
  const tags = aiState.status === 'success' ? recommendationTags(aiState.result,aiState.sources,clinic) : new Map<string,string>();

  useEffect(()=>{
    if (analysisInvalidated(previous.current,signatures,aiState.status === 'loading')) {
      aiRequest.current?.abort(); aiRequest.current=null;
      if (aiState.status !== 'idle') {
        setAiState({status:'idle'});setSummaryExpanded(false);
        onToast('問題或選擇已更新，請重新整理。');
      }
    }
    previous.current=signatures;
  },[requestSignature]);
  useEffect(()=>()=>{aiRequest.current?.abort();if(undoTimer.current)clearTimeout(undoTimer.current);},[]);

  const save = (patch:Partial<UserProfile>) => {
    const next=questionCollection(patch.savedDoctorQuestions ?? questions,patch.nextClinicQuestions ?? clinic);
    if(analysisInvalidated(signatures,questionSignatures(next.questions,next.selectedQuestions),true)) {
      aiRequest.current?.abort(); aiRequest.current=null;
    }
    onSaveSection(patch);
  };
  const clearUndo = () => {setUndo(null);if(undoTimer.current)clearTimeout(undoTimer.current);};
  const withUndo = (message:string,patch:Partial<UserProfile>) => {
    onToast(''); clearUndo();
    const next=questionCollection(patch.savedDoctorQuestions ?? questions,patch.nextClinicQuestions ?? clinic);
    setUndo({message,snapshot:{savedDoctorQuestions:questions,nextClinicQuestions:clinic},expected:JSON.stringify(questionSignatures(next.questions,next.selectedQuestions))});
    undoTimer.current=setTimeout(()=>setUndo(null),8000);
    save(patch);
  };
  const move = (question:string,include:boolean) => {
    const patch=selectQuestion(questions,clinic,question,include);
    if(include) {
      clearUndo();
      setAiState(state=>state.status==='success' ? {...state,result:{...state.result,recommendedQuestions:state.result.recommendedQuestions.filter(q=>state.sources[q.sourceIndex]!==question)}} : state);
      save(patch);onToast('已加入本次覆診');
    } else withUndo('已移回尚未加入',patch);
  };
  const add = (text:string) => {
    const question=normalise(text);
    if(questions.includes(question)) {onToast('此問題已在問題列表中');return;}
    clearUndo();save({savedDoctorQuestions:[...questions,question]});onToast('已儲存到尚未加入');
  };
  const edit = (original:string,text:string) => {
    const question=normalise(text);clearUndo();
    save({savedDoctorQuestions:uniqueQuestions(questions.map(q=>q===original?question:q)),nextClinicQuestions:uniqueQuestions(clinic.map(q=>q===original?question:q))});
    onToast('已保存修改');
  };
  const remove = (question:string) => {
    withUndo('已刪除問題',{savedDoctorQuestions:questions.filter(q=>q!==question),nextClinicQuestions:clinic.filter(q=>q!==question)});
    setDeleteTarget(null);
  };
  const runAi = async () => {
    if(!questions.length || aiRequest.current)return;
    const snapshot=requestSignature, sources=[...questions];
    const controller=new AbortController();aiRequest.current=controller;
    onToast('');
    setAiState({status:'loading'});setSummaryExpanded(false);
    try {
      const result=await organize({questions:sources,selectedQuestions:[...clinic]},controller.signal);
      if(controller.signal.aborted || latest.current!==snapshot)return;
      setAiState({status:'success',result,sources});
    } catch(error) {
      if(controller.signal.aborted || latest.current!==snapshot)return;
      // Use fallback data instead of showing error
      setAiState({status:'fallback'});
      onToast('AI 整理暫時未能使用，已顯示預設建議。');
    } finally {if(aiRequest.current===controller)aiRequest.current=null;}
  };
  const showSuggestions = () => {
    requestAnimationFrame(()=>{
      const first=pending.find(q=>tags.has(q));
      const target=first?cards.current.get(first):pendingList.current;
      target?.focus({preventScroll:true});
      target?.scrollIntoView({block:'nearest',inline:'start',behavior:'instant'});
      const scroller=target?.closest('main');
      if(target && scroller)scroller.scrollTo({top:scroller.scrollTop+target.getBoundingClientRect().top-scroller.getBoundingClientRect().top,behavior:'instant'});
    });
  };
  const share = async () => {
    const text=`覆診日期：${dateLabel || '尚未設定'}\n\n`+clinic.map((q,i)=>`${i+1}. ${q}`).join('\n');
    try {
      if(navigator.share)await navigator.share({title:'覆診問題清單',text});
      else {await navigator.clipboard.writeText(text);onToast('已複製清單，可貼上分享');}
    } catch { /* User may cancel sharing. */ }
  };
  if(doctorView)return <DoctorViewMode dateLabel={dateLabel} questions={clinic} onExport={()=>window.print()} onShare={share} onBack={()=>setDoctorView(false)}/>;
  const close = () => setModal({type:'none'});
  return <QuestionVoiceContext.Provider value={onVoiceDock}>
    <div className="questions-scope question-page" data-empty={!questions.length}>
      <h1 className="sr-only">問題</h1>
      <div className="question-page-content">
        <AppointmentCard variant="questions" profile={profile} onEdit={()=>setModal({type:'date'})}
          onStatusChange={status=>{onSaveSection({nextClinicStatus:status});onToast(status==='completed'?'已標記覆診為完成。':'已取消這次覆診。');}}/>
        <div className="question-backlog-tools" data-voice-avoid>
          <PrimaryAction icon={<PlusGlyph/>} onClick={()=>setModal({type:'add'})}>新增問題</PrimaryAction>
          <SecondaryAction icon={<Sun width={22} height={22} strokeWidth={1.8}/>} disabled={!questions.length || aiState.status==='loading'} onClick={runAi}>{aiState.status==='loading'?'正在整理⋯':'AI 幫我整理'}</SecondaryAction>
          {(questions.length > 0) && <button type="button" className="question-secondary" onClick={() => downloadConsultNote(questions, clinic, profile.nextClinicDate)} data-voice-avoid>
            <Download width={20} height={20} strokeWidth={1.8} aria-hidden="true"/>
            <span>下載問診筆記</span>
          </button>}
        </div>
        {aiState.status==='loading' && <p role="status" className="question-summary"><LoaderCircle className="question-spinner" size={24} aria-hidden="true"/>正在整理關注的主題及選題建議⋯</p>}
        {aiState.status==='fallback' && <section aria-label="預設建議" className="question-summary">
          <h2 className="hm-cardtitle">預設建議</h2>
          <p className="hm-body mt-2">{FALLBACK_SUMMARY}</p>
          <div className="mt-3 flex flex-col gap-2">
            {FALLBACK_CATEGORIES.map(cat => (
              <div key={cat.categoryName} className="t-support text-ink-soft">
                <strong>{cat.categoryName}</strong>（{cat.frequency}）：{cat.description}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <p className="t-support font-semibold text-ink">預設問診問題：</p>
            {FALLBACK_QUESTIONS.map((fq, i) => (
              <p key={i} className="t-support text-ink">{i+1}. {fq.question}</p>
            ))}
          </div>
          <SecondaryAction icon={<RefreshIcon width={22} height={22}/>} onClick={runAi}>重新嘗試 AI 整理</SecondaryAction>
        </section>}
        {aiState.status==='success' && <section aria-label="AI 總結" className="question-summary">
          <h2 className="hm-cardtitle">AI 總結</h2>
          <p id="question-summary-text" data-voice-avoid className="hm-body mt-2">{summaryExpanded || aiState.result.summary.length<=48 ? aiState.result.summary : aiState.result.summary.slice(0,48)+'⋯'}</p>
          {aiState.result.summary.length>48 && <button type="button" className="question-ai-toggle" data-voice-avoid aria-expanded={summaryExpanded} aria-controls="question-summary-text" onClick={()=>setSummaryExpanded(v=>!v)}>{summaryExpanded?'收起摘要':'展開摘要'}<ChevronDownIcon width={20} height={20}/></button>}
          <p className="t-support mt-3 text-ink-soft" role="status">{tags.size ? `${tags.size} 題建議本次討論，由你決定是否加入。` : '暫時沒有其他選題建議。'}</p>
          {tags.size>0 && <button type="button" className="question-ai-toggle question-ai-suggestions" data-voice-avoid onClick={showSuggestions}>查看建議</button>}
        </section>}
        <section className="question-section" aria-label="本次覆診要問">
          <div className="question-section-header">
            <QuestionSectionHeading title="本次覆診要問" count={clinic.length}/>
            {clinic.length > 0 && <button type="button" className="question-doctor-link" aria-label={`給醫生查看全部 ${clinic.length} 題`} data-voice-avoid onClick={()=>{onToast('');setDoctorView(true);}}>給醫生查看</button>}
          </div>
          {clinic.length ? <>
            <QuestionCarousel id="clinic-questions" label="本次覆診要問">{clinic.map(question=><QuestionCard key={question} question={question} selected onMove={()=>move(question,false)} onEdit={()=>setModal({type:'edit',original:question})}/>)}</QuestionCarousel>
          </> : <div className="question-empty"><ClipboardList size={24} aria-hidden="true"/><strong>尚未選擇覆診問題</strong><p>{questions.length?'從「尚未加入」選擇想問的問題。':'新增後，可加入本次覆診。'}</p></div>}
        </section>
        <section className="question-section" aria-label="尚未加入">
          <QuestionSectionHeading title="尚未加入" count={pending.length}/>
          <div ref={pendingList} tabIndex={-1}>
            {pending.length ? <QuestionCarousel id="pending-questions" label="尚未加入">{pending.map(question=><div key={question} ref={node=>{if(node)cards.current.set(question,node);else cards.current.delete(question);}} tabIndex={-1} className="question-source" aria-label={tags.has(question)?`建議本次討論：${question}`:question}><QuestionCard question={question} categoryTag={tags.get(question)} onMove={()=>move(question,true)} onEdit={()=>setModal({type:'edit',original:question})} onDelete={()=>setDeleteTarget(question)}/></div>)}</QuestionCarousel> : <div className="question-empty"><MessageCirclePlus size={24} aria-hidden="true"/><strong>{questions.length?'全部已加入覆診':'暫時未有問題'}</strong><p>{questions.length?'可隨時新增想問的問題。':'想到想問的，隨時新增。'}</p></div>}
          </div>
        </section>
      </div>
      <QuestionEditorModal open={modal.type==='add'} title="新增問題" placeholder="輸入想問醫生的問題" initial="" submitLabel="儲存" onSubmit={text=>{add(text);close();}} onCancel={close}/>
      <QuestionEditorModal open={modal.type==='edit'} title="編輯問題" placeholder="輸入問題內容" initial={modal.type==='edit'?modal.original:''} submitLabel="保存修改" onSubmit={text=>{if(modal.type==='edit')edit(modal.original,text);close();}} onCancel={close}/>
      {modal.type==='date' && <AppointmentEditor appearance="questions" profile={profile} onSave={patch=>{onSaveSection(patch);onToast('已更新覆診資料');}} onClose={close}/>}
      <ConfirmationDialog open={deleteTarget!==null} title="刪除這條問題？" message="刪除後可在提示中選擇復原。" confirmText="確認刪除" onConfirm={()=>deleteTarget && remove(deleteTarget)} onCancel={()=>setDeleteTarget(null)}/>
      {undo && undo.expected===requestSignature && <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-40 px-6" data-voice-avoid><UndoBar message={undo.message} onUndo={()=>{save(undo.snapshot);clearUndo();}}/></div>}
    </div>
  </QuestionVoiceContext.Provider>;
}

function QuestionCarousel({id,label,children}: {id:string;label:string;children:ReactNode[]}) {
  const [index,setIndex] = useState(0);
  const multiple = children.length > 1;
  return <div className="question-carousel-section">
    {multiple && <div className="question-carousel-meta">
      <p id={`${id}-hint`} className="question-swipe-hint"><MoveHorizontal size={18} aria-hidden="true"/>左右滑動，查看更多問題</p>
      <p className="question-carousel-count" aria-label={`第${Math.min(index+1,children.length)}張，共${children.length}張`}>{Math.min(index+1,children.length)} / {children.length}</p>
    </div>}
    <div id={id} className="question-carousel" data-multiple={multiple} role="region" aria-label={label} aria-describedby={multiple?`${id}-hint`:undefined} tabIndex={0}
      onScroll={event=>{const node=event.currentTarget;const first=node.children[0] as HTMLElement;const second=node.children[1] as HTMLElement|undefined;if(second)setIndex(Math.round(node.scrollLeft/(second.offsetLeft-first.offsetLeft)));}}>
      {children}
    </div>
  </div>;
}

function QuestionSectionHeading({title,count}: {title:string;count:number}) {
  return <h2 className="question-section-heading">{title}<span>· {count} 題</span></h2>;
}

function QuestionCard({question,selected=false,categoryTag,onMove,onEdit,onDelete}: {
  question:string;selected?:boolean;categoryTag?:string;onMove:()=>void;onEdit:()=>void;onDelete?:()=>void;
}) {
  return <div className="question-unified-card" data-selected={selected} data-question={question}>
    {categoryTag && <div className="question-recommendation" data-voice-avoid><span>建議本次討論</span><span>{categoryTag}</span></div>}
    <p className="hm-body" data-voice-avoid>{question}</p>
    <div className="question-card-actions" data-selected={selected}>
      <button type="button" onClick={onMove} className="question-card-action question-move" data-voice-avoid>{!selected && <Plus width={18} height={18} strokeWidth={2} aria-hidden="true"/>}<span>{selected?'移出本次覆診':'加入本次覆診'}</span></button>
      <button type="button" onClick={onEdit} className="question-card-action" data-voice-avoid><span>編輯</span></button>
      {onDelete && <button type="button" onClick={onDelete} className="question-card-action question-delete" data-voice-avoid>刪除</button>}
    </div>
  </div>;
}