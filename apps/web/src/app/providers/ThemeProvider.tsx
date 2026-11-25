import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (theme: ThemePreference) => void;
}

const STORAGE_KEY = 'yegna-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Storage may be unavailable.
  }

  return 'system';
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(
    getInitialPreference,
  );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  const resolvedTheme =
    preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const updateSystemTheme = () => {
      setSystemTheme(media.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', updateSystemTheme);

    return () => media.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = preference;

    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // The theme still works for this session.
    }
  }, [preference, resolvedTheme]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}
