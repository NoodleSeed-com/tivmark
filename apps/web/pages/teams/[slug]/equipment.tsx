import Head from 'next/head';
import type { GetServerSidePropsContext } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import EquipmentWorkspace from '@/components/equipment/EquipmentWorkspace';
import type { NextPageWithLayout } from 'types';

const EquipmentPage: NextPageWithLayout = () => {
  const { t } = useTranslation('common');

  return (
    <>
      <Head>
        <title>{t('equipment-page-title')}</title>
      </Head>
      <EquipmentWorkspace />
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

export default EquipmentPage;
