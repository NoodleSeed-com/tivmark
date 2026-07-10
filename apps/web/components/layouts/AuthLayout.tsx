import { ThemeLogo, ThemeToggle } from '@/components/shared';
import { useTranslation } from 'next-i18next';

interface AuthLayoutProps {
  children: React.ReactNode;
  heading?: string;
  description?: string;
}

export default function AuthLayout({
  children,
  heading,
  description,
}: AuthLayoutProps) {
  const { t } = useTranslation('common');

  return (
    <div className="relative min-h-full bg-ui-canvas text-ui-text">
      <ThemeToggle className="absolute right-4 top-4 sm:right-6 sm:top-6" />
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-20 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <div className="flex justify-center">
            <ThemeLogo className="w-44" priority />
          </div>
          {heading && (
            <h2 className="mt-8 text-center font-serif text-3xl leading-tight text-ui-heading">
              {t(heading)}
            </h2>
          )}
          {description && (
            <p className="mt-2 text-center text-sm leading-6 text-ui-muted">
              {t(description)}
            </p>
          )}
        </div>
        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">{children}</div>
      </div>
    </div>
  );
}
