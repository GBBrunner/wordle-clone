import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    baseColorSchemeForTheme,
    isThemeKey,
    THEME_STORAGE_KEY,
    themeColors,
    ThemeKey,
    themeOptions,
} from "./theme";

type AppThemeContextValue = {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
  hasHydrated: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function readStoredTheme(): ThemeKey {
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeKey(raw) ? raw : "light";
  } catch {
    return "light";
  }
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [theme, setThemeState] = useState<ThemeKey>(() => readStoredTheme());

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (!isThemeKey(event.newValue)) return;
      setThemeState(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((nextTheme: ThemeKey) => {
    setThemeState(nextTheme);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, hasHydrated }),
    [theme, setTheme, hasHydrated],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }

  const colors = themeColors[ctx.theme];
  const colorScheme = baseColorSchemeForTheme(ctx.theme);

  return {
    ...ctx,
    colors,
    colorScheme,
    options: themeOptions,
  };
}
