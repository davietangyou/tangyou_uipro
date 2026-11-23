import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  ChevronDown,
  Clock3,
  Eye,
  LogOut,
  ListChecks,
  CircleCheck,
  ClipboardList,
  MailWarning,
  NotebookPen,
  Pill,
  Server,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useAdminLocale } from "./i18n";
import { daysBefore, display, hkToday, type Row } from "./format";
import {
  Empty,
  ErrorNotice,
  Loading,
  Menu,
  PageHeading,
  Refresh,
  useResource,
} from "./ui";
import type { AdminView } from "../admin";

type Stats = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  healthAccess: boolean;
  current: Record<string, number | null>;
  previous: Record<string, number | null>;
  daily: { date: string; count: number }[];
};
type Range = { from: string; to: string };
const tabItems = ["概覽", "流量分析", "統計報告", "待辦提醒"];
function RangePicker({
  range,
  onChange,
}: {
  range: Range;
  onChange: (range: Range) => void;
}) {
  const { t } = useAdminLocale(),
    [error, setError] = useState(false);
  const span =
    Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1;
  return (
    <div className="range-picker">
      <Menu
        popupRole="dialog"
        label={`${range.from.replaceAll("-", "/")} – ${range.to.replaceAll("-", "/")}`}
        icon={<CalendarDays size={15} />}
      >
        {(close) => (
          <form
            className="date-range-form"
            onSubmit={(e) => {
              e.preventDefault();
              const fields = new FormData(e.currentTarget),
                next = {
                  from: String(fields.get("from")),
                  to: String(fields.get("to")),
                },
                days =
                  (Date.parse(next.to) - Date.parse(next.from)) / 86400000 + 1;
              if (
                !Number.isFinite(days) ||
                days < 1 ||
                days > 366 ||
                next.to > hkToday()
              ) {
                setError(true);
                return;
              }
              setError(false);
              onChange(next);
              close();
            }}
          >
            <label>
              {t("開始日期")}
              <input
                type="date"
                required
                name="from"
                defaultValue={range.from}
                max={hkToday()}
              />
            </label>
            <label>
              {t("結束日期")}
              <input
                type="date"
                required
                name="to"
                defaultValue={range.to}
                max={hkToday()}
              />
            </label>
            {error && (
              <p role="alert">{t("請選擇有效日期範圍（最多 366 天）。")}</p>
            )}
            <button>{t("套用")}</button>
          </form>
        )}
      </Menu>
      <Menu
        label={t([7, 14, 30, 90].includes(span) ? `近 ${span} 天` : "自訂日期")}
        icon={<ChevronDown size={16} />}
      >
        {(close) =>
          [7, 14, 30, 90].map((days) => (
            <button
              role="menuitemradio"
              aria-checked={days === span}
              className="menu-item"
              key={days}
              onClick={() => {
                const end = hkToday(),
                  next = { from: daysBefore(end, days - 1), to: end };
                onChange(next);
                close();
              }}
            >
              {days === span ? (
                <Check size={14} />
              ) : (
                <span className="menu-check-space" />
              )}
              {t(`近 ${days} 天`)}
            </button>
          ))
        }
      </Menu>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon: ReactNode;
}) {
  const { t } = useAdminLocale();
  return (
    <section className="metric-card">
      <div className="metric-label">
        <span>{t(label)}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </section>
  );
}
function Change({
  current,
  previous,
  points = false,
}: {
  current: number | null;
  previous: number | null;
  points?: boolean;
}) {
  const { t } = useAdminLocale();
  if (current == null || previous == null) return <>—</>;
  if (points)
    return (
      <>
        {current >= previous ? "+" : "−"}
        {Math.abs(current - previous).toFixed(1)} {t("個百分點")}
      </>
    );
  if (previous === 0) return <>{current === 0 ? t("無變化") : t("前期為零")}</>;
  const n = ((current - previous) / previous) * 100;
  return (
    <>
      {n >= 0 ? "+" : "−"}
      {Math.abs(n).toFixed(1)}%
    </>
  );
}
type Attention = {
  title: string;
  subtitle: string;
  count: number;
  view: AdminView;
  filter?: string;
  action: string;
  icon: typeof Sparkles;
};
export function attentionItems(d: Row): Attention[] {
  return [
    {
      title: "AI 請求失敗",
      subtitle: "最近 24 小時",
      count: Number(d.aiFailures),
      view: "ai",
      filter: "failed",
      action: "查看 AI 請求",
      icon: Sparkles,
    },
    {
      title: "背景任務需要處理",
      subtitle: "重試已耗盡或執行逾期",
      count: Number(d.stalledJobs),
      view: "jobs",
      filter: "issues",
      action: "查看背景任務",
      icon: ListChecks,
    },
    {
      title: "電郵投遞異常",
      subtitle: "失敗或結果未知",
      count: Number(d.deliveryIssues),
      view: "deliveries",
      filter: "issues",
      action: "查看投遞紀錄",
      icon: MailWarning,
    },
    {
      title: "待處理資料請求",
      subtitle: "資料匯出及帳戶刪除",
      count: Number(d.pendingRequests),
      view: "requests",
      action: "查看資料請求",
      icon: ClipboardList,
    },
    {
      title: "Worker 離線",
      subtitle: "服務實例",
      count: d.workerOnline === false ? 1 : 0,
      view: "runtime",
      action: "查看服務實例",
      icon: Server,
    },
  ];
}
function AttentionList({
  items,
  compact = false,
  navigate,
}: {
  items: Attention[];
  compact?: boolean;
  navigate: (view: AdminView, filter?: string) => void;
}) {
  const { t } = useAdminLocale(),
    visible = items.filter((i) => i.count > 0);
  if (!visible.length) return <Empty title="沒有待處理事項" />;
  return (
    <div className={`attention-list ${compact ? "compact" : ""}`}>
      {visible.map((a) => (
        <button
          className="attention-row"
          key={a.title}
          onClick={() => navigate(a.view, a.filter)}
        >
          <span className="attention-icon">
            <a.icon size={18} />
          </span>
          <span className="attention-text">
            <strong>{t(a.title)}</strong>
            <small>{t(a.subtitle)}</small>
          </span>
          {compact ? (
            <>
              <strong className="attention-count">{a.count}</strong>
              <ChevronRight size={14} />
            </>
          ) : (
            <>
              <span
                className={`badge ${a.view === "requests" ? "neutral" : "bad"}`}
              >
                {a.count} {t("項")}
              </span>
              <span className="secondary attention-link">
                <ArrowUpRight size={14} />
                {t(a.action)}
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
function Overview({
  overview,
  runtime,
  stats,
  statsError,
  retry,
  navigate,
  showAll,
}: {
  overview: Row;
  runtime: Row | null;
  stats: Stats | null;
  statsError: Error | null;
  retry: () => void;
  navigate: (view: AdminView, filter?: string) => void;
  showAll: () => void;
}) {
  const { t, locale } = useAdminLocale(),
    reduce = useReducedMotion(),
    items = attentionItems(overview),
    n = (v: unknown) =>
      typeof v === "number"
        ? v.toLocaleString(locale === "en" ? "en-HK" : "zh-HK")
        : "—";
  const metrics = [
    [
      "使用中帳戶",
      overview.activeUsers,
      <>{t("目前狀態")}</>,
      <UsersRound size={16} />,
    ],
    [
      "新增健康紀錄",
      stats?.current.newRecords,
      stats?.previous.newRecords ? (
        <>
          {t("較前期")}{" "}
          <Change
            current={stats.current.newRecords}
            previous={stats.previous.newRecords}
          />
        </>
      ) : stats ? (
        t("本期")
      ) : null,
      <NotebookPen size={16} />,
    ],
    [
      "服藥確認紀錄",
      stats?.current.intakes,
      stats?.previous.intakes ? (
        <>
          {t("較前期")}{" "}
          <Change
            current={stats.current.intakes}
            previous={stats.previous.intakes}
          />
        </>
      ) : stats ? (
        t("本期")
      ) : null,
      <Pill size={16} />,
    ],
    [
      "AI 請求",
      stats?.current.aiRequests,
      stats?.previous.aiRequests ? (
        <>
          {t("較前期")}{" "}
          <Change
            current={stats.current.aiRequests}
            previous={stats.previous.aiRequests}
          />
        </>
      ) : stats ? (
        t("本期")
      ) : null,
      <Sparkles size={16} />,
    ],
  ] as const;
  const chartStep = Math.max(
    1,
    Math.ceil(
      (Math.max(0, ...(stats?.daily.map((d) => d.count) ?? [])) * 1.15) / 3,
    ),
  );
  return (
    <>
      <div className="metrics">
        {metrics.map(([label, value, note, icon]) => (
          <Metric
            key={label}
            label={label}
            value={n(value)}
            note={note}
            icon={icon}
          />
        ))}
      </div>
      {statsError && <ErrorNotice error={statsError} retry={retry} />}
      <div className="dashboard-overview-grid">
        <section className="panel record-chart-panel">
          <div className="section-heading">
            <div>
              <h2>{t("新增健康紀錄")}</h2>
              <p>
                {stats
                  ? `${stats.from.replaceAll("-", "/")} – ${stats.to.replaceAll("-", "/")} · ${n(stats.current.newRecords)} ${t("筆")}`
                  : ""}
              </p>
            </div>
            <span className="chart-legend">
              <i />
              {t("新增紀錄")}
            </span>
          </div>
          {!stats ? (
            statsError ? (
              <Empty title="未能載入" />
            ) : (
              <Loading />
            )
          ) : !stats.healthAccess ? (
            <Empty title="沒有健康資料查閱權限" />
          ) : stats.current.newRecords === 0 ? (
            <Empty title="沒有此期間的紀錄" />
          ) : (
            <div
              className="records-chart"
              role="img"
              aria-label={t("新增健康紀錄")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.daily}
                  margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v === stats.from || v.endsWith("-01")
                        ? v.slice(5).replace("-", "/")
                        : v.slice(8)
                    }
                    tick={{ fontSize: 11, fill: "#596153" }}
                    minTickGap={12}
                  />
                  <YAxis
                    domain={[0, chartStep * 3]}
                    ticks={[0, chartStep, chartStep * 2, chartStep * 3]}
                    allowDecimals={false}
                    width={34}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#596153" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#F5F7F2" }}
                    contentStyle={{
                      borderColor: "#E0E6DA",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value) => [value, t("新增紀錄")]}
                  />
                  <Bar
                    dataKey="count"
                    fill="#386341"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={!reduce}
                    animationDuration={400}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="panel attention-panel">
          <div className="section-heading">
            <h2>{t("目前需關注")}</h2>
            <button className="text-button" onClick={showAll}>
              {t("查看全部")}
            </button>
          </div>
          <AttentionList items={items} compact navigate={navigate} />
        </section>
      </div>
      <div className="dashboard-footer">
        <span>
          {t("待處理資料請求")} <strong>{n(overview.pendingRequests)}</strong>
        </span>
        <span>
          {t("有效推送訂閱")} <strong>{n(runtime?.subscriptions)}</strong>
        </span>
        <small>
          {t("更新於")} {display(overview.at, locale, "at")}
        </small>
      </div>
    </>
  );
}
function Traffic() {
  const { t } = useAdminLocale();
  return (
    <>
      <section className="panel traffic-chart-panel">
        <div className="section-heading">
          <div>
            <h2>Traffic Overview</h2>
            <p>{t("每日瀏覽量與獨立訪客")}</p>
          </div>
          <span className="traffic-legend">
            <span className="chart-legend">
              <i />
              {t("瀏覽量")}
            </span>
            <span className="chart-legend muted-legend">
              <i />
              {t("訪客數")}
            </span>
          </span>
        </div>
        <div className="traffic-unconnected">
          <span className="traffic-grid" />
          <Empty title="尚未接入流量統計" hint="接入後顯示瀏覽量與訪客趨勢" />
        </div>
      </section>
      <div className="metrics">
        {(
          [
            ["瀏覽量 · PV", Eye],
            ["訪客數 · UV", UsersRound],
            ["跳出率", LogOut],
            ["平均訪問時間", Clock3],
          ] as [string, typeof Eye][]
        ).map(([label, Icon]) => (
          <Metric
            key={label}
            label={label}
            value="—"
            icon={<Icon size={16} />}
          />
        ))}
      </div>
      <div className="traffic-bottom">
        <section className="panel">
          <h2>{t("訪問來源")}</h2>
          <Empty title="尚未接入流量統計" />
        </section>
        <section className="panel">
          <h2>{t("裝置分佈")}</h2>
          <Empty title="尚未接入流量統計" />
        </section>
      </div>
    </>
  );
}
function Reports({ stats }: { stats: Stats }) {
  const { t, locale } = useAdminLocale(),
    rows = [
      ["新增用戶", "newUsers"],
      ["有紀錄用戶", "recordUsers"],
      ["新增健康紀錄", "newRecords"],
      ["血糖量度", "glucose"],
      ["HbA1c 量度", "hba1c"],
      ["包含症狀的紀錄", "symptom"],
      ["包含飲食或活動的紀錄", "lifestyle"],
      ["服藥確認紀錄", "intakes"],
      ["AI 請求", "aiRequests"],
      ["AI 完成成功率", "aiSuccessRate"],
    ];
  const value = (n: number | null, key: string) =>
    n == null
      ? "—"
      : key === "aiSuccessRate"
        ? n.toFixed(1) + "%"
        : n.toLocaleString(locale === "en" ? "en-HK" : "zh-HK");
  return (
    <>
      <div className="report-period">
        <div>
          <h2>{t("期間統計")}</h2>
          <p>
            {stats.from.replaceAll("-", "/")} – {stats.to.replaceAll("-", "/")}
          </p>
        </div>
        <ArrowLeftRight size={16} />
        <div>
          <small>{t("比較前期")}</small>
          <p>
            {stats.previousFrom.replaceAll("-", "/")} –{" "}
            {stats.previousTo.replaceAll("-", "/")}
          </p>
        </div>
      </div>
      <div className="table-scroll report-table">
        <table>
          <thead>
            <tr>
              {["統計項目", "本期", "前期", "變化"].map((s) => (
                <th key={s}>{t(s)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, key]) => (
              <tr key={key}>
                <td>{t(label)}</td>
                <td>{value(stats.current[key], key)}</td>
                <td>{value(stats.previous[key], key)}</td>
                <td>
                  <Change
                    current={stats.current[key]}
                    previous={stats.previous[key]}
                    points={key === "aiSuccessRate"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small className="report-note">
        {t(
          stats.healthAccess
            ? "新增紀錄按建立日期統計；同一筆紀錄可包含多類內容。"
            : "沒有健康資料查閱權限",
        )}
      </small>
    </>
  );
}
function Notifications({
  overview,
  runtime,
  navigate,
}: {
  overview: Row;
  runtime: Row | null;
  navigate: (view: AdminView, filter?: string) => void;
}) {
  const { t } = useAdminLocale(),
    [filter, setFilter] = useState("全部"),
    items = attentionItems(overview),
    visible = items.filter(
      (a) =>
        filter === "全部" ||
        (filter === "資料請求" && a.view === "requests") ||
        (filter === "服務異常" && a.view !== "requests"),
    );
  return (
    <>
      <div className="notification-filters">
        {["全部", "服務異常", "資料請求"].map((f) => (
          <button
            className={filter === f ? "soft" : "secondary"}
            aria-pressed={filter === f}
            key={f}
            onClick={() => setFilter(f)}
          >
            {t(f)}
          </button>
        ))}
      </div>
      <section className="notification-panel">
        <div className="section-heading">
          <h2>{t("目前需關注")}</h2>
          <small>{t("點選事項查看詳情")}</small>
        </div>
        <AttentionList items={visible} navigate={navigate} />
      </section>
      <div className="dashboard-footer">
        <CircleCheck size={18} />
        <span>{t("API 服務正常")}</span>
        {runtime?.database === "connected" && (
          <small>{t("資料庫連線正常")}</small>
        )}
      </div>
    </>
  );
}
export function Dashboard({
  navigate,
}: {
  navigate: (view: AdminView, filter?: string) => void;
}) {
  const { t, locale } = useAdminLocale(),
    reduce = useReducedMotion(),
    [tab, setTab] = useState(0),
    [range, setRange] = useState<Range>(() => {
      const to = hkToday();
      return { from: daysBefore(to, 13), to };
    });
  const overview = useResource<Row>("/admin/overview"),
    runtime = useResource<Row>("/admin/runtime"),
    stats = useResource<Stats>(
      tab === 0 || tab === 2
        ? `/admin/statistics?from=${range.from}&to=${range.to}`
        : null,
    );
  return (
    <section className="dashboard-page">
      <PageHeading
        title="Dashboard"
        actions={
          tab === 3 ? (
            <div className="current-time">
              <span>
                {t("截至")} {display(overview.data?.at, locale, "at")}
              </span>
              <Refresh
                busy={overview.loading}
                onClick={() => {
                  overview.reload();
                  runtime.reload();
                }}
              />
            </div>
          ) : (
            <RangePicker range={range} onChange={setRange} />
          )
        }
      />
      <div className="dashboard-tabs" role="tablist" aria-label="Dashboard">
        {tabItems.map((label, i) => (
          <button
            key={label}
            id={`dashboard-tab-${i}`}
            role="tab"
            aria-selected={tab === i}
            aria-controls="dashboard-panel"
            tabIndex={tab === i ? 0 : -1}
            className={tab === i ? "selected" : ""}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = (tab + (e.key === "ArrowRight" ? 1 : 3)) % 4;
                setTab(next);
                document.getElementById(`dashboard-tab-${next}`)?.focus();
              }
            }}
            onClick={() => setTab(i)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          role="tabpanel"
          id="dashboard-panel"
          aria-labelledby={`dashboard-tab-${tab}`}
          key={tab}
          className="dashboard-tab-content"
          initial={{ opacity: 0, y: reduce ? 0 : 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.15 }}
        >
          {tab === 1 ? (
            <Traffic />
          ) : tab === 2 ? (
            stats.error ? (
              <ErrorNotice error={stats.error} retry={stats.reload} />
            ) : stats.data ? (
              <Reports stats={stats.data} />
            ) : (
              <Loading />
            )
          ) : overview.error ? (
            <ErrorNotice error={overview.error} retry={overview.reload} />
          ) : !overview.data ? (
            <Loading />
          ) : tab === 0 ? (
            <Overview
              overview={overview.data}
              runtime={runtime.data}
              stats={stats.data}
              statsError={stats.error}
              retry={stats.reload}
              navigate={navigate}
              showAll={() => setTab(3)}
            />
          ) : (
            <Notifications
              overview={overview.data}
              runtime={runtime.data}
              navigate={navigate}
            />
          )}
        </motion.div>
      </AnimatePresence>
      {runtime.error && tab !== 1 && (
        <ErrorNotice error={runtime.error} retry={runtime.reload} />
      )}
    </section>
  );
}
