import { randomUUID } from 'crypto';
import { EquipmentCategory } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { requireScope } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { withIdempotency } from '@/lib/api/idempotency';
import { requireTeamPrincipal } from '@/lib/api/team';
import { sendTeamInviteEmail } from '@/lib/email/sendTeamInviteEmail';
import { ApiError } from '@/lib/errors';
import {
  assertCanLaunchNewHire,
  equipmentPackage,
  newHireLaunchInputSchema,
  serializeNewHireReceipt,
  toDateOnly,
  type NewHireLaunchInput,
} from '@/lib/new-hire';
import { prisma } from '@/lib/prisma';

const includeLaunch = {
  team: true,
  invitation: true,
  equipmentRequest: true,
} as const;

const sameLaunch = (
  existing: {
    employeeName: string;
    employeeEmail: string;
    jobTitle: string;
    startDate: Date;
    workLocation: string;
    timeZone: string;
    role: string;
    equipmentPackage: string;
  },
  input: NewHireLaunchInput
) =>
  existing.employeeName === input.employeeName &&
  existing.employeeEmail === input.employeeEmail &&
  existing.jobTitle === input.jobTitle &&
  toDateOnly(existing.startDate) === input.startDate &&
  existing.workLocation === input.workLocation &&
  existing.timeZone === input.timeZone &&
  existing.role === input.role &&
  existing.equipmentPackage === input.equipmentPackage;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const teamIdOrSlug = z.string().parse(req.query.teamId);
    const access = await requireTeamPrincipal(
      req,
      res,
      teamIdOrSlug,
      'invitations'
    );
    requireScope(access.principal, 'equipment');
    requireScope(access.principal, 'time_off.policy');
    if (access.principal.type !== 'user') {
      throw new ApiError(403, 'A signed-in manager must launch a new hire');
    }
    const actorUserId = access.principal.userId;
    assertCanLaunchNewHire(access.member?.role);

    if (req.method === 'GET') {
      const launches = await prisma.newHireLaunch.findMany({
        where: { teamId: access.team.id },
        include: includeLaunch,
        orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
        take: 25,
      });
      const policies = await prisma.timeOffPolicy.findMany({
        where: { teamId: access.team.id },
        orderBy: { type: 'asc' },
      });
      return res.status(200).json({
        data: launches.map((launch) =>
          serializeNewHireReceipt(launch, policies)
        ),
        meta: { nextCursor: null },
      });
    }

    if (req.method !== 'POST') {
      return methodNotAllowed(req, res, ['GET', 'POST']);
    }

    const input = newHireLaunchInputSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.teamMember.findFirst({
        where: {
          teamId: access.team.id,
          user: { email: { equals: input.employeeEmail, mode: 'insensitive' } },
        },
      });
      if (member) {
        throw new ApiError(409, 'That person is already a member of this team');
      }

      const existing = await tx.newHireLaunch.findUnique({
        where: {
          teamId_employeeEmail: {
            teamId: access.team.id,
            employeeEmail: input.employeeEmail,
          },
        },
        include: includeLaunch,
      });
      if (existing) {
        if (!sameLaunch(existing, input)) {
          throw new ApiError(
            409,
            'A different new-hire launch already exists for that email'
          );
        }
        const policies = await tx.timeOffPolicy.findMany({
          where: { teamId: access.team.id },
          orderBy: { type: 'asc' },
        });
        return { launch: existing, policies, sendInvitation: false };
      }

      const invitation = await tx.invitation.upsert({
        where: {
          teamId_email: {
            teamId: access.team.id,
            email: input.employeeEmail,
          },
        },
        create: {
          teamId: access.team.id,
          invitedBy: actorUserId,
          role: input.role,
          email: input.employeeEmail,
          sentViaEmail: true,
          allowedDomains: [],
          token: randomUUID(),
          expires: new Date(Date.now() + 7 * 86_400_000),
        },
        update: {
          invitedBy: actorUserId,
          role: input.role,
          sentViaEmail: true,
          allowedDomains: [],
          token: randomUUID(),
          expires: new Date(Date.now() + 7 * 86_400_000),
        },
      });

      const bundle = equipmentPackage(input.equipmentPackage);
      const equipmentRequest = bundle.item
        ? await tx.equipmentRequest.create({
            data: {
              teamId: access.team.id,
              requesterId: actorUserId,
              category: EquipmentCategory.OTHER,
              item: bundle.item,
              quantity: 1,
              justification: `Prepared for ${input.employeeName}, ${input.jobTitle}, starting ${input.startDate}.`,
            },
          })
        : null;

      const launch = await tx.newHireLaunch.create({
        data: {
          teamId: access.team.id,
          createdById: actorUserId,
          invitationId: invitation.id,
          equipmentRequestId: equipmentRequest?.id,
          employeeName: input.employeeName,
          employeeEmail: input.employeeEmail,
          jobTitle: input.jobTitle,
          startDate: new Date(`${input.startDate}T00:00:00.000Z`),
          workLocation: input.workLocation,
          timeZone: input.timeZone,
          role: input.role,
          equipmentPackage: input.equipmentPackage,
        },
        include: includeLaunch,
      });
      const policies = await tx.timeOffPolicy.findMany({
        where: { teamId: access.team.id },
        orderBy: { type: 'asc' },
      });
      return { launch, policies, sendInvitation: true };
    });

    if (result.sendInvitation && result.launch.invitation) {
      try {
        await sendTeamInviteEmail(access.team, result.launch.invitation);
      } catch (error) {
        // The durable invitation and readiness plan are still valid. Email can be retried
        // from Tivmark without replaying the equipment or launch transaction.
        console.error('New-hire invitation email could not be sent', error);
      }
    }

    return res.status(201).json({
      data: serializeNewHireReceipt(result.launch, result.policies),
    });
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
