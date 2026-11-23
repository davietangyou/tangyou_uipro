import { localDate } from './hba1c';
import { todayIntakes, scheduleLabel } from './medication';
import type { GlucoseRecord, UserProfile } from './types';

export function recentGlucoseSummary(records: readonly GlucoseRecord[]) {
  const readings = records.filter(record => record.value > 0)
    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 7).reverse();
  const peak = Math.max(1, ...readings.map(record => record.value));
  return { latest: readings.at(-1), bars: readings.map(record => ({ ...record, height: 24 * record.value / peak })) };
}

export function homeMedicationSummary(profile: UserProfile, now: Date) {
  const entries = todayIntakes(profile, now).sort((a,b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
  const taken = entries.filter(entry => entry.status === 'taken').length;
  const pending = entries.find(entry => entry.status !== 'taken');
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (entries.length) return {
    entries, taken, headline: String(taken),
    hint: pending ? `${pending.time <= time ? '待確認' : '下次'} · ${pending.time}` : '今日安排已確認',
  };

  const medications = profile.medications;
  const timed = medications.filter(med => med.schedule && med.schedule.frequency !== 'asNeeded' && med.reminderEnabled);
  const asNeeded = medications.some(med => med.schedule?.frequency === 'asNeeded');
  if (timed.length) {
    const date = localDate(now);
    const resting = timed.every(med => med.schedule!.frequency === 'cycle' &&
      date >= med.schedule!.startDate && (!med.schedule!.endDate || date <= med.schedule!.endDate));
    return { entries, taken, headline: resting ? '暫停期' : '無安排',
      hint: timed.length === 1 ? scheduleLabel(timed[0]).split(' · ')[0] : '今天未有定時安排' };
  }
  if (asNeeded) return { entries, taken, headline: '按需要', hint: '不設固定提醒' };
  if (medications.some(med => med.schedule)) return { entries, taken, headline: '提醒已關', hint: '藥物資料仍保留' };
  return { entries, taken, headline: '未設定', hint: medications.length ? '可稍後設定時間表' : '先加入藥物資料' };
}
