import app from '@/lib/app';
import { SessionProvider } from 'next-auth/react';
import { appWithTranslation } from 'next-i18next';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import type { AppPropsWithLayout } from 'types';
import mixpanel from 'mixpanel-browser';

import '@boxyhq/react-ui/dist/react-ui.css';
import 'swagger-ui-react/swagger-ui.css';
import '../styles/globals.css';
import { useEffect } from 'react';
import env from '@/lib/env';
import { Themer } from '@boxyhq/react-ui/shared';
import { AccountLayout } from '@/components/layouts';

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const { session, ...props } = pageProps;

  // Add mixpanel
  useEffect(() => {
    if (env.mixpanel.token) {
      mixpanel.init(env.mixpanel.token, {
        debug: true,
        ignore_dnt: true,
        track_pageview: true,
      });
    }
  }, []);

  const getLayout =
    Component.getLayout || ((page) => <AccountLayout>{page}</AccountLayout>);

  return (
    <>
      <Head>
        <title>{app.name}</title>
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/images/favicon-16.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/images/favicon-32.png"
        />
        <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />
      </Head>
      <SessionProvider session={session}>
        <Toaster toastOptions={{ duration: 4000 }} />
        <Themer
          overrideTheme={{
            '--primary-color': 'rgb(var(--ui-heading))',
            '--primary-foreground-color': 'rgb(var(--ui-heading))',
            '--primary-hover': 'rgb(var(--ui-accent))',
            '--primary-active': 'rgb(var(--ui-heading))',
            '--primary-disabled': 'rgb(var(--ui-border))',
            '--primary-color-50': 'rgb(var(--ui-surface))',
            '--primary-color-100': 'rgb(var(--ui-surface-muted))',
            '--primary-color-200': 'rgb(var(--ui-border))',
            '--primary-color-300': 'rgb(var(--ui-accent))',
            '--primary-color-500': 'rgb(var(--ui-accent))',
            '--primary-color-600': 'rgb(var(--ui-accent))',
            '--primary-color-700': 'rgb(var(--ui-heading))',
            '--primary-color-800': 'rgb(var(--ui-heading))',
            '--primary-color-900': 'rgb(var(--ui-heading))',
            '--primary-color-950': 'rgb(var(--ui-heading))',
            '--primary-text-color': 'rgb(var(--ui-text))',
            '--primary-text-color-500': 'rgb(var(--ui-muted))',
            '--secondary-color': 'rgb(var(--ui-surface-muted))',
            '--border-color': 'rgb(var(--ui-border))',
            '--ring-color': 'rgb(var(--ui-accent))',
            '--ring-offset-color': 'rgb(var(--ui-accent) / 25%)',
            '--alert-color-success': '#2b704e',
            '--alert-color-info': '#245b8a',
            '--alert-color-warning': '#795f2b',
          }}
        >
          {getLayout(<Component {...props} />)}
        </Themer>
      </SessionProvider>
    </>
  );
}

export default appWithTranslation<never>(MyApp);
