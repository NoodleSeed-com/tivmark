import { Card } from '@/components/shared';
import useTheme from 'hooks/useTheme';
import { useTranslation } from 'next-i18next';

const UpdateTheme = () => {
  const { preference, themes, setPreference } = useTheme();
  const { t } = useTranslation('common');

  return (
    <Card>
      <Card.Body>
        <Card.Header>
          <Card.Title>{t('theme')}</Card.Title>
          <Card.Description>{t('change-theme')}</Card.Description>
        </Card.Header>
        <div
          className="grid w-full max-w-md grid-cols-3 border border-ui-border bg-ui-surface"
          role="group"
          aria-label={t('theme')}
        >
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              aria-pressed={preference === theme.id}
              className={`flex h-10 items-center justify-center gap-2 border-r border-ui-border px-3 text-sm font-medium transition-colors last:border-r-0 ${
                preference === theme.id
                  ? 'bg-tivmark-navy text-white dark:bg-tivmark-gold dark:text-tivmark-deep'
                  : 'text-ui-text hover:bg-ui-surface-muted'
              }`}
              onClick={() => setPreference(theme.id)}
            >
              <theme.icon className="h-5 w-5" aria-hidden="true" />
              <span>{theme.name}</span>
            </button>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
};

export default UpdateTheme;
