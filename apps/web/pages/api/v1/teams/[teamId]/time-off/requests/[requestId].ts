import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import {
  cancelTimeOffRequest,
  reviewTimeOffRequest,
  updateTimeOffRequest,
  type TimeOffRequestInput,
} from 'models/timeOff';

const actionSchema = z
  .object({
    action: z.enum(['update', 'cancel', 'approve', 'decline', 'review']),
    decision: z.enum(['APPROVED', 'DECLINED']).optional(),
    actorUserId: z.string().uuid().optional(),
    reviewNote: z.string().trim().max(500).nullable().optional(),
    type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    duration: z.enum(['FULL_DAY', 'HALF_DAY']).optional(),
    halfDayPeriod: z.enum(['MORNING', 'AFTERNOON']).nullable().optional(),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .passthrough();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'PATCH') return methodNotAllowed(req, res, ['PATCH']);

    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'time_off'
    );
    const requestId = z.string().uuid().parse(req.query.requestId);
    const input = actionSchema.parse(req.body);
    const requestRecord = await prisma.timeOffRequest.findFirst({
      where: { id: requestId, teamId: access.team.id },
    });
    if (!requestRecord) throw new ApiError(404, 'Time-off request not found');

    const actorUserId =
      access.principal.type === 'user'
        ? access.principal.userId
        : z.string().uuid().parse(input.actorUserId);
    const member = await prisma.teamMember.findUniqueOrThrow({
      where: {
        teamId_userId: { teamId: access.team.id, userId: actorUserId },
      },
      include: { team: true, user: true },
    });

    if (input.action === 'cancel') {
      const request = await cancelTimeOffRequest(member, requestId);
      return res.status(200).json({ data: request });
    }
    if (
      input.action === 'approve' ||
      input.action === 'decline' ||
      input.action === 'review'
    ) {
      if (
        access.principal.type === 'service' &&
        !access.principal.scopes.includes('time_off.approve') &&
        !access.principal.scopes.includes('*')
      ) {
        throw new ApiError(403, 'Missing required scope: time_off.approve');
      }
      const request = await reviewTimeOffRequest(
        member,
        requestId,
        input.action === 'review'
          ? z.enum(['APPROVED', 'DECLINED']).parse(input.decision)
          : input.action === 'approve'
            ? 'APPROVED'
            : 'DECLINED',
        input.reviewNote
      );
      return res.status(200).json({ data: request });
    }

    const request = await updateTimeOffRequest(
      member,
      requestId,
      input as unknown as TimeOffRequestInput
    );
    return res.status(200).json({ data: request });
  } catch (error) {
    return sendProblem(res, error);
  }
}
