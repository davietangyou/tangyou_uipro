import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { DeviceModal } from "./DeviceModal";
import { ChevronDownIcon } from "./icons";
import { ChevronDown } from "lucide-react";
import { recordTimeDraft } from "../utils/recordTimeDraft";

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;
const HALF_VISIBLE = Math.floor(VISIBLE_ITEMS / 2);
const DAY_MS = 86_400_000;

export interface RecordDateTimeSlot {
  id: string;
  label: string;
}

interface WheelItem {
  id: string;
  label: string;
}

export interface RecordDateTimeValue {
  date: string;
  time: string;
  slotId?: string;
}

function dateId(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function relativeDateLabel(value: string, includeYear = false) {
  const date = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const difference = Math.round((day.getTime() - today.getTime()) / DAY_MS);
  if (difference === 0) return "今天";
  if (difference === -1) return "昨天";
  if (includeYear && date.getFullYear() !== today.getFullYear()) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatRecordDateLabel(value: string, relative = true) {
  if (relative) return relativeDateLabel(value, true);
  const date = parseDate(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function toLocalDateTimeInput(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function generateRecentDates(count = 14, futureDays = 0): WheelItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count + futureDays }, (_, index) => {
    const offset = -(count - 1 - index);
    const date = new Date(today.getTime() + offset * DAY_MS);
    return { id: dateId(date), label: relativeDateLabel(dateId(date)) };
  });
}

function generateHistoricalDates(
  selectedDate: string,
  planning = false,
): WheelItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startId =
    /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) && selectedDate < "1900-01-01"
      ? selectedDate
      : "1900-01-01";
  const [startYear, startMonth, startDay] = startId.split("-").map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const todayUtc = planning
    ? Math.max(
        Date.UTC(2100, 11, 31),
        Date.parse(`${selectedDate}T00:00:00Z`) || 0,
      )
    : Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const count = Math.floor((todayUtc - startUtc) / DAY_MS) + 1;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startUtc + index * DAY_MS);
    const id = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    return {
      id,
      label: planning
        ? id.split("-").reverse().join("/")
        : relativeDateLabel(id, true),
    };
  });
}

const HOUR_ITEMS: WheelItem[] = Array.from({ length: 24 }, (_, index) => ({
  id: String(index),
  label: String(index).padStart(2, "0"),
}));

const MINUTE_ITEMS: WheelItem[] = Array.from({ length: 60 }, (_, index) => ({
  id: String(index),
  label: String(index).padStart(2, "0"),
}));

export function VirtualWheelColumn({
  items,
  selectedId,
  onSelect,
  instanceKey,
  label,
  itemHeight: ITEM_HEIGHT = 50,
  visibleItems: VISIBLE_ITEMS = 5,
  rowGap = 0,
}: {
  items: WheelItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  instanceKey: number;
  label: string;
  itemHeight?: number;
  visibleItems?: number;
  rowGap?: number;
}) {
  const HALF_VISIBLE = Math.floor(VISIBLE_ITEMS / 2);
  const container = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = useMemo(
    () =>
      Math.max(
        0,
        items.findIndex((item) => item.id === selectedId),
      ),
    [items, selectedId],
  );
  const [visibleRange, setVisibleRange] = useState(() => ({
    start: Math.max(0, selectedIndex - 6),
    end: Math.min(items.length, selectedIndex + 7),
  }));

  const updateVisibleRange = (scrollTop: number) => {
    const centerIndex = Math.round(scrollTop / ITEM_HEIGHT);
    setVisibleRange({
      start: Math.max(0, centerIndex - 6),
      end: Math.min(items.length, centerIndex + 7),
    });
  };

  useLayoutEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const element = container.current;
    if (!element) return;
    element.scrollTop = selectedIndex * ITEM_HEIGHT;
    updateVisibleRange(element.scrollTop);
    // The picker remount key intentionally resets the wheel to the saved value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const selectIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    const item = items[clamped];
    if (!item) return;
    const element = container.current;
    if (element) {
      // Keep keyboard and tap selection atomic. A smooth scroll fires delayed
      // scroll events that can otherwise replace the newly selected date with
      // an intermediate row, especially across large historical jumps.
      element.scrollTop = clamped * ITEM_HEIGHT;
      updateVisibleRange(clamped * ITEM_HEIGHT);
    }
    onSelect(item.id);
  };

  const handleScroll = () => {
    const element = container.current;
    if (!element) return;
    updateVisibleRange(element.scrollTop);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const index = Math.round(element.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      element.scrollTop = clamped * ITEM_HEIGHT;
      const item = items[clamped];
      if (item && item.id !== selectedId) onSelect(item.id);
    }, 100);
  };

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden"
      style={{ height: VISIBLE_ITEMS * ITEM_HEIGHT - rowGap }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-white to-transparent"
        style={{ height: ITEM_HEIGHT * Math.min(1.6, HALF_VISIBLE * 0.8) }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-white to-transparent"
        style={{ height: ITEM_HEIGHT * Math.min(1.6, HALF_VISIBLE * 0.8) }}
      />
      <div
        className="record-wheel-highlight pointer-events-none absolute inset-x-1 z-10 rounded-[14px] bg-ink/[0.05]"
        style={{ top: HALF_VISIBLE * ITEM_HEIGHT, height: ITEM_HEIGHT - rowGap }}
      />
      <div
        ref={container}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${label}-${selectedId}`}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={(event) => {
          const movement =
            event.key === "ArrowUp"
              ? -1
              : event.key === "ArrowDown"
                ? 1
                : event.key === "PageUp"
                  ? -30
                  : event.key === "PageDown"
                    ? 30
                    : event.key === "Home"
                      ? -items.length
                      : event.key === "End"
                        ? items.length
                        : 0;
          if (!movement) return;
          event.preventDefault();
          selectIndex(selectedIndex + movement);
        }}
        className="h-full overflow-y-scroll scrollbar-none outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        style={{ scrollSnapType: "y mandatory", overscrollBehavior: "contain" }}
      >
        <div
          className="relative"
          style={{ height: (items.length + HALF_VISIBLE * 2) * ITEM_HEIGHT - rowGap }}
        >
          {items
            .slice(visibleRange.start, visibleRange.end)
            .map((item, offset) => {
              const index = visibleRange.start + offset;
              const selected = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  id={`${label}-${item.id}`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectIndex(index)}
                  className={`absolute inset-x-0 flex cursor-pointer select-none items-center justify-center px-1 text-center transition-colors ${selected ? "hm-body font-bold text-ink" : "t-support text-ink-muted"}`}
                  style={{
                    height: ITEM_HEIGHT - rowGap,
                    top: (index + HALF_VISIBLE) * ITEM_HEIGHT,
                    scrollSnapAlign: "center",
                  }}
                >
                  {item.label}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function SelectorItem({
  caption,
  value,
  chevron,
  referenceIcon = false,
}: {
  caption: string;
  value: string;
  chevron?: boolean;
  referenceIcon?: boolean;
}) {
  const Chevron = referenceIcon ? ChevronDown : ChevronDownIcon;
  return (
    <span className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2">
      <span className="t-support text-ink-muted">{caption}</span>
      <span className="hm-body inline-flex min-w-0 items-center gap-1 text-center font-semibold text-ink">
        <span className="min-w-0 [overflow-wrap:anywhere]">{value}</span>
        {chevron && (
          <Chevron
            width={16}
            height={16}
            className="flex-none text-ink-soft"
          />
        )}
      </span>
    </span>
  );
}

export function RecordDateTimePicker({
  date,
  time,
  slotId,
  slots = [],
  dateRange = "recent",
  mode = "datetime",
  selectorUsesRelativeDate = true,
  allowMissingTime = false,
  startAtNow = false,
  measurementStyle = startAtNow,
  ariaLabel,
  renderTrigger,
  theme,
  onConfirm,
}: {
  date: string;
  time: string;
  slotId?: string;
  slots?: RecordDateTimeSlot[];
  dateRange?:
    "recent" | "history" | "plan" | { pastDays: number; futureDays?: number };
  mode?: "datetime" | "date" | "time";
  selectorUsesRelativeDate?: boolean;
  allowMissingTime?: boolean;
  /** Measurement flows start a new draft at the local clock on every open. */
  startAtNow?: boolean;
  /** Preserve measurement styling independently of draft initialization. */
  measurementStyle?: boolean;
  ariaLabel: string;
  theme?: "medication";
  renderTrigger?: (onOpen: (event?: MouseEvent<HTMLElement>) => void, expanded: boolean) => ReactNode;
  onConfirm: (value: RecordDateTimeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [instanceKey, setInstanceKey] = useState(0);
  const [draftDate, setDraftDate] = useState(date);
  const [draftHour, setDraftHour] = useState(
    time ? String(Number(time.slice(0, 2))) : allowMissingTime ? "" : String(new Date().getHours()),
  );
  const [draftMinute, setDraftMinute] = useState(
    time ? String(Number(time.slice(3, 5))) : allowMissingTime ? "" : String(new Date().getMinutes()),
  );
  const [draftSlot, setDraftSlot] = useState(slotId ?? slots[0]?.id ?? "");
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const calendarDay = dateId(new Date());
  const dateItems = useMemo(
    () =>
      dateRange === "plan"
        ? generateHistoricalDates(date, true)
        : dateRange === "history"
          ? generateHistoricalDates(date)
          : typeof dateRange === "object"
            ? generateRecentDates(dateRange.pastDays + 1, dateRange.futureDays)
            : generateRecentDates(),
    [dateRange, date, calendarDay],
  );

  const openPicker = (event?: MouseEvent<HTMLElement>) => {
    returnFocus.current =
      event?.currentTarget ?? trigger.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const now = new Date();
    const draft = recordTimeDraft({ date, time }, startAtNow, now);
    setDraftDate(draft.date);
    setDraftHour(
      draft.time ? String(Number(draft.time.slice(0, 2))) : allowMissingTime ? "" : String(now.getHours()),
    );
    setDraftMinute(
      draft.time ? String(Number(draft.time.slice(3, 5))) : allowMissingTime ? "" : String(now.getMinutes()),
    );
    setDraftSlot(slotId ?? slots[0]?.id ?? "");
    setInstanceKey((key) => key + 1);
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
  };

  const selectedSlot = slots.find((slot) => slot.id === slotId);
  const selectorDate = formatRecordDateLabel(date, selectorUsesRelativeDate);
  const selectorTime = time || (allowMissingTime ? "未記錄" : "選擇時間");

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openPicker, open)
      ) : (
        <button
          ref={trigger}
          type="button"
          onClick={openPicker}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="record-datetime-selector flex w-full items-stretch divide-x divide-hairline rounded-[24px] bg-surface px-1 shadow-[0_8px_24px_rgba(35,38,31,0.06)] transition-transform duration-150 ease-out active:scale-[0.99]"
        >
          {mode !== "time" && (
            <SelectorItem caption="日期" value={selectorDate} />
          )}
          {mode !== "date" && (
            <SelectorItem caption="時間" value={selectorTime} />
          )}
          {slots.length > 0 && (
            <SelectorItem
              caption="時段"
              value={selectedSlot?.label ?? "選擇時段"}
              chevron
              referenceIcon={measurementStyle}
            />
          )}
        </button>
      )}

      <DeviceModal open={open} onClose={closePicker} returnFocusRef={returnFocus} label="record-time-picker-title"
        className={`record-time-picker ${measurementStyle ? "record-measurement-picker" : ""} ${theme === "medication" ? "medication-picker-theme" : ""}`}>
              <div className="flex justify-center pb-1 pt-3">
                <div className="h-1 w-10 rounded-full bg-ink/15" />
              </div>
              <div className="flex items-center justify-between px-6 pb-3 pt-2">
                <button
                  type="button"
                  onClick={() => closePicker()}
                  className="hm-body min-h-[56px] min-w-[64px] text-left font-semibold text-ink-soft"
                >
                  取消
                </button>
                <span
                  id="record-time-picker-title"
                  className="hm-cardtitle text-ink"
                >
                  {mode === "date" ? "選擇日期" : "選擇時間"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm({
                      date: mode === "time" ? date : draftDate,
                      time:
                        mode === "date"
                          ? time
                          : allowMissingTime && (draftHour === "" || draftMinute === "")
                            ? ""
                            : `${draftHour.padStart(2, "0")}:${draftMinute.padStart(2, "0")}`,
                      ...(slots.length > 0 ? { slotId: draftSlot } : {}),
                    });
                    closePicker();
                  }}
                  className="hm-body min-h-[56px] min-w-[64px] text-right font-bold text-ink"
                >
                  確定
                </button>
              </div>
              <div className="flex items-center px-4 pb-safe">
                {mode !== "time" && (
                  <VirtualWheelColumn
                    itemHeight={measurementStyle ? 56 : 50}
                    rowGap={measurementStyle ? 8 : 0}
                    instanceKey={instanceKey}
                    label="日期"
                    items={dateItems}
                    selectedId={draftDate}
                    onSelect={setDraftDate}
                  />
                )}
                {mode !== "date" && (
                  <>
                    <VirtualWheelColumn
                      itemHeight={measurementStyle ? 56 : 50}
                      rowGap={measurementStyle ? 8 : 0}
                      instanceKey={instanceKey}
                      label="小時"
                      items={allowMissingTime ? [{id:"",label:"—"}, ...HOUR_ITEMS] : HOUR_ITEMS}
                      selectedId={draftHour}
                      onSelect={hour => {
                        setDraftHour(hour);
                        if (allowMissingTime && hour === "") {
                          setDraftMinute("");
                          setInstanceKey(key => key + 1);
                        } else if (draftMinute === "") {
                          setDraftMinute(String(new Date().getMinutes()));
                          setInstanceKey(key => key + 1);
                        }
                      }}
                    />
                    <div
                      className="hm-body flex-none font-bold text-ink"
                      style={{
                        height: measurementStyle ? 272 : VISIBLE_ITEMS * ITEM_HEIGHT,
                        lineHeight: `${measurementStyle ? 272 : VISIBLE_ITEMS * ITEM_HEIGHT}px`,
                      }}
                    >
                      :
                    </div>
                    <VirtualWheelColumn
                      itemHeight={measurementStyle ? 56 : 50}
                      rowGap={measurementStyle ? 8 : 0}
                      instanceKey={instanceKey}
                      label="分鐘"
                      items={allowMissingTime ? [{id:"",label:"—"}, ...MINUTE_ITEMS] : MINUTE_ITEMS}
                      selectedId={draftMinute}
                      onSelect={minute => {
                        setDraftMinute(minute);
                        if (allowMissingTime && minute === "") {
                          setDraftHour("");
                          setInstanceKey(key => key + 1);
                        } else if (draftHour === "") {
                          setDraftHour(String(new Date().getHours()));
                          setInstanceKey(key => key + 1);
                        }
                      }}
                    />
                  </>
                )}
                {slots.length > 0 && (
                  <VirtualWheelColumn
                    itemHeight={measurementStyle ? 56 : 50}
                    rowGap={measurementStyle ? 8 : 0}
                    instanceKey={instanceKey}
                    label="時段"
                    items={slots}
                    selectedId={draftSlot}
                    onSelect={setDraftSlot}
                  />
                )}
              </div>
              <div
                style={{ height: "env(safe-area-inset-bottom, 16px)" }}
                className="min-h-4"
              />
      </DeviceModal>

    </>
  );
}
