import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';

import useTheme from 'hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle = ({ className = '' }: ThemeToggleProps) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useTranslation('common');
  const nextTheme = resolvedTheme === 'light' ? t('dark') : t('light');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center border border-ui-border bg-ui-surface text-ui-heading transition-colors hover:border-tivmark-gold hover:text-tivmark-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tivmark-gold ${className}`}
      aria-label={`${t('switch-theme')}: ${nextTheme}`}
      title={`${t('switch-theme')}: ${nextTheme}`}
    >
      {resolvedTheme === 'light' ? (
        <MoonIcon className="h-5 w-5" aria-hidden="true" />
      ) : (
        <SunIcon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
};

export default ThemeToggle;
