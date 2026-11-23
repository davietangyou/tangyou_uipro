import type { MedicationIntake } from "./types";
import { intakeTimestamp } from "./medication";

// Resume or clock jumps must not trigger a burst of obsolete notifications.
export function newDueIntakes(
  entries: MedicationIntake[],
  since: number,
  now: number,
): MedicationIntake[] {
  if (now <= since || now - since > 90000) return [];
  return entries.filter(
    (e) =>
      e.status === "pending" &&
      intakeTimestamp(e) > since &&
      intakeTimestamp(e) <= now,
  );
}

export const notificationFingerprint = (entry: MedicationIntake) =>
  JSON.stringify([entry.id, entry.time, entry.name, entry.amount, entry.unit]);
