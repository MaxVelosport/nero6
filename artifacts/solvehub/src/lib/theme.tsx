import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "nz_theme";

interface ThemeContextType {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggle: () => {},
});

// CSS variables overridden in light mode.
// Applied as inline style on DashboardLayout's root div so auth pages stay dark.
// Sidebar vars are intentionally NOT overridden — sidebar stays dark in both modes.
export const LIGHT_VARS = {
  "--background": "220 28% 97%",
  "--foreground": "230 30% 12%",
  "--card": "0 0% 100%",
  "--card-foreground": "230 30% 12%",
  "--card-border": "220 20% 88%",
  "--border": "220 20% 85%",
  "--muted": "220 20% 93%",
  "--muted-foreground": "220 15% 42%",
  "--input": "220 20% 90%",
  "--ring": "260 100% 65%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "230 30% 12%",
  "--popover-border": "220 20% 88%",
  "--secondary": "220 20% 92%",
  "--secondary-foreground": "230 30% 12%",
  "--shadow-2xs": "0px 2px 4px 0px hsl(230 25% 20% / 0.08)",
  "--shadow-xs": "0px 2px 4px 0px hsl(230 25% 20% / 0.08)",
  "--shadow-sm": "0px 1px 3px 0px hsl(230 25% 20% / 0.1), 0px 1px 2px -1px hsl(230 25% 20% / 0.08)",
  "--shadow": "0px 2px 6px 0px hsl(230 25% 20% / 0.1), 0px 1px 4px -1px hsl(230 25% 20% / 0.08)",
} as Record<string, string>;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme) || "dark"
  );

  const toggle = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
