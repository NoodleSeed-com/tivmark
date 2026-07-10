import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const mutationSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).optional(),
});
const canManage = (role?: string) => role === 'OWNER' || role === 'ADMIN';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const teamId = z.string().parse(req.query.teamId);
    const access = await requireTeamPrincipal(req, res, teamId, 'members');

    if (req.method === 'GET') {
      const members = await prisma.teamMember.findMany({
        where: { teamId: access.team.id },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return res
        .status(200)
        .json({ data: members, meta: { nextCursor: null } });
    }

    if (req.method === 'PATCH') {
      if (access.member && !canManage(access.member.role)) {
        throw new ApiError(403, 'Only owners and admins can update members');
      }
      const body = mutationSchema
        .extend({ role: z.enum(['OWNER', 'ADMIN', 'MEMBER']) })
        .parse(req.body);
      const member = await prisma.teamMember.update({
        where: {
          teamId_userId: { teamId: access.team.id, userId: body.memberId },
        },
        data: { role: body.role },
        include: { user: true },
      });
      return res.status(200).json({ data: member });
    }

    if (req.method === 'DELETE') {
      if (access.member && !canManage(access.member.role)) {
        throw new ApiError(403, 'Only owners and admins can remove members');
      }
      const body = mutationSchema.parse({ memberId: req.query.memberId });
      await prisma.teamMember.delete({
        where: {
          teamId_userId: { teamId: access.team.id, userId: body.memberId },
        },
      });
      return res.status(200).json({ data: {} });
    }

    if (req.method === 'PUT') {
      if (access.principal.type !== 'user') {
        throw new ApiError(403, 'A service credential cannot leave a team');
      }
      await prisma.teamMember.delete({
        where: {
          teamId_userId: {
            teamId: access.team.id,
            userId: access.principal.userId,
          },
        },
      });
      return res.status(200).json({ data: {} });
    }

    return methodNotAllowed(req, res, ['GET', 'PATCH', 'DELETE', 'PUT']);
  } catch (error) {
    return sendProblem(res, error);
  }
}
