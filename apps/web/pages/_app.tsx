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
            '--primary-hover': 'rgb(var(--ui-accent))',
            '--primary-color-50': 'rgb(var(--ui-surface))',
            '--primary-color-100': 'rgb(var(--ui-surface-muted))',
            '--primary-color-200': '#d8d0c0',
            '--primary-color-300': '#c9a96e',
            '--primary-color-500': 'rgb(var(--ui-accent))',
            '--primary-color-600': '#8f7040',
            '--primary-color-700': '#3d4f6b',
            '--primary-color-800': 'rgb(var(--ui-heading))',
            '--primary-color-900': 'rgb(var(--ui-canvas))',
            '--primary-color-950': 'rgb(var(--ui-canvas))',
          }}
        >
          {getLayout(<Component {...props} />)}
        </Themer>
      </SessionProvider>
    </>
  );
}

export default appWithTranslation<never>(MyApp);
