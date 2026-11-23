import type {
  DiabetesType,
  ExerciseFreq,
  ExerciseIntensity,
  Sex,
} from "./types";

// 個人檔案選項清單與純函式（語義沿用 spec §10；香港繁體）。

export const SEX_OPTIONS: { id: Sex; label: string }[] = [
  { id: "male", label: "男" },
  { id: "female", label: "女" },
  { id: "other", label: "其他" },
];

export const DIABETES_TYPE_OPTIONS: { id: DiabetesType; label: string }[] = [
  { id: "type1", label: "一型糖尿病" },
  { id: "type2", label: "二型糖尿病" },
  { id: "gestational", label: "妊娠糖尿病" },
  { id: "prediabetes", label: "糖尿病前期" },
  { id: "unknown", label: "未確定 / 不清楚" },
  { id: "other", label: "其他類型" },
];

// 共病管理（糖尿病本身不出現在此表）。
export const COMMON_CONDITIONS = [
  "高血壓",
  "高血脂",
  "心臟病",
  "腎病",
  "眼睛病變",
  "神經病變",
  "白內障",
];

export const OTHER_CONDITIONS = [
  "中風",
  "痛風",
  "甲狀腺疾病",
  "骨質疏鬆",
  "關節炎",
  "抑鬱 / 焦慮",
  "睡眠窒息症",
  "癌症",
  "呼吸系統疾病",
  "退化性關節炎",
  "腸胃疾病",
  "肝病",
  "其他",
];

// 飲食習慣（五項原版選項，前端保存 ID）
export const DIET_HABITS: { id: string; label: string }[] = [
  { id: "OUTSIDE_EATING", label: "經常在外吃飯" },
  { id: "REFINED_CARB", label: "常吃白飯、粉麵或麵包" },
  { id: "SUGARY_DRINK", label: "常喝奶茶、汽水等甜飲品" },
  { id: "MIDNIGHT_SNACK", label: "習慣吃宵夜或睡前小食" },
  { id: "HOME_COOK", label: "多在家煮，三餐定時定量" },
];

// 運動類型（八項原版選項，前端保存 ID）
export const EXERCISE_TYPES: { id: string; label: string }[] = [
  { id: "WALK", label: "散步／快步行" },
  { id: "RESISTANCE", label: "深蹲／掌上壓等肌力活動" },
  { id: "TAICHI", label: "太極／八段錦／氣功" },
  { id: "SWIM", label: "游泳／水中健體" },
  { id: "CYCLE", label: "健身單車／慢跑" },
  { id: "STRETCH", label: "拉筋／椅子操" },
  { id: "HIKE", label: "郊遊遠足／行山" },
  { id: "OTHER", label: "其他活動／沒有固定項目" },
];

export const EXERCISE_FREQ_OPTIONS: { id: ExerciseFreq; label: string; daysPerWeek: number }[] = [
  { id: "0", label: "0 日", daysPerWeek: 0 },
  { id: "1-2", label: "1–2 日", daysPerWeek: 1.5 },
  { id: "3-4", label: "3–4 日", daysPerWeek: 3.5 },
  { id: "5+", label: "5 日以上", daysPerWeek: 5 },
];

export const EXERCISE_INTENSITY_OPTIONS: { id: ExerciseIntensity; label: string }[] = [
  { id: "LIGHT", label: "輕度" },
  { id: "MODERATE", label: "中等" },
  { id: "VIGOROUS", label: "高強度" },
];

// 每次運動時長（四項固定選項）
export const EXERCISE_DURATION_OPTIONS: { id: string; label: string; minutes: number }[] = [
  { id: "15", label: "少於 20 分鐘", minutes: 15 },
  { id: "30", label: "約 30 分鐘", minutes: 30 },
  { id: "45", label: "約 45 分鐘", minutes: 45 },
  { id: "60+", label: "60 分鐘以上", minutes: 60 },
];

// 每週運動狀態（系統計算結果）
export type ExerciseWeeklyStatus = "NONE" | "UNDER_150" | "MET_150";

export const EXERCISE_WEEKLY_STATUS_TEXT: Record<ExerciseWeeklyStatus, string> = {
  NONE: "幾乎無運動",
  UNDER_150: "不足（少於 150 分鐘／週）",
  MET_150: "達標（至少 150 分鐘／週）",
};

// ---- BMI ----
export function computeBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function toKg(weight: number | null, unit: "kg" | "lb"): number | null {
  if (weight == null) return null;
  return unit === "lb" ? weight * 0.453592 : weight;
}

export interface BmiCategory {
  label: string;
  tone: "low" | "ideal" | "high" | "danger";
  description: string;
}

// 依年齡分類：≥65 長者參考帶較寬（肥胖悖論 obesity paradox）。
// 閾值來源：長者標準——老年醫學循證研究；成人標準——香港衛生署/WHO華人標準。
export function bmiCategory(bmi: number | null, age: number | null): BmiCategory | null {
  if (bmi == null) return null;
  const elderly = (age ?? 0) >= 65;
  const lowMax = elderly ? 20 : 18.5;
  const idealMax = elderly ? 27 : 23;
  const highMax = elderly ? 30 : 25;
  if (elderly) {
    if (bmi < lowMax) return { label: "偏輕消瘦", tone: "low", description: "長者體重偏輕，可能伴隨肌少症或營養不良風險，應避免刻意節食減重，宜補充足夠蛋白質與熱量。建議維持足夠體重儲備，預防肌少症與衰弱。" };
    if (bmi < idealMax) return { label: "長者黃金理想", tone: "ideal", description: "符合長者糖友最佳保護區間！適度微胖有助於抵禦疾病消耗、維持肌力與抵抗力。長者適度微胖存活率與抗病力最佳（微胖是福）。" };
    if (bmi < highMax) return { label: "長者微重", tone: "high", description: "體重稍高，建議以規律散步、維持肌力為主，不建議長者進行過度嚴苛節食。重在「維持肌肉量與日常活力」，不宜盲目追求減重。" };
    return { label: "長者顯著肥胖", tone: "danger", description: "可能增加膝關節負擔及心血管負荷，建議在醫生及營養師指導下進行溫和調整。建議諮詢醫護人員進行溫和、不流失肌肉的安全體重管理。" };
  }
  if (bmi < lowMax) return { label: "體重過輕", tone: "low", description: "體重過輕，建議注意均衡營養與熱量攝取。" };
  if (bmi < idealMax) return { label: "適中理想", tone: "ideal", description: "身材指標非常理想，請繼續保持！" };
  if (bmi < highMax) return { label: "過重偏高", tone: "high", description: "略高於華人成人理想上限，建議適度控制糖分及增加運動量。" };
  return { label: "肥胖指標", tone: "danger", description: "肥胖會增加胰島素阻抗，建議逐步調整飲食與運動改善體態。" };
}

// 每週運動狀態計算（中 / 高強度 ≥150 分鐘為達標）
export function getExerciseWeeklyStatus(
  freq: ExerciseFreq | null,
  minutes: number | null,
  intensity: ExerciseIntensity | null,
): ExerciseWeeklyStatus {
  if (!freq || freq === "0" || !minutes || !intensity) return "NONE";
  const days = EXERCISE_FREQ_OPTIONS.find((f) => f.id === freq)?.daysPerWeek ?? 0;
  if (days === 0) return "NONE";
  if (intensity === "LIGHT") return "UNDER_150";
  return days * minutes >= 150 ? "MET_150" : "UNDER_150";
}

export function exerciseGoalMet(
  freq: ExerciseFreq | null,
  minutes: number | null,
  intensity: ExerciseIntensity | null,
): boolean {
  return getExerciseWeeklyStatus(freq, minutes, intensity) === "MET_150";
}