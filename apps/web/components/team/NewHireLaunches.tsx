import type { Team } from '@prisma/client';

import { Error, Loading } from '@/components/shared';
import useCanAccess from 'hooks/useCanAccess';
import useNewHireLaunches from 'hooks/useNewHireLaunches';
import { useTranslation } from 'next-i18next';

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));

const NewHireLaunches = ({ team }: { team: Team }) => {
  const { t } = useTranslation('common');
  const { canAccess, isLoading: permissionsLoading } = useCanAccess();
  const allowed = canAccess('team_invitation', ['read']);
  const { launches, isLoading, isError } = useNewHireLaunches(
    team.slug,
    allowed
  );

  if (permissionsLoading || isLoading) return <Loading />;
  if (!allowed) return null;
  if (isError) return <Error message={isError.message} />;
  if (!launches?.length) return null;

  return (
    <section className="space-y-3" aria-labelledby="new-hire-readiness-title">
      <div className="space-y-2">
        <h2
          id="new-hire-readiness-title"
          className="text-xl font-medium leading-none tracking-tight text-ui-heading"
        >
          {t('new-hire-readiness')}
        </h2>
        <p className="text-sm text-ui-muted">
          {t('new-hire-readiness-description')}
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {launches.map((launch) => (
          <article
            key={launch.launchId}
            className="border border-ui-border bg-ui-surface p-4 text-ui-text shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-medium text-ui-heading">
                  {launch.newHire.name}
                </h3>
                <p className="mt-1 text-sm text-ui-muted">
                  {launch.newHire.jobTitle} · {launch.newHire.workLocation}
                </p>
              </div>
              <span
                className={`shrink-0 border px-2 py-1 text-xs font-medium ${
                  launch.status === 'ACTIVE'
                    ? 'border-success text-success'
                    : 'border-ui-accent text-ui-accent'
                }`}
              >
                {launch.status === 'ACTIVE'
                  ? t('new-hire-active')
                  : t('new-hire-ready')}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-ui-border py-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ui-muted">
                  {t('new-hire-starts')}
                </dt>
                <dd className="mt-1 text-ui-heading">
                  {dateLabel(launch.newHire.startDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ui-muted">
                  {t('new-hire-invitation')}
                </dt>
                <dd className="mt-1 text-ui-heading">
                  {launch.invitation.status === 'ACCEPTED'
                    ? t('new-hire-accepted')
                    : t('new-hire-pending')}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ui-muted">
                  {t('new-hire-leave')}
                </dt>
                <dd className="mt-1 text-ui-heading">
                  {t('new-hire-policies-prepared', {
                    count: launch.policies.length,
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ui-muted">
                  {t('new-hire-equipment')}
                </dt>
                <dd className="mt-1 text-ui-heading">
                  {launch.equipment.requestId
                    ? t('new-hire-equipment-requested')
                    : t('new-hire-equipment-not-needed')}
                </dd>
              </div>
            </dl>
            <p className="mt-3 truncate text-xs text-ui-muted">
              {launch.newHire.email}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default NewHireLaunches;
