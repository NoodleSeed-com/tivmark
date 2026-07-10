import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { requireApiPrincipal } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal, resolveTeam } from '@/lib/api/team';
import { sendTeamInviteEmail } from '@/lib/email/sendTeamInviteEmail';
import env from '@/lib/env';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { withIdempotency } from '@/lib/api/idempotency';

const createSchema = z.object({
  email: z.string().email().nullable().optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
  sentViaEmail: z.boolean().default(true),
  domains: z.string().optional(),
  actorUserId: z.string().uuid().optional(),
});

const canManage = (role?: string) => role === 'OWNER' || role === 'ADMIN';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const teamIdOrSlug = z.string().parse(req.query.teamId);

    if (req.method === 'PUT') {
      const principal = await requireApiPrincipal(req, res);
      if (principal.type !== 'user') {
        throw new ApiError(403, 'A user must accept an invitation');
      }
      const { inviteToken } = z
        .object({ inviteToken: z.string().uuid() })
        .parse(req.body);
      const invitation = await prisma.invitation.findUniqueOrThrow({
        where: { token: inviteToken },
        include: { team: true },
      });
      const team = await resolveTeam(teamIdOrSlug);
      if (team.id !== invitation.teamId || invitation.expires <= new Date()) {
        throw new ApiError(400, 'Invitation is invalid or expired');
      }
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: principal.userId },
      });
      if (invitation.email && invitation.email !== user.email) {
        throw new ApiError(403, 'Use the email address that was invited');
      }
      await prisma.teamMember.upsert({
        where: {
          teamId_userId: { teamId: team.id, userId: principal.userId },
        },
        create: {
          teamId: team.id,
          userId: principal.userId,
          role: invitation.role,
        },
        update: { role: invitation.role },
      });
      if (invitation.sentViaEmail) {
        await prisma.invitation.delete({ where: { id: invitation.id } });
      }
      return res.status(200).json({ data: {} });
    }

    const access = await requireTeamPrincipal(
      req,
      res,
      teamIdOrSlug,
      'invitations'
    );
    if (access.member && !canManage(access.member.role)) {
      throw new ApiError(403, 'Only owners and admins can manage invitations');
    }

    if (req.method === 'GET') {
      const sentViaEmail =
        typeof req.query.sentViaEmail === 'string'
          ? req.query.sentViaEmail === 'true'
          : undefined;
      const invitations = await prisma.invitation.findMany({
        where: { teamId: access.team.id, sentViaEmail },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json({
        data: invitations.map((invitation) => ({
          ...invitation,
          url: `${env.appUrl}/invitations/${invitation.token}`,
        })),
        meta: { nextCursor: null },
      });
    }

    if (req.method === 'POST') {
      const input = createSchema.parse(req.body);
      const invitedBy =
        access.principal.type === 'user'
          ? access.principal.userId
          : z.string().uuid().parse(input.actorUserId);
      if (input.sentViaEmail && !input.email) {
        throw new ApiError(422, 'Email is required');
      }
      const invitation = await prisma.invitation.create({
        data: {
          teamId: access.team.id,
          invitedBy,
          role: input.role,
          email: input.email || null,
          sentViaEmail: input.sentViaEmail,
          allowedDomains: input.domains
            ? input.domains
                .split(',')
                .map((domain) => domain.trim().toLowerCase())
            : [],
          token: randomUUID(),
          expires: new Date(Date.now() + 7 * 86_400_000),
        },
      });
      if (invitation.sentViaEmail) {
        await sendTeamInviteEmail(access.team, invitation);
      }
      return res.status(201).json({ data: invitation });
    }

    if (req.method === 'DELETE') {
      const id = z.string().uuid().parse(req.query.id);
      await prisma.invitation.deleteMany({
        where: { id, teamId: access.team.id },
      });
      return res.status(200).json({ data: {} });
    }

    return methodNotAllowed(req, res, ['GET', 'POST', 'PUT', 'DELETE']);
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
