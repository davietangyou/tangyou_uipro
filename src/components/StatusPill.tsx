import type { GlucoseStatus } from "../data/types";
import { STATUS_TEXT } from "../data/constants";
import { AlertIcon, CheckIcon } from "./icons";

// 狀態同時用文字 + 圖標 + 語義色，不只靠顏色（DESIGN.md §19 / 無障礙）。
const STYLES: Record<GlucoseStatus, { cls: string }> = {
  ideal: { cls: "bg-positive-surface text-positive border-positive/25" },
  high: { cls: "bg-warning-surface text-warning border-warning/25" },
  low: { cls: "bg-danger-surface text-danger border-danger/25" },
};

export function StatusPill({
  status,
  size = "md",
}: {
  status: GlucoseStatus;
  size?: "sm" | "md";
}) {
  const { cls } = STYLES[status];
  const Icon = status === "ideal" ? CheckIcon : AlertIcon;
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" ? "px-2.5 py-1 text-[15px]" : "px-3.5 py-1.5 t-support",
        cls,
      ].join(" ")}
    >
      <Icon width={size === "sm" ? 16 : 18} height={size === "sm" ? 16 : 18} />
      {STATUS_TEXT[status]}
    </span>
  );
}
