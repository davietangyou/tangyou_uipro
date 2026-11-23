import type { ReactNode } from "react";
import { Maximize as ExpandIcon } from "lucide-react";

export function TrendCardHeader({
  title,
  suffix,
  icon,
  expandLabel,
  onExpand,
}: {
  title: string;
  suffix?: string;
  icon?: ReactNode;
  expandLabel?: string;
  onExpand?: () => void;
}) {
  return (
    <div className="glucose-card-heading">
      {icon && <span className="analysis-trend-icon" aria-hidden="true">{icon}</span>}
      <h2 className="hm-cardtitle text-ink">
        {title}
        {suffix && <span className="t-support font-medium text-ink-soft"> {suffix}</span>}
      </h2>
      {onExpand && expandLabel && (
        <button
          type="button"
          aria-label={expandLabel}
          data-voice-avoid
          onClick={onExpand}
          className="ml-auto flex h-[52px] w-[52px] items-center justify-center rounded-full bg-surface text-ink shadow-[0_2px_8px_rgba(55,53,49,0.08)] transition-transform duration-150 ease-out active:scale-[0.95]"
        >
          <ExpandIcon width={24} height={24} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
