import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import type { Medication } from "../data/types";
import {
  activePattern,
  isReminderPage,
  resizeDailyCount,
  compileMedicationDraft,
  createMedicationDraft,
  hasDoseValues,
  medicationUnits,
  nextWizardPage,
  unitLabel,
  validateWizardPage,
  type AdvancedPattern,
  type FrequencyChoice,
  type MedicationDraft,
  type MedicationUnitCode,
  type MedicationWizardPage,
} from "../data/medicationWizard";
import { validateMedication, weekdayLabels, MAX_REMINDER_SLOTS } from "../data/medication";
import {
  CompactReminderRows,
  CycleStartFields,
  IntervalReminderFields,
  ScheduleDates,
} from "./MedicationScheduleFields";
import { ConfirmDialog } from "./ConfirmDialog";
import {useAppViewport} from '../hooks/useAppViewport';
import {inputViewportAttributes,inputViewportStyle} from './inputViewportSurface';
import {lockAppInteraction} from './appInteractionLock';
import { MedicationNamePicker } from "./MedicationNamePicker";
import {
  BackIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  ListIcon,
  PillIcon,
} from "./icons";

const PAGE_STAGE: Record<MedicationWizardPage, number> = {
  details: 0,
  frequency: 1,
  advanced: 1,
  reminders: 2,
  intervalReminders: 2,
  multipleReminders: 2,
  weeklyReminders: 2,
  cycleStart: 2,
  cycleReminders: 2,
  inventory: 3,
};

const copyDraft = (draft: MedicationDraft): MedicationDraft =>
  structuredClone(draft);

export function UnitWheelSheet({
  open,
  value,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  value: MedicationUnitCode | "";
  onCancel: () => void;
  onConfirm: (value: MedicationUnitCode) => void;
}) {
  const [candidate, setCandidate] = useState<MedicationUnitCode>(
    value || "pill",
  );
  const sheet = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pendingScroll=useRef<number|null>(null);
  const itemHeight = 58;
  const viewport=useAppViewport(open);

  useLayoutEffect(()=>open ? lockAppInteraction() : undefined,[open]);

  useLayoutEffect(() => {
    if (!open) return;
    const next = value || "pill";
    setCandidate(next);
    const index = medicationUnits.findIndex((item) => item.code === next);
    const initialScroll=Math.max(0,index)*itemHeight;
    pendingScroll.current=initialScroll;
    const frame=requestAnimationFrame(() => {
      if (list.current && pendingScroll.current===initialScroll)
        list.current.scrollTop = initialScroll;
      sheet.current?.focus({preventScroll:true});
    });
    return ()=>{cancelAnimationFrame(frame);pendingScroll.current=null;};
  }, [open, value]);

  const choose=(code:MedicationUnitCode)=>{
    const index=medicationUnits.findIndex(unit=>unit.code===code);
    pendingScroll.current=index*itemHeight;
    setCandidate(code);
    list.current?.focus({preventScroll:true});
    list.current?.scrollTo({top:index*itemHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {event.preventDefault();event.stopPropagation();onCancel();}
      if (event.key !== "Tab" || !sheet.current) return;
      const controls = Array.from(
        sheet.current.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]):not(:disabled),[tabindex="0"]'),
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus({preventScroll:true});
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus({preventScroll:true});
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return createPortal(
    <div {...inputViewportAttributes(viewport)} style={inputViewportStyle(viewport,true)} className="input-viewport-surface med-unit-overlay" onMouseDown={onCancel}>
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="med-unit-title"
        className="med-unit-sheet"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="med-unit-sheet-header">
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <h2 id="med-unit-title">選擇用量單位</h2>
          <button type="button" onClick={() => onConfirm(candidate)}>
            完成
          </button>
        </div>
        <p>滾動選擇，按「完成」後才會套用。</p>
        <div className="med-unit-wheel-frame">
          <div className="med-unit-wheel-highlight" aria-hidden="true" />
          <div
            ref={list}
            role="listbox"
            aria-label="用量單位"
            aria-activedescendant={`med-unit-${candidate}`}
            tabIndex={0}
            className="med-unit-wheel outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
            onPointerDown={()=>{pendingScroll.current=null;}}
            onWheel={()=>{pendingScroll.current=null;}}
            onScroll={(event) => {
              // A clicked option remains selected while its wheel moves into place.
              if(pendingScroll.current!==null){
                if(Math.abs(event.currentTarget.scrollTop-pendingScroll.current)>1)return;
                pendingScroll.current=null;
              }
              const index = Math.max(
                0,
                Math.min(
                  medicationUnits.length - 1,
                  Math.round(event.currentTarget.scrollTop / itemHeight),
                ),
              );
              setCandidate(medicationUnits[index].code);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              const current = medicationUnits.findIndex(
                (item) => item.code === candidate,
              );
              const index = Math.max(
                0,
                Math.min(
                  medicationUnits.length - 1,
                  current + (event.key === "ArrowDown" ? 1 : -1),
                ),
              );
              choose(medicationUnits[index].code);
            }}
          >
            <div className="med-unit-wheel-spacer" aria-hidden="true" />
            {medicationUnits.map((item) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={candidate === item.code}
                id={`med-unit-${item.code}`}
                key={item.code}
                className="med-unit-wheel-item"
                onClick={() => choose(item.code)}
              >
                {item.label}
              </button>
            ))}
            <div className="med-unit-wheel-spacer" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>,
    document.getElementById('device-overlay-layer') ?? document.body,
  );
}

function StepProgress({
  draft,
  page,
}: {
  draft: MedicationDraft;
  page: MedicationWizardPage;
}) {
  const current = PAGE_STAGE[page];
  const labels = [
    "藥物資料",
    "服用規律",
    draft.frequencyChoice === "asNeeded" ? "無需設定" : "提醒時間",
    "庫存",
  ];
  return (
    <ol className="med-wizard-progress" aria-label="新增藥物進度" data-voice-avoid={(isReminderPage(page) || page === "cycleStart") || undefined}>
      {labels.map((label, index) => (
        <li
          key={label}
          className={
            index < current
              ? "is-complete"
              : index === current
                ? "is-current"
                : ""
          }
          aria-current={index === current ? "step" : undefined}
        >
          <span>
            {index < current ? <CheckIcon width={17} height={17} /> : index + 1}
          </span>
          <small>{label}</small>
        </li>
      ))}
    </ol>
  );
}

function ChoiceCard({
  selected,
  title,
  description,
  onClick,
  children,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`med-choice-card ${selected ? "is-selected" : ""}`}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        className="med-choice-trigger"
        onClick={onClick}
      >
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className="med-radio-mark" aria-hidden="true">
          {selected && <CheckIcon width={18} height={18} />}
        </span>
      </button>
      {selected && children && (
        <div className="med-choice-details">{children}</div>
      )}
    </div>
  );
}

const FREQUENCIES: Array<{
  id: FrequencyChoice;
  title: string;
  description: string;
}> = [
  {
    id: "dailyOnce",
    title: "每日 1 次",
    description: "每天使用同一個提醒時間",
  },
  { id: "dailyTwice", title: "每日 2 次", description: "每天設定兩個不同時間" },
  { id: "asNeeded", title: "按需要服用", description: "不建立定時提醒" },
  {
    id: "more",
    title: "更多方式",
    description: "間隔、每日多次、指定星期或循環服用",
  },
];

const ADVANCED: Array<{
  id: AdvancedPattern;
  title: string;
  description: string;
}> = [
  {
    id: "intervalHours",
    title: "每隔一段時間",
    description: "每隔數小時，或每隔數日",
  },
  { id: "multipleDaily", title: "每日多次", description: "每日 2 至 24 次" },
  { id: "weekly", title: "指定星期", description: "例如星期一、三、五" },
  { id: "cycle", title: "循環服用", description: "設定服用日數及暫停日數" },
];

export function MedicationWizard({
  initial,
  mode,
  busy,
  saveError,
  onBack,
  onSave,
}: {
  initial: Medication;
  mode: "create" | "schedule";
  busy: boolean;
  saveError: string;
  onBack: () => void;
  onSave: (medication: Medication) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(() => createMedicationDraft(initial));
  const [page, setPage] = useState<MedicationWizardPage>(
    mode === "create" ? "details" : "frequency",
  );
  const [history, setHistory] = useState<MedicationWizardPage[]>([]);
  const [error, setError] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const unitTrigger = useRef<HTMLButtonElement>(null);
  const initialSnapshot = useRef(JSON.stringify(draft)).current;
  const dirty = JSON.stringify(draft) !== initialSnapshot;
  const stage = PAGE_STAGE[page];
  const pattern = activePattern(draft);
  const unit = unitLabel(draft);

  useLayoutEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [page]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const patch = (change: (next: MedicationDraft) => void) => {
    setDraft((current) => {
      const next = copyDraft(current);
      change(next);
      return next;
    });
    setError("");
  };

  const requestExit = () => {
    if (dirty) setLeaveOpen(true);
    else onBack();
  };

  const goBack = () => {
    if (history.length) {
      const previous = history[history.length - 1];
      setHistory(history.slice(0, -1));
      setError("");
      setPage(previous);
      return;
    }
    requestExit();
  };

  const save = async () => {
    if (submitting || busy) return;
    const inventoryError = mode === "schedule"
      ? validateMedication(compileMedicationDraft(draft, mode))
      : validateWizardPage(draft, "inventory");
    if (inventoryError) {
      setError(inventoryError);
      return;
    }
    setSubmitting(true);
    try {
      await onSave(compileMedicationDraft(draft, mode));
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = async () => {
    const problem = validateWizardPage(draft, page);
    if (problem) {
      setError(problem);
      return;
    }
    if (
      mode === "schedule" &&
      (isReminderPage(page) ||
        (page === "frequency" && draft.frequencyChoice === "asNeeded"))
    ) {
      await save();
      return;
    }
    const next = nextWizardPage(draft, page);
    if (!next) {
      await save();
      return;
    }
    if (next === "multipleReminders")
      patch((value) => {
        value.multipleDaily.visited = true;
      });
    setHistory((items) => [...items, page]);
    setPage(next);
    setError("");
  };

  const applyUnit = (nextCode: MedicationUnitCode) => {
    const changed = !!draft.unitCode && draft.unitCode !== nextCode;
    patch((next) => {
      next.unitCode = nextCode;
      if (nextCode !== "custom") next.customUnit = "";
      if (changed && hasDoseValues(next)) next.doseUnitReviewRequired = true;
      if (
        changed &&
        (next.inventory.quantity.trim() || next.inventory.threshold.trim())
      )
        next.inventoryUnitReviewRequired = true;
    });
    setUnitOpen(false);
    requestAnimationFrame(() => unitTrigger.current?.focus({preventScroll:true}));
  };

  const title =
    page === "details"
      ? "藥物資料"
      : page === "frequency"
        ? "服用規律"
        : page === "advanced"
          ? "更多方式"
          : page === "cycleStart"
            ? "週期開始日期"
            : isReminderPage(page)
              ? "提醒時間"
              : "庫存設定";
  const nextLabel =
    mode === "schedule" &&
    (isReminderPage(page) ||
      (page === "frequency" && draft.frequencyChoice === "asNeeded"))
      ? "儲存時間表"
      : page === "inventory"
        ? "儲存藥物"
        : "下一步";

  const activeTimed =
    pattern === "dailyOnce"
      ? draft.dailyOnce
      : pattern === "dailyTwice"
        ? draft.dailyTwice
        : pattern === "multipleDaily"
          ? draft.multipleDaily
          : pattern === "weekly"
            ? draft.weekly
            : pattern === "intervalDays"
              ? draft.intervalDays
              : pattern === "cycle"
                ? draft.cycle
                : null;

  const showUnitFields = mode === "schedule" && !initial.schedule?.unit?.trim();
  const unitError = page === "frequency" && showUnitFields &&
    (!draft.unitCode || (draft.unitCode === "custom" && !draft.customUnit.trim()));

  const unitFields = (
    <>
            <div className="care-field">
              <span>用量單位</span>
              <button
                ref={unitTrigger}
                type="button"
                className="med-unit-trigger"
                aria-haspopup="dialog"
                aria-expanded={unitOpen}
                onClick={() => setUnitOpen(true)}
              >
                <span>{unit || "選擇單位"}</span>
                <ChevronDownIcon width={21} height={21} />
              </button>
            </div>
            {draft.unitCode === "custom" && (
              <label className="care-field">
                自訂用量單位
                <input
                  value={draft.customUnit}
                  onChange={(event) => {
                    const changed =
                      !!draft.customUnit &&
                      draft.customUnit !== event.target.value;
                    patch((next) => {
                      next.customUnit = event.target.value;
                      if (changed && hasDoseValues(next))
                        next.doseUnitReviewRequired = true;
                      if (
                        changed &&
                        (next.inventory.quantity || next.inventory.threshold)
                      )
                        next.inventoryUnitReviewRequired = true;
                    });
                  }}
                  placeholder="例如：樽"
                />
              </label>
            )}
    </>
  );

  return (
    <div
      className={`care-page medication-workflow med-wizard-page ${(isReminderPage(page) || page === "cycleStart") ? "med-advanced-page" : ""}`}
    >
      <header className="med-wizard-header">
        <button type="button" className="med-back-button" onClick={goBack} data-voice-avoid>
          <BackIcon width={24} height={24} />
          <span>返回</span>
        </button>
        <div data-voice-avoid>
          <p>{mode === "create" ? "新增藥物" : `編輯 ${draft.name}`}</p>
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
        </div>
      </header>
      {mode === "create" && <StepProgress draft={draft} page={page} />}
      {mode === "create" && <section className={`med-wizard-context is-stage-${stage}`} data-voice-avoid={(isReminderPage(page) || page === "cycleStart") || undefined}>
        <span aria-hidden="true">
          {stage === 0 ? (
            <PillIcon />
          ) : stage === 1 ? (
            <CalendarIcon />
          ) : stage === 2 ? (
            <ClockIcon />
          ) : (
            <ListIcon />
          )}
        </span>
        <div>
          <strong>{draft.name || "尚未命名的藥物"}</strong>
          <small>{unit ? `用量單位：${unit}` : "先填寫名稱和用量單位"}</small>
        </div>
      </section>}

      <div className="med-wizard-content">
        {page === "details" && (
          <section className="med-wizard-card">
            <MedicationNamePicker
              value={draft.name}
              onConfirm={(name) => patch((next) => { next.name = name; })}
            />
            {unitFields}
          </section>
        )}

        {page === "frequency" && (
          <section>
            {showUnitFields && (
              <section className="med-wizard-card med-schedule-unit-fields" data-voice-avoid>
                {unitFields}
                {error && unitError && (
                  <p className="med-field-error" role="alert">{error}</p>
                )}
              </section>
            )}
            <div
              className="med-choice-list"
              role="radiogroup"
              aria-label="服用規律"
            >
              {FREQUENCIES.map((option) => (
                <ChoiceCard
                  key={option.id}
                  selected={draft.frequencyChoice === option.id}
                  title={option.title}
                  description={option.description}
                  onClick={() =>
                    patch((next) => {
                      next.frequencyChoice = option.id;
                    })
                  }
                />
              ))}
            </div>
          </section>
        )}

        {page === "advanced" && (
          <section>
            <div className="med-wizard-question med-wizard-question-standalone">
              <CalendarIcon width={24} height={24} />
              <div>
                <h2>哪一種方式最符合您的安排？</h2>
                <p>輸入範圍只用作建立排程，不代表用藥建議。</p>
              </div>
            </div>
            <div
              className="med-choice-list"
              role="radiogroup"
              aria-label="更多服用方式"
            >
              {ADVANCED.map((option) => {
                const intervalSelected =
                  option.id === "intervalHours" &&
                  (draft.advancedPattern === "intervalHours" ||
                    draft.advancedPattern === "intervalDays");
                const selected =
                  intervalSelected || draft.advancedPattern === option.id;
                return (
                  <ChoiceCard
                    key={option.id}
                    selected={selected}
                    title={option.title}
                    description={option.description}
                    onClick={() =>
                      patch((next) => {
                        next.advancedPattern = option.id;
                      })
                    }
                  >
                    {option.id === "intervalHours" && (
                      <>
                        <div
                          className="med-segmented"
                          role="radiogroup"
                          aria-label="間隔單位"
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={
                              draft.advancedPattern === "intervalHours"
                            }
                            className={
                              draft.advancedPattern === "intervalHours"
                                ? "is-active"
                                : ""
                            }
                            onClick={() =>
                              patch((next) => {
                                next.advancedPattern = "intervalHours";
                              })
                            }
                          >
                            每隔數小時
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={
                              draft.advancedPattern === "intervalDays"
                            }
                            className={
                              draft.advancedPattern === "intervalDays"
                                ? "is-active"
                                : ""
                            }
                            onClick={() =>
                              patch((next) => {
                                next.advancedPattern = "intervalDays";
                              })
                            }
                          >
                            每隔數日
                          </button>
                        </div>
                        <label className="care-field">
                          {draft.advancedPattern === "intervalDays"
                            ? "每隔多少日"
                            : "每隔多少小時"}
                          {draft.advancedPattern === "intervalHours" ? (
                            <input
                              type="number"
                              inputMode="numeric"
                              min="1"
                              max="24"
                              step="1"
                              aria-label="每隔多少小時"
                              aria-invalid={!!error && draft.advancedPattern === "intervalHours"}
                              value={draft.intervalHours.everyHours}
                              onChange={(event) =>
                                patch((next) => {
                                  next.intervalHours.everyHours = event.target.value;
                                })
                              }
                            />
                          ) : (
                            <input
                              type="number"
                              inputMode="numeric"
                              min="1"
                              max={
                                draft.advancedPattern === "intervalDays"
                                  ? "365"
                                  : "24"
                              }
                              value={
                                draft.advancedPattern === "intervalDays"
                                  ? draft.intervalDays.everyDays
                                  : draft.intervalHours.everyHours
                              }
                              onChange={(event) =>
                                patch((next) => {
                                  if (next.advancedPattern === "intervalDays")
                                    next.intervalDays.everyDays =
                                      event.target.value;
                                  else
                                    next.intervalHours.everyHours =
                                      event.target.value;
                                })
                              }
                            />
                          )}
                        </label>
                      </>
                    )}
                    {option.id === "multipleDaily" && (
                      <label className="care-field">
                        每日服用次數
                        <select
                          aria-label="每日服用次數"
                          value={draft.multipleDaily.count}
                          onChange={(event) =>
                            patch((next) =>
                              resizeDailyCount(
                                next.multipleDaily,
                                Number(event.target.value),
                              ),
                            )
                          }
                        >
                          {Array.from(
                            { length: MAX_REMINDER_SLOTS - 1 },
                            (_, index) => index + 2,
                          ).map((count) => (
                            <option key={count} value={count}>
                              {count} 次
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {option.id === "weekly" && (
                      <fieldset className="med-wizard-weekdays">
                        <legend>選擇星期（可多選）</legend>
                        <div>
                          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                            <label key={day}>
                              <input
                                type="checkbox"
                                checked={draft.weekly.weekdays.includes(day)}
                                onChange={(event) =>
                                  patch((next) => {
                                    next.weekly.weekdays = event.target.checked
                                      ? [...next.weekly.weekdays, day]
                                      : next.weekly.weekdays.filter(
                                          (value) => value !== day,
                                        );
                                  })
                                }
                              />
                              <span>星期{weekdayLabels[day]}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    {option.id === "cycle" && (
                      <div className="med-wizard-number-grid">
                        <label className="care-field">
                          連續服用日數
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="365"
                            value={draft.cycle.intakeDays}
                            onChange={(event) =>
                              patch((next) => {
                                next.cycle.intakeDays = event.target.value;
                              })
                            }
                          />
                        </label>
                        <label className="care-field">
                          暫停日數
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="365"
                            value={draft.cycle.pauseDays}
                            onChange={(event) =>
                              patch((next) => {
                                next.cycle.pauseDays = event.target.value;
                              })
                            }
                          />
                        </label>
                      </div>
                    )}
                    {selected && error && (
                      <p className="med-field-error" role="alert">
                        {error}
                      </p>
                    )}
                  </ChoiceCard>
                );
              })}
            </div>
          </section>
        )}

        {(isReminderPage(page) || page === "cycleStart") && (
            <div className="med-advanced-content">
              <div className="med-advanced-intro" data-voice-avoid>
                <h2>
                  {page === "cycleStart"
                    ? "本次服藥週期從哪一天開始？"
                    : "您想在甚麼時間收到提醒？"}
                </h2>
                <p>
                  {pattern === "dailyOnce" || pattern === "dailyTwice"
                    ? `每天服用 ${pattern === "dailyOnce" ? 1 : 2} 次`
                    : pattern === "intervalDays"
                      ? `從開始日期起，每隔 ${draft.intervalDays.everyDays} 日服用`
                    : pattern === "intervalHours"
                    ? `每 ${draft.intervalHours.everyHours} 小時服用一次`
                    : pattern === "multipleDaily"
                      ? `每天服用 ${draft.multipleDaily.count} 次`
                      : pattern === "weekly"
                        ? `逢${[1, 2, 3, 4, 5, 6, 0]
                            .filter((day) =>
                              draft.weekly.weekdays.includes(day),
                            )
                            .map((day) => `星期${weekdayLabels[day]}`)
                            .join("、")}服用`
                        : `服用 ${draft.cycle.intakeDays} 日，暫停 ${draft.cycle.pauseDays} 日`}
                </p>
              </div>
              {draft.doseUnitReviewRequired && page !== "cycleStart" && (
                <div className="med-review-required" role="status">
                  <p>用量單位已更改為「{unit}」，請重新核對所有提醒用量。</p>
                  <button
                    type="button"
                    onClick={() =>
                      patch((next) => {
                        next.doseUnitReviewRequired = false;
                      })
                    }
                  >
                    我已重新核對
                  </button>
                </div>
              )}
              {page === "cycleStart" ? (
                <CycleStartFields
                  branch={draft.cycle}
                  onChange={(value) =>
                    patch((next) => Object.assign(next.cycle, value))
                  }
                />
              ) : page === "intervalReminders" ? (
                <IntervalReminderFields
                  branch={draft.intervalHours}
                  unit={unit}
                  onChange={(value) =>
                    patch((next) => Object.assign(next.intervalHours, value))
                  }
                />
              ) : (
                activeTimed && (
                  <>
                    <CompactReminderRows
                      key={pattern}
                      slots={activeTimed.slots}
                      unit={unit}
                      allowAdd={pattern === "weekly" || pattern === "cycle" || pattern === "intervalDays"}
                      showErrors={!!error}
                      onChange={(slots) =>
                        patch((next) => {
                          const target =
                            pattern === "dailyOnce" ? next.dailyOnce
                            : pattern === "dailyTwice" ? next.dailyTwice
                            : pattern === "intervalDays" ? next.intervalDays
                            : pattern === "multipleDaily"
                              ? next.multipleDaily
                              : pattern === "weekly"
                                ? next.weekly
                                : next.cycle;
                          target.slots = slots;
                        })
                      }
                    />
                    {pattern === "cycle" ? (
                      <p className="med-schedule-help">
                        這些提醒只適用於服用日；暫停期不會安排服藥提醒。
                      </p>
                    ) : (
                      <ScheduleDates
                        startDate={activeTimed.startDate}
                        endDate={activeTimed.endDate}
                        onChange={(value) =>
                          patch((next) =>
                            Object.assign(
                              pattern === "dailyOnce" ? next.dailyOnce
                              : pattern === "dailyTwice" ? next.dailyTwice
                              : pattern === "intervalDays" ? next.intervalDays
                              : pattern === "multipleDaily"
                                ? next.multipleDaily
                                : next.weekly,
                              value,
                            ),
                          )
                        }
                      />
                    )}
                  </>
                )
              )}
            </div>
          )}

        {page === "inventory" && (
          <section className="med-wizard-card med-wizard-inventory-card">
            <div className="med-wizard-question">
              <ListIcon width={24} height={24} />
              <div>
                <h2>要記錄目前庫存嗎？</h2>
              </div>
            </div>
            {draft.inventoryUnitReviewRequired && (
              <div className="med-review-required" role="status">
                <p>用量單位已更改為「{unit}」，請重新核對庫存和門檻。</p>
                <button
                  type="button"
                  onClick={() =>
                    patch((next) => {
                      next.inventoryUnitReviewRequired = false;
                    })
                  }
                >
                  我已重新核對
                </button>
              </div>
            )}
            <label className="care-field">
              目前庫存（{unit}）
              <input
                inputMode="decimal"
                value={draft.inventory.quantity}
                onChange={(event) =>
                  patch((next) => {
                    next.inventory.quantity = event.target.value;
                  })
                }
                placeholder="選填"
              />
            </label>
            <label className="med-wizard-toggle">
              <span>
                <strong>提醒我補充藥物</strong>
                <small>當庫存到達您設定的數量時顯示提示。</small>
              </span>
              <input
                type="checkbox"
                checked={draft.inventory.refillEnabled}
                onChange={(event) =>
                  patch((next) => {
                    next.inventory.refillEnabled = event.target.checked;
                  })
                }
              />
            </label>
            {draft.inventory.refillEnabled && (
              <label className="care-field">
                剩餘多少時提醒（{unit}）
                <input
                  inputMode="decimal"
                  value={draft.inventory.threshold}
                  onChange={(event) =>
                    patch((next) => {
                      next.inventory.threshold = event.target.value;
                    })
                  }
                />
              </label>
            )}
            {draft.inventory.refillEnabled &&
              draft.inventory.quantity.trim() &&
              draft.inventory.threshold.trim() &&
              Number(draft.inventory.quantity) <=
                Number(draft.inventory.threshold) && (
                <p className="care-warning" role="status">
                  目前庫存已到達補藥提醒門檻，儲存後會在藥物頁顯示提示。
                </p>
              )}
            {draft.frequencyChoice === "asNeeded" && (
              <p className="med-wizard-note">
                這項藥物會儲存為按需要服用，不會建立定時提醒或要求開啟系統通知。
              </p>
            )}
          </section>
        )}
      </div>

      {((error && !unitError && (page !== "advanced" || !draft.advancedPattern)) || saveError) && (
        <p className="care-warning med-wizard-error" role="alert">
          {error || saveError}
        </p>
      )}
      <footer className="med-wizard-actions" data-single-action={!history.length || undefined} data-voice-avoid>
        {history.length > 0 && <button type="button" className="med-wizard-secondary" onClick={goBack}>
          上一步
        </button>}
        <button
          type="button"
          className="med-wizard-primary"
          disabled={busy || submitting}
          onClick={() => void goNext()}
        >
          {busy || submitting ? "正在儲存…" : nextLabel}
        </button>
      </footer>

      <UnitWheelSheet
        open={unitOpen}
        value={draft.unitCode}
        onCancel={() => {
          setUnitOpen(false);
          requestAnimationFrame(() => unitTrigger.current?.focus({preventScroll:true}));
        }}
        onConfirm={applyUnit}
      />
      <ConfirmDialog
        open={leaveOpen}
        title="放棄未儲存的變更？"
        message="離開後，這次新增或修改的內容不會保留。"
        confirmText="放棄變更"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={onBack}
      />
    </div>
  );
}
