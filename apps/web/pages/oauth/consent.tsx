import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from 'next';
import Head from 'next/head';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { z } from 'zod';

import { ThemeLogo, ThemeToggle } from '@/components/shared';
import { getOAuthPayload } from '@/lib/api/oauth';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import type { NextPageWithLayout } from 'types';

const Consent: NextPageWithLayout<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = ({ request, clientName, scopes }) => {
  const { t } = useTranslation('common');

  return (
    <>
      <Head>
        <title>{t('oauth-authorize-title', { clientName })}</title>
      </Head>
      <main className="relative flex min-h-screen items-center justify-center bg-ui-canvas px-4 py-16 text-ui-text">
        <ThemeToggle className="absolute right-4 top-4 sm:right-6 sm:top-6" />
        <div className="w-full max-w-md">
          <div className="flex justify-center">
            <ThemeLogo className="w-44" priority />
          </div>
          <section className="mt-8 border border-ui-border bg-ui-surface p-6 shadow-sm">
            <h1 className="font-serif text-2xl text-ui-heading">
              {t('oauth-authorize-heading', { clientName })}
            </h1>
            <p className="mt-2 text-sm text-ui-muted">
              {t('oauth-authorize-description')}
            </p>
            <ul className="mt-5 divide-y divide-ui-border border-y border-ui-border text-sm">
              {scopes.map((scope) => (
                <li key={scope} className="py-3 font-medium text-ui-heading">
                  {scope.replaceAll('_', ' ')}
                </li>
              ))}
            </ul>
            <form
              action="/api/oauth-v1/consent"
              method="post"
              className="mt-6 flex gap-3"
            >
              <input type="hidden" name="request" value={request} />
              <button
                className="btn btn-outline flex-1"
                name="decision"
                value="deny"
                type="submit"
              >
                {t('deny')}
              </button>
              <button
                className="btn btn-primary flex-1"
                name="decision"
                value="approve"
                type="submit"
              >
                {t('authorize')}
              </button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
};

Consent.getLayout = (page) => page;

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context.req, context.res);
  const request =
    typeof context.query.request === 'string' ? context.query.request : '';
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: `/?tab=login&callbackUrl=${encodeURIComponent(`/oauth/consent?request=${request}`)}`,
        permanent: false,
      },
    };
  }

  try {
    const authorization = await getOAuthPayload(
      'AUTHORIZATION_REQUEST',
      request
    );
    if (authorization.userId !== session.user.id) return { notFound: true };
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: String(authorization.clientId) },
      select: { name: true },
    });
    if (!client) return { notFound: true };
    return {
      props: {
        ...(context.locale
          ? await serverSideTranslations(context.locale, ['common'])
          : {}),
        request,
        clientName: client.name,
        scopes: z.array(z.string()).parse(authorization.scopes),
      },
    };
  } catch {
    return { notFound: true };
  }
};

export default Consent;
