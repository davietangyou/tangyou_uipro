import type { UserProfile } from "./types";
import {
  DIET_HABITS,
  EXERCISE_TYPES,
  EXERCISE_DURATION_OPTIONS,
} from "./profileConstants";

export const dietSummary = (profile: UserProfile) =>
  profile.dietHabits.length
    ? profile.dietHabits
        .map((id) => DIET_HABITS.find((item) => item.id === id)?.label ?? id)
        .join("、")
    : "未有填寫飲食習慣";
export function activitySummary(profile: UserProfile): string {
  if (profile.exerciseFreq === "0") return "暫時沒有固定運動";
  if (!profile.exerciseFreq) return "未有填寫活動習慣";
  const days =
    profile.exerciseFreq === "5+"
      ? "5 天或以上"
      : `${profile.exerciseFreq.replace("-", "–")} 天`;
  const activities = profile.exerciseTypes
    .map((id) => id === "OTHER" ? (profile.otherExerciseNote.trim() || "其他活動") : EXERCISE_TYPES.find((item) => item.id === id)?.label ?? id)
    .join("、");
  const duration =
    EXERCISE_DURATION_OPTIONS.find(
      (item) => item.minutes === profile.exerciseMinutes,
    )?.label ??
    (profile.exerciseMinutes ? `約 ${profile.exerciseMinutes} 分鐘` : "");
  return `每週${activities || "活動"} ${days}${duration ? `，每次${duration}` : ""}`;
}
export function lifestyleComplete(profile: UserProfile): boolean {
  return (
    profile.dietHabits.length > 0 &&
    profile.exerciseFreq != null &&
    (profile.exerciseFreq === "0" ||
      (profile.exerciseMinutes != null && profile.exerciseMinutes > 0))
  );
}
// Hidden legacy fields are deliberately absent: saving a simplified form cannot erase them.
export function lifestylePatch(draft: UserProfile): Partial<UserProfile> {
  return {
    dietHabits: draft.dietHabits,
    favoriteFoods: draft.favoriteFoods.trim(),
    exerciseFreq: draft.exerciseFreq,
    exerciseMinutes: draft.exerciseMinutes,
    exerciseTypes: draft.exerciseTypes,
    otherExerciseNote: draft.otherExerciseNote.trim(),
  };
}
