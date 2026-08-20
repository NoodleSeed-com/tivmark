import type { GetServerSidePropsContext } from 'next';

import { getSession } from '@/lib/session';
import { getTeams } from 'models/team';

/**
 * Mark is not a page. The assistant lives in exactly two modes -- the floating launcher and
 * the right-side drawer -- and never takes over the canvas or swaps the sidebar.
 *
 * This route survives only as the sign-in landing target: the marketing site's sign-in
 * handoff redirects here with the single-use ticket cookie. It forwards straight to the
 * user's team page (their only team's time-off view when they have exactly one, the teams
 * list otherwise), where the widget mounts, spends the ticket, opens the drawer, and Mark
 * answers the question the visitor asked before signing in -- with the time-off / equipment
 * menu right where it belongs.
 */
export const getServerSideProps = async ({
  req,
  res,
}: GetServerSidePropsContext) => {
  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/auth/login?callbackUrl=%2Fmark',
        permanent: false,
      },
    };
  }

  let destination = '/teams';
  try {
    const teams = await getTeams(session.user.id);
    if (teams.length === 1 && teams[0]?.slug) {
      destination = `/teams/${teams[0].slug}/time-off`;
    }
  } catch {
    /* the teams list is a fine fallback */
  }

  return { redirect: { destination, permanent: false } };
};

// Never rendered: getServerSideProps always redirects.
export default function MarkRedirect() {
  return null;
}
