import type { UserProfile } from './types';
import { questionComparisonKey } from '../../shared/locale';
export const normalizeQuestion = (text: string) => text.trim().replace(/\s+/g, ' ');
export function mergeQuestions(existing: string[], imported: string[]): string[] {
  const seen = new Set<string>();
  return [...existing, ...imported].filter(q => {
    const text = questionComparisonKey(q);
    if (!text || seen.has(text)) return false;
    seen.add(text); return true;
  });
}
export function migrateChatQuestions(profile: UserProfile, storage: Pick<Storage, 'getItem' | 'setItem'>, prefix: string): UserProfile {
  const sourceKey = `${prefix}saved_doctor_questions`, marker = `${sourceKey}_migrated_to_profile`;
  if (storage.getItem(marker) === '1') return profile;
  const raw = storage.getItem(sourceKey);
  if (raw === null) return profile;
  let imported: unknown;
  try { imported = JSON.parse(raw); } catch { throw new Error('舊問診備忘未能讀取，原有資料已保留。'); }
  if (!Array.isArray(imported) || imported.some(q => typeof q !== 'string')) throw new Error('舊問診備忘格式不正確，原有資料已保留。');
  const profileKey = `${prefix}profile`;
  if (!storage.getItem(`${sourceKey}_pre_merge`)) storage.setItem(`${sourceKey}_pre_merge`, raw);
  if (!storage.getItem(`${profileKey}_pre_questions`)) storage.setItem(`${profileKey}_pre_questions`, storage.getItem(profileKey) || JSON.stringify(profile));
  const next = { ...profile, savedDoctorQuestions: mergeQuestions(profile.savedDoctorQuestions || [], imported as string[]) };
  storage.setItem(profileKey, JSON.stringify(next));
  storage.setItem(marker, '1');
  return next;
}
