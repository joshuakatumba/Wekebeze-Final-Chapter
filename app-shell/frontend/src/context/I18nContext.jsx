import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import en from "../i18n/en.json";
import lg from "../i18n/lg.json";

const DICTS = { en, lg };
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("shell-lang") || "en");

  const setLang = useCallback((next) => {
    if (!DICTS[next]) return;
    setLangState(next);
    localStorage.setItem("shell-lang", next);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = useCallback((key, vars) => {
    let str = (DICTS[lang] && DICTS[lang][key]) ?? en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{{${k}}}`, String(v));
    }
    return str;
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
