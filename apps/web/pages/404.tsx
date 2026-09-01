import React, { ReactElement } from 'react';
import { AccountLayout } from '@/components/layouts';
import { useTranslation } from 'react-i18next';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Link from 'next/link';
import router from 'next/router';

const Custom404 = () => {
  const { t } = useTranslation('common');
  return (
    <div className="w-full items-center justify-center bg-ui-canvas text-center text-ui-text lg:px-2 xl:px-0">
      <p className="text-7xl font-bold tracking-wider text-ui-heading md:text-8xl lg:text-9xl">
        {t('error-404')}
      </p>
      <p className="mt-2 text-4xl font-bold tracking-wider text-ui-heading md:text-5xl lg:text-6xl">
        {t('page-not-found')}
      </p>
      <p className="my-12 text-lg text-ui-muted md:text-xl lg:text-2xl">
        {t('sorry-not-found')}
      </p>
      <div className="mt-8 space-x-5">
        <Link href="/" className="btn btn-primary btn-md px-2 py-3 sm:px-4">
          {t('go-home')}
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            router.back();
          }}
          className="btn btn-primary btn-outline btn-md px-2 py-3 sm:px-4"
        >
          {t('go-back')}
        </button>
      </div>
    </div>
  );
};

export default Custom404;

Custom404.getLayout = function getLayout(page: ReactElement) {
  return <AccountLayout>{page}</AccountLayout>;
};

export async function getStaticProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}
