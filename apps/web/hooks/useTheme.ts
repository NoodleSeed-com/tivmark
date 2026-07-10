import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'next-i18next';

import {
  THEME_EVENT,
  ThemesProps,
  ThemePreference,
  ResolvedTheme,
  applyTheme,
  getThemePreference,
  resolveTheme,
} from '@/lib/theme';

const getInitialResolvedTheme = (): ResolvedTheme => {
  if (typeof document === 'undefined') {
    return 'light';
  }

  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

const useTheme = () => {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    getInitialResolvedTheme
  );
  const { t } = useTranslation('common');

  useEffect(() => {
    const storedPreference = getThemePreference();
    setPreferenceState(storedPreference);
    setResolvedTheme(resolveTheme(storedPreference));

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (getThemePreference() === 'system') {
        applyTheme('system');
      }
    };
    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        preference: ThemePreference;
        resolvedTheme: ResolvedTheme;
      };
      setPreferenceState(detail.preference);
      setResolvedTheme(detail.resolvedTheme);
    };

    media.addEventListener('change', handleSystemChange);
    window.addEventListener(THEME_EVENT, handleThemeChange);

    return () => {
      media.removeEventListener('change', handleSystemChange);
      window.removeEventListener(THEME_EVENT, handleThemeChange);
    };
  }, []);

  const themes: ThemesProps[] = useMemo(
    () => [
      { id: 'system', name: t('system'), icon: ComputerDesktopIcon },
      { id: 'light', name: t('light'), icon: SunIcon },
      { id: 'dark', name: t('dark'), icon: MoonIcon },
    ],
    [t]
  );

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    applyTheme(nextPreference);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  }, [resolvedTheme]);

  const selectedTheme =
    themes.find((theme) => theme.id === preference) || themes[0];

  return {
    preference,
    resolvedTheme,
    selectedTheme,
    themes,
    setPreference,
    setTheme: setPreference,
    toggleTheme,
    applyTheme,
  };
};

export default useTheme;
