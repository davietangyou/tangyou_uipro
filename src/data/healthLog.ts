import type { GlucoseRecord, HbA1cRecord } from "./types";
import { localDate, localTime } from "./hba1c";

export type HealthLogEntry =
  | (GlucoseRecord & { kind: "glucose"; date: string; time: string })
  | (HbA1cRecord & { kind: "hba1c" });
export type HealthLogGroup = { key: string; date: string; items: HealthLogEntry[] };

/** Presentation adapter only: measured HbA1c never enters glucose statistics. */
export function groupHealthLog(glucose: GlucoseRecord[], hba1c: HbA1cRecord[], symptomFilter: string | null = null): HealthLogGroup[] {
  const entries: HealthLogEntry[] = glucose
    .filter(record => !symptomFilter || record.symptoms.includes(symptomFilter))
    .map(record => ({ ...record, kind: "glucose", date: localDate(new Date(record.timestamp)), time: localTime(new Date(record.timestamp)) }));
  if (!symptomFilter) entries.push(...hba1c.map(record => ({ ...record, kind: "hba1c" as const })));
  entries.sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || "") || b.timestamp - a.timestamp || `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  const groups = new Map<string, HealthLogGroup>();
  for (const entry of entries) {
    if (!groups.has(entry.date)) groups.set(entry.date, { key: entry.date, date: entry.date, items: [] });
    groups.get(entry.date)!.items.push(entry);
  }
  return [...groups.values()];
}
