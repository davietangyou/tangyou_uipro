import type {
  Medication,
  MedicationIntake,
  MedicationSchedule,
  UserProfile,
} from "./types";
import { localDate, validDate } from "./hba1c";

export { newRecordId as newId } from './id';
import { newRecordId as newId } from './id';
export const validTime = (time: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const rounded = (n: number) => Number(n.toFixed(6));
export const validInventoryQuantity = (amount: number) =>
  Number.isFinite(amount) && amount >= 0 && amount < 100000000 && rounded(amount) === amount;
export const validDose = (amount: number) => amount > 0 && validInventoryQuantity(amount);
export const inventoryQuantityError = "數量須為 0 或以上、小於一億，最多 6 位小數。";
export const doseError = "用量須大於 0、小於一億，最多 6 位小數。";
export const MAX_REMINDER_SLOTS = 24;
export const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];
export const intakeId = (medicationId: string, slotId: string, date: string) =>
  `${medicationId}:${slotId}:${date}`;
export const intakeTimestamp = (entry: MedicationIntake) =>
  new Date(`${entry.date}T${entry.time}:00`).getTime();

const calendarDayNumber = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};

const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
};

const daysSince = (date: string, anchor: string) =>
  calendarDayNumber(date) - calendarDayNumber(anchor);

const isScheduleDate = (schedule: MedicationSchedule, date: string) => {
  if (
    date < schedule.startDate ||
    (schedule.endDate && date > schedule.endDate)
  )
    return false;
  const elapsed = daysSince(date, schedule.startDate);
  if (elapsed < 0) return false;
  if (schedule.frequency === "weekly")
    return schedule.weekdays.includes(new Date(`${date}T12:00:00`).getDay());
  if (schedule.frequency === "intervalDays")
    return !!schedule.interval && elapsed % schedule.interval.value === 0;
  if (schedule.frequency === "cycle") {
    if (!schedule.cycle) return false;
    const length = schedule.cycle.intakeDays + schedule.cycle.pauseDays;
    return elapsed % length < schedule.cycle.intakeDays;
  }
  return schedule.frequency !== "asNeeded";
};

export function normalizeMedications(medications: Medication[]): Medication[] {
  if (!Array.isArray(medications))
    throw new Error("藥物資料格式不正確，原有資料已保留。");
  const ids = new Set<string>();
  return medications.map((medication, index) => {
    if (!medication || typeof medication.name !== "string")
      throw new Error("藥物資料格式不正確，原有資料已保留。");
    let id = medication.id || `legacy-medication-${index}`;
    while (ids.has(id)) id += "-copy";
    ids.add(id);
    return medication.id === id
      ? medication
      : { ...medication, id, reminderEnabled: false };
  });
}

export function validateMedication(med: Medication): string {
  if (!med.name.trim()) return "請填寫藥物名稱。";
  const schedule = med.schedule;
  if (!schedule) return "請設定服藥時間表。";
  if (
    !validDate(schedule.startDate) ||
    (schedule.endDate &&
      (!validDate(schedule.endDate) || schedule.endDate < schedule.startDate))
  )
    return "請檢查開始及結束日期。";
  if (
    schedule.frequency === "weekly" &&
    (!schedule.weekdays.length ||
      schedule.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
  )
    return "請選擇每週服藥日子。";
  if (!schedule.unit.trim()) return "請填寫每次用量的單位。";
  if (schedule.slots.length > MAX_REMINDER_SLOTS) return `最多設定 ${MAX_REMINDER_SLOTS} 個提醒時間。`;
  if (schedule.frequency === "asNeeded") {
    if (schedule.slots.length) return "按需要服用不應設定定時提醒。";
  } else if (
    schedule.frequency === "intervalHours" &&
    (!schedule.interval ||
      schedule.interval.unit !== "hours" ||
      !Number.isInteger(schedule.interval.value) ||
      schedule.interval.value < 1 ||
      schedule.interval.value > 24 ||
      !validTime(schedule.interval.startTime || "") ||
      !validTime(schedule.interval.endTime || "") ||
      schedule.interval.startTime === schedule.interval.endTime)
  ) {
    return "請檢查每隔小時的開始、結束時間及間隔。";
  } else if (
    schedule.frequency === "intervalDays" &&
    (!schedule.interval ||
      schedule.interval.unit !== "days" ||
      !Number.isInteger(schedule.interval.value) ||
      schedule.interval.value < 1 ||
      schedule.interval.value > 365)
  ) {
    return "請填寫 1 至 365 日的有效間隔。";
  } else if (
    schedule.frequency === "cycle" &&
    (!schedule.cycle ||
      !Number.isInteger(schedule.cycle.intakeDays) ||
      schedule.cycle.intakeDays < 1 ||
      schedule.cycle.intakeDays > 365 ||
      !Number.isInteger(schedule.cycle.pauseDays) ||
      schedule.cycle.pauseDays < 1 ||
      schedule.cycle.pauseDays > 365)
  ) {
    return "服用日數及暫停日數須為 1 至 365 日。";
  }
  if (
    schedule.frequency !== "asNeeded" &&
    (!schedule.slots.length ||
      schedule.slots.some(
        (s) =>
          !validTime(s.time) || !validDose(s.amount),
      ))
  )
    return `每個服藥時間均須填寫有效時間。${doseError}`;
  if (
    new Set(schedule.slots.map((s) => `${s.dayOffset || 0}:${s.time}`)).size !==
    schedule.slots.length
  )
    return "同一藥物的服藥時間不可重複。";
  if (new Set(schedule.slots.map((s) => s.id)).size !== schedule.slots.length)
    return "時間項目重複，請重新加入時間。";
  const stock = med.inventory;
  if (stock && !validInventoryQuantity(stock.quantity))
    return `目前庫存：${inventoryQuantityError}`;
  if (
    stock?.refillEnabled &&
    (stock.threshold == null ||
      !validInventoryQuantity(stock.threshold))
  )
    return `補藥提醒門檻：${inventoryQuantityError}`;
  return "";
}

export function scheduledIntakes(
  meds: Medication[],
  date: string,
): MedicationIntake[] {
  return meds
    .flatMap((med) => {
      const s = med.schedule;
      if (!med.id || !s || !med.reminderEnabled || s.frequency === "asNeeded")
        return [];
      return s.slots.flatMap((slot) => {
        const offset =
          s.frequency === "intervalHours" ? slot.dayOffset || 0 : 0;
        const windowDate = shiftDate(date, -offset);
        if (!isScheduleDate(s, windowDate) || (s.endDate && date > s.endDate)) return [];
        return [
          {
            id: intakeId(med.id!, slot.id, date),
            medicationId: med.id!,
            slotId: slot.id,
            date,
            time: slot.time,
            name: med.name,
            amount: slot.amount,
            unit: s.unit,
            status: "pending" as const,
          },
        ];
      });
    })
    .sort(
      (a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name),
    );
}

// Freeze past occurrences; replace only today's unconfirmed schedule snapshots.
export function reconcileIntakes(
  profile: UserProfile,
  now = new Date(),
): UserProfile {
  const today = localDate(now);
  const existing = profile.medicationIntakes || [];
  const historic = existing.filter(
    (e) => e.date !== today || e.status === "taken",
  );
  const historicIds = new Set(historic.map((e) => e.id));
  const added: MedicationIntake[] = [];
  if (
    profile.medicationLogDate &&
    validDate(profile.medicationLogDate) &&
    profile.medicationLogDate < today
  ) {
    const cursor = new Date(`${profile.medicationLogDate}T12:00:00`);
    for (
      cursor.setDate(cursor.getDate() + 1);
      localDate(cursor) < today;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      for (const entry of scheduledIntakes(
        profile.medications,
        localDate(cursor),
      ))
        if (!historicIds.has(entry.id)) added.push(entry);
    }
  }
  // Match actual same-day doses before stable slot IDs: branch changes can
  // regenerate IDs, while an old ID may now belong to a different time.
  const planned = scheduledIntakes(profile.medications, today);
  const takenToday = historic.filter(e => e.date === today && e.status === "taken");
  const matchedTaken = new Set<number>();
  const matchedPlanned = new Set<number>();
  for (const byTime of [true, false]) {
    planned.forEach((entry, index) => {
      if (matchedPlanned.has(index)) return;
      const match = takenToday.findIndex((taken, takenIndex) =>
        !matchedTaken.has(takenIndex) && taken.medicationId === entry.medicationId &&
        (byTime ? taken.time === entry.time : taken.id === entry.id));
      if (match >= 0) {
        matchedTaken.add(match);
        matchedPlanned.add(index);
      }
    });
  }
  const entries = [
    ...historic,
    ...added,
    ...planned.filter((_, index) => !matchedPlanned.has(index)).map(entry =>
      historicIds.has(entry.id) ? { ...entry, id: `${entry.id}:${entry.time}` } : entry),
  ];
  if (
    profile.medicationLogDate === today &&
    JSON.stringify(entries) === JSON.stringify(existing)
  )
    return profile;
  return { ...profile, medicationIntakes: entries, medicationLogDate: today };
}

export function todayIntakes(
  profile: UserProfile,
  now = new Date(),
): MedicationIntake[] {
  return reconcileIntakes(profile, now)
    .medicationIntakes!.filter((e) => e.date === localDate(now))
    .sort(
      (a, b) =>
        Number(a.status === "taken") - Number(b.status === "taken") ||
        a.time.localeCompare(b.time),
    );
}

export function confirmIntake(
  profile: UserProfile,
  id: string,
  now = new Date(),
): UserProfile {
  const current = reconcileIntakes(profile, now);
  const entry = current.medicationIntakes!.find((e) => e.id === id);
  if (!entry) throw new Error("這項服藥安排已更新，請重新查看。");
  if (entry.status === "taken") return current;
  if (entry.date !== localDate(now))
    throw new Error("這是過往的未確認紀錄，不會加入今天的服藥安排。");
  const med = current.medications.find((m) => m.id === entry.medicationId);
  if (!med) throw new Error("這項藥物已移除。");
  const debit = med.inventory
    ? Math.min(med.inventory.quantity, entry.amount)
    : 0;
  return {
    ...current,
    medications: current.medications.map((m) =>
      m.id === med.id && m.inventory
        ? {
            ...m,
            inventory: {
              ...m.inventory,
              quantity: rounded(m.inventory.quantity - debit),
            },
          }
        : m,
    ),
    medicationIntakes: current.medicationIntakes!.map((e) =>
      e.id === id
        ? {
            ...e,
            status: "taken",
            takenAt: now.getTime(),
            inventoryDebit: debit,
            inventoryShortfall: !!med.inventory && debit < entry.amount,
            inventoryRevision: med.inventory?.revision,
          }
        : e,
    ),
  };
}

export function undoIntake(profile: UserProfile, id: string): UserProfile {
  const entry = profile.medicationIntakes?.find((e) => e.id === id);
  if (!entry || entry.status !== "taken") return profile;
  const medication = profile.medications.find(
    (m) => m.id === entry.medicationId,
  );
  const canRestore =
    !!medication?.inventory &&
    medication.inventory.revision === entry.inventoryRevision;
  return {
    ...profile,
    medications: profile.medications.map((m) =>
      m.id === entry.medicationId && m.inventory && canRestore
        ? {
            ...m,
            inventory: {
              ...m.inventory,
              quantity: rounded(
                m.inventory.quantity + (entry.inventoryDebit || 0),
              ),
            },
          }
        : m,
    ),
    medicationIntakes: profile.medicationIntakes!.map((e) =>
      e.id === id
        ? {
            ...e,
            status: "pending",
            takenAt: undefined,
            inventoryDebit: undefined,
            inventoryShortfall: undefined,
            inventoryRevision: undefined,
          }
        : e,
    ),
  };
}

// Basic registration does not invent a schedule, inventory or intake records.
export function saveMedicationBasics(profile: UserProfile, med: Medication, mode: "create" | "edit" = "edit"): UserProfile {
  if (!med.name.trim()) throw new Error("請填寫藥物名稱。");
  const current = profile.medications.find((item) => item.id === med.id);
  if (mode === "create") {
    if (current) throw new Error("這項藥物已儲存，請返回藥物清單。");
    const next: Medication = { id: med.id || newId(), name: med.name.trim(), dosage: med.dosage, usage: med.usage, reminderEnabled: false };
    return { ...profile, medications: [...profile.medications, next] };
  }
  if (!current || !!current.schedule !== !!med.schedule) throw new Error("藥物資料已更新，請重新開啟編輯。");
  if (med.schedule) return saveMedication(profile, med);
  return { ...profile, medications: profile.medications.map((item) => item.id === med.id ? med : item) };
}

export function saveMedication(
  profile: UserProfile,
  med: Medication,
  now = new Date(),
): UserProfile {
  const error = validateMedication(med);
  if (error) throw new Error(error);
  const current = reconcileIntakes(profile, now);
  const next = {
    ...current,
    medications: current.medications.some((m) => m.id === med.id)
      ? current.medications.map((m) => (m.id === med.id ? med : m))
      : [...current.medications, med],
  };
  return reconcileIntakes(next, now);
}
export const lowStock = (med: Medication) =>
  !!med.inventory?.refillEnabled &&
  med.inventory.threshold != null &&
  med.inventory.quantity <= med.inventory.threshold;
export function scheduleLabel(med: Medication): string {
  if (!med.schedule) return "未設定提醒";
  const s = med.schedule;
  if (s.frequency === "asNeeded") return "按需要服用 · 無定時提醒";
  const times = s.slots
    .map((slot) => `${slot.time}${slot.dayOffset ? "（翌日）" : ""}`)
    .join("、");
  const prefix =
    s.frequency === "daily"
      ? "每天"
      : s.frequency === "weekly"
        ? `逢星期${[...s.weekdays]
            .sort()
            .map((d) => weekdayLabels[d])
            .join("、")}`
        : s.frequency === "intervalHours"
          ? `每隔 ${s.interval?.value || "—"} 小時`
          : s.frequency === "intervalDays"
            ? `每隔 ${s.interval?.value || "—"} 日`
            : `服用 ${s.cycle?.intakeDays || "—"} 日，暫停 ${s.cycle?.pauseDays || "—"} 日`;
  return `${prefix} · ${times}`;
}

export function refillMedication(
  profile: UserProfile,
  id: string,
  amount: number,
): UserProfile {
  const med = profile.medications.find((m) => m.id === id);
  if (!med?.inventory) throw new Error("藥量設定已更改，請重新開啟藥物詳情。");
  const quantity = rounded(med.inventory.quantity + amount);
  if (!validDose(amount) || !validInventoryQuantity(quantity))
    throw new Error("請填寫有效的補充數量。");
  return {
    ...profile,
    medications: profile.medications.map((m) =>
      m.id === id ? { ...m, inventory: { ...m.inventory!, quantity } } : m,
    ),
  };
}
