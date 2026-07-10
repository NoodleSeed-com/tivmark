import dynamic from 'next/dynamic';
import Head from 'next/head';
import type { GetServerSidePropsContext } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import { getSession } from '@/lib/session';
import type { NextPageWithLayout } from 'types';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

const ApiDocs: NextPageWithLayout = () => {
  const { t } = useTranslation('common');

  return (
    <>
      <Head>
        <title>{t('api-documentation-title')}</title>
      </Head>
      <main className="min-h-screen bg-white">
        <SwaggerUI
          url="/api/openapi.json"
          persistAuthorization={false}
          displayRequestDuration
          tryItOutEnabled
          oauth2RedirectUrl="/docs/oauth2-redirect.html"
        />
      </main>
    </>
  );
};

ApiDocs.getLayout = (page) => page;

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context.req, context.res);
  if (!session) {
    return {
      redirect: {
        destination: `/auth/login?callbackUrl=${encodeURIComponent('/docs')}`,
        permanent: false,
      },
    };
  }
  return {
    props: {
      session,
      ...(context.locale
        ? await serverSideTranslations(context.locale, ['common'])
        : {}),
    },
  };
};

export default ApiDocs;
