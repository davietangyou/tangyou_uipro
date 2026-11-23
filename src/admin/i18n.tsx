import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Languages } from "lucide-react";
import { translate, type AdminLocale } from "./copy";

const LocaleContext = createContext({
  locale: "zh-HK" as AdminLocale,
  setLocale: (_: AdminLocale) => {},
  t: (text: string) => text,
});
export function AdminLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AdminLocale>(() => {
    try {
      return localStorage.getItem("diaguide.admin.locale") === "en"
        ? "en"
        : "zh-HK";
    } catch {
      return "zh-HK";
    }
  });
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-Hant-HK";
    document.title =
      locale === "en" ? "DiaGuide HK · Admin Console" : "糖友導航 · 管理中心";
    try {
      localStorage.setItem("diaguide.admin.locale", locale);
    } catch {
      /* The current session still uses the selected language. */
    }
  }, [locale]);
  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, t: (text) => translate(text, locale) }}
    >
      {children}
    </LocaleContext.Provider>
  );
}
export const useAdminLocale = () => useContext(LocaleContext);
export function LanguageSwitch() {
  const { locale, setLocale, t } = useAdminLocale();
  return (
    <button
      className="language-switch secondary"
      onClick={() => setLocale(locale === "en" ? "zh-HK" : "en")}
      aria-label={t("切換語言")}
    >
      <Languages size={16} />
      <span>{locale === "en" ? "繁體中文" : "English"}</span>
    </button>
  );
}
