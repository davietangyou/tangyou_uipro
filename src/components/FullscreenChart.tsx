import { DeviceModal } from './DeviceModal';
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft as BackIcon } from "lucide-react";

// 將圖表旋轉成橫屏，但尺寸取自機框內部，而不是整個瀏覽器 viewport。
// 默認比例完整顯示圖表；放大後才允許在橫向畫布內捲動查看細節。
export function FullscreenChart({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [zoom, setZoom] = useState(1);

  const [open, setOpen] = useState(true);
  const id = useId();
  const done = useRef(onClose); done.current = onClose;
  const close = () => setOpen(false);
  useEffect(() => {
    if(open) return;
    const timer = setTimeout(() => done.current(), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200);
    return () => clearTimeout(timer);
  }, [open]);
  return (
    <DeviceModal open={open} onClose={close} label={id} placement="chart" className="fullscreen-chart-panel">
      <div className="absolute inset-0 overflow-hidden bg-app-bg" style={{containerType:'size'}}>
      <div
        className="absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-[24px] bg-app-bg"
        style={{
          width: "calc(100cqh - 48px)",
          height: "calc(100cqw - 32px)",
          transform: "translate(-50%, -50%) rotate(90deg)",
          transformOrigin: "center",
        }}
      >
        <header className="flex shrink-0 items-center gap-3 px-4 py-2">
          <button
            type="button"
            onClick={close}
            aria-label="返回"
            className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[0_2px_8px_rgba(35,38,31,0.06)] transition-transform duration-150 ease-out active:scale-[0.95]"
          >
            <BackIcon width={23} height={23} />
          </button>
          <div className="min-w-0">
            <h2 id={id} className="hm-cardtitle truncate text-ink">{title}</h2>
            {subtitle && (
              <p className="t-support truncate text-ink-soft">{subtitle}</p>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-1">
          <div
            className="flex h-full min-h-[150px] items-center [&>svg]:h-full [&>svg]:w-full"
            style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
          >
            {children}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.5) * 10) / 10))}
            aria-label="放大"
            disabled={zoom >= 2.5}
            className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-action text-white shadow-[0_4px_14px_rgba(35,38,31,0.12)] disabled:opacity-35 active:scale-[0.95]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <span className="t-support text-ink-soft" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.5) * 10) / 10))}
            aria-label="縮小"
            disabled={zoom <= 1}
            className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-action text-white shadow-[0_4px_14px_rgba(35,38,31,0.12)] disabled:opacity-35 active:scale-[0.95]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
        </footer>
      </div>
      </div>
    </DeviceModal>
  );
}
