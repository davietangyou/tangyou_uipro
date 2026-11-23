import type {GlucoseRecord} from './types';
import {SYMPTOM_TAGS} from './constants';
import {glucoseStatsRangeStart,type GlucoseStatsRange} from './glucoseTrend';
import {symptomGroup, SYMPTOM_GROUP_LABELS, type SymptomGroup} from './symptomClinical';

/** Counts include symptom-only records; recents are independent of the range. */
export function symptomOverview(records:readonly GlucoseRecord[],range:GlucoseStatsRange,todayStart:number) {
  const start=glucoseStatsRangeStart(range,todayStart);
  const end=new Date(todayStart);end.setDate(end.getDate()+1);
  const symptoms=records.filter(record=>record.symptoms.length>0);
  const inRange=symptoms.filter(record=>record.timestamp>=start&&record.timestamp<end.getTime());
  const tally=new Map<string,number>();
  for(const record of inRange)for(const name of record.symptoms)tally.set(name,(tally.get(name)??0)+1);
  const order=(name:string)=>{const index=(SYMPTOM_TAGS as readonly string[]).indexOf(name);return index<0?SYMPTOM_TAGS.length:index;};
  const counts=[...tally].sort((a,b)=>b[1]-a[1]||order(a[0])-order(b[0])||a[0].localeCompare(b[0],'zh-Hant'));
  return {recordCount:inRange.length,counts,recent:[...symptoms].sort((a,b)=>b.timestamp-a.timestamp).slice(0,2)};
}

// ── Group-level statistics ──────────────────────────────────────────────────

export interface SymptomGroupStats {
  group: SymptomGroup;
  label: string;
  count: number;
}

export function symptomGroupStats(records: readonly GlucoseRecord[], range: GlucoseStatsRange, todayStart: number): SymptomGroupStats[] {
  const start = glucoseStatsRangeStart(range, todayStart);
  const end = new Date(todayStart); end.setDate(end.getDate() + 1);
  const inRange = records.filter(r => r.symptoms.length > 0 && r.timestamp >= start && r.timestamp < end.getTime());

  const groupCounts = new Map<SymptomGroup, number>();
  for (const record of inRange) {
    for (const name of record.symptoms) {
      const g = symptomGroup(name);
      groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
    }
  }

  const groupOrder: SymptomGroup[] = ['LOW_BG', 'HIGH_BG', 'COMPLICATION', 'GENERAL'];
  return groupOrder
    .filter(g => groupCounts.has(g))
    .map(g => ({ group: g, label: SYMPTOM_GROUP_LABELS[g], count: groupCounts.get(g)! }));
}

// ── Clinical memo (就诊摘要) ────────────────────────────────────────────────

function slotLabelForTimeType(timeType: string): string {
  const labels: Record<string, string> = {
    fasting: '空腹', preMeal: '餐前', postMeal: '餐後', bedtime: '睡前', random: '日常隨機',
  };
  return labels[timeType] || timeType;
}

export function generateClinicalMemo(records: readonly GlucoseRecord[], range: GlucoseStatsRange, todayStart: number): string {
  const start = glucoseStatsRangeStart(range, todayStart);
  const end = new Date(todayStart); end.setDate(end.getDate() + 1);
  const inRange = records.filter(r => r.symptoms.length > 0 && r.timestamp >= start && r.timestamp < end.getTime());

  if (!inRange.length) return '患者近期暫無自覺不適或症狀紀錄。';

  // Tally symptoms
  const tally = new Map<string, { count: number; timeTypes: Map<string, number> }>();
  let totalSymptomInstances = 0;
  for (const record of inRange) {
    for (const name of record.symptoms) {
      totalSymptomInstances++;
      const entry = tally.get(name) || { count: 0, timeTypes: new Map() };
      entry.count++;
      entry.timeTypes.set(record.timeType, (entry.timeTypes.get(record.timeType) ?? 0) + 1);
      tally.set(name, entry);
    }
  }

  // Sort by frequency, take top 3
  const sorted = [...tally.entries()].sort((a, b) => b[1].count - a[1].count);
  const top3 = sorted.slice(0, 3);

  const lines: string[] = [];
  lines.push(`累計不適紀錄 ${inRange.length} 筆，症狀人次共 ${totalSymptomInstances} 次。`);

  // Top symptoms with peak time slot
  for (let i = 0; i < top3.length; i++) {
    const [name, data] = top3[i];
    const peakSlot = [...data.timeTypes.entries()].sort((a, b) => b[1] - a[1])[0];
    lines.push(`第${i + 1}高頻：「${name}」${data.count} 次，高發時段：${slotLabelForTimeType(peakSlot[0])}。`);
  }

  // Group-specific recommendations
  const groupCounts = new Map<SymptomGroup, number>();
  for (const [name, data] of tally) {
    const g = symptomGroup(name);
    groupCounts.set(g, (groupCounts.get(g) ?? 0) + data.count);
  }

  if ((groupCounts.get('LOW_BG') ?? 0) > 0) {
    lines.push('建議排查降糖藥物劑量是否偏大或餐食延遲。');
  }
  if ((groupCounts.get('HIGH_BG') ?? 0) > 0) {
    lines.push('建議評估餐後血糖峰值是否過高。');
  }
  if ((groupCounts.get('COMPLICATION') ?? 0) > 0) {
    lines.push('建議安排下肢觸覺與眼底檢查。');
  }

  return lines.join('\n');
}