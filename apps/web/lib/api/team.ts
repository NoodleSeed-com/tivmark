import type { NextApiRequest, NextApiResponse } from 'next';

import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireApiPrincipal, requireScope } from './auth';

export const resolveTeam = async (teamIdOrSlug: string) => {
  const team = await prisma.team.findFirst({
    where: { OR: [{ id: teamIdOrSlug }, { slug: teamIdOrSlug }] },
  });
  if (!team) throw new ApiError(404, 'Team not found');
  return team;
};

export const requireTeamPrincipal = async (
  req: NextApiRequest,
  res: NextApiResponse,
  teamIdOrSlug: string,
  scope: string
) => {
  const [principal, team] = await Promise.all([
    requireApiPrincipal(req, res),
    resolveTeam(teamIdOrSlug),
  ]);

  requireScope(principal, scope);

  if (principal.type === 'service') {
    if (principal.teamId !== team.id) {
      throw new ApiError(403, 'This credential cannot access that team');
    }
    return { principal, team, member: null };
  }

  const member = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: { teamId: team.id, userId: principal.userId },
    },
    include: { user: true, team: true },
  });
  if (!member) throw new ApiError(403, 'You do not have access to this team');
  return { principal, team, member };
};
