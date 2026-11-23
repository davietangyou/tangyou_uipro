import { buildHealthContext } from './data/aiContext';
import { mergeQuestions } from './data/questionMigration';
import { isDesignPreview } from './services/storage';
import { HbA1cRecordView } from "./views/HbA1cRecordView";
import { useHbA1c } from "./hooks/useHbA1c";
import { MedicationView } from './views/MedicationView';
import { useMedicationReminders } from './hooks/useMedicationReminders';
import {ProfileVoiceContext,useProfileVoiceRegistry} from './components/profile/ProfileVoice';
import { SetupView } from './views/SetupView';
import { FloatingVoice, type VoiceDock } from './components/FloatingVoice';
import { loadSetup, readStored, writeStored, type SetupState } from './services/storage';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BottomNav, type NavKey } from "./components/BottomNav";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Toast } from "./components/Toast";
import { useGlucose, type NewGlucoseInput } from "./hooks/useGlucose";
import { useProfile } from "./hooks/useProfile";
import { HomeView } from "./views/HomeView";
import { GlucoseView } from "./views/GlucoseView";
import { RecordView } from "./views/RecordView";
import { MeView } from "./views/MeView";
import { AboutView } from "./views/AboutView";
import { AppViewportFrame } from "./components/AppViewportFrame";
import { ConsultView } from "./views/ConsultView";
import { QuestionsView } from "./views/QuestionsView";

// 單頁應用，由全域 view state 切換（遵循 spec：非 URL router）。
type View =
  | { name: "home" }
  | { name: "medication"; from: "home" | "me"; intakeId?: string }
  | { name: "glucose" }
  | { name: "hba1c"; id?: string }
  | { name: "consult" }
  | { name: "questions" }
  | { name: "record"; mode: "add"; from: NavKey }
  | { name: "record"; mode: "edit"; id: string }
  | { name: "me" }
  | { name: "about" };

const FONT_KEY = "dia_large_font";

export default function App() {
  const [questionDock,setQuestionDock]=useState<VoiceDock|null>(null);
  const profileVoice=useProfileVoiceRegistry();
  const hba1c = useHbA1c();
  const { records, addRecord, updateRecord, deleteRecord, getById } = useGlucose();
  const { profile, updateProfile, transactProfile, resetAll } = useProfile();
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [view, commitView] = useState<View>(() => {
    const match = location.hash.match(/^#medication=(.+)$/);
    if (match) { try { return {name:'medication',from:'home',intakeId:decodeURIComponent(match[1])}; } catch {} }
    return {name:'home'};
  });
  const viewRef = useRef(view);
  const pageScroll = useRef<Record<string, number>>({});
  const [visited, setVisited] = useState(() => new Set(['home']));
  const [transition, setTransition] = useState('none');
  const subpageTrigger = useRef<HTMLElement | null>(null);
  const setView = useCallback((next: View) => {
    const current = viewRef.current;
    if (current.name === next.name && JSON.stringify(current) === JSON.stringify(next)) return;
    pageScroll.current[current.name] = document.querySelector('main')?.scrollTop ?? 0;
    const sub = (name: string) => ['record','medication','hba1c','about'].includes(name);
    const direction = sub(current.name) && !sub(next.name) ? 'back' : sub(next.name) ? 'forward' : 'tab';
    if (direction === 'forward') subpageTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
    setTransition(direction);
    setVisited(previous => new Set([...previous, next.name]));
    viewRef.current = next;
    commitView(next);
  }, []);
  useLayoutEffect(() => {
    document.querySelector('main')?.scrollTo({ top: transition === 'forward' ? 0 : pageScroll.current[view.name] ?? 0 });
    if (transition === 'back') {
      const trigger = subpageTrigger.current;
      if (trigger?.isConnected && !trigger.closest('[hidden],[inert]')) trigger.focus({preventScroll:true});
      else if (trigger) {
        const label = trigger.getAttribute('aria-label') || trigger.textContent;
        const replacement = Array.from(document.querySelectorAll<HTMLElement>('main button')).find(node =>
          !node.closest('[hidden],[inert]') && (node.getAttribute('aria-label') || node.textContent) === label);
        replacement?.focus({preventScroll:true});
      }
    }
  }, [view.name, transition]);
  const openHbA1c = (id?: string) => {
    setView({name:'hba1c', id});
  };
  const returnFromHbA1c = () => setView({name:'glucose'});

  const medicationControls = useMedicationReminders(profile, transactProfile, intakeId => setView({name:'medication',from:'home',intakeId}));
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [setup,setSetup] = useState<SetupState>(()=>loadSetup(profile));
  const [showSetup,setShowSetup] = useState(setup.status === 'active');
  const voiceScope = profileVoice.forRoute('appointment') ?? profileVoice.forRoute(showSetup ? 'setup' : view.name === 'me' ? 'profile' : view.name);
  // Default large-font for elderly users (Health Literacy Universal Precautions).

  const [largeFont, setLargeFont] = useState(()=>readStored("large_font",true));
  useEffect(() => {
    document.documentElement.classList.toggle("large-font",largeFont);
    writeStored("large_font",largeFont);
  }, [largeFont]);

  const latest = records.find(r=>r.value > 0) ?? null;

  const activeNav: NavKey =
    view.name === "medication" ? view.from : view.name === "glucose"
      ? "glucose"
      : view.name === "consult"
        ? "ai"
        : view.name === "questions"
          ? "questions"
        : view.name === "me" || view.name === "about"
          ? "me"
          : view.name === "record"
            ? view.mode === "add"
              ? view.from
              : "glucose"
            : "home";

  const isSubPage = view.name === "record" || view.name === "medication" || view.name === "hba1c" || view.name === "about";

  const handleAddSubmit = (input: NewGlucoseInput) => {
    addRecord(input);
    const from = view.name === "record" && view.mode === "add" ? view.from : "home";
    setView(from === "glucose" ? { name: "glucose" } : { name: "home" });
    setToast("已成功記錄血糖");
  };

  const handleEditSubmit = (input: NewGlucoseInput) => {
    if (view.name === "record" && view.mode === "edit") {
      updateRecord(view.id, input);
    }
    setView({ name: "glucose" });
    setToast("已成功保存修改");
  };

  const handleDelete = () => {
    try {
      if (view.name === "record" && view.mode === "edit") deleteRecord(view.id);
      setConfirmDelete(false);
      setView({ name: "glucose" });
      setToast("已刪除紀錄");
    } catch {
      setConfirmDelete(false);
      setToast("未能刪除，原有紀錄已保留。請再試一次。");
    }
  };

  const editingRecord =
    view.name === "record" && view.mode === "edit" ? getById(view.id) : undefined;

  useEffect(() => {
    const context = (document as Document & {
      modelContext?: {
        registerTool: (tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
          execute: (input: unknown) => unknown;
        }, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const register = (tool: Parameters<typeof context.registerTool>[0]) => {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    };

    register({
      name: "open_doctor_questions",
      title: "開啟覆診問題",
      description: "Navigate to the DiaGuide HK doctor-question list.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => {
        setView({ name: "questions" });
        return { view: "questions" };
      },
    });

    register({
      name: "add_doctor_question",
      title: "新增覆診問題",
      description: "Add one question to the saved list and optionally include it in the next clinic visit.",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string", minLength: 1, maxLength: 240 },
          includeInNextVisit: { type: "boolean", default: true },
        },
        required: ["question"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const payload = input as { question?: unknown; includeInNextVisit?: unknown };
        const question = typeof payload.question === "string" ? payload.question.trim() : "";
        if (!question || question.length > 240) throw new Error("問題內容須為 1 至 240 個字元");
        const same = (value: string) => value.trim().replace(/\s+/g, " ") === question.replace(/\s+/g, " ");
        const saved = profile.savedDoctorQuestions ?? [];
        const clinic = profile.nextClinicQuestions ?? [];
        const include = payload.includeInNextVisit !== false;
        updateProfile({
          savedDoctorQuestions: saved.some(same) ? saved : [question, ...saved],
          nextClinicQuestions: include && !clinic.some(same) ? [...clinic, question] : clinic,
        });
        setView({ name: "questions" });
        return { added: true, question, includedInNextVisit: include };
      },
    });

    return () => lifecycle.abort();
  }, [profile.nextClinicQuestions, profile.savedDoctorQuestions, updateProfile]);

  return (
    <ProfileVoiceContext.Provider value={profileVoice.register}><AppViewportFrame activeView={view.name}>
      <main data-transition={transition} inert={showSetup} className={`min-h-0 flex-1 ${view.name === "consult" ? "overflow-hidden" : "overflow-y-auto"}`}>
        {visited.has("home") && (<div className="main-panel" hidden={view.name !== "home"}>
          <HomeView
            profile={profile}
            records={records}
            now={medicationControls.now}
            largeFont={largeFont}
            onToggleFont={() => setLargeFont(v => !v)}
            onOpenConsult={() => setView({name:'consult'})}
            onOpenQuestions={() => setView({name:'questions'})}
            onOpenMedication={() => setView({name:'medication',from:'home'})}
            onOpenProfile={() => setView({name:'me'})}
            onRecordGlucose={() => setView({name:'record',mode:'add',from:'home'})}
            onSaveProfile={updateProfile}
            onToast={setToast}
          />
        </div>)}

        {view.name === 'medication' && <MedicationView
          profile={profile} transact={transactProfile} onToast={setToast} controls={medicationControls}
          initialIntake={view.intakeId} onBack={() => {history.replaceState(null,'',location.pathname+location.search);setView(view.from==='home'?{name:'home'}:{name:'me'});}}
        />}

        {visited.has("glucose") && (
          <div className="main-panel" hidden={view.name !== "glucose"}><GlucoseView
            onFullscreenChange={setChartFullscreen}
            records={records}
            hba1cRecords={hba1c.records}
            onRecordHbA1c={() => openHbA1c()}
            onOpenHbA1c={openHbA1c}
            onRecord={() => setView({ name: "record", mode: "add", from: "glucose" })}
            onOpenRecord={(id) => setView({ name: "record", mode: "edit", id })}
            onSaveSymptom={(input) => addRecord(input)}
            onDeleteRecord={(id) => deleteRecord(id)}
            onToast={setToast}
          /></div>
        )}

        {visited.has("consult") && (<div className="main-panel main-panel-chat" hidden={view.name !== "consult"}>
          <ConsultView onToast={setToast}
            onOpenQuestions={() => setView({name:'questions'})}
            savedQuestions={profile.savedDoctorQuestions || []}
            health={buildHealthContext(profile, records, hba1c.records, isDesignPreview())}
            onSaveQuestion={question => transactProfile(current => ({ ...current,
              savedDoctorQuestions: mergeQuestions(current.savedDoctorQuestions || [], [question.trim()]),
            }))}
          />
        </div>)}

        {visited.has("questions") && (<div className="main-panel" hidden={view.name !== "questions"}>
          <QuestionsView
            onVoiceDock={setQuestionDock}
            profile={profile}
            onSaveSection={updateProfile}
            onToast={setToast}
          />
        </div>)}

        {visited.has("me") && (<div className="main-panel" hidden={view.name !== "me"}>
          <MeView
            onOpenAbout={() => setView({name:'about'})}
            onOpenMedication={() => setView({name:"medication",from:"me"})}
            profile={profile}
            onSaveSection={updateProfile}
            onResetAll={resetAll}
            onResumeSetup={setup.status !== "complete" ? ()=>setShowSetup(true) : undefined}
            onToast={setToast}
          />
        </div>)}

        {view.name === "hba1c" && <HbA1cRecordView
          key={view.id || "new-hba1c"} editing={!!view.id}
          record={view.id ? hba1c.records.find(record => record.id === view.id) : undefined}
          onBack={returnFromHbA1c} onSave={hba1c.save} onDelete={hba1c.remove} onToast={setToast}
        />}

        {view.name === "record" && (
          <RecordView
            key={view.mode === "edit" ? view.id : "new-glucose"}
            mode={view.mode}
            record={editingRecord}
            onBack={() =>
              setView(
                view.mode === "add" && view.from === "home"
                  ? { name: "home" }
                  : { name: "glucose" },
              )
            }
            onSubmit={view.mode === "add" ? handleAddSubmit : handleEditSubmit}
            onDelete={view.mode === "edit" ? () => setConfirmDelete(true) : undefined}
          />
        )}

        {view.name === 'about' && <AboutView onBack={() => setView({name:'me'})} />}
      </main>

      {!isSubPage && !showSetup && (
        <BottomNav
          active={activeNav}
          onNavigate={(key) => {
            if (key === "home") setView({ name: "home" });
            else if (key === "glucose") setView({ name: "glucose" });
            else if (key === "ai") setView({ name: "consult" });
            else if (key === "questions") setView({ name: "questions" });
            else if (key === "me") setView({ name: "me" });
          }}
        />
      )}

      {showSetup && <SetupView profile={profile} initialStep={setup.step} onSave={updateProfile} onClose={state=>{setSetup(state);setShowSetup(false);}} onToast={setToast}/>}
      <FloatingVoice
        dock={questionDock}
        hidden={
          view.name === "consult" || view.name === "about" || (view.name === "glucose" && chartFullscreen)
        }
        route={voiceScope?.route || (showSetup ? 'setup' : view.name)}
        onToast={setToast}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <ConfirmDialog
        appearance="record"
        open={confirmDelete}
        title="刪除這筆血糖紀錄？"
        message="刪除後無法復原，這筆紀錄將從數據日誌及分析中移除。"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppViewportFrame></ProfileVoiceContext.Provider>
  );
}