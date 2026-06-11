/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

const FALLBACK_LIGHT_BG = "#f4f4f6";
const FALLBACK_DARK_BG = "#080810";

export type Theme = "light" | "dark" | "system";

interface ThemeProviderProps {
  theme: Theme;
  children: React.ReactNode;
}

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const subscribe = (callback: () => void) => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
};

const getSnapshot = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const getServerSnapshot = () => false;

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const isSystemDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const resolvedTheme =
    theme === "system" ? (isSystemDark ? "dark" : "light") : theme === "dark" ? "dark" : "light";

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);

    // Update theme-color meta tag for mobile browsers
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }
    const computedBg = getComputedStyle(root).getPropertyValue("--app-bg").trim();
    const color = computedBg || (resolvedTheme === "dark" ? FALLBACK_DARK_BG : FALLBACK_LIGHT_BG);
    metaThemeColor.setAttribute("content", color);
  }, [resolvedTheme]);

  return <ThemeContext.Provider value={{ theme, resolvedTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
