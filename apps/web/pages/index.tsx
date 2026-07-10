import Head from 'next/head';
import { getCsrfToken } from 'next-auth/react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from 'next';

import AuthPortal from '@/components/auth/AuthPortal';
import { authProviderEnabled } from '@/lib/auth';
import env from '@/lib/env';
import { getSession } from '@/lib/session';
import type { NextPageWithLayout } from 'types';

const Home: NextPageWithLayout<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = ({ csrfToken, authProviders, recaptchaSiteKey, initialTab }) => {
  return (
    <>
      <Head>
        <title>
          {initialTab === 'signup'
            ? 'Create Account | Tivmark'
            : 'Sign In | Tivmark'}
        </title>
      </Head>
      <AuthPortal
        csrfToken={csrfToken}
        authProviders={authProviders}
        recaptchaSiteKey={recaptchaSiteKey}
        initialTab={initialTab}
      />
    </>
  );
};

Home.getLayout = (page) => page;

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context.req, context.res);

  if (session) {
    return {
      redirect: {
        destination: env.redirectIfAuthenticated,
        permanent: false,
      },
    };
  }

  const { locale, query } = context;

  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
      csrfToken: (await getCsrfToken(context)) || null,
      authProviders: authProviderEnabled(),
      recaptchaSiteKey: env.recaptcha.siteKey,
      initialTab:
        query.tab === 'signup' ? ('signup' as const) : ('login' as const),
    },
  };
};

export default Home;
