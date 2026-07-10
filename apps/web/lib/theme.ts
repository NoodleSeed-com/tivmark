export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export type ThemesProps = {
  id: ThemePreference;
  name: string;
  icon: React.ForwardRefExoticComponent<
    Omit<React.SVGProps<SVGSVGElement>, 'ref'> & {
      title?: string | undefined;
      titleId?: string | undefined;
    } & React.RefAttributes<SVGSVGElement>
  >;
};

export const THEME_COOKIE = 'tivmark_theme';
export const THEME_EVENT = 'tivmark-theme-change';

const readCookie = () => {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : undefined;
};

export const getThemePreference = (): ThemePreference => {
  const value = readCookie();
  return value === 'light' || value === 'dark' ? value : 'system';
};

export const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
  if (preference !== 'system') {
    return preference;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const cookieAttributes = () => {
  const isProductionDomain =
    window.location.hostname === 'tivmark.com' ||
    window.location.hostname.endsWith('.tivmark.com');

  return isProductionDomain
    ? '; Domain=.tivmark.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure'
    : '; Path=/; Max-Age=31536000; SameSite=Lax';
};

const storePreference = (preference: ThemePreference) => {
  if (preference === 'system') {
    const domain =
      window.location.hostname === 'tivmark.com' ||
      window.location.hostname.endsWith('.tivmark.com')
        ? '; Domain=.tivmark.com'
        : '';
    document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${domain}`;
    return;
  }

  document.cookie = `${THEME_COOKIE}=${preference}${cookieAttributes()}`;
};

const applyResolvedTheme = (resolvedTheme: ResolvedTheme) => {
  const isDark = resolvedTheme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.setAttribute(
    'data-theme',
    isDark ? 'tivmark-dark' : 'tivmark-light'
  );
  document.documentElement.style.colorScheme = resolvedTheme;
};

export const applyTheme = (preference: ThemePreference) => {
  storePreference(preference);
  localStorage.removeItem('theme');
  const resolvedTheme = resolveTheme(preference);
  applyResolvedTheme(resolvedTheme);
  window.dispatchEvent(
    new CustomEvent(THEME_EVENT, {
      detail: { preference, resolvedTheme },
    })
  );
};

export const themeInitScript = `(() => {
  try {
    const match = document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
    const legacyPreference = localStorage.getItem('theme');
    const preference = match ? decodeURIComponent(match[1]) : (legacyPreference === 'light' || legacyPreference === 'dark' ? legacyPreference : 'system');
    if (!match && preference !== 'system') {
      const production = location.hostname === 'tivmark.com' || location.hostname.endsWith('.tivmark.com');
      document.cookie = '${THEME_COOKIE}=' + preference + '; Path=/; Max-Age=31536000; SameSite=Lax' + (production ? '; Domain=.tivmark.com; Secure' : '');
      localStorage.removeItem('theme');
    }
    const dark = preference === 'dark' || (preference !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.setAttribute('data-theme', dark ? 'tivmark-dark' : 'tivmark-light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (_) {}
})();`;
