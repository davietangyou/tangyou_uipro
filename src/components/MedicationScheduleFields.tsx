import { useState } from "react";
import { RecordDateTimePicker } from "./RecordDateTimePicker";
import { CalendarIcon, ClockIcon, PlusIcon, TrashIcon } from "./icons";
import { validTime, validDose, doseError, MAX_REMINDER_SLOTS } from "../data/medication";
import { localDate } from "../data/hba1c";
import {
  addDays,
  appendReminder,
  compileIntervalHourSlots,
  dateBoundsError,
  reminderRowErrors,
  type DraftSlot,
  type MedicationDraft,
} from "../data/medicationWizard";

const displayDate = (date: string) =>
  date ? date.split("-").reverse().join("/") : "未設定";

export function SchedulePicker({
  label,
  value,
  mode,
  onChange,
  invalid = false,
}: {
  label: string;
  value: string;
  mode: "date" | "time";
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <RecordDateTimePicker
      theme="medication"
      date={mode === "date" ? value || localDate() : localDate()}
      time={mode === "time" ? value : "08:00"}
      mode={mode}
      dateRange={mode === "date" ? "plan" : "recent"}
      ariaLabel={label}
      selectorUsesRelativeDate={false}
      renderTrigger={(open, expanded) => (
        <button
          type="button"
          className="med-schedule-picker"
          data-voice-avoid
          aria-label={`${label}：${mode === "date" ? displayDate(value) : value || "選擇時間"}`}
          aria-invalid={invalid}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          onClick={open}
        >
          {mode === "date" ? displayDate(value) : value || "選擇時間"}
          {mode === "date" ? (
            <CalendarIcon width={18} height={18} />
          ) : (
            <ClockIcon width={18} height={18} />
          )}
        </button>
      )}
      onConfirm={(next) => onChange(mode === "date" ? next.date : next.time)}
    />
  );
}

export function ScheduleDates({
  startDate,
  endDate,
  onChange,
  endOnly = false,
}: {
  startDate: string;
  endDate: string;
  onChange: (patch: { startDate?: string; endDate?: string }) => void;
  endOnly?: boolean;
}) {
  const problem = dateBoundsError(startDate, endDate);
  return (
    <details className="med-plan-dates" open={problem ? true : undefined}>
      <summary data-voice-avoid>
        {endOnly ? "結束日期（選填）" : "計劃日期"}
        <span>{endOnly ? displayDate(endDate) : displayDate(startDate)}</span>
      </summary>
      {!endOnly && (
        <div className="med-schedule-setting">
          <span>開始日期</span>
          <SchedulePicker
            label="計劃開始日期"
            value={startDate}
            mode="date"
            onChange={(value) => onChange({ startDate: value })}
          />
        </div>
      )}
      <div className="med-schedule-setting">
        <span>結束日期</span>
        <SchedulePicker
          label="計劃結束日期"
          value={endDate}
          mode="date"
          invalid={!!problem}
          onChange={(value) => onChange({ endDate: value })}
        />
      </div>
      {endDate && (
        <button
          type="button"
          className="med-schedule-clear"
          onClick={() => onChange({ endDate: "" })}
        >
          清除結束日期
        </button>
      )}
      {problem && (
        <p className="med-field-error" role="alert">
          {problem}
        </p>
      )}
    </details>
  );
}

function DoseAmount({
  amount,
  unit,
  label,
  error,
  onChange,
}: {
  amount: string;
  unit: string;
  label: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="med-dose-value">
      <label>
        <span className="sr-only">{label}</span>
        <input
          aria-label={label}
          aria-invalid={!!error}
          inputMode="decimal"
          value={amount}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>{unit}</span>
      </label>
      {error && (
        <p className="med-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function CompactReminderRows({
  slots,
  unit,
  allowAdd,
  onChange,
  showErrors,
}: {
  slots: DraftSlot[];
  unit: string;
  allowAdd: boolean;
  onChange: (slots: DraftSlot[]) => void;
  showErrors: boolean;
}) {
  const [touched, setTouched] = useState<string[]>([]);
  const errors = reminderRowErrors(slots);
  const update = (id: string, patch: Partial<DraftSlot>) => {
    setTouched((current) => [...current, id]);
    onChange(
      slots.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };
  return (
    <section className="med-compact-schedule" aria-label="提醒時間與用量">
      {slots.map((entry, index) => {
        const issue =
          showErrors || touched.includes(entry.id)
            ? errors[entry.id]
            : undefined;
        return (
          <div className="med-compact-row" key={entry.id} data-voice-avoid>
            <div>
              <SchedulePicker
                label={`第 ${index + 1} 次提醒時間`}
                mode="time"
                value={entry.time}
                invalid={!!issue?.time}
                onChange={(time) => update(entry.id, { time })}
              />
              {issue?.time && (
                <p className="med-field-error" role="alert">
                  {issue.time}
                </p>
              )}
            </div>
            <DoseAmount
              label={`第 ${index + 1} 次用量（${unit}）`}
              amount={entry.amount}
              unit={unit}
              error={issue?.amount}
              onChange={(amount) => update(entry.id, { amount })}
            />
            {allowAdd && slots.length > 1 && (
              <button
                type="button"
                className="med-compact-remove"
                aria-label={`移除第 ${index + 1} 次提醒`}
                onClick={() =>
                  onChange(slots.filter((row) => row.id !== entry.id))
                }
              >
                <TrashIcon width={17} height={17} />
                移除
              </button>
            )}
          </div>
        );
      })}
      {allowAdd && (
        <button
          type="button"
          className="med-compact-add"
          data-voice-avoid
          disabled={slots.length >= MAX_REMINDER_SLOTS}
          onClick={() => onChange(appendReminder(slots))}
        >
          <PlusIcon width={22} height={22} />
          新增提醒時間
        </button>
      )}
    </section>
  );
}

export function IntervalReminderFields({
  branch,
  unit,
  onChange,
}: {
  branch: MedicationDraft["intervalHours"];
  unit: string;
  onChange: (patch: Partial<MedicationDraft["intervalHours"]>) => void;
}) {
  const startError = !validTime(branch.startTime) ? "請選擇開始時間。" : "";
  const endError = !validTime(branch.endTime) ? "請選擇結束時間。" : branch.startTime === branch.endTime ? "請選擇與開始時間不同的結束時間。" : "";
  const amountError =
    !validDose(Number(branch.amount))
      ? doseError
      : "";
  const slots = compileIntervalHourSlots(
    branch.startTime,
    branch.endTime,
    Number(branch.everyHours),
    Number(branch.amount),
  );
  return (
    <>
      <section className="med-compact-schedule" aria-label="間隔提醒設定">
        <div className="med-schedule-setting">
          <span>開始時間</span>
          <SchedulePicker
            label="開始時間"
            mode="time"
            value={branch.startTime}
            invalid={!!startError}
            onChange={(startTime) => onChange({ startTime })}
          />
        </div>
        {startError && <p className="med-field-error" role="alert">{startError}</p>}
        <div className="med-schedule-setting">
          <span>
            結束時間{branch.endTime < branch.startTime && <small>翌日</small>}
          </span>
          <SchedulePicker
            label="結束時間"
            mode="time"
            value={branch.endTime}
            invalid={!!endError}
            onChange={(endTime) => onChange({ endTime })}
          />
        </div>
        {endError && (
          <p className="med-field-error" role="alert">
            {endError}
          </p>
        )}
        <div className="med-schedule-setting">
          <span>每次用量</span>
          <DoseAmount
            label={`每次用量（${unit}）`}
            amount={branch.amount}
            unit={unit}
            error={amountError}
            onChange={(amount) => onChange({ amount })}
          />
        </div>
      </section>
      {slots.length > 0 && (
        <div className="med-generated-preview">
          <p>提醒時間預覽</p>
          <ul>
            {slots.map((entry) => (
              <li key={entry.id}>
                {entry.dayOffset ? "翌日 " : ""}
                {entry.time}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="med-schedule-help">
        由開始時間起計；結束時間只有剛好符合間隔時才加入。較早的結束時間代表翌日。
      </p>
      <ScheduleDates
        startDate={branch.startDate}
        endDate={branch.endDate}
        onChange={onChange}
      />
    </>
  );
}

export function CycleStartFields({
  branch,
  onChange,
}: {
  branch: MedicationDraft["cycle"];
  onChange: (patch: Partial<MedicationDraft["cycle"]>) => void;
}) {
  const intake = Number(branch.intakeDays),
    pause = Number(branch.pauseDays);
  return (
    <>
      <section className="med-compact-schedule">
        <div className="med-schedule-setting">
          <span>開始日期</span>
          <SchedulePicker
            label="週期開始日期"
            mode="date"
            value={branch.startDate}
            onChange={(startDate) => onChange({ startDate })}
          />
        </div>
      </section>
      <div className="med-cycle-dates" aria-live="polite" data-voice-avoid>
        <p>
          首個服用期：{displayDate(branch.startDate)} 至{" "}
          {displayDate(addDays(branch.startDate, intake - 1))}
        </p>
        <p>
          暫停期：{displayDate(addDays(branch.startDate, intake))} 至{" "}
          {displayDate(addDays(branch.startDate, intake + pause - 1))}
        </p>
        <p>
          下一服用期：{displayDate(addDays(branch.startDate, intake + pause))}{" "}
          開始
        </p>
      </div>
      <ScheduleDates
        startDate={branch.startDate}
        endDate={branch.endDate}
        endOnly
        onChange={onChange}
      />
    </>
  );
}
