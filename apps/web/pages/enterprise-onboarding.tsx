import type { GetServerSidePropsContext } from 'next';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

// Stable entry point for the public website; never choose between multiple teams.
export default function EnterpriseEntry() {
  return null;
}

export async function getServerSideProps({
  req,
  res,
}: GetServerSidePropsContext) {
  const session = await getSession(req, res);
  if (!session?.user?.id)
    return {
      redirect: {
        destination: '/auth/login?callbackUrl=%2Fenterprise-onboarding',
        permanent: false,
      },
    };
  const memberships = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    include: { team: true },
    take: 2,
  });
  const destination =
    memberships.length === 1
      ? `/teams/${memberships[0].team.slug}/enterprise-onboarding`
      : memberships.length
        ? '/teams'
        : '/onboarding';
  return { redirect: { destination, permanent: false } };
}
