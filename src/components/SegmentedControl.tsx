// 分段控件（分析/日誌 Tab、時間範圍切換）。選中用淡藍底 + Primary Blue 文字 + 邊框。
export interface SegmentOption<T extends string> {
  id: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  tone = "blue",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  // "blue"：既有藍色主題（首頁統計 / 血糖分析沿用）。
  // "ink"：對齊個人檔案重新設計的中性 ink 家族。
  tone?: "blue" | "ink";
}) {
  const container =
    tone === "ink"
      ? "flex gap-1.5 rounded-[20px] bg-field p-1.5"
      : "flex gap-1.5 rounded-[16px] border border-border bg-surface p-1.5";
  return (
    <div role="tablist" aria-label={ariaLabel} className={container}>
      {options.map((opt) => {
        const active = opt.id === value;
        const activeCls =
          tone === "ink"
            ? "bg-surface text-ink ring-2 ring-ink/25 shadow-[0_2px_8px_rgba(35,38,31,0.06)]"
            : "bg-primary-pale text-primary ring-1 ring-primary/40";
        const inactiveCls =
          tone === "ink"
            ? "text-ink-soft hover:brightness-[0.98]"
            : "text-text-secondary hover:bg-surface-subtle";
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={[
              "flex-1 rounded-[15px] font-semibold transition-colors duration-150",
              size === "sm" ? "min-h-[48px] px-3 t-support" : "min-h-[56px] px-4 t-body",
              active ? activeCls : inactiveCls,
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
