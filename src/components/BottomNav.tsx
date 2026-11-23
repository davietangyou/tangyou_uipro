import type { CSSProperties } from "react";
import {
  Droplet,
  Home as HomeIcon,
  List,
  MessageSquare,
  UserRound,
} from "lucide-react";

export type NavKey = "home" | "glucose" | "ai" | "questions" | "me";

const ITEMS = [
  { key: "home", label: "首頁", icon: HomeIcon },
  { key: "glucose", label: "紀錄", icon: Droplet },
  { key: "ai", label: "問 AI", icon: MessageSquare },
  { key: "questions", label: "問題", icon: List },
  { key: "me", label: "我的", icon: UserRound },
] as const;

export function BottomNav({ active, onNavigate }: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
}) {
  return (
    <nav
      aria-label="主導航"
      className="app-bottom-nav"
    >
      <ul
        className="mx-auto max-w-[520px] bg-surface"
        style={{ "--nav-index": ITEMS.findIndex(item => item.key === active) } as CSSProperties}
      >
        {ITEMS.map(({ key, label, icon: Icon }) => (
          <li key={key}>
            <button
              type="button"
              aria-current={key === active ? "page" : undefined}
              aria-label={label}
              onClick={() => onNavigate(key)}
              className={`flex items-center ${key === active ? "text-white" : "text-ink-soft"}`}
            >
              <Icon width={24} height={24} strokeWidth={1.8} aria-hidden="true" />
              <span className="hm-nav">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
