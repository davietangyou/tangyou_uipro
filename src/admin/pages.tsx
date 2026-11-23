import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Download,
  Droplet,
  HeartPulse,
  CircleCheck,
  Circle,
  NotebookPen,
  Pill,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useAdminLocale } from "./i18n";
import {
  display,
  glucoseUnit,
  glucoseValue,
  measurement,
  scheduleSummary,
  type Row,
} from "./format";
import {
  Drawer,
  Empty,
  ErrorNotice,
  Fields,
  Filter,
  Loading,
  PageHeading,
  Pager,
  Refresh,
  Status,
  Table,
  Value,
  useResource,
  type Column,
  type Page,
} from "./ui";
import type { AdminView } from "../admin";

const categories = {
  profile: "個人資料",
  glucose: "血糖",
  hba1c: "HbA1c",
  symptom: "症狀",
  lifestyle: "生活紀錄",
  medications: "藥物清單",
  intakes: "實際服藥",
  appointment: "覆診",
  requests: "資料匯出紀錄",
};
const categoryIcons = {
  profile: UserRound,
  glucose: Droplet,
  hba1c: Activity,
  symptom: HeartPulse,
  lifestyle: NotebookPen,
  medications: Pill,
  intakes: CalendarCheck,
  appointment: CalendarDays,
  requests: Download,
};
const profileLabels = {
  diabetesType: "類型",
  diabetesDurationYears: "病齡",
  usesDiabetesMeds: "糖尿病藥物",
  usesInsulin: "胰島素",
  conditionDetails: "補充資料",
  hasCaregiver: "照顧者",
  activity: "活動",
  exerciseMinutes: "每次時間",
};
const configs = {
  users: {
    title: "用戶清單",
    description: "查看用戶資料與健康紀錄",
    path: "users",
    columns: [
      { key: "id", label: "用戶編號" },
      "status",
      "contacts",
      "createdAt",
    ] as Column[],
    filters: ["ACTIVE", "SUSPENDED", "DELETING", "DELETED"],
  },
  deliveries: {
    title: "電郵驗證碼",
    description: "驗證碼投遞與驗證狀態",
    path: "deliveries",
    columns: [
      "createdAt",
      "target",
      "purpose",
      "state",
      "attempts",
      "errorCategory",
    ] as Column[],
    filters: [
      "issues",
      "queued",
      "submitting",
      "accepted",
      "simulated",
      "failed",
      "unknown",
      "expired",
      "suppressed",
    ],
  },
  ai: {
    title: "AI 請求",
    description: "最近 24 小時的請求元資料",
    path: "ai-runs",
    columns: [
      "createdAt",
      "provider",
      "model",
      "state",
      "durationMs",
      "errorCategory",
    ] as Column[],
    filters: ["failed", "success", "running"],
  },
  jobs: {
    title: "背景任務",
    description: "背景工作的執行狀態",
    path: "jobs",
    columns: [
      "type",
      "state",
      "attempts",
      "dueAt",
      "errorCategory",
    ] as Column[],
    filters: ["issues", "ready", "running", "done", "dead", "cancelled"],
  },
  requests: {
    title: "資料請求",
    description: "尚待處理的資料匯出及帳戶刪除",
    path: "requests",
    columns: ["id", "type", "state", "createdAt"] as Column[],
    filters: [] as string[],
  },
  audit: {
    title: "存取紀錄",
    description: "資料查閱與操作追蹤",
    path: "audit",
    columns: [
      "at",
      "action",
      "actorId",
      "targetUserId",
      "reason",
      "requestId",
    ] as Column[],
    filters: [] as string[],
  },
};
const listWidths: Record<keyof typeof configs, number[]> = {
  users: [260, 140, 280, 310, 144],
  deliveries: [190, 235, 110, 190, 70, 200, 139],
  ai: [180, 110, 180, 130, 100, 250, 184],
  jobs: [235, 175, 120, 220, 240, 144],
  requests: [310, 260, 230, 334],
  audit: [180, 200, 155, 165, 290, 144],
};
export function Listing({
  view,
  initialFilter,
  onDetailName,
}: {
  view: Exclude<AdminView, "overview" | "runtime">;
  initialFilter: string;
  onDetailName: (name: string | null) => void;
}) {
  const c = configs[view],
    { t } = useAdminLocale(),
    [filter, setFilter] = useState(initialFilter),
    [offset, setOffset] = useState(0),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Row | null>(null),
    [cursors, setCursors] = useState<Record<number, string>>({ 0: "" });
  const params = new URLSearchParams({
    limit: "25",
    offset: view === "audit" ? "0" : String(offset),
  });
  if (view === "audit" && cursors[offset])
    params.set("cursor", cursors[offset]);
  if (c.filters.length)
    params.set(view === "users" ? "status" : "state", filter);
  if (view === "users") params.set("query", query);
  if (view === "deliveries") params.set("requestId", query);
  const r = useResource<Page>(`/admin/${c.path}?${params}`);
  function page(n: number) {
    if (view === "audit" && n > offset) {
      if (!r.data?.nextCursor) return;
      setCursors((p) => ({ ...p, [n]: r.data!.nextCursor! }));
    }
    setOffset(n);
  }
  function refresh() {
    if (view === "audit") {
      setOffset(0);
      setCursors({ 0: "" });
    }
    r.reload();
  }
  if (view === "users" && selected)
    return (
      <UserDetail
        id={String(selected.id)}
        onBack={() => setSelected(null)}
        onName={onDetailName}
      />
    );
  const detailTitle =
    view === "deliveries"
      ? "投遞詳情"
      : view === "ai"
        ? "請求詳情"
        : view === "jobs"
          ? "任務詳情"
          : "存取詳情";
  return (
    <section className="listing-page">
      <PageHeading title={c.title} description={c.description} />
      <div className="filters">
        {(view === "users" || view === "deliveries") && (
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
              setOffset(0);
            }}
          >
            <Search size={15} />
            <input
              aria-label={t(view === "users" ? "搜尋用戶編號" : "搜尋請求編號")}
              placeholder={t(
                view === "users" ? "搜尋用戶編號" : "搜尋請求編號",
              )}
              value={search}
              maxLength={80}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="icon-button"
                aria-label={t("清除搜尋")}
                onClick={() => {
                  setSearch("");
                  setQuery("");
                  setOffset(0);
                }}
              >
                <X size={14} />
              </button>
            )}
            <button className="sr-only" type="submit">
              {t("搜尋")}
            </button>
          </form>
        )}
        {c.filters.length > 0 && (
          <Filter
            value={filter}
            options={c.filters}
            onChange={(v) => {
              setFilter(v);
              setOffset(0);
            }}
          />
        )}
        <Refresh busy={r.loading} onClick={refresh} />
      </div>
      {r.error ? (
        <ErrorNotice error={r.error} retry={r.reload} />
      ) : r.loading || !r.data ? (
        <Loading />
      ) : (
        <>
          <Table
            items={r.data.items}
            columns={
              view === "audit"
                ? c.columns.filter((column) => column !== "requestId")
                : view === "users"
                  ? c.columns.map((column) =>
                      typeof column !== "string" && column.key === "id"
                        ? {
                            ...column,
                            render: (row: Row) => (
                              <span title={String(row.id)}>
                                {String(row.id).slice(0, 8)}…
                                {String(row.id).slice(-4)}
                              </span>
                            ),
                          }
                        : column,
                    )
                  : c.columns
            }
            widths={listWidths[view]}
            onSelect={view === "requests" ? undefined : setSelected}
            emptyTitle={view === "requests" ? "沒有待處理請求" : undefined}
          />
          <div className="listing-spacer" />
          <Pager
            offset={offset}
            hasMore={
              r.data.hasMore && (view !== "audit" || !!r.data.nextCursor)
            }
            onChange={page}
          />
        </>
      )}
      {selected && (
        <Drawer title={detailTitle} onClose={() => setSelected(null)}>
          {view === "deliveries" ? (
            <DeliveryDetail id={String(selected.id)} />
          ) : (
            <>
              <Status value={selected.state ?? selected.action} />
              <Fields data={selected} />
            </>
          )}
        </Drawer>
      )}
    </section>
  );
}
function DeliveryDetail({ id }: { id: string }) {
  const r = useResource<Row>(`/admin/deliveries/${id}`),
    { t } = useAdminLocale();
  if (r.error) return <ErrorNotice error={r.error} retry={r.reload} />;
  if (!r.data) return <Loading />;
  const d = r.data;
  return (
    <>
      <Status value={d.state} />
      <h3>{String(d.target)}</h3>
      <ol className="timeline">
        {[
          ["系統受理", d.createdAt],
          ["Worker 開始處理", d.attemptedAt],
          ["提交處理結束", d.completedAt],
          ["用戶成功驗證", d.verifiedAt],
        ].map(([label, value]) => (
          <li key={String(label)}>
            {value ? <CircleCheck size={16} /> : <Circle size={16} />}
            <strong>{t(String(label))}</strong>
            <span>
              {value ? <Value value={value} field="at" /> : t("尚無紀錄")}
            </span>
          </li>
        ))}
      </ol>
      <Fields
        data={Object.fromEntries(
          Object.entries(d).filter(
            ([key]) =>
              ![
                "createdAt",
                "attemptedAt",
                "completedAt",
                "verifiedAt",
                "state",
              ].includes(key),
          ),
        )}
      />
    </>
  );
}
export function Runtime() {
  const r = useResource<Row>("/admin/runtime"),
    { t } = useAdminLocale();
  return (
    <section className="runtime-page">
      <PageHeading title="運行與設定" description="服務實例與系統狀態" />
      {r.error ? (
        <ErrorNotice error={r.error} retry={r.reload} />
      ) : !r.data ? (
        <Loading />
      ) : (
        <>
          <section className="panel">
            <div className="section-heading">
              <h2>{t("服務實例")}</h2>
              <Refresh busy={r.loading} onClick={r.reload} />
            </div>
            <Table
              items={r.data.instances as Row[]}
              columns={[
                { key: "id", label: "實例" },
                "role",
                "version",
                {
                  key: "online",
                  render: (d) => (
                    <span className={`badge ${d.online ? "good" : "bad"}`}>
                      {t(d.online ? "在線" : "離線")}
                    </span>
                  ),
                },
                {
                  key: "mailConfigured",
                  render: (d) => t(d.mailConfigured ? "已配置" : "未配置"),
                },
                "lastSeenAt",
              ]}
            />
          </section>
          <div className="two-columns">
            <section className="panel">
              <h2>{t("資料庫與服務")}</h2>
              <dl className="fields">
                <div>
                  <dt>{t("資料庫")}</dt>
                  <dd>
                    {t(
                      r.data.database === "connected" ? "連線正常" : "結果未知",
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t("遷移版本")}</dt>
                  <dd>
                    <Value value={r.data.migration} />
                  </dd>
                </div>
                <div>
                  <dt>{t("AI 供應商")}</dt>
                  <dd>
                    <Value value={r.data.provider} />
                  </dd>
                </div>
              </dl>
            </section>
            <section className="panel">
              <h2>{t("運行配置")}</h2>
              <dl className="fields">
                <div>
                  <dt>{t("有效推送訂閱")}</dt>
                  <dd>
                    <Value value={r.data.subscriptions} />
                  </dd>
                </div>
                <div>
                  <dt>{t("短訊服務")}</dt>
                  <dd>{t("已停用")}</dd>
                </div>
                <div>
                  <dt>{t("備份驗證")}</dt>
                  <dd>
                    <span className="badge neutral">{t("尚未驗證")}</span>
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
function Profile({
  profile,
  counts,
  onTab,
}: {
  profile: Row;
  counts: Row;
  onTab: (tab: string) => void;
}) {
  const { t, locale } = useAdminLocale(),
    unit = (v: unknown, u: unknown) =>
      v == null ? t("未提供") : `${v} ${u ?? t("未提供")}`;
  const groups = [
    [
      "基本資料",
      {
        name: profile.name,
        ageSex: `${profile.age == null ? t("未提供") : profile.age + " " + t("歲")} / ${display(profile.sex ?? profile.gender, locale, "sex")}`,
        height: unit(profile.heightCm ?? profile.height, "cm"),
        weight: unit(profile.weight, profile.weightUnit),
      },
    ],
    [
      "糖尿病資料",
      {
        diabetesType: profile.diabetesType,
        diabetesDurationYears: profile.diabetesDurationYears,
        usesDiabetesMeds: profile.usesDiabetesMeds,
        usesInsulin: profile.usesInsulin,
      },
    ],
    [
      "病況與照顧",
      {
        conditions: profile.conditions,
        conditionDetails: profile.conditionDetails,
        otherConditionNote: profile.otherConditionNote,
        hasCaregiver: profile.hasCaregiver,
        livesAlone: profile.livesAlone,
      },
    ],
    [
      "飲食與活動",
      {
        dietHabits: profile.dietHabits,
        favoriteFoods: profile.favoriteFoods,
        activity:
          [
            Array.isArray(profile.exerciseTypes)
              ? profile.exerciseTypes
                  .map((v) => display(v, locale, "exerciseTypes"))
                  .join(locale === "en" ? ", " : "、")
              : null,
            profile.exerciseFreq != null
              ? `${t("每週")} ${profile.exerciseFreq} ${t("日")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        exerciseMinutes: profile.exerciseMinutes,
        exerciseIntensity: profile.exerciseIntensity,
      },
    ],
  ] as const;
  const shown = new Set([
    "name",
    "age",
    "sex",
    "gender",
    "heightCm",
    "height",
    "weight",
    "weightUnit",
    "diabetesType",
    "diabetesDurationYears",
    "usesDiabetesMeds",
    "usesInsulin",
    "conditions",
    "conditionDetails",
    "otherConditionNote",
    "hasCaregiver",
    "livesAlone",
    "dietHabits",
    "favoriteFoods",
    "exerciseTypes",
    "exerciseFreq",
    "exerciseMinutes",
    "exerciseIntensity",
  ]);
  const extra = Object.fromEntries(
    Object.entries(profile).filter(
      ([k]) =>
        !shown.has(k) &&
        !k.startsWith("nextClinic") &&
        !["medications", "medicationIntakes", "savedDoctorQuestions"].includes(
          k,
        ),
    ),
  );
  return (
    <>
      <div className="profile-grid">
        {groups.map(([title, fields]) => (
          <section className="panel" key={title}>
            <h3>{t(title)}</h3>
            <Fields data={fields} labels={profileLabels} />
          </section>
        ))}
      </div>
      <div className="record-counts" aria-label={t("健康紀錄數量")}>
        {["glucose", "hba1c", "symptom", "lifestyle"].map((key) => (
          <button className="secondary" key={key} onClick={() => onTab(key)}>
            {t(categories[key])}
            <strong>{display(counts[key] ?? 0, locale)}</strong>
          </button>
        ))}
      </div>
      {Object.keys(extra).length > 0 && (
        <section className="panel">
          <Fields data={extra} />
        </section>
      )}
    </>
  );
}
function Appointment({
  profile,
  questions,
}: {
  profile: Row;
  questions: Row[];
}) {
  const { t } = useAdminLocale();
  return (
    <>
      {profile.nextClinicDate ? (
        <section className="panel appointment-detail">
          <div className="section-heading">
            <h3>
              <Value value={profile.nextClinicDate} field="nextClinicDate" />
            </h3>
            <Status value={profile.nextClinicStatus ?? "scheduled"} />
          </div>
          <Fields
            data={Object.fromEntries(
              [
                "nextClinicTime",
                "nextClinicLocation",
                "nextClinicDoctor",
                "nextClinicSpecialty",
                "nextClinicNote",
              ].map((k) => [k, profile[k]]),
            )}
          />
        </section>
      ) : (
        <Empty title="尚未記錄覆診安排" />
      )}
      <div className="two-columns">
        {[true, false].map((selected) => (
          <section className="panel" key={String(selected)}>
            <h3>{t(selected ? "本次覆診要問" : "尚未加入")}</h3>
            {questions.some((q) => Boolean(q.selected) === selected) ? (
              <ol className="question-list">
                {questions
                  .filter((q) => Boolean(q.selected) === selected)
                  .map((q) => (
                    <li key={String(q.id)}>{String(q.text)}</li>
                  ))}
              </ol>
            ) : (
              <p>{t("尚未有問題")}</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
function RecordDetail({ item }: { item: Row }) {
  const { t, locale } = useAdminLocale(),
    time = measurement(item),
    data = (item.data ?? {}) as Row,
    hba1c = item.kind === "hba1c",
    measured = hba1c || item.kind === "glucose",
    unit = hba1c
      ? String(item.originalUnit || data.originalUnit || "%")
      : item.kind === "glucose"
        ? glucoseUnit(item)
        : "";
  const known = new Set([
    "value",
    "date",
    "time",
    "timestamp",
    "timeType",
    "mealTag",
    "symptoms",
    "dietNote",
    "exerciseNote",
    "note",
  ]);
  return (
    <section className="panel record-detail-card">
      <div className="record-detail-heading">
        {measured && (
          <>
            <strong>
              {hba1c || unit
                ? display(data.value, locale)
                : glucoseValue(item, locale)}
            </strong>
            <span>{unit}</span>
          </>
        )}
        <p>
          {display(time.date, locale, "date")}{" "}
          {time.time ? display(time.time, locale) : t("時間未提供")}
        </p>
      </div>
      <Fields
        data={{
          ...(!hba1c
            ? {
                timeType: data.timeType,
                mealTag: data.mealTag,
                symptoms: data.symptoms,
                dietNote: data.dietNote,
                exerciseNote: data.exerciseNote,
              }
            : {}),
          note: data.note,
          ...Object.fromEntries(
            Object.entries(data).filter(([key]) => !known.has(key)),
          ),
          ...(item.originalUnit &&
          item.originalUnit !== (hba1c ? "%" : "mmol/L")
            ? { originalUnit: item.originalUnit }
            : {}),
          id: item.id,
          version: item.version,
        }}
      />
    </section>
  );
}
function MedicationDetail({ medication }: { medication: Row }) {
  const { t, locale } = useAdminLocale(),
    inventory = medication.inventory as Row | undefined,
    schedule = medication.schedule as Row | undefined;
  return (
    <>
      <section className="panel medication-detail-card">
        <h3>{String(medication.name)}</h3>
        <Fields
          labels={{ dosage: "用量", schedule: "服藥安排", inventory: "庫存" }}
          data={{
            dosage: medication.dosage,
            usage: medication.usage,
            reminderEnabled: medication.reminderEnabled,
            schedule: scheduleSummary(medication, locale),
            startDate: schedule?.startDate,
            endDate: schedule?.endDate,
            inventory:
              inventory?.quantity == null
                ? null
                : `${inventory.quantity} ${inventory.unit ?? schedule?.unit ?? ""}`.trim(),
            refillEnabled: inventory?.refillEnabled,
            ...(inventory?.threshold != null
              ? { threshold: inventory.threshold }
              : {}),
            version: medication.version,
          }}
        />
      </section>
      <details className="panel medication-full-data">
        <summary>{t("完整資料")}</summary>
        <Fields
          data={Object.fromEntries(
            Object.entries(medication).filter(
              ([key]) =>
                ![
                  "name",
                  "dosage",
                  "usage",
                  "reminderEnabled",
                  "version",
                ].includes(key),
            ),
          )}
        />
      </details>
    </>
  );
}
export function UserDetail({
  id,
  onBack,
  onName,
}: {
  id: string;
  onBack: () => void;
  onName: (name: string | null) => void;
}) {
  const { t, locale } = useAdminLocale(),
    reduce = useReducedMotion(),
    [tab, setTab] = useState("profile"),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<Row | null>(null);
  const r = useResource<Row>(`/admin/users/${id}`),
    record = ["glucose", "hba1c", "symptom", "lifestyle"].includes(tab),
    activity = ["intakes", "requests"].includes(tab);
  const list = useResource<Page>(
    record
      ? `/admin/users/${id}/records?kind=${tab}&limit=25&offset=${offset}`
      : activity
        ? `/admin/users/${id}/activity?kind=${tab}&limit=25&offset=${offset}`
        : null,
  );
  const name = (r.data?.profile as Row | undefined)?.name;
  useEffect(() => {
    onName(name ? String(name) : null);
    return () => onName(null);
  }, [name, onName]);
  function changeTab(next: string) {
    setTab(next);
    setOffset(0);
    setSelected(null);
  }
  if (r.error)
    return (
      <>
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={16} />
          {t("返回清單")}
        </button>
        <ErrorNotice error={r.error} retry={r.reload} />
      </>
    );
  if (!r.data) return <Loading />;
  const d = r.data,
    p = (d.profile ?? {}) as Row;
  const columns: Column[] = record
    ? [
        {
          key: "date",
          label: "量度日期",
          render: (item) => (
            <Value value={measurement(item).date} field="date" />
          ),
        },
        {
          key: "time",
          render: (item) =>
            measurement(item).time ? (
              <Value value={measurement(item).time} />
            ) : (
              t("未記錄")
            ),
        },
        ...(tab === "glucose"
          ? [
              {
                key: "value",
                label: "血糖",
                render: (item: Row) => glucoseValue(item, locale),
              },
              {
                key: "timeType",
                label: "量度時段",
                render: (item: Row) => (
                  <Value value={(item.data as Row).timeType} field="timeType" />
                ),
              },
            ]
          : tab === "hba1c"
            ? [
                {
                  key: "value",
                  label: "HbA1c",
                  render: (item: Row) =>
                    `${display((item.data as Row).value, locale)} ${item.originalUnit || (item.data as Row).originalUnit || "%"}`,
                },
              ]
            : tab === "symptom"
              ? [
                  {
                    key: "symptoms",
                    label: "症狀",
                    render: (item: Row) =>
                      Array.isArray((item.data as Row).symptoms)
                        ? ((item.data as Row).symptoms as string[]).join("、")
                        : t("未提供"),
                  },
                ]
              : [
                  {
                    key: "dietNote",
                    label: "飲食紀錄",
                    render: (item: Row) => (
                      <Value value={(item.data as Row).dietNote} />
                    ),
                  },
                  {
                    key: "exerciseNote",
                    label: "運動紀錄",
                    render: (item: Row) => (
                      <Value value={(item.data as Row).exerciseNote} />
                    ),
                  },
                ]),
      ]
    : tab === "intakes"
      ? [
          "name",
          "date",
          { key: "time", label: "計劃時間" },
          "takenAt",
          "amount",
          "unit",
          "status",
        ]
      : ["id", "status", "createdAt", "expiresAt"];
  const medications = (d.medications ?? []) as Row[];
  return (
    <section className="user-detail-page">
      <div className="user-heading">
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={15} />
          {t("返回清單")}
        </button>
        <div>
          <h1>{display(p.name, locale)}</h1>
          <p className="identifier">{id}</p>
        </div>
        <Status value={d.status} />
      </div>
      <div className="user-detail-layout">
        <nav className="detail-nav" aria-label={t("用戶資料類別")}>
          {Object.entries(categories).map(([key, label]) => {
            const Icon = categoryIcons[key];
            return (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => changeTab(key)}
              >
                <Icon size={16} />
                {t(label)}
              </button>
            );
          })}
        </nav>
        <section className="detail-content">
          <h2>{t(categories[tab])}</h2>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${tab}-${selected?.id ?? ""}`}
              className="detail-tab-content"
              initial={{ opacity: 0, y: reduce ? 0 : 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.12 }}
            >
              {selected ? (
                <>
                  <button
                    className="secondary detail-back"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft size={15} />
                    {t(tab === "medications" ? "返回藥物清單" : "返回紀錄")}
                  </button>
                  {tab === "medications" ? (
                    <MedicationDetail medication={selected} />
                  ) : (
                    <RecordDetail item={selected} />
                  )}
                </>
              ) : (
                <>
                  {tab === "profile" && (
                    <Profile
                      profile={p}
                      counts={(d.recordCounts ?? {}) as Row}
                      onTab={changeTab}
                    />
                  )}
                  {tab === "appointment" && (
                    <Appointment
                      profile={p}
                      questions={(d.doctorQuestions ?? []) as Row[]}
                    />
                  )}
                  {tab === "medications" && (
                    <Table
                      items={medications}
                      widths={[220, 120, 290, 130, 160]}
                      emptyTitle="尚未記錄藥物"
                      columns={[
                        { key: "name", label: "藥物名稱" },
                        "dosage",
                        {
                          key: "schedule",
                          label: "安排",
                          render: (m) => scheduleSummary(m, locale),
                        },
                        {
                          key: "inventory",
                          label: "庫存",
                          render: (m) =>
                            m.inventory
                              ? display((m.inventory as Row).quantity, locale)
                              : t("未設定"),
                        },
                      ]}
                      onSelect={setSelected}
                    />
                  )}
                  {(record || activity) &&
                    (list.error ? (
                      <ErrorNotice error={list.error} retry={list.reload} />
                    ) : list.loading || !list.data ? (
                      <Loading />
                    ) : (
                      <>
                        <Table
                          items={list.data.items}
                          columns={columns}
                          widths={
                            tab === "glucose"
                              ? [180, 120, 200, 200, 220]
                              : tab === "hba1c"
                                ? [230, 200, 280, 210]
                                : undefined
                          }
                          onSelect={record ? setSelected : undefined}
                          emptyTitle="尚未有此類紀錄"
                        />
                        <Pager
                          offset={offset}
                          hasMore={list.data.hasMore}
                          onChange={setOffset}
                        />
                      </>
                    ))}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </section>
  );
}
