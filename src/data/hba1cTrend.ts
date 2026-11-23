import type { HbA1cRecord } from "./types";
import type { ChartPoint } from "../components/RangeTrendChart";

const displayDate = (date: string) => date.replace(/-/g, "/");

export interface HbA1cTrendModel {
  points: ChartPoint[];
  domainStart: number;
  domainEnd: number;
  yMin: number;
  yMax: number;
  yTicks: number[];
  xTicks: number[];
  dateRangeLabel: string;
}

export function buildHbA1cTrendModel(records: HbA1cRecord[]): HbA1cTrendModel {
  // Date-only results use a plotting anchor, never a fabricated displayed time.
  const points = records.map(record => ({
    ts: new Date(record.date + "T" + (record.time || "12:00") + ":00").getTime(),
    value: Number(record.value),
  }));
  const dates = points.map(point => point.ts);
  const values = points.map(point => point.value);
  const recordDates = records.map(record => record.date).sort();
  const day = 86400000;
  const domainStart = dates.length ? Math.min(...dates) - day : Date.now() - day;
  const domainEnd = dates.length ? Math.max(...dates) + day : Date.now();
  const yMin = values.length ? Math.max(0, Math.floor(Math.min(...values) - 1)) : 0;
  const yMax = values.length ? Math.min(100, Math.ceil(Math.max(...values) + 1)) : 10;
  return {
    points,
    domainStart,
    domainEnd,
    yMin,
    yMax,
    yTicks: [yMin, (yMin + yMax) / 2, yMax],
    xTicks: [...new Set(dates)].sort((a, b) => a - b),
    dateRangeLabel: recordDates.length
      ? `${displayDate(recordDates[0])} 至 ${displayDate(recordDates[recordDates.length - 1])}`
      : "",
  };
}
