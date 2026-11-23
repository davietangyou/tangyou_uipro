import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  CircleCheck,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { backend, BackendError } from "../services/backendClient";
import { fieldLabel } from "./copy";
import { LanguageSwitch, useAdminLocale } from "./i18n";
import { display, states, type Row } from "./format";
export { display, states, type Row } from "./format";
export type Page = { items: Row[]; hasMore: boolean; nextCursor?: string };

export function Status({ value }: { value: unknown }) {
  const { locale } = useAdminLocale(),
    state = String(value ?? "unknown");
  return (
    <span
      className={`badge ${["failed", "dead", "unknown", "SUSPENDED"].includes(state) ? "bad" : ["accepted", "success", "ACTIVE", "done", "taken", "completed"].includes(state) ? "good" : "neutral"}`}
    >
      {["accepted", "success", "ACTIVE", "done", "taken", "completed"].includes(
        state,
      ) && <CircleCheck size={12} />}
      {display(value, locale, "status")}
    </span>
  );
}
export function Value({
  value,
  field = "",
}: {
  value: unknown;
  field?: string;
}) {
  const { locale } = useAdminLocale();
  return <>{display(value, locale, field)}</>;
}
export function Fields({
  data,
  labels,
}: {
  data: Row;
  labels?: Record<string, string>;
}) {
  const { locale, t } = useAdminLocale();
  return (
    <dl className="fields">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt>{labels?.[key] ? t(labels[key]) : fieldLabel(key, locale)}</dt>
          <dd>
            {["reminderEnabled", "refillEnabled"].includes(key) &&
            typeof value === "boolean" ? (
              <span className={`badge ${value ? "good" : "neutral"}`}>
                {value && <CircleCheck size={12} />}
                {t(value ? "開啟" : "關閉")}
              </span>
            ) : value && typeof value === "object" ? (
              Array.isArray(value) ? (
                value.length ? (
                  value.map((item, i) => (
                    <div key={i}>
                      {item && typeof item === "object" ? (
                        <Fields data={item as Row} />
                      ) : (
                        <Value value={item} field={key} />
                      )}
                    </div>
                  ))
                ) : (
                  t("沒有紀錄")
                )
              ) : Object.keys(value).length ? (
                <Fields data={value as Row} />
              ) : (
                t("未提供")
              )
            ) : (
              <Value value={value} field={key} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  const { t, locale } = useAdminLocale(),
    b = error instanceof BackendError ? error : null;
  const englishErrors: Record<string, string> = {
    INVALID_CREDENTIALS: "Incorrect email or password.",
    NETWORK_ERROR: "Unable to connect. Please try again.",
    RATE_LIMITED: "Too many attempts. Please try again later.",
    FORBIDDEN: "You do not have permission to view this data.",
    NOT_FOUND: "This record could not be found.",
    INVALID_PAGE: "The page or filter is invalid.",
    INVALID_RANGE: "Choose a valid date range of up to 366 days.",
  };
  return (
    <div className="error-notice" role="alert">
      <strong>
        {t(
          b?.status === 403
            ? "沒有查閱權限"
            : b?.status === 401 && b.code !== "INVALID_CREDENTIALS"
              ? "登入已失效"
              : b?.code === "INVALID_CREDENTIALS"
                ? "未能登入"
                : "未能載入",
        )}
      </strong>
      <p>
        {locale === "en"
          ? (englishErrors[b?.code ?? ""] ?? t("請求未能完成。"))
          : error.message}
      </p>
      {b?.requestId && <small>Request ID: {b.requestId}</small>}
      {b?.status === 401 && b.code !== "INVALID_CREDENTIALS" ? (
        <button className="secondary" onClick={() => location.reload()}>
          {t("重新登入")}
        </button>
      ) : (
        retry && (
          <button className="secondary" onClick={retry}>
            {t("重試")}
          </button>
        )
      )}
    </div>
  );
}
export function useResource<T>(path: string | null, reason?: string) {
  const [resource, setResource] = useState<{
    path: string | null;
    data: T | null;
    error: Error | null;
    loading: boolean;
  }>({ path: null, data: null, error: null, loading: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setResource({ path, data: null, error: null, loading: !!path });
    if (!path) {
      return;
    }
    const controller = new AbortController();
    backend<T>(path, { reason, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted)
          setResource({ path, data: result, error: null, loading: false });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResource({ path, data: null, error: e, loading: false });
      });
    return () => controller.abort();
  }, [path, reason, revision]);
  return {
    data: resource.path === path ? resource.data : null,
    error: resource.path === path ? resource.error : null,
    loading: !!path && (resource.path !== path || resource.loading),
    reload: () => setRevision((n) => n + 1),
  };
}
export function Loading() {
  const { t } = useAdminLocale();
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={19} className="spin" />
      {t("正在載入…")}
    </div>
  );
}
export function Empty({
  title = "沒有符合條件的紀錄",
  hint,
}: {
  title?: string;
  hint?: string;
}) {
  const { t } = useAdminLocale();
  return (
    <div className="empty-state">
      <strong>{t(title)}</strong>
      {hint && <p>{t(hint)}</p>}
    </div>
  );
}
export function Refresh({
  onClick,
  busy = false,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  const { t } = useAdminLocale();
  return (
    <button className="secondary refresh" disabled={busy} onClick={onClick}>
      <RefreshCw size={15} className={busy ? "spin" : ""} />
      {t("重新整理")}
    </button>
  );
}
export type Column =
  | string
  | {
      key: string;
      label?: string;
      render?: (row: Row) => ReactNode;
      className?: string;
    };
export function Table({
  items,
  columns,
  onSelect,
  emptyTitle,
  widths,
}: {
  items: Row[];
  columns: Column[];
  onSelect?: (row: Row) => void;
  emptyTitle?: string;
  widths?: number[];
}) {
  const { locale, t } = useAdminLocale();
  if (!items.length)
    return (
      <Empty
        title={emptyTitle}
        hint={emptyTitle ? undefined : "可調整搜尋或篩選條件。"}
      />
    );
  const cols = columns.map((c) => (typeof c === "string" ? { key: c } : c));
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={t("資料列表")}
      tabIndex={0}
    >
      <table
        style={
          widths
            ? {
                tableLayout: "fixed",
                minWidth: widths.reduce((a, b) => a + b, 0),
              }
            : undefined
        }
      >
        {widths && (
          <colgroup>
            {widths.map((width, i) => (
              <col key={i} style={{ width }} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key}>
                {c.label ? t(c.label) : fieldLabel(c.key, locale)}
              </th>
            ))}
            {onSelect && (
              <th>
                <span className="sr-only">{t("詳情")}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={
                    c.className ??
                    (c.key.toLowerCase().includes("id") ? "identifier" : "")
                  }
                >
                  {c.render ? (
                    c.render(row)
                  ) : ["state", "status"].includes(c.key) ? (
                    <Status value={row[c.key]} />
                  ) : row[c.key] && typeof row[c.key] === "object" ? (
                    <Fields data={row[c.key] as Row} />
                  ) : (
                    <Value value={row[c.key]} field={c.key} />
                  )}
                </td>
              ))}
              {onSelect && (
                <td className="table-action">
                  <button
                    className="text-button"
                    onClick={() => onSelect(row)}
                    aria-label={`${t("查看")} ${String(row.name ?? row.target ?? row.id ?? "")} ${t("詳情")}`}
                  >
                    {t("查看")}
                    <ArrowUpRight size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pager({
  offset,
  hasMore,
  onChange,
}: {
  offset: number;
  hasMore: boolean;
  onChange: (n: number) => void;
}) {
  const { t, locale } = useAdminLocale();
  return (
    <div className="pager">
      <span>
        {locale === "en"
          ? `Page ${Math.floor(offset / 25) + 1} · 25 per page`
          : `第 ${Math.floor(offset / 25) + 1} 頁 · 每頁 25 筆`}
      </span>
      <div>
        <button
          className="secondary"
          disabled={!offset}
          onClick={() => onChange(offset - 25)}
        >
          <ChevronLeft size={14} />
          {t("上一頁")}
        </button>
        <button
          className="secondary"
          disabled={!hasMore || offset >= 10000}
          onClick={() => onChange(offset + 25)}
        >
          {t("下一頁")}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [closing, setClosing] = useState(false),
    reduce = useReducedMotion(),
    { t } = useAdminLocale();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  function requestClose() {
    if (reduce) {
      ref.current?.close();
      onClose();
    } else setClosing(true);
  }
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label={t(title)}
      data-closing={closing}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (
          e.target === ref.current &&
          e.clientX < ref.current.getBoundingClientRect().left
        )
          requestClose();
      }}
    >
      <motion.section
        className="drawer-panel"
        initial={{ x: reduce ? 0 : "100%" }}
        animate={{ x: closing && !reduce ? "100%" : 0 }}
        transition={{
          duration: reduce ? 0 : closing ? 0.3 : 0.5,
          ease: "easeInOut",
        }}
        onAnimationComplete={() => {
          if (closing) {
            ref.current?.close();
            onClose();
          }
        }}
      >
        <header>
          <h2>{t(title)}</h2>
          <div className="drawer-actions">
            <LanguageSwitch />
            <button
              className="icon-button"
              onClick={requestClose}
              aria-label={t("關閉詳情")}
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="drawer-body">{children}</div>
      </motion.section>
    </dialog>
  );
}
export function Menu({
  label,
  children,
  icon,
  buttonClass = "secondary",
  popupRole = "menu",
  chevron,
  ariaLabel,
}: {
  label: ReactNode;
  children: (close: () => void) => ReactNode;
  icon?: ReactNode;
  buttonClass?: string;
  popupRole?: "menu" | "dialog";
  chevron?: ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId(),
    reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      ref={root}
      className="menu-root"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        if (
          popupRole === "menu" &&
          ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)
        ) {
          e.preventDefault();
          if (!open) {
            setOpen(true);
            const last = e.key === "ArrowUp" || e.key === "End";
            requestAnimationFrame(() => {
              const items = root.current?.querySelectorAll<HTMLElement>(
                '[role="menuitem"],[role="menuitemradio"]',
              );
              if (items?.length) items[last ? items.length - 1 : 0].focus();
            });
            return;
          }
          const items = Array.from(
            root.current!.querySelectorAll<HTMLElement>(
              '[role="menuitem"],[role="menuitemradio"]',
            ),
          );
          const at = items.indexOf(document.activeElement as HTMLElement);
          items[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : e.key === "ArrowDown"
                  ? (at + 1) % items.length
                  : at < 0
                    ? items.length - 1
                    : (at - 1 + items.length) % items.length
          ]?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className={buttonClass}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup={popupRole}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {icon}
        {label}
        {chevron}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role={popupRole}
            aria-label={typeof label === "string" ? label : undefined}
            className="dropdown-menu"
            initial={{
              opacity: 0,
              scale: reduce ? 1 : 0.95,
              y: reduce ? 0 : -4,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduce ? 1 : 0.95, y: reduce ? 0 : -4 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
          >
            {children(close)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export function Filter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (s: string) => void;
  options: string[];
}) {
  const { t } = useAdminLocale();
  return (
    <Menu
      label={
        value
          ? t(value === "issues" ? "需要關注" : (states[value] ?? value))
          : t("狀態")
      }
      icon={<CirclePlus size={15} />}
    >
      {(close) =>
        ["", ...options].map((f) => (
          <button
            role="menuitemradio"
            aria-checked={value === f}
            className="menu-item"
            key={f}
            onClick={() => {
              onChange(f);
              close();
            }}
          >
            {value === f ? (
              <Check size={14} />
            ) : (
              <span className="menu-check-space" />
            )}
            {t(
              f === ""
                ? "全部狀態"
                : f === "issues"
                  ? "需要關注"
                  : (states[f] ?? f),
            )}
          </button>
        ))
      }
    </Menu>
  );
}
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { t } = useAdminLocale();
  return (
    <div className="page-heading">
      <div>
        <h1>{t(title)}</h1>
        {description && <p>{t(description)}</p>}
      </div>
      {actions}
    </div>
  );
}
