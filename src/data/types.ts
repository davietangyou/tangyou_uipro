// 血糖資料模型 — 沿用 CURRENT_PRODUCT_SPEC.md 的語義，不新增/改變欄位含義。

// 五種 timeType（spec §7.1：寫入五種 timeType 之一及可選 mealTag）
export type TimeType =
  | "fasting" // 空腹 / 起床空腹
  | "preMeal" // 餐前
  | "postMeal" // 餐後
  | "bedtime" // 睡前
  | "random"; // 夜間 / 日常隨機

export type MealTag = "breakfast" | "lunch" | "dinner" | "other";

export interface GlucoseRecord {
  id: string;
  value: number; // mmol/L，固定一位小數；純症狀事件為 0（本輪不涉症狀新增）
  timestamp: number; // 量度時間
  timeType: TimeType;
  mealTag?: MealTag;
  dietNote?: string; // 飲食情境
  exerciseNote?: string; // 運動情境
  symptoms: string[]; // 症狀
}

// 血糖狀態判斷結果（門檻來自 spec §7.1，不改動）
export type GlucoseStatus = "low" | "ideal" | "high";

// ---- 個人檔案資料模型（spec §10 / REDESIGN §8.11，沿用既有欄位語義） ----

export type Sex = "male" | "female" | "other";
export type WeightUnit = "kg" | "lb";
export type DiabetesType =
  "type1" | "type2" | "gestational" | "prediabetes" | "unknown" | "other";

// 是否使用糖尿病藥物 / 胰島素：三態，避免「未填」被當成「否」
export type YesNoUnknown = "yes" | "no" | "unknown";

// 每週運動日數
export type ExerciseFreq = "0" | "1-2" | "3-4" | "5+";
// 運動強度（原版枚舉 ID）
export type ExerciseIntensity = "LIGHT" | "MODERATE" | "VIGOROUS";

export interface Medication {
  id?: string; // Assigned once when an older profile is loaded.
  name: string;
  dosage?: string;
  usage?: string;
  diabetesRelated?: boolean;
  reminderEnabled?: boolean;
  schedule?: MedicationSchedule;
  inventory?: {
    quantity: number;
    refillEnabled: boolean;
    threshold?: number;
    revision?: string;
  };
}

export type MedicationFrequency =
  "daily" | "weekly" | "asNeeded" | "intervalHours" | "intervalDays" | "cycle";

export interface MedicationScheduleSlot {
  id: string;
  time: string;
  amount: number;
  /** Calendar-day offset used by an interval-hours window that crosses midnight. */
  dayOffset?: 0 | 1;
}

export interface MedicationSchedule {
  frequency: MedicationFrequency;
  weekdays: number[]; // Local calendar days, Sunday = 0.
  startDate: string;
  endDate?: string;
  unit: string;
  /** Stable machine-readable unit; legacy records may only contain `unit`. */
  unitCode?: string;
  slots: MedicationScheduleSlot[];
  interval?: {
    value: number;
    unit: "hours" | "days";
    startTime?: string;
    endTime?: string;
  };
  cycle?: { intakeDays: number; pauseDays: number };
}

export interface MedicationIntake {
  id: string;
  medicationId: string;
  slotId: string;
  date: string;
  time: string;
  name: string;
  amount: number;
  unit: string;
  status: "pending" | "taken";
  takenAt?: number;
  inventoryDebit?: number;
  inventoryShortfall?: boolean;
  inventoryRevision?: string;
}

export interface UserProfile {
  legacyData?: Record<string, unknown>;
  otherDiabetesType?: string;
  conditionDetails?: Record<string, { years?: string; specificName?: string }>;

  // 基本資料
  name: string; // 稱呼
  age: number | null;
  sex: Sex | null;
  heightCm: number | null;
  weight: number | null; // 以 weightUnit 為單位儲存
  weightUnit: WeightUnit;

  // 糖尿病相關（三個新欄位互不自動推導）
  diabetesType: DiabetesType | null;
  diagnosisYear: number | null; // 確診年份
  diabetesDurationYears: number | null; // 糖尿病病齡
  usesDiabetesMeds: YesNoUnknown; // 是否使用糖尿病藥物
  usesInsulin: YesNoUnknown; // 是否使用胰島素
  medications: Medication[]; // 藥物清單
  medicationIntakes?: MedicationIntake[];
  medicationLogDate?: string;
  medicationNotifications?: boolean;

  // 長期疾病（共病管理）
  noChronicConditions: boolean; // 「沒有長期疾病」
  conditions: string[]; // 常見 / 其他疾病
  otherConditionNote: string; // 其他名稱

  // 家庭照顧支持（兩 boolean 互斥）
  hasCaregiver: boolean;
  livesAlone: boolean;

  // 飲食
  dietHabits: string[]; // 5 項可多選
  favoriteFoods: string; // 喜愛食物自由文字

  // 運動
  exerciseFreq: ExerciseFreq | null; // 每週日數
  exerciseMinutes: number | null; // 每次時長
  exerciseIntensity: ExerciseIntensity | null; // 強度
  exerciseTypes: string[]; // 8 項多選
  otherExerciseNote: string; // 其他

  // 覆診問題（「問題」功能，spec §2）——只使用 string[]，不改為 object array，不新增其他欄位。
  savedDoctorQuestions?: string[]; // 已保存、等待整理的問題庫
  nextClinicQuestions?: string[]; // 明確選入本次／下次覆診清單的問題
  nextClinicDate?: string; // 下次覆診日期（YYYY-MM-DD）
  nextClinicTime?: string;
  nextClinicLocation?: string;
  nextClinicStatus?: "scheduled" | "completed" | "cancelled";

  // ── 臨床風險標誌（SDM安全門 + AI個人化推理依賴） ──
  hasHypoHistory?: boolean;          // 有低血糖病史
  isFrail?: boolean;                  // 高齡/體弱（醫生曾提示需特殊照顧）
  hasHypoUnawareness?: boolean;      // 無感低血糖（低血糖時無典型預警症狀）
  healthLiteracy?: 'HIGH' | 'MEDIUM' | 'LOW';  // 健康素養水平

  // ── 就診機構 ──
  clinicTypes?: string[];             // 多選：GOPC/SOPC/DHC/PRIVATE/OTHER/NONE

  // ── AI累積認知（縱向患者理解） ──
  expressedConcerns?: string[];       // 確認：患者明確表達過的關切主題
  preferenceSignals?: string[];       // 確認：患者表達過的偏好信號
  educationTopicsViewed?: string[];   // 確認：已查看/諮詢過的教育主題
  recentQuestionThemes?: string[];    // 確認：近期問題的主題
  inferredNotes?: string[];           // 推論：AI推論的備注
  riskSignals?: string[];             // 推論：AI檢測到的風險信號
}

// 實測化驗結果；沿用舊版欄位，與日常血糖紀錄分開儲存。
export interface HbA1cRecord {
  id: string;
  value: string;
  date: string;
  /** Local test time. Absent on legacy date-only results. */
  time?: string;
  timestamp: number;
}