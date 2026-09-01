import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import { openAssistant } from '@/components/shared/shell/assistantSurface';
import {
  ONBOARDING_BLUEPRINT_COOKIE,
  clearOnboardingBlueprintCookie,
  goalLabel,
  parseOnboardingBlueprint,
} from '@/lib/onboarding';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

type OnboardingPageProps = InferGetServerSidePropsType<
  typeof getServerSideProps
>;

const allowanceLabel = (halfDays: number | null) =>
  halfDays === null
    ? 'Unlimited'
    : `${halfDays / 2} ${halfDays === 2 ? 'day' : 'days'}`;

export default function OnboardingPage({
  blueprint,
  team,
}: OnboardingPageProps) {
  const router = useRouter();
  const { t } = useTranslation('common');
  const complete = Boolean(team?.onboardingCompletedAt);

  useEffect(() => {
    let attempts = 0;
    const reveal = () => {
      attempts += 1;
      if (!openAssistant() && attempts < 20) {
        window.setTimeout(reveal, 200);
      }
    };
    reveal();

    const refresh = () => void router.replace(router.asPath);
    window.addEventListener('tivmark-onboarding-completed', refresh);
    return () =>
      window.removeEventListener('tivmark-onboarding-completed', refresh);
  }, [router]);

  const businessName = team?.name ?? blueprint?.businessName ?? 'Your business';
  const size = team?.businessSizeBand ?? blueprint?.teamSize;
  const timeZone = team?.timeZone ?? blueprint?.timeZone;
  const goal = team?.onboardingGoal ?? blueprint?.primaryGoal;
  const policies =
    team?.timeOffPolicies ??
    (blueprint
      ? [
          {
            type: 'VACATION',
            annualAllowanceHalfDays: blueprint.vacationAllowanceDays * 2,
          },
          {
            type: 'SICK',
            annualAllowanceHalfDays: blueprint.sickAllowanceDays * 2,
          },
          {
            type: 'PERSONAL',
            annualAllowanceHalfDays: blueprint.personalAllowanceDays * 2,
          },
          { type: 'UNPAID', annualAllowanceHalfDays: null },
        ]
      : []);

  return (
    <>
      <Head>
        <title>{t('onboarding-page-title')}</title>
      </Head>

      <div className="mx-auto max-w-5xl space-y-5">
        <section className="border border-ui-border bg-ui-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ui-accent">
                {t('onboarding-label')}
              </p>
              <h1 className="mt-2 font-serif text-3xl text-ui-heading">
                {complete
                  ? `${businessName} is ready`
                  : `Finish setting up ${businessName}`}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ui-muted">
                {complete
                  ? 'Mark completed the same workspace blueprint that started on the public website. The settings below are now live in Tivmark.'
                  : 'Your public-site blueprint is loaded. Mark will resume the pending setup, show the exact configuration, and wait for your confirmation before applying it.'}
              </p>
            </div>
            <span
              className={`inline-flex w-fit items-center border px-3 py-1.5 text-xs font-semibold ${
                complete
                  ? 'border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-ui-border bg-ui-surface-muted text-ui-heading'
              }`}
            >
              {complete ? 'Workspace ready' : 'Confirmation required'}
            </span>
          </div>

          <ol className="mt-7 grid gap-3 md:grid-cols-3">
            {[
              [
                '1',
                'Blueprint designed',
                'Completed with Mark on tivmark.com.',
              ],
              [
                '2',
                'Owner authenticated',
                'Your new account now owns the workspace.',
              ],
              [
                '3',
                complete ? 'Configuration applied' : 'Review and confirm',
                complete
                  ? 'The business profile and leave policy are live.'
                  : 'Open Mark and approve the exact authenticated action.',
              ],
            ].map(([number, title, detail]) => (
              <li
                key={number}
                className="border border-ui-border bg-ui-canvas p-4"
              >
                <span className="text-xs font-semibold text-ui-accent">
                  STEP {number}
                </span>
                <h2 className="mt-2 font-semibold text-ui-heading">{title}</h2>
                <p className="mt-1 text-sm text-ui-muted">{detail}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-3">
            {!complete ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openAssistant()}
              >
                {t('onboarding-open-mark')}
              </button>
            ) : null}
            {team ? (
              <Link
                className={complete ? 'btn btn-primary' : 'btn btn-outline'}
                href={`/teams/${team.slug}/time-off`}
              >
                {t('onboarding-open-time-off')}
              </Link>
            ) : null}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="border border-ui-border bg-ui-surface p-6 shadow-sm">
            <h2 className="font-serif text-xl text-ui-heading">
              {t('onboarding-business-profile')}
            </h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-ui-muted">{t('onboarding-business')}</dt>
                <dd className="mt-1 font-semibold text-ui-heading">
                  {businessName}
                </dd>
              </div>
              <div>
                <dt className="text-ui-muted">{t('onboarding-team-size')}</dt>
                <dd className="mt-1 font-semibold text-ui-heading">
                  {size ?? 'To be confirmed'}
                </dd>
              </div>
              <div>
                <dt className="text-ui-muted">{t('onboarding-time-zone')}</dt>
                <dd className="mt-1 font-semibold text-ui-heading">
                  {timeZone ?? 'To be confirmed'}
                </dd>
              </div>
              <div>
                <dt className="text-ui-muted">
                  {t('onboarding-first-workflow')}
                </dt>
                <dd className="mt-1 font-semibold text-ui-heading">
                  {goal ? goalLabel(goal) : 'To be confirmed'}
                </dd>
              </div>
            </dl>
          </article>

          <article className="border border-ui-border bg-ui-surface p-6 shadow-sm">
            <h2 className="font-serif text-xl text-ui-heading">
              {t('onboarding-starter-policy')}
            </h2>
            <p className="mt-1 text-sm text-ui-muted">
              {t('onboarding-policy-note')}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {policies.map((policy) => (
                <div
                  key={policy.type}
                  className="border border-ui-border bg-ui-canvas p-4"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-ui-muted">
                    {policy.type.toLowerCase()}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-ui-heading">
                    {allowanceLabel(policy.annualAllowanceHalfDays)}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </>
  );
}

export const getServerSideProps = async ({
  req,
  res,
  locale,
}: GetServerSidePropsContext) => {
  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/auth/login?callbackUrl=%2Fonboarding',
        permanent: false,
      },
    };
  }

  const blueprint = parseOnboardingBlueprint(
    req.cookies[ONBOARDING_BLUEPRINT_COOKIE]
  );
  const memberships = await prisma.teamMember.findMany({
    where: { userId: session.user.id, role: 'OWNER' },
    include: {
      team: {
        include: { timeOffPolicies: { orderBy: { type: 'asc' } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  const membership =
    memberships.find(
      ({ team }) =>
        blueprint &&
        team.name.localeCompare(blueprint.businessName, undefined, {
          sensitivity: 'accent',
        }) === 0
    ) ??
    memberships.find(({ team }) => team.onboardingCompletedAt) ??
    memberships[0];
  const team = membership?.team;

  if (team?.onboardingCompletedAt) {
    res.setHeader(
      'Set-Cookie',
      clearOnboardingBlueprintCookie(req.headers.host)
    );
  }

  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
      blueprint: blueprint ?? null,
      team: team
        ? {
            id: team.id,
            name: team.name,
            slug: team.slug,
            businessSizeBand: team.businessSizeBand,
            timeZone: team.timeZone,
            onboardingGoal: team.onboardingGoal,
            onboardingCompletedAt:
              team.onboardingCompletedAt?.toISOString() ?? null,
            timeOffPolicies: team.timeOffPolicies.map((policy) => ({
              type: policy.type,
              annualAllowanceHalfDays: policy.annualAllowanceHalfDays,
            })),
          }
        : null,
    },
  };
};
