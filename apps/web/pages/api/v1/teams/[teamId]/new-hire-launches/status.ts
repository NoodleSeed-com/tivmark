import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { requireScope } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import {
  assertCanLaunchNewHire,
  serializeNewHireReceipt,
} from '@/lib/new-hire';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'GET') {
      return methodNotAllowed(req, res, ['GET']);
    }
    const teamIdOrSlug = z.string().parse(req.query.teamId);
    const email = z.string().email().parse(req.query.email).toLowerCase();
    const access = await requireTeamPrincipal(
      req,
      res,
      teamIdOrSlug,
      'invitations'
    );
    requireScope(access.principal, 'equipment');
    requireScope(access.principal, 'time_off.policy');
    if (access.principal.type !== 'user') {
      throw new ApiError(403, 'A signed-in manager must inspect a new hire');
    }
    assertCanLaunchNewHire(access.member?.role);

    const launch = await prisma.newHireLaunch.findUnique({
      where: {
        teamId_employeeEmail: {
          teamId: access.team.id,
          employeeEmail: email,
        },
      },
      include: { team: true, invitation: true, equipmentRequest: true },
    });
    if (!launch) throw new ApiError(404, 'New-hire launch not found');
    const policies = await prisma.timeOffPolicy.findMany({
      where: { teamId: access.team.id },
      orderBy: { type: 'asc' },
    });
    return res.status(200).json({
      data: serializeNewHireReceipt(launch, policies),
    });
  } catch (error) {
    return sendProblem(res, error);
  }
}
