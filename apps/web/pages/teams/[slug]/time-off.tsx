import Head from 'next/head';
import type { GetServerSidePropsContext } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import TimeOffWorkspace from '@/components/timeOff/TimeOffWorkspace';
import type { NextPageWithLayout } from 'types';

const TimeOffPage: NextPageWithLayout = () => {
  const { t } = useTranslation('common');

  return (
    <>
      <Head>
        <title>{t('time-off-page-title')}</title>
      </Head>
      <TimeOffWorkspace />
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

export default TimeOffPage;
