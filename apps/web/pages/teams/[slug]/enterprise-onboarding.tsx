/* eslint-disable i18next/no-literal-string -- English-first enterprise showcase. */
import Head from 'next/head';
import type { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import EnterpriseWorkspace from '@/components/onboarding/EnterpriseWorkspace';
export default function EnterpriseOnboardingPage() {
  return (
    <>
      <Head>
        <title>Five-stage onboarding | Tivmark</title>
      </Head>
      <EnterpriseWorkspace />
    </>
  );
}
export const getServerSideProps = async ({
  locale,
}: GetServerSidePropsContext) => ({
  props: {
    ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
  },
});
