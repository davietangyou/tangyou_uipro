import type { GlucoseRecord } from "../data/types";
import type { NewGlucoseInput } from "../hooks/useGlucose";
import { GlucoseForm } from "../components/GlucoseForm";
import { ChevronLeft as BackIcon } from "lucide-react";
import { RecordMissing } from "../components/RecordMissing";

// 記錄血糖（新增/編輯共用同一表單，Approved Change 8.6）。子頁不顯示底部導航。
// 版式對齊重新設計的首頁設計系統（app-bg 背景、白色圓形圖標徽章、大圓角柔和卡片）。
export function RecordView({
  mode,
  record,
  onBack,
  onSubmit,
  onDelete,
}: {
  mode: "add" | "edit";
  record?: GlucoseRecord;
  onBack: () => void;
  onSubmit: (input: NewGlucoseInput) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="record-entry record-entry-page min-h-full bg-app-bg">
      {/* ── 頁首：返回鍵 + 標題（適老大觸控區、與首頁同一設計語言） ── */}
      <header className="sticky top-0 z-10 bg-app-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-[18px] pt-6 pb-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[0_2px_8px_rgba(55,53,49,0.08)] transition-transform duration-150 ease-out active:scale-[0.94]"
          >
            <BackIcon width={24} height={24} aria-hidden="true" />
          </button>
          <h1 className="record-entry-title hm-cardtitle text-ink">
            {mode === "edit" ? "編輯血糖紀錄" : "記錄血糖"}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-[520px] px-[18px] pb-[max(24px,env(safe-area-inset-bottom))]">
        {mode === "edit" && !record ? <RecordMissing onBack={onBack}/> : <GlucoseForm
          mode={mode}
          initial={record}
          onSubmit={onSubmit}
          onDelete={onDelete}
        />}
      </div>
    </div>
  );
}
