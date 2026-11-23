import type { HbA1cRecord } from "./types";
import { newRecordId } from './id';

export type HbA1cInput = { value: string; date: string; time?: string };
export const HBA1C_GAUGE_MAX = 15;
export const HBA1C_STATUS = {
  excellent: { label: "非糖尿病/非常理想", shortLabel: "非常理想", color: "#166534", arc: "#22C55E", surface: "#DCFCE7" },
  ideal: { label: "控制良好", shortLabel: "控制良好", color: "#206A3D", arc: "#52C07A", surface: "#E3F0E5" },
  elevated: { label: "尚可", shortLabel: "尚可", color: "#8A5100", arc: "#F5A623", surface: "#FFF0D6" },
  high: { label: "偏高", shortLabel: "偏高", color: "#AE3431", arc: "#E05A4E", surface: "#FBE9E7" },
} as const;
// Fixed product thresholds; intentionally independent of patient/profile data.
// 4-tier: <6.0% excellent, 6.0-6.9% ideal, 7.0-7.9% elevated, >=8.0% high.
export function hba1cStatus(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 100) return null;
  return value < 6 ? "excellent" : value < 7 ? "ideal" : value < 8 ? "elevated" : "high";
}
export function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function localTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value;
}
export function validateHbA1c(
  value: string,
  date: string,
  today = localDate(),
) {
  return {
    value:
      !/^\d+(\.\d+)?$/.test(value.trim()) ||
      !Number.isFinite(Number(value)) ||
      Number(value) <= 0 ||
      Number(value) > 100
        ? "請輸入大於 0、不超過 100 的百分比。"
        : "",
    date: !validDate(date)
      ? "請選擇有效的檢測日期。"
      : date > today
        ? "檢測日期不能在今天之後。"
        : "",
  };
}
export function createHbA1c(
  value: string,
  date: string,
  previous?: HbA1cRecord,
  time = previous?.time,
): HbA1cRecord {
  const errors = validateHbA1c(value, date);
  if (errors.value || errors.date) throw new Error(errors.value || errors.date);
  if (time && !validTime(time)) throw new Error("請選擇有效的檢測時間。");
  return {
    ...previous,
    id: previous?.id ?? newRecordId(),
    value: String(Number(value)),
    date,
    // An explicit empty value clears a previously known time; an omitted
    // argument keeps the existing value through the default above.
    time: time || undefined,
    // A legacy date anchor is never exposed as a known test time.
    timestamp: !time && previous?.date === date
      ? previous.timestamp
      : new Date(`${date}T${time || "12:00"}:00`).getTime(),
  };
}
export function sortHbA1c(records: HbA1cRecord[]): HbA1cRecord[] {
  return [...records].sort(
    (a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || "") || b.timestamp - a.timestamp || a.id.localeCompare(b.id),
  );
}
export function migrateHbA1c(raw: unknown): HbA1cRecord[] {
  if (!Array.isArray(raw))
    throw new Error("糖化紀錄格式不正確，原有資料已保留。");
  const ids = new Set<string>();
  const records = raw.map((record) => {
    if (
      !record ||
      typeof record.id !== "string" ||
      !record.id ||
      ids.has(record.id) ||
      typeof record.date !== "string" ||
      !validDate(record.date) ||
      (record.time !== undefined && (typeof record.time !== "string" || !validTime(record.time))) ||
      !["string", "number"].includes(typeof record.value) ||
      !String(record.value).trim() ||
      !Number.isFinite(Number(record.value)) ||
      Number(record.value) <= 0 ||
      Number(record.value) > 100 ||
      (record.timestamp !== undefined &&
        (typeof record.timestamp !== "number" || !Number.isFinite(record.timestamp)))
    ) {
      throw new Error("部分糖化紀錄未能讀取，原有資料已保留，請勿重置。");
    }
    ids.add(record.id);
    const timestamp = record.timestamp ?? new Date(`${record.date}T${record.time || "12:00"}:00`).getTime();
    return { ...record, value: String(record.value), timestamp } as HbA1cRecord;
  });
  return sortHbA1c(records);
}