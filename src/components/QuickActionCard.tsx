import type { ReactNode } from "react";

// 可重用的首頁快捷卡片（問問 AI / 覆診清單共用同一元件與變體）。
// 兩個變體僅換底色，尺寸、內距、圓角、字體完全一致。
export type QuickActionVariant = "sky" | "lilac";

const SURFACE: Record<QuickActionVariant, string> = {
  sky: "bg-sky",
  lilac: "bg-lilac",
};

export function QuickActionCard({
  variant,
  icon,
  label,
  onClick,
}: {
  variant: QuickActionVariant;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "home-quick-card",
        "transition-[transform,filter] duration-150 ease-out hover:brightness-[0.98] active:scale-[0.97]",
        SURFACE[variant],
      ].join(" ")}
    >
      {/* 白色圓形圖標徽章（左上） */}
      <span className="home-icon">
        {icon}
      </span>
      <span className="home-card-title">{label}</span>
    </button>
  );
}
