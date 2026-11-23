import type { UserProfile } from "./types";

// 預置示例個人檔案（陳伯伯）：部分填、部分空，讓完成度 < 5/5 可展示。
export function buildSeedProfile(): UserProfile {
  return {
    // 基本資料（完整）
    name: "陳伯伯",
    age: 68,
    sex: "male",
    heightCm: 168,
    weight: 72,
    weightUnit: "kg",

    // 糖尿病相關（完整）
    diabetesType: "type2",
    diagnosisYear: 2015,
    diabetesDurationYears: 11,
    usesDiabetesMeds: "yes",
    usesInsulin: "no",
    medications: [
      { name: "二甲雙胍 Metformin", dosage: "500mg", usage: "每日兩次，餐後" },
      { name: "格列齊特 Gliclazide" },
    ],

    // 長期疾病（完整）
    noChronicConditions: false,
    conditions: ["高血壓", "高血脂"],
    otherConditionNote: "",

    // 家庭照顧支持（完整）
    hasCaregiver: true,
    livesAlone: false,

    // 飲食（留空 favoriteFoods，令此分區未完成）
    dietHabits: ["OUTSIDE_EATING", "SUGARY_DRINK"],
    favoriteFoods: "",

    // 運動（部分填，令此分區未完成）
    exerciseFreq: "3-4",
    exerciseMinutes: null,
    exerciseIntensity: "MODERATE",
    exerciseTypes: ["WALK", "TAICHI"],
    otherExerciseNote: "",

    // 覆診問題（固定示例資料，spec §12）
    nextClinicDate: "2026-09-18",
    nextClinicQuestions: [
      "最近餐後血糖偏高，需要調整飲食或藥物嗎？",
      "我是否適合使用持續血糖監測器？",
    ],
    savedDoctorQuestions: [
      "最近餐後血糖偏高，需要調整飲食或藥物嗎？",
      "我是否適合使用持續血糖監測器？",
      "夜晚偶爾出汗，會不會是低血糖？",
      "服用 Metformin 後腸胃不適，可以怎樣處理？",
      "每日應該步行多長時間？",
    ],
  };
}
