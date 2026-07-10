import { Card } from '@/components/shared';
import { Error, Loading } from '@/components/shared';
import { TeamTab } from '@/components/team';
import env from '@/lib/env';
import fetcher from '@/lib/fetcher';
import { inferSSRProps } from '@/lib/inferSSRProps';
import useCanAccess from 'hooks/useCanAccess';
import useTeam from 'hooks/useTeam';
import { GetServerSidePropsContext } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import type { NextPageWithLayout } from 'types';

interface RetracedEventsBrowserProps {
  host: string;
  auditLogToken: string;
  header: string;
}

const RetracedEventsBrowser = dynamic<RetracedEventsBrowserProps>(
  () => import('@retracedhq/logs-viewer'),
  {
    ssr: false,
  }
);

const Events: NextPageWithLayout<inferSSRProps<typeof getServerSideProps>> = ({
  teamFeatures,
}) => {
  const { query } = useRouter();
  const { t } = useTranslation('common');
  const { canAccess } = useCanAccess();
  const { isLoading, isError, team } = useTeam();
  const canRead = canAccess('team_audit_log', ['read']);
  const { data: viewer, error: viewerError } = useSWR<{
    data: { token: string; host: string };
  }>(
    canRead && query.slug
      ? `/api/v1/teams/${query.slug}/audit-logs/viewer-token`
      : null,
    (url: string) => fetcher(url, { method: 'POST' })
  );

  if (isLoading) {
    return <Loading />;
  }

  if (isError || viewerError) {
    return <Error message={isError?.message || viewerError?.message} />;
  }

  if (!team) {
    return <Error message={t('team-not-found')} />;
  }

  return (
    <>
      <TeamTab activeTab="audit-logs" team={team} teamFeatures={teamFeatures} />
      <Card>
        <Card.Body>
          {canRead && viewer?.data.token && (
            <RetracedEventsBrowser
              host={viewer.data.host}
              auditLogToken={viewer.data.token}
              header={t('audit-logs')}
            />
          )}
        </Card.Body>
      </Card>
    </>
  );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  if (!env.teamFeatures.auditLog) {
    return {
      notFound: true,
    };
  }

  const { locale } = context;
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
      teamFeatures: env.teamFeatures,
    },
  };
}

export default Events;
