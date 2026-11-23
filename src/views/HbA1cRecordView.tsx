import { HbA1cPhotoPicker } from "../components/HbA1cPhotoPicker";
import { RecordMissing } from "../components/RecordMissing";
import { useRef, useState, type FormEvent } from "react";
import type { HbA1cRecord } from "../data/types";
import {
  HBA1C_GAUGE_MAX,
  HBA1C_STATUS,
  hba1cStatus,
  localDate,
  validateHbA1c,
  validTime,
  type HbA1cInput,
} from "../data/hba1c";
import { AlertTriangle as AlertIcon, ChevronLeft as BackIcon, Check as CheckIcon, Droplet as DropletIcon } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SecondaryButton } from "../components/buttons";
import { RecordDateTimePicker } from "../components/RecordDateTimePicker";
import { SemicircleValueGauge } from "../components/SemicircleValueGauge";

export function HbA1cRecordView({ record, editing, onBack, onSave, onDelete, onToast }: {
  record?: HbA1cRecord;
  editing: boolean;
  onBack: () => void;
  onSave: (input: HbA1cInput, id?: string) => void;
  onDelete: (id: string) => void;
  onToast: (message: string) => void;
}) {
  const [date, setDate] = useState(record?.date ?? localDate());
  const [time, setTime] = useState(record?.time ?? "");
  const [value, setValue] = useState(record?.value ?? "");
  const [errors, setErrors] = useState({ value: "", date: "", time: "" });
  const [storageError, setStorageError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const numeric = Number(value);
  const valueError = validateHbA1c(value, date).value;
  const hasValue = !valueError;
  const status = hasValue ? hba1cStatus(numeric) : null;
  const meta = status ? HBA1C_STATUS[status] : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = {
      ...validateHbA1c(value, date),
      time: !time || validTime(time) ? "" : "請選擇有效的檢測時間。",
    };
    setErrors(next);
    setStorageError("");
    if (next.value || next.date || next.time) return;
    try {
      onSave({ value, date, time }, record?.id);
      onToast(editing ? "已更新糖化紀錄" : "已儲存糖化紀錄");
      onBack();
    } catch {
      setStorageError("未能儲存，輸入內容已保留。請檢查瀏覽器儲存空間後再試。");
    }
  };

  if (editing && !record) {
    return (
      <div className="hba1c-entry mx-auto max-w-[520px] px-[18px] py-6">
        <RecordMissing kind="糖化" onBack={onBack}/>
      </div>
    );
  }

  const statusClass = status === "excellent" ? "text-positive" : status === "ideal" ? "text-positive" : status === "elevated" ? "text-warning" : "text-danger";
  const valueColor = status === "excellent"
    ? "var(--color-positive)"
    : status === "ideal"
      ? "var(--color-positive)"
      : status === "elevated"
        ? "var(--color-warning)"
        : status === "high"
          ? "var(--color-danger)"
          : "var(--color-text-primary)";

  return (
    <div ref={page} className="hba1c-entry min-h-full bg-app-bg">
      <header className="sticky top-0 z-10 bg-app-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-[18px] pt-6 pb-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="hba1c-back flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[0_2px_8px_rgba(55,53,49,0.08)] transition-transform duration-150 ease-out active:scale-[0.94]"
          >
            <BackIcon width={24} height={24} aria-hidden="true" />
          </button>
          <h1 className="record-entry-title hm-cardtitle text-ink">
            {editing ? "編輯糖化紀錄" : "記錄糖化"}
          </h1>
        </div>
      </header>

      <form noValidate onSubmit={submit} className="mx-auto flex max-w-[520px] flex-col gap-5 px-[18px] pb-[max(24px,env(safe-area-inset-bottom))]">
        <RecordDateTimePicker
          measurementStyle
          startAtNow={!editing}
          date={date}
          time={time}
          mode="datetime"
          dateRange="history"
          allowMissingTime
          ariaLabel={`檢測日期：${date}，時間：${time || "未記錄"}，點擊修改`}
          onConfirm={(next) => {
            setDate(next.date);
            setTime(next.time);
            setErrors((previous) => ({ ...previous, date: "", time: "" }));
          }}
        />
        <p className="hba1c-time-help">檢測時間可留空，只記錄檢測日期。</p>
        {errors.date && <p role="alert" id="hba1c-date-error" className="hba1c-error">{errors.date}</p>}
        {errors.time && <p role="alert" id="hba1c-time-error" className="hba1c-error">{errors.time}</p>}

        <section className="hba1c-input-card flex flex-col gap-4 rounded-[28px] bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="hba1c-icon flex h-7 w-7 flex-shrink-0 items-center justify-center text-ink">
              <DropletIcon width={28} height={28} />
            </span>
            <span className="hm-cardtitle text-ink">輸入糖化</span>
            <HbA1cPhotoPicker onSelect={next => {setValue(next);setErrors(previous => ({...previous,value:""}));}} />
          </div>

          <SemicircleValueGauge
            value={value}
            numericValue={numeric}
            hasValue={hasValue}
            maximum={HBA1C_GAUGE_MAX}
            inputMaximum={100}
            unit="%"
            ariaLabel="輸入糖化值（%）"
            arcColor={meta?.arc ?? "var(--color-primary)"}
            valueColor={valueColor}
            error={errors.value}
            onChange={(event) => {
              setValue(event.target.value);
              setErrors((previous) => ({ ...previous, value: "" }));
            }}
            feedback={<div id="hba1c-value-feedback" className="hba1c-feedback" aria-live="polite">
              {errors.value ? (
                <div role="alert" className="mt-4 flex items-center gap-1.5 text-danger">
                  <AlertIcon width={20} height={20} />
                  <span className="hm-body font-semibold">{errors.value}</span>
                </div>
              ) : meta ? (
                <div className={`mt-4 flex items-center gap-1.5 ${statusClass}`}>
                  {(status === "ideal" || status === "excellent") ? <CheckIcon width={20} height={20} /> : <AlertIcon width={20} height={20} />}
                  <span className="hm-body font-semibold">{meta.shortLabel}</span>
                </div>
              ) : null}
              {meta && numeric > HBA1C_GAUGE_MAX && (
                <p className="mt-3 text-ink-soft">數值超出儀表顯示刻度，會完整儲存 {value}%。</p>
              )}
            </div>}
          />
        </section>

        {storageError && <p role="alert" className="hba1c-error">{storageError}</p>}
        <div className="flex flex-col gap-5">
          <button
            type="submit"
            data-voice-avoid
            disabled={!value.trim()}
            className={`hba1c-save flex min-h-[64px] w-full items-center justify-center rounded-[24px] hm-btn transition-transform duration-150 ease-out ${value.trim() ? "bg-action text-white active:scale-[0.97]" : "cursor-not-allowed bg-disabled text-ink-soft"}`}
          >
            {editing ? "儲存修改" : "儲存糖化紀錄"}
          </button>
          {editing && (
            <SecondaryButton type="button" fullWidth className="record-entry-delete" onClick={() => setDeleting(true)}>
              刪除糖化紀錄
            </SecondaryButton>
          )}
        </div>
      </form>

      {deleting && (
        <ConfirmDialog
          appearance="record"
          open
          title="刪除這筆糖化紀錄？"
          message="刪除後無法復原，這筆紀錄將從數據日誌及糖化趨勢中移除。"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            try {
              onDelete(record!.id);
              setDeleting(false);
              onToast("已刪除糖化紀錄");
              onBack();
            } catch {
              setDeleting(false);
              setStorageError("未能刪除，原有紀錄已保留。請稍後再試。");
            }
          }}
        />
      )}
    </div>
  );
}