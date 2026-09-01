/* eslint-disable i18next/no-literal-string -- The showcase launches in the repository's only configured locale; localization follows the validated demo contract. */
import type { GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import ActionDeskWorkspace from '@/components/action-desk/ActionDeskWorkspace';
import type { NextPageWithLayout } from 'types';

const ActionDeskPage: NextPageWithLayout = () => (
  <>
    <Head>
      <title>Action Desk | Tivmark</title>
      <meta
        name="description"
        content="Ask for help, track the outcome, and manage every service request in one place."
      />
    </Head>
    <ActionDeskWorkspace />
  </>
);

export const getServerSideProps = async ({
  locale,
}: GetServerSidePropsContext) => ({
  props: {
    ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
  },
});

export default ActionDeskPage;
