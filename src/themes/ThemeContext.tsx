/*
 * ThemeContext — theme key state + CSS variable application.
 * Defaulting: a stored override (localStorage 'thaitor-theme') wins; otherwise
 * prefers-color-scheme dark → 'market', light → 'paper'.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { THEMES, type Theme, type ThemeKey } from './tokens';
import { applyTheme } from './applyTheme';

const STORAGE_KEY = 'thaitor-theme';

function isThemeKey(value: string | null): value is ThemeKey {
  return value === 'paper' || value === 'temple' || value === 'market';
}

function detectInitialThemeKey(): ThemeKey {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isThemeKey(stored)) return stored;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'market' : 'paper';
}

interface ThemeContextValue {
  themeKey: ThemeKey;
  theme: Theme;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>(detectInitialThemeKey);

  // Apply on mount and whenever the key changes.
  useEffect(() => {
    applyTheme(THEMES[themeKey]);
  }, [themeKey]);

  const setTheme = useCallback((key: ThemeKey) => {
    localStorage.setItem(STORAGE_KEY, key);
    applyTheme(THEMES[key]);
    setThemeKey(key);
  }, []);

  const value: ThemeContextValue = {
    themeKey,
    theme: THEMES[themeKey],
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
