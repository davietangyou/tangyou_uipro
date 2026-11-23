import type { GlucoseStatus, MealTag, TimeType } from "./types";

// 十個既有量度時段（spec §7.1）。每個時段對映一個 timeType 與可選 mealTag。
export interface TimeSlot {
  id: string;
  label: string;
  timeType: TimeType;
  mealTag?: MealTag;
}

export const TIME_SLOTS: TimeSlot[] = [
  { id: "wakeFasting", label: "起床空腹", timeType: "fasting" },
  { id: "breakfastPre", label: "早餐前", timeType: "preMeal", mealTag: "breakfast" },
  { id: "breakfastPost", label: "早餐後", timeType: "postMeal", mealTag: "breakfast" },
  { id: "lunchPre", label: "午餐前", timeType: "preMeal", mealTag: "lunch" },
  { id: "lunchPost", label: "午餐後", timeType: "postMeal", mealTag: "lunch" },
  { id: "dinnerPre", label: "晚餐前", timeType: "preMeal", mealTag: "dinner" },
  { id: "dinnerPost", label: "晚餐後", timeType: "postMeal", mealTag: "dinner" },
  { id: "bedtime", label: "睡前", timeType: "bedtime" },
  { id: "night", label: "夜間", timeType: "random" },
  { id: "random", label: "日常隨機", timeType: "random" },
];

export function slotById(id: string): TimeSlot | undefined {
  return TIME_SLOTS.find((s) => s.id === id);
}

// 依 timeType + mealTag 反查一個可代表的時段 label（供日誌/摘要顯示）
export function slotLabelFor(timeType: TimeType, mealTag?: MealTag): string {
  // Saved records do not distinguish the night and random entry options.
  if (timeType === "random") return "日常隨機";
  const match = TIME_SLOTS.find(
    (s) => s.timeType === timeType && s.mealTag === mealTag,
  );
  if (match) return match.label;
  const byType = TIME_SLOTS.find((s) => s.timeType === timeType);
  return byType?.label ?? "日常隨機";
}

// 血糖狀態門檻（spec §7.1，維持不變）：
// <4.0 偏低；空腹/餐前 >7.0 偏高；其他 >10.0 偏高；否則理想。
export function glucoseStatus(value: number, timeType: TimeType): GlucoseStatus {
  if (value < 4.0) return "low";
  const fastingLike = timeType === "fasting" || timeType === "preMeal";
  if (fastingLike) return value > 7.0 ? "high" : "ideal";
  return value > 10.0 ? "high" : "ideal";
}

export const STATUS_TEXT: Record<GlucoseStatus, string> = {
  low: "偏低",
  ideal: "正常",
  high: "偏高",
};

// 依目前小時建議時段（spec §7.1：首次 mount 依目前小時自動建議）
export function suggestSlotId(hour: number): string {
  if (hour >= 5 && hour < 9) return "wakeFasting";
  if (hour >= 9 && hour < 11) return "breakfastPost";
  if (hour >= 11 && hour < 13) return "lunchPre";
  if (hour >= 13 && hour < 15) return "lunchPost";
  if (hour >= 15 && hour < 18) return "random";
  if (hour >= 18 && hour < 20) return "dinnerPre";
  if (hour >= 20 && hour < 22) return "dinnerPost";
  if (hour >= 22 || hour < 1) return "bedtime";
  return "night";
}

// 主要時間範圍（Approved Change 8.4）：近 7 天 / 近 30 天 / 近 3 個月，年/自訂為次級。
export type RangeId = "7d" | "30d" | "3m" | "1y" | "custom";

export interface RangeOption {
  id: RangeId;
  label: string;
  days: number | null; // null = 自訂
}

export const PRIMARY_RANGES: RangeOption[] = [
  { id: "7d", label: "近 7 天", days: 7 },
  { id: "30d", label: "近 30 天", days: 30 },
  { id: "3m", label: "近 3 個月", days: 90 },
];

export const SECONDARY_RANGES: RangeOption[] = [
  { id: "1y", label: "近 1 年", days: 365 },
  { id: "custom", label: "自訂範圍", days: null },
];

// 常用飲食 / 運動 / 症狀快捷標籤
export const DIET_TAGS = [
  "清淡少油",
  "多蔬菜／高纖",
  "白飯／澱粉主食",
  "茶餐廳／高油外賣",
  "低 GI 雜糧糙米",
  "水果甜品",
  "無糖茶飲",
  "少吃了一餐",
];
export const EXERCISE_TAGS = [
  "散步 20–30 分鐘",
  "深蹲／坐站 15–20 次",
  "太極／八段錦",
  "彈力帶／啞鈴肌力",
  "靠牆掌上壓／提踵",
  "慢跑／快走",
  "居家伸展操",
  "做家務／行樓梯",
  "今天沒有運動",
];

// Exact aliases for shipped presets only; free-text notes are not translated.
const LEGACY_LIFESTYLE_TAGS: Readonly<Record<string, string>> = {
  "多蔬菜／高纤": "多蔬菜／高纖",
  "白饭／淀粉主食": "白飯／澱粉主食",
  "茶餐厅／高油外卖": "茶餐廳／高油外賣",
  "低 GI 杂粮糙米": "低 GI 雜糧糙米",
  "水果甜点": "水果甜品",
  "无糖茶饮": "無糖茶飲",
  "散步 20–30 分钟": "散步 20–30 分鐘",
  "太极／八段锦": "太極／八段錦",
  "弹力带／哑铃肌力": "彈力帶／啞鈴肌力",
  "靠墙俯卧撑／提踵": "靠牆掌上壓／提踵",
  "做家务／走楼梯": "做家務／行樓梯",
  "今天没有运动": "今天沒有運動",
};

export function lifestyleTagsForEditing(note?: string): string[] {
  return [...new Set((note ?? "").split("、").filter(Boolean)
    .map(tag => Object.hasOwn(LEGACY_LIFESTYLE_TAGS, tag) ? LEGACY_LIFESTYLE_TAGS[tag] : tag))];
}
// 十個既有預設症狀（繁體中文，順序與語義固定，不改動）
export const SYMPTOM_TAGS = [
  "頭暈",
  "冒冷汗",
  "心悸手震",
  "極度飢餓",
  "口乾口渴",
  "頻尿",
  "極度疲倦",
  "視力模糊",
  "噁心不適",
  "手腳發麻",
];
