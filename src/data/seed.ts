import type { GlucoseRecord } from "./types";
import { slotById } from "./constants";

const DAY = 24 * 60 * 60 * 1000;

// 預置模擬資料：跨約 6 週，含正常/偏高/偏低，部分帶飲食/運動/症狀。
// 僅用於展示 Gauge / 分析 / 日誌的 filled 狀態；語義與 spec 一致。
interface Seed {
  daysAgo: number;
  hour: number;
  minute: number;
  slotId: string;
  value: number;
  diet?: string;
  exercise?: string;
  symptoms?: string[];
}

const SEEDS: Seed[] = [
  { daysAgo: 0, hour: 7, minute: 20, slotId: "wakeFasting", value: 6.4, diet: "" },
  { daysAgo: 0, hour: 13, minute: 5, slotId: "lunchPost", value: 9.1, diet: "白飯、蒸魚", exercise: "散步" },
  { daysAgo: 1, hour: 7, minute: 10, slotId: "wakeFasting", value: 7.6 },
  { daysAgo: 1, hour: 21, minute: 40, slotId: "dinnerPost", value: 11.8, diet: "茶餐廳、甜品", symptoms: ["口乾口渴", "極度疲倦"] },
  { daysAgo: 2, hour: 6, minute: 55, slotId: "wakeFasting", value: 5.9 },
  { daysAgo: 2, hour: 15, minute: 30, slotId: "random", value: 3.6, symptoms: ["頭暈", "冒冷汗", "心悸手震"] },
  { daysAgo: 3, hour: 7, minute: 30, slotId: "wakeFasting", value: 6.1, exercise: "太極" },
  { daysAgo: 3, hour: 12, minute: 50, slotId: "lunchPost", value: 8.7, diet: "粥、青菜" },
  { daysAgo: 4, hour: 7, minute: 15, slotId: "wakeFasting", value: 6.8 },
  { daysAgo: 5, hour: 22, minute: 10, slotId: "bedtime", value: 7.2 },
  { daysAgo: 6, hour: 7, minute: 25, slotId: "wakeFasting", value: 6.5 },
  { daysAgo: 7, hour: 13, minute: 15, slotId: "lunchPost", value: 10.4, diet: "麵食", symptoms: ["視力模糊"] },
  { daysAgo: 9, hour: 7, minute: 5, slotId: "wakeFasting", value: 7.1 },
  { daysAgo: 11, hour: 19, minute: 20, slotId: "dinnerPre", value: 5.4, exercise: "行樓梯" },
  { daysAgo: 13, hour: 7, minute: 40, slotId: "wakeFasting", value: 6.3 },
  { daysAgo: 16, hour: 12, minute: 30, slotId: "lunchPost", value: 9.6, diet: "飲品、水果" },
  { daysAgo: 20, hour: 7, minute: 0, slotId: "wakeFasting", value: 6.9 },
  { daysAgo: 25, hour: 21, minute: 50, slotId: "dinnerPost", value: 12.3, diet: "甜品", symptoms: ["頻尿", "口乾口渴"] },
  { daysAgo: 31, hour: 7, minute: 35, slotId: "wakeFasting", value: 6.6 },
  { daysAgo: 38, hour: 13, minute: 0, slotId: "lunchPost", value: 8.9 },
];

export function buildSeedRecords(now: number = Date.now()): GlucoseRecord[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const base = midnight.getTime();

  const records = SEEDS.map((s, i) => {
    const slot = slotById(s.slotId)!;
    const ts = base - s.daysAgo * DAY + (s.hour * 60 + s.minute) * 60 * 1000;
    const rec: GlucoseRecord = {
      id: `seed-${i}-${ts}`,
      value: Math.round(s.value * 10) / 10,
      timestamp: ts,
      timeType: slot.timeType,
      mealTag: slot.mealTag,
      dietNote: s.diet || undefined,
      exerciseNote: s.exercise || undefined,
      symptoms: s.symptoms ?? [],
    };
    return rec;
  });

  // 依 timestamp 倒序（spec：插入並依 timestamp 倒序）
  return records.sort((a, b) => b.timestamp - a.timestamp);
}
