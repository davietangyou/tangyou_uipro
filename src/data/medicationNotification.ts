export type MedicationNotificationAccess =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export type MedicationNotificationAction =
  | "create"
  | "basic"
  | "schedule"
  | "inventory"
  | "resume";

export function notificationIntentForAccess(
  access: MedicationNotificationAccess,
) {
  return access === "granted";
}

export function shouldOfferMedicationNotificationPrimer({
  action,
  reminderEnabled,
  access,
  enabled,
}: {
  action: MedicationNotificationAction;
  reminderEnabled: boolean;
  access: MedicationNotificationAccess;
  enabled: boolean;
}) {
  if (!reminderEnabled || access === "denied" || access === "unsupported" || (access === "granted" && enabled)) return false;
  return action === "schedule" || action === "resume";
}


export function medicationReminderLabel(
  med: { schedule?: { frequency: string }; reminderEnabled?: boolean },
  access: MedicationNotificationAccess,
  enabled: boolean,
): string {
  if (!med.schedule) return "未設定提醒";
  if (med.schedule.frequency === "asNeeded") return "無定時提醒";
  if (!med.reminderEnabled) return "提醒已暫停";
  if (access === "granted" && enabled) return "App 內提醒及系統通知已開啟";
  if (access === "unsupported") return "App 內提醒已開啟；此環境不支援系統通知";
  return "App 內提醒已開啟；系統通知未開啟";
}
