import { localDate } from './hba1c';
import { dateRangeError } from './dateRange';
import type { HealthLogEntry, HealthLogGroup } from './healthLog';

export const DAY_PARTS = [
  { id: 'morning', label: '早上', hours: '00:00–11:59' },
  { id: 'afternoon', label: '下午', hours: '12:00–17:59' },
  { id: 'evening', label: '晚上', hours: '18:00–23:59' },
] as const;
export type DayPart = typeof DAY_PARTS[number]['id'];
export type ScheduleGlucose = Extract<HealthLogEntry, { kind: 'glucose' }>;
export type ScheduleDay = {
  date: string;
  readings: Record<DayPart, ScheduleGlucose[]>;
  more: HealthLogEntry[];
  hba1cCount: number;
  symptomCount: number;
};

/** Calendar arithmetic at noon avoids elapsed-hour/DST errors. */
export function shiftCalendarDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
}
export function schedulePageForDate(today: string, date: string): number {
  const ordinal = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };
  return Math.max(0, Math.floor((ordinal(today) - ordinal(date)) / 7));
}
export function dayPartForTime(time: string): DayPart {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}
export function buildHealthSchedule(groups: HealthLogGroup[], today: string, page: number): ScheduleDay[] {
  const end = shiftCalendarDate(today, -7 * Math.max(0, Math.floor(page)));
  return buildHealthScheduleRange(groups, shiftCalendarDate(end, -6), end);
}
export function calendarRangeDays(start: string, end: string): number {
  if (dateRangeError(start, end)) return 0;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}
export function buildHealthScheduleRange(groups: HealthLogGroup[], start: string, end: string): ScheduleDay[] {
  const byDate = new Map(groups.map(group => [group.date, group.items]));
  return Array.from({ length: calendarRangeDays(start, end) }, (_, offset) => {
    const date = shiftCalendarDate(end, -offset);
    const items = [...(byDate.get(date) ?? [])].sort((a,b) =>
      (b.time || '').localeCompare(a.time || '') || b.timestamp - a.timestamp || `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
    const readings: ScheduleDay['readings'] = { morning: [], afternoon: [], evening: [] };
    for (const item of items) if (item.kind === 'glucose' && item.value > 0) readings[dayPartForTime(item.time)].push(item);
    return { date, readings,
      more: items.filter(item => item.kind === 'hba1c' || item.symptoms.length > 0),
      hba1cCount: items.filter(item => item.kind === 'hba1c').length,
      symptomCount: items.filter(item => item.kind === 'glucose' && item.symptoms.length > 0).length,
    };
  });
}
