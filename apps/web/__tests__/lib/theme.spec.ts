import {
  THEME_COOKIE,
  applyTheme,
  getThemePreference,
  resolveTheme,
  themeInitScript,
} from '@/lib/theme';

const setSystemTheme = (dark: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: dark,
      media: '(prefers-color-scheme: dark)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
};

describe('theme', () => {
  beforeEach(() => {
    document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
    document.documentElement.className = '';
    document.documentElement.dataset.theme = '';
    localStorage.clear();
    setSystemTheme(false);
  });

  it('applies and stores an explicit dark preference', () => {
    applyTheme('dark');

    expect(getThemePreference()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('tivmark-dark');
  });

  it('deletes the override when System is selected', () => {
    applyTheme('light');
    setSystemTheme(true);
    applyTheme('system');

    expect(getThemePreference()).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('tivmark-dark');
  });

  it('resolves System from the device preference', () => {
    setSystemTheme(false);
    expect(resolveTheme('system')).toBe('light');

    setSystemTheme(true);
    expect(resolveTheme('system')).toBe('dark');
  });

  it('initializes the document before hydration', () => {
    document.cookie = `${THEME_COOKIE}=dark; Path=/`;
    window.eval(themeInitScript);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('tivmark-dark');
  });
});
