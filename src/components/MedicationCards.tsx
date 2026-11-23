import type { MedicationIntake, UserProfile } from "../data/types";
import { intakeTimestamp, lowStock } from "../data/medication";

export function IntakeCard({
  entry,
  now,
  onConfirm,
  onUndo,
  busy = false,
  allowConfirm = true,
}: {
  entry: MedicationIntake;
  now: Date;
  onConfirm: (id: string) => void;
  onUndo: (id: string) => void;
  busy?: boolean;
  allowConfirm?: boolean;
}) {
  const taken = entry.status === "taken";
  return (
    <article
      className={`med-intake${taken ? " is-taken" : ""}`}
    >
      <div className="med-intake-time">
        <time>{entry.time}</time>
        <span className="med-status">
          {taken
            ? "已服用"
            : intakeTimestamp(entry) <= now.getTime()
              ? "待確認"
              : "接下來"}
        </span>
      </div>
      <div className="med-intake-copy">
        <h3>{entry.name}</h3>
        <p>
          {entry.amount} {entry.unit}
        </p>
      </div>
      {taken ? (
        <button
          className="care-secondary"
          disabled={busy}
          onClick={() => onUndo(entry.id)}
          aria-label={`撤銷 ${entry.name} ${entry.time} 的服藥確認`}
        >
          撤銷
        </button>
      ) : allowConfirm ? (
        <button
          className="care-primary"
          disabled={busy}
          onClick={() => onConfirm(entry.id)}
          aria-label={`確認已服用 ${entry.name} ${entry.time}`}
        >
          已服用
        </button>
      ) : (
        <span className="care-muted">未確認</span>
      )}
      {taken && entry.inventoryShortfall && (
        <p className="care-warning" style={{ gridColumn: "1 / -1" }}>
          已記錄服藥，但登記庫存不足，請核對剩餘藥量。
        </p>
      )}
    </article>
  );
}
export function LowStockNotices({ profile }: { profile: UserProfile }) {
  const meds = profile.medications.filter(lowStock);
  return (
    <>
      {meds.map((m) => (
        <p key={m.id} className="care-warning">
          {m.name}：剩餘 {m.inventory!.quantity} {m.schedule?.unit}
          ，請安排補充。
        </p>
      ))}
    </>
  );
}
