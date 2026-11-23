import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ListChecks,
  ChevronRight,
  CircleUserRound,
  ChevronsUpDown,
  ClipboardList,
  Heart,
  Eye,
  EyeOff,
  LogIn,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeft,
  Server,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { backend, BackendError } from "./services/backendClient";
import {
  AdminLocaleProvider,
  LanguageSwitch,
  useAdminLocale,
} from "./admin/i18n";
import { ErrorNotice, Loading, Menu } from "./admin/ui";
import { Dashboard } from "./admin/dashboard";
import { Listing, Runtime } from "./admin/pages";
import "./admin.css";

export type AdminView =
  | "overview"
  | "users"
  | "deliveries"
  | "ai"
  | "jobs"
  | "runtime"
  | "requests"
  | "audit";
const navigation = [
  {
    group: "工作台",
    items: [{ id: "overview", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    group: "用戶與資料",
    items: [
      { id: "users", label: "用戶清單", icon: UsersRound },
      { id: "requests", label: "資料請求", icon: ClipboardList },
    ],
  },
  {
    group: "服務運行",
    items: [
      { id: "ai", label: "AI 請求", icon: Sparkles },
      { id: "deliveries", label: "電郵驗證碼", icon: Mail },
      { id: "jobs", label: "背景任務", icon: ListChecks },
      { id: "runtime", label: "運行與設定", icon: Server },
    ],
  },
  {
    group: "審計",
    items: [{ id: "audit", label: "存取紀錄", icon: ShieldCheck }],
  },
] as const;
function Admin() {
  const { t, locale } = useAdminLocale(),
    reduce = useReducedMotion();
  const [phase, setPhase] = useState<"checking" | "login" | "ready">(
      "checking",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  const [view, setView] = useState<AdminView>("overview"),
    [filter, setFilter] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [detailName, setDetailName] = useState<string | null>(null);
  useEffect(() => {
    void backend<{ role: string }>("/auth/me")
      .then((me) => {
        setPhase(me.role === "ADMIN" ? "ready" : "login");
        if (me.role !== "ADMIN") setError(new Error(t("此帳戶沒有管理權限。")));
      })
      .catch((e) => {
        setPhase("login");
        if (!(e instanceof BackendError && e.status === 401)) setError(e);
      });
  }, []);
  async function login() {
    setBusy(true);
    setError(null);
    try {
      const result = await backend<{ role: string }>("/auth/sessions", {
        method: "POST",
        body: { channel: "email", value: email, password },
      });
      if (result.role !== "ADMIN") {
        await backend("/auth/sessions/current", { method: "DELETE" });
        throw new Error(t("此帳戶沒有管理權限。"));
      }
      setPassword("");
      setPhase("ready");
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await backend("/auth/sessions/current", { method: "DELETE" });
      setPhase("login");
      setView("overview");
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  function navigate(next: AdminView, nextFilter = "") {
    setView(next);
    setFilter(nextFilter);
    setError(null);
  }
  if (phase === "checking")
    return (
      <main className="login-shell">
        <Loading />
      </main>
    );
  if (phase === "login")
    return (
      <main className="login-shell">
        <div className="login-language">
          <LanguageSwitch />
        </div>
        <div className="login-brand">
          <Heart size={22} />
          <strong>{t("糖友導航")}</strong>
        </div>
        <section className="login-card">
          <div>
            <h1>{t("登入管理中心")}</h1>
            <p>{t("輸入管理員電郵及密碼")}</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
          >
            <label>
              {t("電郵")}
              <input
                type="email"
                required
                autoComplete="username"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              {t("密碼")}
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  aria-label={t("密碼")}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t(showPassword ? "隱藏密碼" : "顯示密碼")}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
            </label>
            {error && <ErrorNotice error={error} />}
            <button disabled={busy}>
              <LogIn size={16} />
              {t(busy ? "正在登入…" : "登入")}
            </button>
          </form>
        </section>
      </main>
    );
  const title = navigation
    .map((g) => g.items.find((i) => i.id === view)?.label)
    .find(Boolean)!;
  return (
    <div className={`admin-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <Heart size={21} />
          </span>
          <div className="sidebar-label">
            <strong>{t("糖友導航")}</strong>
            <small>{locale === "en" ? "Admin Console" : "DiaGuide HK"}</small>
          </div>
        </div>
        <nav aria-label={t("管理中心")}>
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              <p className="sidebar-label">{t(group.group)}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={view === item.id ? "active" : ""}
                  aria-current={view === item.id ? "page" : undefined}
                  aria-label={t(item.label)}
                  title={collapsed ? t(item.label) : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <item.icon size={17} />
                  <span className="sidebar-label">{t(item.label)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Menu
            label={
              <>
                <CircleUserRound size={28} />
                <span className="account-label sidebar-label">
                  <strong>{t("管理員")}</strong>
                  <small>DiaGuide {t("管理中心")}</small>
                </span>
              </>
            }
            ariaLabel={t("管理員")}
            buttonClass="account-trigger"
            chevron={<ChevronsUpDown size={14} />}
          >
            {(close) => (
              <button
                role="menuitem"
                className="menu-item"
                disabled={busy}
                onClick={() => {
                  close();
                  void logout();
                }}
              >
                <LogOut size={16} />
                {t(busy ? "正在登出…" : "登出")}
              </button>
            )}
          </Menu>
        </div>
      </aside>
      <div className="admin-main">
        <header className="topbar">
          <button
            className="icon-button sidebar-toggle"
            aria-label={t(collapsed ? "展開側欄" : "收合側欄")}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeft size={18} />
          </button>
          <span className="header-separator" />
          <span className="muted">{t("管理中心")}</span>
          <ChevronRight size={12} />
          <span className="breadcrumb">
            {t(title)}
            {detailName && view === "users" ? ` / ${detailName}` : ""}
          </span>
          <div className="header-actions">
            <span className="timezone">{t("香港時間 · UTC+8")}</span>
            <LanguageSwitch />
            <span className="header-avatar" aria-label={t("管理員")}>
              <UserRound size={16} />
            </span>
          </div>
        </header>
        <main className="admin-content">
          {error && <ErrorNotice error={error} />}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view + "-" + filter}
              className="page-content"
              initial={{ opacity: 0, y: reduce ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.15 }}
            >
              {view === "overview" ? (
                <Dashboard navigate={navigate} />
              ) : view === "runtime" ? (
                <Runtime />
              ) : (
                <Listing
                  view={view}
                  initialFilter={filter}
                  onDetailName={setDetailName}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("admin-root")!).render(
  <AdminLocaleProvider>
    <Admin />
  </AdminLocaleProvider>,
);
