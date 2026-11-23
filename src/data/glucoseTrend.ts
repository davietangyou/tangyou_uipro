/** Shared by the inline and fullscreen blood-glucose plots. */
export const GLUCOSE_STATS_RANGES = [
  { id: '1w', label: '最近一週', months: 0 },
  { id: '1m', label: '最近一個月', months: 1 },
  { id: '3m', label: '最近三個月', months: 3 },
  { id: '6m', label: '最近六個月', months: 6 },
] as const;
export type GlucoseStatsRange = typeof GLUCOSE_STATS_RANGES[number]['id'];

/** Inclusive dates ending today, with month-end clamping before advancing a day. */
export function glucoseStatsRangeStart(range: GlucoseStatsRange, todayStart: number): number {
  const start = new Date(todayStart);
  const months = GLUCOSE_STATS_RANGES.find(option => option.id === range)!.months;
  if (months === 0) start.setDate(start.getDate() - 6);
  else {
    const day = start.getDate();
    start.setDate(1);
    start.setMonth(start.getMonth() - months);
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    start.setDate(Math.min(day, lastDay) + 1);
  }
  return start.getTime();
}

export function glucoseRecordsInStatsRange<T extends {value:number;timestamp:number}>(records:readonly T[], range:GlucoseStatsRange, todayStart:number):T[] {
  const start = glucoseStatsRangeStart(range, todayStart);
  const end = new Date(todayStart);
  end.setDate(end.getDate() + 1);
  return records.filter(record => record.value > 0 && record.timestamp >= start && record.timestamp < end.getTime());
}

export function glucoseRecordsInCalendarRange<T extends {value:number;timestamp:number}>(records:readonly T[],days:number,todayStart:number):T[] {
  const start=new Date(todayStart);
  start.setDate(start.getDate()-(days-1));
  const end=new Date(todayStart);
  end.setDate(end.getDate()+1);
  return records.filter(record=>record.value>0&&record.timestamp>=start.getTime()&&record.timestamp<end.getTime());
}

export function glucoseTrendAxis(points: readonly { value: number }[]) {
  const highest = points.reduce((max, point) => Number.isFinite(point.value) ? Math.max(max, point.value) : max, 12);
  const step = Math.max(2, Math.ceil(highest / 6 / 2) * 2);
  const yMax = Math.ceil(highest / step) * step;
  const yTicks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, index) => index * step);
  return { yMax, yTicks };
}
