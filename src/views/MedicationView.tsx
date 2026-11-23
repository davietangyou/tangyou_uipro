import { SavedFeedback } from '../components/SavedFeedback';
import { AnimatePresence } from 'motion/react';
import { PageSurface } from '../components/PageSurface';
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {AccountSettingsContext} from "../components/account/AccountSettingsContext";
import { Clock3, Pill, Plus, ChevronRight } from "lucide-react";
import type { Medication, UserProfile } from "../data/types";
import {
  confirmIntake,
  refillMedication,
  lowStock,
  newId,
  reconcileIntakes,
  saveMedication,
  saveMedicationBasics,
  scheduleLabel,
  todayIntakes,
  undoIntake,
  validateMedication,
} from "../data/medication";
import { localDate } from "../data/hba1c";
import { medicationReminderLabel, shouldOfferMedicationNotificationPrimer } from "../data/medicationNotification";
import type { MedicationReminderControls } from "../hooks/useMedicationReminders";
import { IntakeCard, LowStockNotices } from "../components/MedicationCards";
import { MedicationWizard } from "../components/MedicationWizard";
import { MedicationBasicEditor } from "../components/MedicationBasicEditor";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  BackIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  ListIcon,
  PillIcon,
  PlusIcon,
  TrashIcon,
} from "../components/icons";

type Props = {
  profile: UserProfile;
  transact: (change: (p: UserProfile) => UserProfile) => Promise<void>;
  onBack: () => void;
  onToast: (text: string) => void;
  controls: MedicationReminderControls;
  initialIntake?: string;
};

type EditorMode = "create" | "basic" | "schedule" | "inventory";
type MedicationScreen =
  | { kind: "overview" }
  | { kind: "history" }
  | { kind: "details"; id: string }
  | { kind: "notification-primer"; id: string }
  | {
      kind: "editor";
      med: Medication;
      initialStep: number;
      mode: EditorMode;
      existing?: boolean;
    };

function MedicationIconBadge({
  tone,
  children,
}: {
  tone: "peach" | "sage" | "lilac" | "blue";
  children: ReactNode;
}) {
  return (
    <span className={`med-icon-badge med-icon-${tone}`} aria-hidden="true">
      {children}
    </span>
  );
}

function MedicationPageHeader({
  title,
  description,
  onBack,
  headingRef,
  avoidVoice,
}: {
  title: string;
  description?: string;
  avoidVoice?: boolean;
  onBack: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <header className="med-page-header">
      <button
        className="med-back-button"
        onClick={onBack}
        data-voice-avoid={avoidVoice || undefined}
      >
        <BackIcon width={25} height={25} aria-hidden="true" />
        <span>返回</span>
      </button>
      <div
        className="med-page-heading"
        data-voice-avoid={avoidVoice || undefined}
      >
        <h1 ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        {description && <p>{description}</p>}
      </div>
    </header>
  );
}

function MedicationStatusChip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "active" | "warning" | "paused";
  children: ReactNode;
}) {
  return <span className={`med-summary-chip is-${tone}`}>{children}</span>;
}

function MedicationModuleLink({
  tone,
  icon,
  title,
  summary,
  actionLabel = "編輯",
  onClick,
}: {
  tone: "peach" | "sage" | "lilac" | "blue";
  icon: ReactNode;
  title: string;
  summary: string;
  actionLabel?: string;
  onClick: () => void;
}) {
  return (
    <button className="med-module-link" onClick={onClick}>
      <MedicationIconBadge tone={tone}>{icon}</MedicationIconBadge>
      <span className="med-module-copy">
        <strong>{title}</strong>
        <small>{summary}</small>
      </span>
      <span className="med-module-action">
        <span>{actionLabel}</span>
        <ChevronRightIcon width={22} height={22} aria-hidden="true" />
      </span>
    </button>
  );
}

function MedicationNotificationPrimer({
  controls,
  onEnabled,
  onLater,
}: {
  controls: MedicationReminderControls;
  onEnabled: () => void;
  onLater: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const canRequest = controls.access === "default" || controls.access === "granted";
  useEffect(() => {
    if (!canRequest) onLater();
  }, [canRequest, onLater]);
  useLayoutEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, []);
  const requestPermission = async () => {
    if (busy || !canRequest) return;
    setBusy(true);
    const result = await controls.enable();
    setBusy(false);
    if (result === "granted") onEnabled();
    else onLater();
  };
  if (!canRequest) return null;
  return (
    <div className="care-page medication-workflow med-permission-page">
      <section className="med-permission-panel" aria-labelledby="med-permission-title">
        <span className="med-permission-icon" aria-hidden="true"><ClockIcon width={44} height={44} /></span>
        <div className="med-permission-copy">
          <h1 id="med-permission-title" ref={heading} tabIndex={-1}>開啟服藥通知？</h1>
          {import.meta.env?.VITE_CLOUD_MODE==='true' ? <p>可接收服藥提醒，實際送達視裝置及通知設定而定。</p> : <>
            <p>開啟後，當此頁正在運行時，可在服藥時間提醒您查看並確認。</p>
            <p className="med-permission-limit">關閉 App 後不會定時通知。</p>
          </>}
        </div>
        <div className="med-permission-actions" data-voice-avoid>
          <button type="button" className="med-permission-primary" disabled={busy} onClick={() => void requestPermission()}>
            {busy ? "正在開啟…" : "開啟通知"}
          </button>
          <button type="button" className="med-permission-secondary" disabled={busy} onClick={onLater}>暫時不用</button>
        </div>
      </section>
    </div>
  );
}

export function MedicationView({
  profile,
  transact,
  onBack,
  onToast,
  controls,
  initialIntake,
}: Props) {
  const account=useContext(AccountSettingsContext);
  const [screen, commitScreen] = useState<MedicationScreen>({ kind: "overview" });
  const screenRef = useRef(screen);
  const scrollPositions = useRef(new Map<string, number>());
  const triggers = useRef(new Map<string, HTMLElement>());
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const screenKey = (value: MedicationScreen) => `${value.kind}:${'id' in value ? value.id : value.kind === 'editor' ? `${value.mode}:${value.med.id}` : ''}`;
  const screenDepth = (value: MedicationScreen) => value.kind === 'overview' ? 0 : value.kind === 'details' || value.kind === 'history' ? 1 : 2;
  const setScreen = (next: MedicationScreen) => {
    const current = screenRef.current;
    const key = screenKey(current);
    scrollPositions.current.set(key, document.querySelector('main')?.scrollTop ?? 0);
    const back = screenDepth(next) < screenDepth(current);
    setDirection(back ? 'back' : 'forward');
    if (!back && document.activeElement instanceof HTMLElement) triggers.current.set(key, document.activeElement);
    screenRef.current = next;
    commitScreen(next);
  };
  useLayoutEffect(() => {
    document.querySelector('main')?.scrollTo({top:direction === 'back' ? scrollPositions.current.get(screenKey(screen)) ?? 0 : 0});
    if (direction === 'back') {
      const trigger = triggers.current.get(screenKey(screen));
      if (trigger?.isConnected) trigger.focus({preventScroll:true});
      else if (trigger) {
        const label = trigger.getAttribute('aria-label') || trigger.textContent;
        const replacement = Array.from(document.querySelectorAll<HTMLElement>('main button')).find(node => (node.getAttribute('aria-label') || node.textContent) === label);
        replacement?.focus({preventScroll:true});
      }
    }
  }, [screen]);
  const submitting = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [updatedId, setUpdatedId] = useState<string | null>(null);
  const [medicationsExpanded, setMedicationsExpanded] = useState(true);
  const editor = screen.kind === "editor" ? screen : null;
  const med =
    screen.kind === "details"
      ? profile.medications.find((m) => m.id === screen.id)
      : undefined;
  const today = todayIntakes(profile, controls.now);
  const entry = profile.medicationIntakes?.find((e) => e.id === initialIntake);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if(direction === "forward") title.current?.focus({ preventScroll: true });
  }, [screen, initialIntake]);
  const run = async (
    change: (p: UserProfile) => UserProfile,
    message: string,
  ) => {
    if (submitting.current) return false;
    submitting.current = true;
    setError("");
    setBusy(true);
    try {
      await transact(change);
      onToast(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "未能儲存，原有資料已保留。");
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const take = (id: string) =>
    void run((p) => confirmIntake(p, id), "已記錄服藥；如有誤，可按撤銷。");
  const undo = (id: string) =>
    void run((p) => undoIntake(p, id), "已撤銷服藥確認。");
  const freshMedication = (): Medication => ({
    id: newId(),
    name: "",
    dosage: "",
    usage: "",
    diabetesRelated: false,
    reminderEnabled: false,
  });
  const renderScreen = () => {
  if (screen.kind === "notification-primer")
    return (
      <MedicationNotificationPrimer
        controls={controls}
        onEnabled={() => {
          onToast(import.meta.env?.VITE_CLOUD_MODE==='true'?"通知設定已儲存，同步後生效。":"系統通知已開啟。");
          setScreen({ kind: "details", id: screen.id });
        }}
        onLater={() => setScreen({ kind: "details", id: screen.id })}
      />
    );
  if (editor && editor.mode === "schedule")
    return (
      <MedicationWizard
        initial={editor.med}
        mode={editor.mode}
        busy={busy}
        saveError={error}
        onBack={() =>
          setScreen(
            editor.existing && editor.med.id
              ? { kind: "details", id: editor.med.id }
              : { kind: "overview" },
          )
        }
        onSave={async (next) => {
          const ok = await run(
            (p) => {
              const current = p.medications.find((m) => m.id === next.id);
              if (editor.existing && !current)
                throw new Error("這項藥物已移除，請返回藥物清單。");
              if (
                current &&
                JSON.stringify(current) !== JSON.stringify(editor.med)
              )
                throw new Error("藥物資料剛有更新，請返回詳情後重新編輯。");
              return saveMedication(p, next);
            },
            "已儲存服藥時間表。",
          );
          if (ok) {
            const offer = shouldOfferMedicationNotificationPrimer({
              action: editor.mode,
              reminderEnabled: !!next.reminderEnabled,
              access: controls.access,
              enabled: controls.enabled,
            });
            setScreen({
              kind: offer ? "notification-primer" : "details",
              id: next.id!,
            });
          }
          return ok;
        }}
      />
    );
  if (editor)
    return (
      <MedicationEditor
        initial={editor.med}
        initialStep={editor.initialStep}
        mode={editor.mode}
        onBack={() =>
          setScreen(
            editor.existing && editor.med.id
              ? { kind: "details", id: editor.med.id }
              : { kind: "overview" },
          )
        }
        onSave={async (next) => {
          const ok = await run(
            (p) => {
              const current = p.medications.find((m) => m.id === next.id);
              if (editor.existing && !current)
                throw new Error("這項藥物已移除，請返回藥物清單。");
              if (
                current &&
                JSON.stringify(current) !== JSON.stringify(editor.med)
              )
                throw new Error("藥物資料剛有更新，請返回詳情後重新編輯。");
              return editor.mode === "create" || editor.mode === "basic"
                ? saveMedicationBasics(p, next, editor.mode === "create" ? "create" : "edit")
                : saveMedication(p, next);
            },
            editor.mode === "inventory" ? "已儲存藥量與補充設定。" : "已儲存藥物資料。",
          );
          if (ok) { setUpdatedId(next.id!); setScreen({ kind: "details", id: next.id! }); }
          return ok;
        }}
        onRefill={
          editor.mode === "inventory" && editor.med.id
            ? async (next, amount) => {
                const ok = await run((p) => {
                  const current = p.medications.find((m) => m.id === next.id);
                  if (!current)
                    throw new Error("這項藥物已移除，請返回藥物清單。");
                  if (JSON.stringify(current) !== JSON.stringify(editor.med))
                    throw new Error("藥物資料剛有更新，請返回詳情後重新編輯。");
                  return refillMedication(
                    saveMedication(p, next),
                    next.id!,
                    amount,
                  );
                }, "已儲存藥量設定並加入新包裝。");
                if (ok) setScreen({ kind: "details", id: editor.med.id! });
                return ok;
              }
            : undefined
        }
        saveError={error}
        busy={busy}
      />
    );
  return (
    <div
      className={`care-page medication-workflow${screen.kind === "overview" ? " med-overview-page" : screen.kind === "details" ? " med-details-page" : ""}`}
    >
      {screen.kind === "details" && med ? (
        <>
          <MedicationPageHeader
            title="藥物詳情"
            avoidVoice
            description="管理這款藥物的服用安排與相關資料。"
            onBack={() => {
              setError("");
              setScreen({ kind: "overview" });
            }}
            headingRef={title}
          />
          {error && (
            <p className="care-warning" role="alert">
              {error}
            </p>
          )}
          <section className={`med-detail-hero${updatedId === med.id ? " ui-local-update" : ""}`} data-voice-avoid>
            <div className="med-detail-identity">
              <MedicationIconBadge tone="peach">
                <PillIcon width={28} height={28} />
              </MedicationIconBadge>
              <div>
                <p className="care-eyebrow">已登記藥物</p>
                <h2>{med.name}</h2>
                <p>{med.dosage || "未填寫規格／劑量說明"}</p>
              </div>
            </div>
            {med.usage && (
              <p className="med-detail-advice">
                <Clock3 size={21} strokeWidth={1.8} aria-hidden="true" />
                <span>{med.usage}</span>
              </p>
            )}
            <div className="med-chip-row">
              <MedicationStatusChip
                tone={
                  !med.schedule
                    ? "neutral"
                    : med.schedule.frequency === "asNeeded"
                      ? "neutral"
                      : med.reminderEnabled
                        ? "active"
                        : "paused"
                }
              >
                {medicationReminderLabel(med, controls.access, controls.enabled)}
              </MedicationStatusChip>
              {med.schedule && (
                <MedicationStatusChip>
                  {scheduleLabel(med)}
                </MedicationStatusChip>
              )}
              {med.inventory && (
                <MedicationStatusChip
                  tone={lowStock(med) ? "warning" : "neutral"}
                >
                  剩餘 {med.inventory.quantity} {med.schedule?.unit}
                </MedicationStatusChip>
              )}
            </div>
          {updatedId === med.id && <SavedFeedback message="藥物資料已儲存"/>}
          </section>

          <section
            className="med-module-list"
            aria-label="藥物設定"
            data-voice-avoid
          >
            <MedicationModuleLink
              tone="peach"
              icon={<PillIcon width={25} height={25} />}
              title="藥物資料"
              summary={med.usage || med.dosage || "名稱、規格及服用備註"}
              onClick={() =>
                setScreen({
                  kind: "editor",
                  med,
                  initialStep: 0,
                  mode: "basic",
                  existing: true,
                })
              }
            />
            <MedicationModuleLink
              tone="sage"
              icon={<ListIcon width={25} height={25} />}
              title="藥量與補充"
              summary={
                med.inventory
                  ? `剩餘 ${med.inventory.quantity} ${med.schedule?.unit || ""}${lowStock(med) ? "，請安排補充" : ""}`
                  : med.schedule
                    ? "尚未設定庫存（選填）"
                    : "請先設定服藥時間表及用量單位"
              }
              onClick={() => {
                setError("");
                if (!med.schedule || !med.schedule.unit?.trim()) {
                  setError("請先設定服藥時間表及用量單位，再記錄藥量。");
                  return;
                }
                setScreen({
                  kind: "editor",
                  med,
                  initialStep: 2,
                  mode: "inventory",
                  existing: true,
                });
              }}
            />
            <MedicationModuleLink
              tone="lilac"
              icon={<ClockIcon width={25} height={25} />}
              title={med.schedule ? "編輯服藥提醒" : "設定服藥提醒（選填）"}
              actionLabel={med.schedule ? "編輯" : "設定"}
              summary={med.schedule ? scheduleLabel(med) : "按需要設定服藥時間及用量"}
              onClick={() =>
                setScreen({
                  kind: "editor",
                  med,
                  initialStep: 1,
                  mode: "schedule",
                  existing: true,
                })
              }
            />
          </section>

          {med.schedule && med.schedule.frequency !== "asNeeded" && med.reminderEnabled &&
            (controls.access !== "granted" || !controls.enabled) && (
              <section className="care-card med-notification-note" aria-label="系統通知狀態" data-voice-avoid>
                <p>系統通知未開啟，您仍可在 App 內查看服藥安排。</p>
                {controls.access === "denied" && <p className="care-muted">如需系統通知，請到瀏覽器或裝置設定更改通知權限。</p>}
                {controls.access === "unsupported" && <p className="care-muted">此瀏覽器不支援系統通知。</p>}
                {controls.error && <p className="care-warning" role="alert">{controls.error}</p>}
                {(controls.access==='default'||controls.access==='granted')&&<button type="button" className="care-secondary" disabled={busy} onClick={()=>void (async()=>{
                  if(busy)return;setBusy(true);
                  const permission=await controls.enable();setBusy(false);
                  if(permission==='granted')onToast(import.meta.env?.VITE_CLOUD_MODE==='true'?'通知設定已儲存，同步後生效。':'系統通知已開啟。');
                })()}>{busy?'正在開啟…':controls.error?'重試':'開啟通知'}</button>}
              </section>
            )}

          {account?.syncFeedback}
          {lowStock(med) && (
            <p className="care-warning">藥量已達提醒數量，請安排補充。</p>
          )}
          <section className="med-secondary-zone" aria-label="其他藥物操作">
            {med.schedule && med.schedule.frequency !== "asNeeded" && (
              <button
                className="care-secondary med-pause-button"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    const resuming = !med.reminderEnabled;
                    const ok = await run(
                      (p) => {
                        const current = reconcileIntakes(p);
                        return reconcileIntakes({
                          ...current,
                          medications: current.medications.map((m) =>
                            m.id === med.id
                              ? { ...m, reminderEnabled: !m.reminderEnabled }
                              : m,
                          ),
                        });
                      },
                      med.reminderEnabled ? "已暫停提醒。" : "已恢復提醒。",
                    );
                    if (
                      ok &&
                      resuming &&
                      shouldOfferMedicationNotificationPrimer({
                        action: "resume",
                        reminderEnabled: true,
                        access: controls.access,
                        enabled: controls.enabled,
                      })
                    )
                      setScreen({ kind: "notification-primer", id: med.id! });
                  })()
                }
              >
                <span className="med-action-label" data-voice-avoid>
                  <ClockIcon width={21} height={21} aria-hidden="true" />
                  {med.reminderEnabled ? "暫停提醒" : "恢復提醒"}
                </span>
              </button>
            )}
            <button className="care-danger" onClick={() => setDeleting(true)}>
              <span className="med-action-label" data-voice-avoid>
                <TrashIcon width={21} height={21} aria-hidden="true" />
                刪除藥物
              </span>
            </button>
          </section>
          <ConfirmDialog
            open={deleting}
            title="刪除這項藥物？"
            message="將移除藥物及往後提醒，已有服藥紀錄會保留。"
            onCancel={() => setDeleting(false)}
            onConfirm={() =>
              void (async () => {
                if (
                  await run((p) => {
                    const current = reconcileIntakes(p);
                    return reconcileIntakes({
                      ...current,
                      medications: current.medications.filter(
                        (m) => m.id !== med.id,
                      ),
                    });
                  }, "已刪除藥物。")
                ) {
                  setDeleting(false);
                  setScreen({ kind: "overview" });
                }
              })()
            }
          />
        </>
      ) : screen.kind === "history" ? (
        <>
          <MedicationPageHeader
            title="服藥紀錄"
            description="查看過往的服藥確認狀態。"
            onBack={() => setScreen({ kind: "overview" })}
            headingRef={title}
          />
          {error && (
            <p className="care-warning" role="alert">
              {error}
            </p>
          )}
          <section className="care-card med-history-card">
            <div className="med-section-heading">
              <MedicationIconBadge tone="blue">
                <ListIcon width={24} height={24} />
              </MedicationIconBadge>
              <div>
                <h2>歷史紀錄</h2>
                <p className="care-muted">
                  「未確認」表示尚未在 App 記錄，不代表您一定沒有服藥。
                </p>
              </div>
            </div>
            {!profile.medicationIntakes?.length && (
              <p className="med-empty-copy">尚未有服藥紀錄。</p>
            )}
            {[...(profile.medicationIntakes || [])]
              .sort(
                (a, b) =>
                  b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
              )
              .map((e) => (
                <div className="med-history" key={e.id}>
                  <p className="med-history-date">{e.date}</p>
                  <IntakeCard
                    entry={e}
                    now={controls.now}
                    onConfirm={take}
                    onUndo={undo}
                    busy={busy}
                    allowConfirm={e.date === localDate(controls.now)}
                  />
                </div>
              ))}
          </section>
        </>
      ) : (
        <>
          <MedicationPageHeader
            title="我的藥物"
            description="記錄正在使用的藥物，按需要設定服藥提醒。"
            onBack={onBack}
            headingRef={title}
          />
          {error && (
            <p className="care-warning" role="alert">
              {error}
            </p>
          )}
          <button
            className="med-add-button"
            data-voice-avoid
            onClick={() => {
              setError("");
              setScreen({
                kind: "editor",
                med: freshMedication(),
                initialStep: 0,
                mode: "create",
              });
            }}
          >
            <span className="med-add-symbol" aria-hidden="true">
              <Plus size={30} strokeWidth={1.8} />
            </span>
            <span>新增藥物</span>
            <ChevronRight
              className="med-add-chevron"
              size={26}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>

          {initialIntake && (
            <section className="care-card med-highlight-card">
              <div className="med-section-heading">
                <MedicationIconBadge tone="peach">
                  <PillIcon width={24} height={24} />
                </MedicationIconBadge>
                <div>
                  <p className="care-eyebrow">從通知開啟</p>
                  <h2>這次服藥提醒</h2>
                </div>
              </div>
              {entry ? (
                <>
                  <p className="care-muted">{entry.date}</p>
                  <IntakeCard
                    entry={entry}
                    now={controls.now}
                    onConfirm={take}
                    onUndo={undo}
                    busy={busy}
                    allowConfirm={entry.date === localDate(controls.now)}
                  />
                  {entry.date !== localDate(controls.now) && (
                    <p className="care-muted">
                      這是過往安排，請查看今天的時間表。
                    </p>
                  )}
                </>
              ) : (
                <p>這項安排已更新或移除，請查看今天的時間表。</p>
              )}
            </section>
          )}

          <section className="med-list-section">
            <div className="med-list-heading" data-voice-avoid>
              <div>
                <h2>
                  我的藥物
                  <span> · {profile.medications.length} 項</span>
                </h2>
              </div>
              {profile.medications.length > 1 ? (
                <button
                  type="button"
                  className="med-list-toggle"
                  data-voice-avoid
                  aria-expanded={medicationsExpanded}
                  aria-controls="medication-overview-list"
                  onClick={() => setMedicationsExpanded((value) => !value)}
                >
                  <span>{medicationsExpanded ? "收起" : "展開"}</span>
                  <ChevronDownIcon width={19} height={19} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {!profile.medications.length && (
              <section className="care-card med-empty-card" data-voice-avoid>
                <MedicationIconBadge tone="peach">
                  <PillIcon width={26} height={26} />
                </MedicationIconBadge>
                <div>
                  <h3>登記正在使用的藥物</h3>
                  <p className="care-muted">
                    先填寫藥名即可儲存，服藥提醒可稍後設定。
                  </p>
                </div>
              </section>
            )}
            <div
              id="medication-overview-list"
              className="medication-card-list"
              data-collapsed={
                profile.medications.length > 1 && !medicationsExpanded
              }
              data-multiple={profile.medications.length > 1}
            >
              {(medicationsExpanded
                ? profile.medications
                : profile.medications.slice(0, 1)
              ).map((m, index) => (
                <button
                  key={m.id}
                  className="care-medication-card med-overview-card"
                  onClick={() => setScreen({ kind: "details", id: m.id! })}
                >
                  <MedicationIconBadge tone="peach">
                    <Pill size={30} strokeWidth={1.65} />
                  </MedicationIconBadge>
                  <span className="med-overview-copy" data-voice-avoid>
                    <strong>{m.name}</strong>
                    <span>
                      {m.schedule ? scheduleLabel(m) : m.usage || m.dosage || "已登記藥物資料"}
                    </span>
                    <span className="med-chip-row">
                      <MedicationStatusChip
                        tone={
                          !m.schedule
                            ? "neutral"
                            : m.reminderEnabled
                              ? "active"
                              : "paused"
                        }
                      >
                        {medicationReminderLabel(m, controls.access, controls.enabled)}
                      </MedicationStatusChip>
                      {m.inventory && (
                        <MedicationStatusChip
                          tone={lowStock(m) ? "warning" : "neutral"}
                        >
                          剩餘 {m.inventory.quantity} {m.schedule?.unit}
                        </MedicationStatusChip>
                      )}
                    </span>
                    {index === 0 &&
                      profile.medications.length > 1 &&
                      !medicationsExpanded && (
                        <span className="med-overview-more">
                          另有 {profile.medications.length - 1} 項藥物，展開查看
                        </span>
                      )}
                  </span>
                  <span className="med-card-destination" data-voice-avoid>
                    <span>查看詳情</span>
                    <ChevronRightIcon
                      width={22}
                      height={22}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              ))}
            </div>
          </section>
          {today.length > 0 && (
            <section className="care-card med-today-card">
              <div className="med-card-heading-row">
                <div className="med-section-heading" data-voice-avoid>
                  <MedicationIconBadge tone="blue">
                    <Clock3 size={29} strokeWidth={1.9} />
                  </MedicationIconBadge>
                  <div>
                    <h2>今日服藥</h2>
                    <p className="care-muted">
                      {localDate(controls.now)} ·{" "}
                      {today.filter((e) => e.status === "taken").length}／
                      {today.length} 項已確認
                    </p>
                  </div>
                </div>
              </div>
              <div className="med-intake-list" data-voice-avoid>
                {today.map((e) => (
                  <IntakeCard
                    key={e.id}
                    entry={e}
                    now={controls.now}
                    onConfirm={take}
                    onUndo={undo}
                    busy={busy}
                  />
                ))}
              </div>
              <button
                className="care-text-button med-inline-link"
                data-voice-avoid
                onClick={() => setScreen({ kind: "history" })}
              >
                服藥紀錄{" "}
                <ChevronRight size={23} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </section>
          )}
          {!today.length && !!profile.medicationIntakes?.length && (
            <button className="care-text-button med-inline-link" data-voice-avoid onClick={() => setScreen({ kind: "history" })}>
              服藥紀錄 <ChevronRight size={23} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
          <LowStockNotices profile={profile} />
        </>
      )}
    </div>
  );
  };
  return <div className="med-page-stack"><AnimatePresence initial={false} mode="popLayout">
    <PageSurface key={screenKey(screen)} direction={direction}>{renderScreen()}</PageSurface>
  </AnimatePresence></div>;
}

function MedicationEditor(props: {
  initial: Medication;
  initialStep: number;
  mode: EditorMode;
  onBack: () => void;
  onSave: (med: Medication) => Promise<boolean>;
  onRefill?: (med: Medication, amount: number) => Promise<boolean>;
  saveError: string;
  busy: boolean;
}) {
  return props.mode === "basic" || props.mode === "create"
    ? <MedicationBasicEditor mode={props.mode === "create" ? "create" : "edit"} initial={props.initial} busy={props.busy} saveError={props.saveError} onBack={props.onBack} onSave={props.onSave} />
    : <MedicationInventoryEditor initial={props.initial} onBack={props.onBack} onSave={props.onSave} onRefill={props.onRefill} saveError={props.saveError} busy={props.busy} />;
}

// 只服務「藥量與補充」的庫存編輯；基本資料、服藥時間表及新增流程已由新版組件接管。
function MedicationInventoryEditor({
  initial,
  onBack,
  onSave,
  onRefill,
  saveError,
  busy,
}: {
  initial: Medication;
  onBack: () => void;
  onSave: (med: Medication) => Promise<boolean>;
  onRefill?: (med: Medication, amount: number) => Promise<boolean>;
  saveError: string;
  busy: boolean;
}) {
  const [med, setMed] = useState<Medication>(() => ({
    ...initial,
    schedule: initial.schedule
      ? {
          ...initial.schedule,
          slots: initial.schedule.slots.map((s) => ({ ...s })),
        }
      : {
          frequency: "daily",
          weekdays: [],
          startDate: localDate(),
          unit: "",
          slots: [{ id: newId(), time: "", amount: NaN }],
        },
  }));
  const [stock, setStock] = useState(
    initial.inventory ? String(initial.inventory.quantity) : "",
  );
  const [threshold, setThreshold] = useState(
    initial.inventory?.threshold != null
      ? String(initial.inventory.threshold)
      : "",
  );
  const [packageAmount, setPackageAmount] = useState("");
  const [error, setError] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const initialInventorySnapshot = useRef({
    enabled: !!initial.inventory,
    refillEnabled: !!initial.inventory?.refillEnabled,
    stock: initial.inventory ? String(initial.inventory.quantity) : "",
    threshold:
      initial.inventory?.refillEnabled && initial.inventory.threshold != null
        ? String(initial.inventory.threshold)
        : "",
  }).current;
  const currentInventorySnapshot = {
    enabled: !!med.inventory,
    refillEnabled: !!med.inventory?.refillEnabled,
    stock: med.inventory ? stock : "",
    threshold: med.inventory?.refillEnabled ? threshold : "",
  };
  const dirty =
    currentInventorySnapshot.enabled !== initialInventorySnapshot.enabled ||
    currentInventorySnapshot.refillEnabled !==
      initialInventorySnapshot.refillEnabled ||
    currentInventorySnapshot.stock !== initialInventorySnapshot.stock ||
    currentInventorySnapshot.threshold !== initialInventorySnapshot.threshold ||
    packageAmount.trim() !== "";
  const requestBack = () => {
    if (dirty) setLeaveOpen(true);
    else onBack();
  };
  useLayoutEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
    title.current?.focus({ preventScroll: true });
  }, []);
  const s = med.schedule!;
  const buildMedication = () => {
    const next: Medication = {
      ...med,
      name: med.name.trim(),
      reminderEnabled: med.reminderEnabled ?? true,
    };
    if (next.inventory) {
      next.inventory = {
        ...next.inventory,
        quantity: stock.trim() ? Number(stock) : NaN,
        threshold: threshold.trim() ? Number(threshold) : undefined,
      };
      if (
        initial.inventory?.quantity !== next.inventory.quantity ||
        initial.schedule?.unit !== next.schedule?.unit
      )
        next.inventory.revision = newId();
    }
    return next;
  };
  const setInventoryEnabled = (enabled: boolean) => {
    setMed({
      ...med,
      inventory: enabled
        ? med.inventory || {
            quantity: 0,
            refillEnabled: false,
            revision: newId(),
          }
        : undefined,
    });
    if (enabled && !stock) setStock("0");
  };
  return (
    <div className="care-page medication-workflow medication-editor-page">
      <MedicationPageHeader
        title="藥量與補充"
        onBack={requestBack}
        headingRef={title}
      />
      <form
        className="med-editor"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const next = buildMedication();
          const problem = validateMedication(next);
          if (problem) {
            setError(problem);
            return;
          }
          setError("");
          await onSave(next);
        }}
      >
        <div className="med-confirm-editor">
          <section className="med-inventory-hero">
            <MedicationIconBadge tone="sage">
              <ListIcon width={29} height={29} />
            </MedicationIconBadge>
            <p>現有藥量</p>
            <strong>
              {med.inventory ? stock || "0" : "未啟用"}
              {med.inventory && <small>{s.unit}</small>}
            </strong>
            <span>{med.name}</span>
          </section>
          <section className="med-form-card med-inventory-card">
            <div className="med-section-label">
              <ListIcon width={24} height={24} aria-hidden="true" />
              <div>
                <h3>庫存設定</h3>
                <p>登記現有數量，並可在接近用完時顯示補藥提示。</p>
              </div>
            </div>
            <label className="med-toggle-row">
              <span>
                <strong>記錄藥量庫存</strong>
                <small>服藥確認後會按實際用量扣減。</small>
              </span>
              <input
                type="checkbox"
                checked={!!med.inventory}
                onChange={(e) => setInventoryEnabled(e.target.checked)}
              />
            </label>
            {med.inventory && (
              <div className="med-inventory-fields">
                <label className="care-field">
                  現有藥量（{s.unit || "請先填寫單位"}）
                  <input
                    inputMode="decimal"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </label>
                <label className="med-toggle-row">
                  <span>
                    <strong>藥量不足時提醒補充</strong>
                    <small>達到您設定的數量時顯示低庫存提示。</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={med.inventory.refillEnabled}
                    onChange={(e) =>
                      setMed({
                        ...med,
                        inventory: {
                          ...med.inventory!,
                          refillEnabled: e.target.checked,
                        },
                      })
                    }
                  />
                </label>
                {med.inventory.refillEnabled && (
                  <label className="care-field">
                    剩餘多少時提醒（{s.unit}）
                    <input
                      inputMode="decimal"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                    />
                  </label>
                )}
              </div>
            )}
          </section>
          {med.inventory && onRefill && (
            <section className="med-form-card med-package-card">
              <div>
                <h3>加入新包裝</h3>
                <p>填寫今次補充的實際數量，儲存後會加到現有藥量。</p>
              </div>
              <label className="care-field">
                補充數量（{s.unit}）
                <input
                  inputMode="decimal"
                  value={packageAmount}
                  onChange={(e) => setPackageAmount(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="med-package-button"
                disabled={busy}
                onClick={async () => {
                  const amount = Number(packageAmount);
                  if (
                    !packageAmount.trim() ||
                    !Number.isFinite(amount) ||
                    amount <= 0
                  ) {
                    setError("請填寫大於 0 的補充數量。");
                    return;
                  }
                  const next = buildMedication();
                  const problem = validateMedication(next);
                  if (problem) {
                    setError(problem);
                    return;
                  }
                  setError("");
                  await onRefill?.(next, amount);
                }}
              >
                <PlusIcon width={22} height={22} aria-hidden="true" />
                <span>加入新包裝</span>
              </button>
              <p className="care-muted">
                如藥量只是登記錯誤，請直接修改上方現有藥量。
              </p>
            </section>
          )}
        </div>
        {(error || saveError) && (
          <p className="care-warning" role="alert">
            {error || saveError}
          </p>
        )}
        <div className="med-editor-actions">
          <button className="med-save-button" disabled={busy}>
            儲存藥量設定
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={leaveOpen}
        title="放棄未儲存的變更？"
        message="離開後，這次修改的藥量與補充設定不會保留。"
        confirmText="放棄變更"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setLeaveOpen(false);
          onBack();
        }}
      />
    </div>
  );
}