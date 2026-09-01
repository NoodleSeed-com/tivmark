import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import { assessTimeOffEligibility } from '@/lib/timeOff';
import { getTimeOffWorkspace } from 'models/timeOff';

const querySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine(
    ({ startDate, endDate }) => Boolean(startDate) === Boolean(endDate),
    'Provide both startDate and endDate for an eligibility assessment.'
  );

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'time_off'
    );
    const query = querySchema.parse(req.query);
    // Exact dates are authoritative for an assessment. This prevents a stale or
    // model-supplied year from loading a different request window.
    const year = query.startDate
      ? Number(query.startDate.slice(0, 4))
      : (query.year ?? new Date().getUTCFullYear());
    const member =
      access.member ||
      (await prisma.teamMember.findFirstOrThrow({
        where: { teamId: access.team.id, role: { in: ['OWNER', 'ADMIN'] } },
        include: { team: true, user: true },
      }));
    const workspace = await getTimeOffWorkspace(member, year);
    const assessment =
      query.startDate && query.endDate
        ? assessTimeOffEligibility({
            team: access.team.slug,
            userId: member.userId,
            type: query.type ?? 'VACATION',
            startDate: query.startDate,
            endDate: query.endDate,
            balances: workspace.balances,
            requests: workspace.requests,
          })
        : null;
    return res.status(200).json({
      data: workspace.balances,
      meta: {
        team: access.team.slug,
        userId: member.userId,
        assessment,
      },
    });
  } catch (error) {
    return sendProblem(res, error);
  }
}
