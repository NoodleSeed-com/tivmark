import type { NextApiHandler, NextApiRequest } from 'next';

import { sendProblem } from '@/lib/api/http';
import { setLegacyApiContext } from '@/lib/api/legacy-context';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';

export const adaptLegacyTeamHandler =
  (handler: NextApiHandler, scope: string): NextApiHandler =>
  async (req, res) => {
    try {
      const teamId = String((req as NextApiRequest).query.teamId || '');
      const access = await requireTeamPrincipal(req, res, teamId, scope);
      const teamMember =
        access.member ||
        (await prisma.teamMember.findFirstOrThrow({
          where: { teamId: access.team.id, role: 'OWNER' },
          include: { user: true, team: true },
        }));

      setLegacyApiContext(
        req,
        {
          expires: new Date(Date.now() + 15 * 60_000).toISOString(),
          user: {
            id: teamMember.user.id,
            name: teamMember.user.name,
            email: teamMember.user.email,
            image: teamMember.user.image,
            roles: [{ teamId: access.team.id, role: teamMember.role }],
          },
        },
        teamMember
      );
      req.query.slug = access.team.slug;
      return await handler(req, res);
    } catch (error) {
      return sendProblem(res, error);
    }
  };
