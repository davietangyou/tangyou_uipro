import { BackIcon } from "./icons";
import type { ReactNode } from "react";

// 子頁頁首（個人檔案分區編輯器共用）—— 對齊記錄血糖頁的設計語言：
// app-bg 表面、白色圓形返回徽章、ink 標題。
export function SubPageHeader({
  title,
  onBack,
  trailing,
}: {
  title: string;
  onBack: () => void;
  trailing?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 bg-app-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[520px] items-center gap-3 px-5 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[0_2px_8px_rgba(55,53,49,0.08)] transition-transform duration-150 ease-out active:scale-[0.94]"
        >
          <BackIcon width={26} height={26} aria-hidden="true" />
        </button>
        <h1 className="hm-cardtitle text-ink min-w-0 flex-1" style={{ fontSize: 26, lineHeight: "34px" }}>
          {title}
        </h1>
        {trailing}
      </div>
    </header>
  );
}
