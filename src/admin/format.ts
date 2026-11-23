import { translate, type AdminLocale } from "./copy";
export type Row = Record<string, unknown>;
export const states: Record<string, string> = {
  AI_QUOTA_EXHAUSTED: "AI 供應商額度不足",
  queued: "等候處理",
  submitting: "提交中",
  accepted: "郵件伺服器已接受",
  simulated: "本機模擬",
  failed: "失敗",
  unknown: "結果未知",
  expired: "已過期／失效",
  suppressed: "毋須投遞",
  ready: "待執行",
  running: "處理中",
  done: "已完成",
  dead: "重試已耗盡",
  cancelled: "已取消",
  ACTIVE: "使用中",
  DELETING: "刪除中",
  DELETED: "已刪除",
  SUSPENDED: "已暫停",
  success: "成功",
  pending: "待處理",
  taken: "已服用",
  register: "註冊",
  password_reset: "重設密碼",
  link: "綁定電郵",
  local: "本機測試",
  smtp: "真實電郵",
  scheduled: "已安排",
  completed: "已完成",
  export: "資料匯出",
  deletion: "帳戶刪除",
};
const enums: Record<string, Record<string, string>> = {
  timeType: {
    fasting: "空腹",
    preMeal: "餐前",
    postMeal: "餐後",
    bedtime: "睡前",
    random: "隨機",
  },
  mealTag: { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", other: "其他" },
  frequency: {
    daily: "每日",
    weekly: "每週",
    asNeeded: "有需要時",
    intervalHours: "每隔指定小時",
    intervalDays: "每隔指定日數",
    cycle: "週期",
  },
  sex: { male: "男", female: "女", other: "其他" },
  gender: { male: "男", female: "女", other: "其他" },
  diabetesType: {
    type1: "一型糖尿病",
    type2: "二型糖尿病",
    gestational: "妊娠糖尿病",
    prediabetes: "糖尿病前期",
    unknown: "未確定",
    other: "其他",
  },
  usesDiabetesMeds: { yes: "有使用", no: "沒有使用", unknown: "未提供" },
  usesInsulin: { yes: "有使用", no: "沒有使用", unknown: "未提供" },
  exerciseIntensity: { LIGHT: "輕度", MODERATE: "中等", VIGOROUS: "高強度" },
  dietHabits: {
    OUTSIDE_EATING: "經常在外吃飯",
    REFINED_CARB: "常吃白飯、粉麵或麵包",
    SUGARY_DRINK: "常喝奶茶、汽水等甜飲品",
    MIDNIGHT_SNACK: "習慣吃宵夜或睡前小食",
    HOME_COOK: "多在家煮，三餐定時定量",
  },
  exerciseTypes: {
    WALK: "散步／快步行",
    RESISTANCE: "深蹲／掌上壓等肌力活動",
    TAICHI: "太極／八段錦／氣功",
    SWIM: "游泳／水中健體",
    CYCLE: "健身單車／慢跑",
    STRETCH: "拉筋／椅子操",
    HIKE: "郊遊遠足／行山",
    OTHER: "其他活動／沒有固定項目",
  },
};
const englishEnums: Record<string, string> = {
  OUTSIDE_EATING: "Often eats out",
  REFINED_CARB: "Refined carbohydrates",
  SUGARY_DRINK: "Sugary drinks",
  MIDNIGHT_SNACK: "Late-night snacks",
  HOME_COOK: "Regular home-cooked meals",
  WALK: "Walking",
  RESISTANCE: "Strength exercises",
  TAICHI: "Tai chi / qigong",
  SWIM: "Swimming",
  CYCLE: "Cycling / jogging",
  STRETCH: "Stretching / chair exercises",
  HIKE: "Hiking",
  OTHER: "Other activities",
};
export function display(
  value: unknown,
  locale: AdminLocale = "zh-HK",
  key = "",
): string {
  const t = (text: string) => translate(text, locale);
  if (value === null || value === undefined || value === "") return t("未提供");
  if (typeof value === "boolean")
    return t(
      key === "hasCaregiver" ? (value ? "有" : "沒有") : value ? "是" : "否",
    );
  if (typeof value === "number" && key === "diabetesDurationYears")
    return `${value} ${t("年")}`;
  if (typeof value === "number" && key === "exerciseMinutes")
    return `${value} ${t("分鐘")}`;
  if (key === "weekdays" && typeof value === "number")
    return new Intl.DateTimeFormat(locale === "en" ? "en-HK" : "zh-HK", {
      weekday: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 9, 18 + value)));
  if (
    typeof value === "number" &&
    ["timestamp", "takenAt"].includes(key) &&
    Number.isFinite(value)
  )
    value = new Date(value).toISOString();
  if (typeof value === "string") {
    if (key === "contacts" && value === "已驗證電郵" && locale === "en")
      return "Verified email";
    if (
      ["date", "startDate", "endDate", "nextClinicDate"].includes(key) &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    )
      return value.replaceAll("-", "/");
    if (
      [
        "state",
        "status",
        "purpose",
        "mode",
        "deliveryMode",
        "nextClinicStatus",
        "errorCategory",
        "type",
      ].includes(key) &&
      states[value]
    )
      return t(states[value]);
    if (enums[key]?.[value])
      return locale === "en" && englishEnums[value]
        ? englishEnums[value]
        : t(enums[key][value]);
    if (
      [
        "at",
        "createdAt",
        "attemptedAt",
        "completedAt",
        "verifiedAt",
        "expiresAt",
        "dueAt",
        "lockedUntil",
        "lastSeenAt",
        "timestamp",
        "takenAt",
      ].includes(key) &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      !Number.isNaN(Date.parse(value))
    ) {
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Hong_Kong",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        })
          .formatToParts(new Date(value))
          .map((part) => [part.type, part.value]),
      );
      return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}${["at", "lastSeenAt", "timestamp", "takenAt"].includes(key) ? ":" + p.second : ""}`;
    }
  }
  return String(value);
}
export function measurement(item: Row): { date: unknown; time: unknown } {
  const data = (item.data ?? {}) as Row;
  if (item.measuredDate || data.date)
    return {
      date: item.measuredDate || data.date,
      time: item.measuredTime || data.time || null,
    };
  if (typeof data.timestamp === "number" && Number.isFinite(data.timestamp)) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(data.timestamp));
    const p = Object.fromEntries(parts.map((i) => [i.type, i.value]));
    return {
      date: `${p.year}-${p.month}-${p.day}`,
      time: `${p.hour}:${p.minute}`,
    };
  }
  return { date: null, time: null };
}
export function glucoseUnit(item: Row): string {
  const data = (item.data ?? {}) as Row;
  if (data.value === 0 && Array.isArray(data.symptoms) && data.symptoms.length)
    return "";
  return String(item.originalUnit || data.originalUnit || "mmol/L");
}
export function glucoseValue(item: Row, locale: AdminLocale): string {
  const data = (item.data ?? {}) as Row, unit = glucoseUnit(item);
  if (!unit)
    return translate("只記錄症狀，未量度血糖", locale);
  return data.value === null || data.value === undefined
    ? translate("未提供", locale)
    : `${data.value} ${unit}`;
}
export function scheduleSummary(med: Row, locale: AdminLocale): string {
  const t = (s: string) => translate(s, locale),
    s = med.schedule as Row | null;
  if (!s) return t("未設定");
  let label = display(s.frequency, locale, "frequency");
  if (s.frequency === "asNeeded") label = t("按需要服用");
  else if (s.frequency === "intervalHours" || s.frequency === "intervalDays")
    label = `${t("每隔")} ${display((s.interval as Row | undefined)?.value, locale)} ${t(s.frequency === "intervalHours" ? "小時" : "日")}`;
  else if (s.frequency === "cycle") {
    const cycle = (s.cycle ?? {}) as Row;
    label = `${t("服用")} ${display(cycle.intakeDays ?? s.intakeDays, locale)} ${t("日")} · ${t("暫停")} ${display(cycle.pauseDays ?? s.pauseDays, locale)} ${t("日")}`;
  } else if (s.frequency === "weekly" && Array.isArray(s.weekdays))
    label += ` · ${s.weekdays.map((n) => display(n, locale, "weekdays")).join(locale === "en" ? ", " : "、")}`;
  const slots = Array.isArray(s.slots) ? (s.slots as Row[]) : [];
  if (slots.length && s.frequency !== "asNeeded")
    label += ` · ${slots.map((x) => display(x.time, locale)).join(", ")}`;
  return label;
}
export function hkToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function daysBefore(date: string, days: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") - days * 86400000)
    .toISOString()
    .slice(0, 10);
}
