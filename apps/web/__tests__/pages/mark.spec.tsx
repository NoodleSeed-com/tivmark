import { renderToStaticMarkup } from 'react-dom/server.node';

import MarkPage from '../../pages/mark';

jest.mock('next/head', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        mark: 'Mark',
        'mark-unavailable': 'Mark is currently unavailable',
        'mark-unavailable-description':
          'Use the standard Tivmark workspaces while we reconnect Mark.',
      })[key] ?? key,
  }),
}));

describe('Mark page', () => {
  it('shows a useful fallback when the embedded assistant is disabled', () => {
    const html = renderToStaticMarkup(<MarkPage />);

    expect(html).toContain('Mark is currently unavailable');
    expect(html).toContain(
      'Use the standard Tivmark workspaces while we reconnect Mark.'
    );
  });
});
