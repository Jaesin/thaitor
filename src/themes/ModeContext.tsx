/*
 * ModeContext — app mode (Travel | Learn) state with localStorage persistence.
 * Travel surfaces the Translate tab; Learn surfaces the Play tab.
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

export type AppMode = 'travel' | 'learn';

const STORAGE_KEY = 'thaitor_mode';

function isAppMode(value: string | null): value is AppMode {
  return value === 'travel' || value === 'learn';
}

function detectInitialMode(): AppMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isAppMode(stored) ? stored : 'travel';
}

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(detectInitialMode);

  const setMode = useCallback((next: AppMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  const value: ModeContextValue = { mode, setMode };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (ctx === null) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return ctx;
}
