import { GlucosePhotoPicker } from './GlucosePhotoPicker';
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { GlucoseRecord } from "../data/types";
import {
  DIET_TAGS,
  EXERCISE_TAGS,
  lifestyleTagsForEditing,
  glucoseStatus,
  slotById,
  STATUS_TEXT,
  suggestSlotId,
  SYMPTOM_TAGS,
  TIME_SLOTS,
} from "../data/constants";
import type { NewGlucoseInput } from "../hooks/useGlucose";
import { SecondaryButton } from "./buttons";
import { AlertTriangle as AlertIcon, Check as CheckIcon, Droplet as DropletIcon, Utensils as ForkKnifeIcon, Activity as PulseIcon, Footprints as WalkIcon } from "lucide-react";
import { RecordDateTimePicker, toLocalDateTimeInput } from "./RecordDateTimePicker";
import { SemicircleValueGauge } from "./SemicircleValueGauge";
import {DeviceModal} from './DeviceModal';

function slotIdForRecord(rec: GlucoseRecord): string {
  if (rec.timeType === "random") return "random";
  const match = TIME_SLOTS.find(
    (s) => s.timeType === rec.timeType && s.mealTag === rec.mealTag,
  );
  return match?.id ?? TIME_SLOTS.find((s) => s.timeType === rec.timeType)?.id ?? "random";
}


// ── TagSheet bottom sheet ─────────────────────────────────────────────────────
function TagSheet({
  open,
  title,
  tags,
  selected,
  placeholder,
  onToggle,
  onDone,
}: {
  open: boolean;
  title: string;
  tags: string[];
  selected: string[];
  placeholder: string;
  onToggle: (t: string) => void;
  onDone: (customText?: string) => void;
}) {
  const titleId=useId();
  const customId=useId();
  const [customInput, setCustomInput] = useState("");
  const choiceTags = [...tags, ...selected.filter(tag => !tags.includes(tag))];

  // The shared modal owns keyboard dismissal and Escape handling.
  useEffect(() => {
    if (!open) setCustomInput("");
  }, [open]);

  const handleDone = () => {
    onDone(customInput.trim() || undefined);
    setCustomInput("");
  };

  return (
    <DeviceModal open={open} onClose={() => onDone()} label={titleId} className="record-entry record-tag-sheet" swipeToDismiss>
      <div className="record-tag-sheet-drag-area" data-sheet-drag-handle>
        <div className="record-tag-sheet-handle" aria-hidden="true"><span/></div>
        <h2 id={titleId} className="record-tag-sheet-header">{title}</h2>
        <p className="record-tag-sheet-help">可選多項</p>
      </div>
      <div className="record-tag-sheet-content">
        <div className="record-tag-options">
          {choiceTags.map(tag => {
            const checked = selected.includes(tag);
            return <button key={tag} type="button" aria-pressed={checked} onClick={() => onToggle(tag)} className="record-tag-choice">
              {tag}<span className="record-tag-mark" aria-hidden="true">{checked && <CheckIcon width={17} height={17}/>}</span>
            </button>;
          })}
        </div>
        <label htmlFor={customId} className="record-tag-custom-label">{title === "症狀" ? "其他不適" : `其他${title}`}</label>
        <input id={customId} type="text" value={customInput} onChange={event => setCustomInput(event.target.value)} placeholder={placeholder} className="hm-body"/>
      </div>
      <div className="record-tag-sheet-actions">
        <button type="button" onClick={handleDone} className="hm-btn">確定</button>
      </div>
    </DeviceModal>
  );
}

// ── OptionalRecordItem ──────────────────────────────────────────────────────
// 可重用的「記錄更多」選項卡片，與首頁快捷卡片同一設計系統（柔和色面、白色圓形
// 圖標徽章、統一尺寸/內距/圓角）。已選狀態以外框 + 打勾徽章表示，不僅靠顏色。
type OptionVariant = "sun" | "sky" | "sage";

const OPT_SURFACE: Record<OptionVariant, string> = {
  sun: "bg-sun",
  sky: "bg-sky",
  sage: "bg-sage",
};

function OptionalRecordItem({
  variant,
  icon,
  label,
  count,
  onClick,
}: {
  variant: OptionVariant;
  icon: ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  const selected = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={selected ? `${label}，已選 ${count} 項` : label}
      className={[
        "relative flex min-h-[120px] flex-col items-center justify-center gap-2.5 rounded-[24px] p-3 text-ink",
        "transition-[transform,filter] duration-150 ease-out hover:brightness-[0.98] active:scale-[0.97]",
        OPT_SURFACE[variant],
        selected ? "ring-2 ring-ink/25" : "",
      ].join(" ")}
    >
      <span className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-surface text-ink shadow-[0_2px_8px_rgba(55,53,49,0.08)]">
        {icon}
        {selected && (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-action text-white font-bold"
            style={{ fontSize: 13 }}
          >
            {count}
          </span>
        )}
      </span>
      <span className="hm-body font-semibold">{label}</span>
      {selected && (
        <span className="absolute right-3 top-3 text-ok-text" aria-hidden="true">
          <CheckIcon width={18} height={18} />
        </span>
      )}
    </button>
  );
}

// ── GlucoseForm ───────────────────────────────────────────────────────────────
export function GlucoseForm({
  mode,
  initial,
  onSubmit,
  onDelete,
}: {
  mode: "add" | "edit";
  initial?: GlucoseRecord;
  onSubmit: (input: NewGlucoseInput) => void;
  onDelete?: () => void;
}) {
  const now = Date.now();
  const [dt, setDt] = useState<string>(
    initial ? toLocalDateTimeInput(initial.timestamp) : toLocalDateTimeInput(now),
  );
  const [slotId, setSlotId] = useState<string>(
    initial ? slotIdForRecord(initial) : suggestSlotId(new Date(now).getHours()),
  );
  const [valueStr, setValueStr] = useState<string>(
    initial ? initial.value.toFixed(1) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<"diet" | "exercise" | "symptom" | null>(null);

  const [dietTags, setDietTags] = useState<string[]>(
    lifestyleTagsForEditing(initial?.dietNote),
  );
  const [exerciseTags, setExerciseTags] = useState<string[]>(
    lifestyleTagsForEditing(initial?.exerciseNote),
  );
  const [symptoms, setSymptoms] = useState<string[]>(initial?.symptoms ?? []);

  const slot = slotById(slotId) ?? TIME_SLOTS[0];
  const numeric = Math.round(parseFloat(valueStr) * 10) / 10;
  const hasValue = valueStr !== "" && Number.isFinite(numeric) && numeric > 0 && numeric <= 33;
  const liveStatus = hasValue ? glucoseStatus(numeric, slot.timeType) : null;

  const toggle = (list: string[], setList: (v: string[]) => void, t: string) =>
    setList(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);

  const handleSubmit = () => {
    if (!hasValue) {
      setError("請輸入大於 0、不超過 33 的血糖值（mmol/L）");
      return;
    }
    setError(null);
    try {
      onSubmit({
      value: numeric,
      timestamp: new Date(dt).getTime(),
      timeType: slot.timeType,
      mealTag: slot.mealTag,
      dietNote: dietTags.join("、"),
      exerciseNote: exerciseTags.join("、"),
      symptoms,
      });
    } catch {
      setError("未能儲存，輸入內容已保留。請檢查瀏覽器儲存空間後再試。");
    }
  };

  const statusStyle = useMemo(() => {
    if (liveStatus === "ideal") return "text-positive";
    if (liveStatus === "high") return "text-warning";
    if (liveStatus === "low") return "text-danger";
    return "text-text-muted";
  }, [liveStatus]);

  // Status-based arc fill colour — vivid fills matching GlucoseGauge
  const arcFillColor = liveStatus === "high" ? "#E05A4E" : liveStatus === "low" ? "#F5A623" : liveStatus === "ideal" ? "#52C07A" : "var(--color-primary)";
  const valTextColor = liveStatus === "high" ? "var(--color-danger)" : liveStatus === "low" ? "var(--color-warning)" : liveStatus === "ideal" ? "var(--color-positive)" : "var(--color-text-primary)";

  return (
    <div className="record-entry flex flex-col gap-5">
      {/* ── 日期 / 時間 / 時段 選擇器（白色輕量卡、三欄分隔、52px 觸控區） ── */}
      <RecordDateTimePicker
        measurementStyle
        startAtNow={mode === "add"}
        dateRange={mode === "edit" ? "history" : "recent"}
        date={dt.slice(0, 10)}
        time={dt.slice(11, 16)}
        slotId={slotId}
        slots={TIME_SLOTS.map((item) => ({ id: item.id, label: item.label }))}
        ariaLabel={`測量時間：${dt.slice(0, 10)} ${dt.slice(11, 16)} ${slot.label}，點擊修改`}
        onConfirm={(next) => {
          setDt(`${next.date}T${next.time}`);
          if (next.slotId) setSlotId(next.slotId);
        }}
      />

      {/* ── 輸入血糖 Hero 卡（柔和 sage 面 + 白色圓角儀表容器） ── */}
      <section className="flex flex-col gap-4 record-input-card rounded-[28px] bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-ink">
            <DropletIcon width={28} height={28} />
          </span>
          <span className="hm-cardtitle text-ink">輸入血糖</span>
          <GlucosePhotoPicker onSelect={value => {setValueStr(value.toFixed(1));setError(null);}} />
        </div>

        {/* 半圓儀表 —— 血糖與糖化共用同一幾何與輸入佈局 */}
        <SemicircleValueGauge
          value={valueStr}
          numericValue={numeric}
          hasValue={hasValue}
          maximum={33}
          inputMaximum={33}
          unit="mmol/L"
          ariaLabel="輸入血糖值（mmol/L）"
          arcColor={arcFillColor}
          valueColor={valTextColor}
          error={error}
          onChange={(event) => {
            const next = event.target.value;
            if (parseFloat(next) < 0) setValueStr("0");
            else setValueStr(next);
            if (error) setError(null);
          }}
          feedback={<>
            {liveStatus && !error && (
            <div className={`mt-4 flex items-center gap-1.5 ${statusStyle}`}>
              {liveStatus === "ideal" ? (
                <CheckIcon width={20} height={20} />
              ) : (
                <AlertIcon width={20} height={20} />
              )}
              <span className="hm-body font-semibold">
                {STATUS_TEXT[liveStatus]}
                {liveStatus === "high" && "（超出此時段目標）"}
                {liveStatus === "low" && "（低血糖，請多加留意）"}
              </span>
            </div>
            )}
            {error && (
            <div role="alert" className="mt-4 flex items-center gap-1.5 text-danger">
              <AlertIcon width={20} height={20} />
              <span className="hm-body font-semibold">{error}</span>
            </div>
            )}
          </>}
        />
      </section>

      {/* ── 記錄更多（可選）：飲食 / 運動 / 症狀 —— 與首頁快捷卡片同一系統 ── */}
      <section className="flex flex-col gap-5">
        <span className="hm-cardtitle text-ink">記錄更多（可選）</span>
        <div className="grid grid-cols-3 gap-3">
          <OptionalRecordItem
            variant="sun"
            icon={<ForkKnifeIcon width={28} height={28} />}
            label="飲食"
            count={dietTags.length}
            onClick={() => setActiveSheet("diet")}
          />
          <OptionalRecordItem
            variant="sky"
            icon={<WalkIcon width={28} height={28} />}
            label="運動"
            count={exerciseTags.length}
            onClick={() => setActiveSheet("exercise")}
          />
          <OptionalRecordItem
            variant="sage"
            icon={<PulseIcon width={28} height={28} />}
            label="症狀"
            count={symptoms.length}
            onClick={() => setActiveSheet("symptom")}
          />
        </div>
      </section>

      {/* ── 保存記錄（深炭主行動鍵，與首頁同一按鈕系統） + 刪除（僅編輯） ── */}
      <div className="flex flex-col gap-5">
        <button
          type="button"
          disabled={!hasValue}
          data-voice-avoid
          onClick={handleSubmit}
          className={[
            "flex min-h-[56px] w-full items-center justify-center rounded-[16px] hm-btn",
            "transition-transform duration-150 ease-out",
            hasValue
              ? "bg-action text-white active:scale-[0.97]"
              : "cursor-not-allowed bg-disabled text-ink-soft",
          ].join(" ")}
        >
          {mode === "edit" ? "保存修改" : "保存記錄"}
        </button>
        {mode === "edit" && onDelete && (
          <SecondaryButton
            fullWidth
            className="record-entry-delete"
            onClick={onDelete}
          >
            刪除這筆紀錄
          </SecondaryButton>
        )}
      </div>

      {/* ── Tag sheets ── */}
      <TagSheet
        open={activeSheet === "diet"}
        title="飲食"
        tags={DIET_TAGS}
        selected={dietTags}
        placeholder="自行輸入"
        onToggle={(t) => toggle(dietTags, setDietTags, t)}
        onDone={(extra) => {
          if (extra) setDietTags((prev) => prev.includes(extra) ? prev : [...prev, extra]);
          setActiveSheet(null);
        }}
      />
      <TagSheet
        open={activeSheet === "exercise"}
        title="運動"
        tags={EXERCISE_TAGS}
        selected={exerciseTags}
        placeholder="自行輸入"
        onToggle={(t) => toggle(exerciseTags, setExerciseTags, t)}
        onDone={(extra) => {
          if (extra) setExerciseTags((prev) => prev.includes(extra) ? prev : [...prev, extra]);
          setActiveSheet(null);
        }}
      />
      <TagSheet
        open={activeSheet === "symptom"}
        title="症狀"
        tags={SYMPTOM_TAGS}
        selected={symptoms}
        placeholder="自行輸入"
        onToggle={(t) => toggle(symptoms, setSymptoms, t)}
        onDone={(extra) => {
          if (extra) setSymptoms((prev) => prev.includes(extra) ? prev : [...prev, extra]);
          setActiveSheet(null);
        }}
      />
    </div>
  );
}
