import Head from 'next/head';
import type { GetServerSidePropsContext } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import env from '@/lib/env';
import type { NextPageWithLayout } from 'types';

const MarkPage: NextPageWithLayout = () => {
  const { t } = useTranslation('common');

  return (
    <>
      <Head>
        <title>{t('mark-page-title')}</title>
      </Head>
      <h1 className="sr-only">{t('mark')}</h1>
      {!env.assistant.enabled && (
        <div
          className="flex h-full min-h-72 items-center justify-center border border-ui-border bg-ui-surface p-8 text-center"
          role="status"
        >
          <div className="max-w-md">
            <h2 className="text-xl text-ui-heading">{t('mark-unavailable')}</h2>
            <p className="mt-2 text-sm text-ui-muted">
              {t('mark-unavailable-description')}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export const getServerSideProps = async ({
  locale,
}: GetServerSidePropsContext) => ({
  props: {
    ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
  },
});

export default MarkPage;
