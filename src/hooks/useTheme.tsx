import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "sniptalk:theme";

type Ctx = {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readStored(): Theme {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(t: Theme): "light" | "dark" {
  const isDark = t === "dark" || (t === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  return isDark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);
  const [resolved, setResolved] = useState<"light" | "dark">(() => applyTheme(theme));
  // Don't persist on initial mount — only when the user actually picks a theme.
  const isInitial = useRef(true);

  useEffect(() => {
    setResolved(applyTheme(theme));
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Always listen to system changes; only apply them when in "system" mode.
  // Re-subscribing per theme caused brief gaps where flips were missed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStored() === "system" || theme === "system") {
        setResolved(applyTheme("system"));
      }
    };
    // Safari <14 fallback
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [theme]);

  // Cross-tab sync: when another tab changes the saved choice (or clears it),
  // mirror that here so all tabs stay aligned.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next: Theme =
        e.newValue === "light" || e.newValue === "dark" || e.newValue === "system"
          ? e.newValue
          : "system";
      setThemeState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = (t: Theme) => setThemeState(t);
  // Toggle flips the *resolved* color and stores it as an explicit choice.
  const toggle = () => setThemeState(resolved === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
