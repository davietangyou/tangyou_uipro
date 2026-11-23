import type {
  Medication,
  MedicationSchedule,
  MedicationScheduleSlot,
} from "./types";
import { localDate, validDate } from "./hba1c";
import { newId, validTime, validDose, doseError, validInventoryQuantity, inventoryQuantityError, validateMedication, MAX_REMINDER_SLOTS } from "./medication";

export const medicationUnits = [
  { code: "tablet", label: "片" },
  { code: "pill", label: "粒" },
  { code: "capsule", label: "膠囊" },
  { code: "mg", label: "毫克" },
  { code: "mcg", label: "微克" },
  { code: "g", label: "克" },
  { code: "ml", label: "毫升" },
  { code: "drop", label: "滴" },
  { code: "puff", label: "吸" },
  { code: "spray", label: "噴" },
  { code: "patch", label: "貼" },
  { code: "sachet", label: "包" },
  { code: "injection", label: "針" },
  { code: "ampoule", label: "安瓿" },
  { code: "teaspoon", label: "茶匙" },
  { code: "tablespoon", label: "湯匙" },
  { code: "portion", label: "份" },
  { code: "unit", label: "單位" },
  { code: "custom", label: "自訂單位" },
] as const;

export type MedicationUnitCode = (typeof medicationUnits)[number]["code"];
export type MedicationWizardPage =
  | "details"
  | "frequency"
  | "advanced"
  | "reminders"
  | "intervalReminders"
  | "multipleReminders"
  | "weeklyReminders"
  | "cycleStart"
  | "cycleReminders"
  | "inventory";
export type FrequencyChoice = "dailyOnce" | "dailyTwice" | "asNeeded" | "more";
export type AdvancedPattern =
  "intervalHours" | "intervalDays" | "multipleDaily" | "weekly" | "cycle";

export type DraftSlot = { id: string; time: string; amount: string };
type TimedDraft = { startDate: string; endDate: string; slots: DraftSlot[] };

export interface MedicationDraft {
  base: Medication;
  name: string;
  unitCode: MedicationUnitCode | "";
  customUnit: string;
  frequencyChoice: FrequencyChoice | "";
  advancedPattern: AdvancedPattern | "";
  dailyOnce: TimedDraft;
  dailyTwice: TimedDraft;
  multipleDaily: TimedDraft & {
    count: number;
    retainedSlots: DraftSlot[];
    visited: boolean;
  };
  weekly: TimedDraft & { weekdays: number[] };
  intervalDays: TimedDraft & { everyDays: string };
  intervalHours: {
    startDate: string;
    endDate: string;
    everyHours: string;
    startTime: string;
    endTime: string;
    amount: string;
  };
  cycle: TimedDraft & { intakeDays: string; pauseDays: string };
  inventory: {
    quantity: string;
    refillEnabled: boolean;
    threshold: string;
    revision: string;
  };
  doseUnitReviewRequired: boolean;
  inventoryUnitReviewRequired: boolean;
}

const slot = (source?: MedicationScheduleSlot): DraftSlot => ({
  id: source?.id || newId(),
  time: source?.time || "",
  amount: source && Number.isFinite(source.amount) ? String(source.amount) : "",
});

const timed = (
  schedule?: MedicationSchedule,
  count = 1,
  defaults?: string[],
): TimedDraft => ({
  startDate: schedule?.startDate || localDate(),
  endDate: schedule?.endDate || "",
  slots: Array.from({ length: count }, (_, index) =>
    schedule?.slots[index]
      ? slot(schedule.slots[index])
      : defaults
        ? { id: newId(), time: defaults[index], amount: "1" }
        : slot(),
  ),
});

const selectedUnit = (schedule?: MedicationSchedule) => {
  if (!schedule) return { unitCode: "" as const, customUnit: "" };
  const byCode = medicationUnits.find(
    (unit) => unit.code === schedule.unitCode,
  );
  if (byCode && byCode.code !== "custom")
    return { unitCode: byCode.code, customUnit: "" };
  const byLabel = medicationUnits.find(
    (unit) => unit.code !== "custom" && unit.label === schedule.unit,
  );
  return byLabel
    ? { unitCode: byLabel.code, customUnit: "" }
    : { unitCode: "custom" as const, customUnit: schedule.unit };
};

export const activePattern = (draft: MedicationDraft) =>
  draft.frequencyChoice === "more"
    ? draft.advancedPattern
    : draft.frequencyChoice;

export function createMedicationDraft(base: Medication): MedicationDraft {
  const schedule = base.schedule;
  const unit = selectedUnit(schedule);
  let frequencyChoice: MedicationDraft["frequencyChoice"] = "";
  let advancedPattern: MedicationDraft["advancedPattern"] = "";
  if (schedule?.frequency === "daily") {
    frequencyChoice =
      schedule.slots.length <= 1
        ? "dailyOnce"
        : schedule.slots.length === 2
          ? "dailyTwice"
          : "more";
    if (schedule.slots.length > 2) advancedPattern = "multipleDaily";
  } else if (schedule?.frequency === "weekly") {
    frequencyChoice = "more";
    advancedPattern = "weekly";
  } else if (schedule?.frequency === "asNeeded") {
    frequencyChoice = "asNeeded";
  } else if (schedule?.frequency) {
    frequencyChoice = "more";
    advancedPattern = schedule.frequency;
  }

  const activeSlots = schedule?.slots || [];
  const once = timed(
    schedule?.frequency === "daily" && activeSlots.length === 1
      ? schedule
      : undefined,
    1,
    ["08:00"],
  );
  const twice = timed(
    schedule?.frequency === "daily" && activeSlots.length === 2
      ? schedule
      : undefined,
    2,
    ["08:00", "12:00"],
  );
  const multipleCount = Math.max(
    3,
    schedule?.frequency === "daily" && activeSlots.length > 2
      ? activeSlots.length
      : 3,
  );
  const multiple = timed(
    schedule?.frequency === "daily" && activeSlots.length > 2
      ? schedule
      : undefined,
    multipleCount,
    dailyPresetTimes(multipleCount),
  );
  const weekly = timed(
    schedule?.frequency === "weekly" ? schedule : undefined,
    Math.max(1, schedule?.frequency === "weekly" ? activeSlots.length : 1),
    ["08:00"],
  );
  const intervalDays = timed(
    schedule?.frequency === "intervalDays" ? schedule : undefined,
    Math.max(
      1,
      schedule?.frequency === "intervalDays" ? activeSlots.length : 1,
    ),
  );
  const cycle = timed(
    schedule?.frequency === "cycle" ? schedule : undefined,
    Math.max(1, schedule?.frequency === "cycle" ? activeSlots.length : 1),
    ["08:00"],
  );

  return {
    base,
    name: base.name,
    ...unit,
    frequencyChoice,
    advancedPattern,
    dailyOnce: once,
    dailyTwice: twice,
    multipleDaily: {
      ...multiple,
      count: multipleCount,
      retainedSlots: [],
      visited: schedule?.frequency === "daily" && activeSlots.length > 2,
    },
    weekly: {
      ...weekly,
      weekdays: schedule?.frequency === "weekly" ? [...schedule.weekdays] : [],
    },
    intervalDays: {
      ...intervalDays,
      everyDays:
        schedule?.frequency === "intervalDays"
          ? String(schedule.interval?.value || "")
          : "",
    },
    intervalHours: {
      startDate:
        schedule?.frequency === "intervalHours"
          ? schedule.startDate
          : localDate(),
      endDate:
        schedule?.frequency === "intervalHours" ? schedule.endDate || "" : "",
      everyHours:
        schedule?.frequency === "intervalHours"
          ? String(schedule.interval?.value || "")
          : "6",
      startTime:
        schedule?.frequency === "intervalHours"
          ? schedule.interval?.startTime || ""
          : "06:00",
      endTime:
        schedule?.frequency === "intervalHours"
          ? schedule.interval?.endTime || ""
          : "00:00",
      amount:
        schedule?.frequency === "intervalHours" && schedule.slots[0]
          ? String(schedule.slots[0].amount)
          : "1",
    },
    cycle: {
      ...cycle,
      intakeDays:
        schedule?.frequency === "cycle"
          ? String(schedule.cycle?.intakeDays || "")
          : "",
      pauseDays:
        schedule?.frequency === "cycle"
          ? String(schedule.cycle?.pauseDays || "")
          : "",
    },
    inventory: {
      quantity: base.inventory ? String(base.inventory.quantity) : "",
      refillEnabled: !!base.inventory?.refillEnabled,
      threshold:
        base.inventory?.threshold == null
          ? ""
          : String(base.inventory.threshold),
      revision: base.inventory?.revision || newId(),
    },
    doseUnitReviewRequired: false,
    inventoryUnitReviewRequired: false,
  };
}

export const unitLabel = (draft: MedicationDraft) => {
  if (draft.unitCode === "custom") return draft.customUnit.trim();
  return (
    medicationUnits.find((unit) => unit.code === draft.unitCode)?.label || ""
  );
};

const amount = (value: string) => (value.trim() ? Number(value) : Number.NaN);
const compiledSlots = (slots: DraftSlot[]): MedicationScheduleSlot[] =>
  slots.map((entry) => ({
    id: entry.id,
    time: entry.time,
    amount: amount(entry.amount),
  }));

const minutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

export function compileIntervalHourSlots(
  startTime: string,
  endTime: string,
  everyHours: number,
  dose: number,
): MedicationScheduleSlot[] {
  if (!validTime(startTime) || !validTime(endTime) || startTime === endTime)
    return [];
  const start = minutes(startTime);
  let end = minutes(endTime);
  if (end < start) end += 1440;
  const step = everyHours * 60;
  if (!Number.isInteger(everyHours) || everyHours < 1 || everyHours > 24)
    return [];
  const result: MedicationScheduleSlot[] = [];
  for (
    let cursor = start, index = 0;
    cursor <= end;
    cursor += step, index += 1
  ) {
    const value = cursor % 1440;
    result.push({
      id: `interval-${index}-${cursor - start}`,
      time: `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`,
      amount: dose,
      dayOffset: cursor >= 1440 ? 1 : 0,
    });
  }
  return result;
}

function scheduleFromDraft(draft: MedicationDraft): MedicationSchedule {
  const unit = unitLabel(draft);
  const code = draft.unitCode || undefined;
  const pattern = activePattern(draft);
  if (pattern === "asNeeded")
    return {
      frequency: "asNeeded",
      weekdays: [],
      startDate:
        draft.base.schedule?.frequency === "asNeeded"
          ? draft.base.schedule.startDate
          : localDate(),
      unit,
      unitCode: code,
      slots: [],
    };
  if (pattern === "intervalHours") {
    const branch = draft.intervalHours;
    const everyHours = Number(branch.everyHours);
    return {
      frequency: "intervalHours",
      weekdays: [],
      startDate: branch.startDate,
      endDate: branch.endDate || undefined,
      unit,
      unitCode: code,
      interval: {
        value: everyHours,
        unit: "hours",
        startTime: branch.startTime,
        endTime: branch.endTime,
      },
      slots: compileIntervalHourSlots(
        branch.startTime,
        branch.endTime,
        everyHours,
        amount(branch.amount),
      ),
    };
  }
  if (pattern === "intervalDays") {
    const branch = draft.intervalDays;
    return {
      frequency: "intervalDays",
      weekdays: [],
      startDate: branch.startDate,
      endDate: branch.endDate || undefined,
      unit,
      unitCode: code,
      interval: { value: Number(branch.everyDays), unit: "days" },
      slots: compiledSlots(branch.slots),
    };
  }
  if (pattern === "cycle") {
    const branch = draft.cycle;
    return {
      frequency: "cycle",
      weekdays: [],
      startDate: branch.startDate,
      endDate: branch.endDate || undefined,
      unit,
      unitCode: code,
      cycle: {
        intakeDays: Number(branch.intakeDays),
        pauseDays: Number(branch.pauseDays),
      },
      slots: compiledSlots(branch.slots),
    };
  }
  if (pattern === "weekly") {
    const branch = draft.weekly;
    return {
      frequency: "weekly",
      weekdays: [...branch.weekdays],
      startDate: branch.startDate,
      endDate: branch.endDate || undefined,
      unit,
      unitCode: code,
      slots: compiledSlots(branch.slots),
    };
  }
  const branch =
    pattern === "dailyTwice"
      ? draft.dailyTwice
      : pattern === "multipleDaily"
        ? draft.multipleDaily
        : draft.dailyOnce;
  return {
    frequency: "daily",
    weekdays: [],
    startDate: branch.startDate,
    endDate: branch.endDate || undefined,
    unit,
    unitCode: code,
    slots: compiledSlots(branch.slots),
  };
}

export function compileMedicationDraft(draft: MedicationDraft, mode: "create" | "schedule" = "create"): Medication {
  const quantity = draft.inventory.quantity.trim();
  const threshold = draft.inventory.threshold.trim();
  const schedule = scheduleFromDraft(draft);
  if (mode === "schedule") return {
    ...draft.base,
    schedule,
    reminderEnabled: schedule.frequency === "asNeeded" ? false : (!draft.base.schedule || draft.base.schedule.frequency === "asNeeded" ? true : (draft.base.reminderEnabled ?? true)),
  };
  return {
    ...draft.base,
    name: draft.name.trim(),
    schedule,
    reminderEnabled:
      schedule.frequency === "asNeeded"
        ? false
        : (draft.base.reminderEnabled ?? true),
    inventory: quantity
      ? {
          quantity: Number(quantity),
          refillEnabled: draft.inventory.refillEnabled,
          threshold:
            draft.inventory.refillEnabled && threshold
              ? Number(threshold)
              : undefined,
          revision: draft.inventory.revision,
        }
      : undefined,
  };
}

export function validateWizardPage(
  draft: MedicationDraft,
  page: MedicationWizardPage,
): string {
  if (page === "details") {
    if (!draft.name.trim()) return "請填寫藥物名稱。";
    if (!draft.unitCode) return "請選擇用量單位。";
    if (draft.unitCode === "custom" && !draft.customUnit.trim())
      return "請填寫自訂用量單位。";
    return "";
  }
  if (page === "frequency") {
    if (!draft.unitCode) return "請選擇用量單位。";
    if (draft.unitCode === "custom" && !draft.customUnit.trim()) return "請填寫自訂用量單位。";
    return draft.frequencyChoice ? "" : "請選擇服用規律。";
  }
  if (page === "advanced") {
    const pattern = draft.advancedPattern;
    if (!pattern) return "請選擇一種服用方式。";
    if (pattern === "intervalHours") {
      const value = Number(draft.intervalHours.everyHours);
      if (!Number.isInteger(value) || value < 1 || value > 24)
        return "小時間隔須為 1 至 24。";
    }
    if (pattern === "intervalDays") {
      const value = Number(draft.intervalDays.everyDays);
      if (!Number.isInteger(value) || value < 1 || value > 365)
        return "日數間隔須為 1 至 365。";
    }
    if (
      pattern === "multipleDaily" &&
      (!Number.isInteger(draft.multipleDaily.count) ||
        draft.multipleDaily.count < 2 ||
        draft.multipleDaily.count > MAX_REMINDER_SLOTS)
    )
      return "每日次數須為 2 至 24。";
    if (pattern === "weekly" && !draft.weekly.weekdays.length)
      return "請選擇至少一個星期日子。";
    if (pattern === "cycle") {
      const intake = Number(draft.cycle.intakeDays);
      const pause = Number(draft.cycle.pauseDays);
      if (
        !Number.isInteger(intake) ||
        intake < 1 ||
        intake > 365 ||
        !Number.isInteger(pause) ||
        pause < 1 ||
        pause > 365
      )
        return "服用日數及暫停日數須為 1 至 365。";
    }
    return "";
  }
  if (page === "cycleStart")
    return dateBoundsError(draft.cycle.startDate, draft.cycle.endDate);
  if (isReminderPage(page)) {
    if (draft.doseUnitReviewRequired) return "請重新核對提醒用量的單位。";
    const schedule = scheduleFromDraft(draft);
    const candidate = {
      ...draft.base,
      name: draft.name,
      schedule,
      inventory: undefined,
    };
    return validateMedication(candidate);
  }
  if (draft.inventoryUnitReviewRequired)
    return "請重新核對目前庫存及補藥門檻的單位。";
  if (draft.inventory.refillEnabled && !draft.inventory.quantity.trim())
    return "開啟補藥提醒前，請填寫目前庫存。";
  if (
    draft.inventory.quantity.trim() &&
    !validInventoryQuantity(Number(draft.inventory.quantity))
  )
    return `目前庫存：${inventoryQuantityError}`;
  if (
    draft.inventory.refillEnabled &&
    (!draft.inventory.threshold.trim() ||
      !validInventoryQuantity(Number(draft.inventory.threshold)))
  )
    return `補藥提醒門檻：${inventoryQuantityError}`;
  return validateMedication(compileMedicationDraft(draft));
}

export function nextWizardPage(
  draft: MedicationDraft,
  page: MedicationWizardPage,
): MedicationWizardPage | null {
  if (page === "details") return "frequency";
  if (page === "frequency") {
    if (draft.frequencyChoice === "more") return "advanced";
    if (draft.frequencyChoice === "asNeeded") return "inventory";
    return "reminders";
  }
  if (page === "advanced") {
    return draft.advancedPattern === "intervalHours"
      ? "intervalReminders"
      : draft.advancedPattern === "multipleDaily"
        ? "multipleReminders"
        : draft.advancedPattern === "weekly"
          ? "weeklyReminders"
          : draft.advancedPattern === "cycle"
            ? "cycleStart"
            : "reminders";
  }
  if (page === "cycleStart") return "cycleReminders";
  if (isReminderPage(page)) return "inventory";
  return null;
}

export function addDays(date: string, days: number) {
  if (!validDate(date)) return "";
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
}

export function cycleDateSummary(draft: MedicationDraft) {
  const start = draft.cycle.startDate;
  const intake = Number(draft.cycle.intakeDays);
  const pause = Number(draft.cycle.pauseDays);
  if (
    !validDate(start) ||
    !Number.isInteger(intake) ||
    !Number.isInteger(pause)
  )
    return "填寫日期和日數後會顯示首個週期。";
  return `首個服用期：${start} 至 ${addDays(start, intake - 1)}；暫停期：${addDays(start, intake)} 至 ${addDays(start, intake + pause - 1)}。`;
}

export const hasDoseValues = (draft: MedicationDraft) =>
  [
    ...draft.dailyOnce.slots,
    ...draft.dailyTwice.slots,
    ...draft.multipleDaily.slots,
    ...draft.weekly.slots,
    ...draft.intervalDays.slots,
    ...draft.cycle.slots,
  ].some((entry) => entry.amount.trim()) || draft.intervalHours.amount.trim();

export const isReminderPage = (page: MedicationWizardPage) =>
  [
    "reminders",
    "intervalReminders",
    "multipleReminders",
    "weeklyReminders",
    "cycleReminders",
  ].includes(page);

const clockTime = (value: number) => {
  const minute = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
};

export function dailyPresetTimes(count: number): string[] {
  if (!Number.isInteger(count) || count < 2 || count > MAX_REMINDER_SLOTS) return [];
  const preset: Record<number, string[]> = {
    2: ["08:00", "20:00"],
    3: ["08:00", "14:00", "20:00"],
    4: ["08:00", "12:00", "16:00", "20:00"],
  };
  return (
    preset[count] ||
    Array.from({ length: count }, (_, i) =>
      clockTime(480 + Math.round((i * 1440) / count)),
    )
  );
}

export function nextReminderTime(
  slots: DraftSlot[],
  preferred?: string,
): string | null {
  const used = new Set(slots.map((s) => s.time));
  const last = slots.at(-1)?.time;
  const start =
    preferred && validTime(preferred)
      ? minutes(preferred)
      : last && validTime(last)
        ? minutes(last) + 120
        : 480;
  for (let i = 0; i < 12; i++) {
    const candidate = clockTime(start + i * 120);
    if (!used.has(candidate)) return candidate;
  }
  for (let i = 1; i < 1440; i++) {
    const candidate = clockTime(start + i);
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

export function appendReminder(slots: DraftSlot[]): DraftSlot[] {
  if (slots.length >= MAX_REMINDER_SLOTS) return slots;
  const time = nextReminderTime(slots);
  return time ? [...slots, { id: newId(), time, amount: "1" }] : slots;
}

export function resizeDailyCount(
  branch: MedicationDraft["multipleDaily"],
  count: number,
) {
  if (!Number.isInteger(count) || count < 2 || count > MAX_REMINDER_SLOTS) return;
  if (!branch.visited) {
    branch.slots = dailyPresetTimes(count).map((time) => ({
      id: newId(),
      time,
      amount: "1",
    }));
    branch.retainedSlots = [];
  } else {
    const all = [...branch.slots, ...branch.retainedSlots];
    const presets = dailyPresetTimes(count);
    while (all.length < count) {
      const time = nextReminderTime(all, presets[all.length]);
      if (!time) break;
      all.push({ id: newId(), time, amount: "1" });
    }
    branch.slots = all.slice(0, count);
    branch.retainedSlots = all.slice(count);
  }
  branch.count = count;
}

export function dateBoundsError(start: string, end: string): string {
  if (!validDate(start)) return "請選擇有效的開始日期。";
  if (end && (!validDate(end) || end < start))
    return "結束日期不可早於開始日期。";
  return "";
}

export function reminderRowErrors(slots: DraftSlot[]) {
  return Object.fromEntries(
    slots.map((entry) => [
      entry.id,
      {
        time: !validTime(entry.time)
          ? "請選擇提醒時間。"
          : slots.some(
                (other) => other.id !== entry.id && other.time === entry.time,
              )
            ? "提醒時間不可重複。"
            : "",
        amount:
          !validDose(amount(entry.amount))
            ? doseError
            : "",
      },
    ]),
  );
}
