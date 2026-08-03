import {
  HalfDayPeriod,
  Role,
  TimeOffDuration,
  TimeOffStatus,
  TimeOffType,
  type TeamMember,
} from '@prisma/client';

import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import {
  calculateRequestedHalfDays,
  DEFAULT_TIME_OFF_ALLOWANCES,
  getYearBounds,
  serializeTimeOffRequest,
  TIME_OFF_TYPES,
} from '@/lib/timeOff';
import type {
  HalfDayPeriodValue,
  TimeOffBalanceData,
  TimeOffDurationValue,
  TimeOffTypeValue,
  TimeOffWorkspaceData,
} from 'types/time-off';

type MemberWithIdentity = TeamMember & {
  team: { id: string; slug: string; name: string };
  user: { id: string; name?: string | null; email?: string | null };
};

const timeOffRequestPeople = {
  requester: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true, email: true } },
} as const;

export interface TimeOffRequestInput {
  type: TimeOffTypeValue;
  startDate: string;
  endDate: string;
  duration: TimeOffDurationValue;
  halfDayPeriod?: HalfDayPeriodValue | null;
  reason?: string | null;
}

export const canApproveTimeOff = (member: Pick<TeamMember, 'role'>) =>
  member.role === Role.OWNER || member.role === Role.ADMIN;

export const ensureDefaultTimeOffPolicies = async (teamId: string) => {
  await prisma.timeOffPolicy.createMany({
    data: TIME_OFF_TYPES.map((type) => ({
      teamId,
      type: type as TimeOffType,
      annualAllowanceHalfDays: DEFAULT_TIME_OFF_ALLOWANCES[type],
    })),
    skipDuplicates: true,
  });
};

const validateRequestInput = (input: TimeOffRequestInput) => {
  const requestedHalfDays = calculateRequestedHalfDays(input);

  if (input.duration === 'HALF_DAY' && !input.halfDayPeriod) {
    throw new ApiError(422, 'Choose morning or afternoon for a half day.');
  }

  return {
    requestedHalfDays,
    startDate: new Date(`${input.startDate}T00:00:00.000Z`),
    endDate: new Date(`${input.endDate}T00:00:00.000Z`),
    duration: input.duration as TimeOffDuration,
    halfDayPeriod:
      input.duration === 'HALF_DAY'
        ? (input.halfDayPeriod as HalfDayPeriod)
        : null,
  };
};

const throwIfOverlapping = async ({
  teamId,
  requesterId,
  startDate,
  endDate,
  excludeId,
}: {
  teamId: string;
  requesterId: string;
  startDate: Date;
  endDate: Date;
  excludeId?: string;
}) => {
  const overlap = await prisma.timeOffRequest.findFirst({
    where: {
      teamId,
      requesterId,
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: [TimeOffStatus.PENDING, TimeOffStatus.APPROVED] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  });

  if (overlap) {
    throw new ApiError(409, 'This request overlaps existing time off.');
  }
};

export const createTimeOffRequest = async (
  member: MemberWithIdentity,
  input: TimeOffRequestInput
) => {
  let normalized;
  try {
    normalized = validateRequestInput(input);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, (error as Error).message);
  }

  await throwIfOverlapping({
    teamId: member.teamId,
    requesterId: member.userId,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
  });

  const request = await prisma.timeOffRequest.create({
    data: {
      teamId: member.teamId,
      requesterId: member.userId,
      type: input.type as TimeOffType,
      reason: input.reason?.trim() || null,
      ...normalized,
    },
    include: timeOffRequestPeople,
  });
  return serializeTimeOffRequest(request);
};

export const updateTimeOffRequest = async (
  member: MemberWithIdentity,
  requestId: string,
  input: TimeOffRequestInput
) => {
  const request = await prisma.timeOffRequest.findFirst({
    where: { id: requestId, teamId: member.teamId },
  });

  if (!request) throw new ApiError(404, 'Time-off request not found.');
  if (request.status !== TimeOffStatus.PENDING) {
    throw new ApiError(409, 'Only pending requests can be edited.');
  }
  if (request.requesterId !== member.userId && !canApproveTimeOff(member)) {
    throw new ApiError(403, 'You cannot edit this request.');
  }

  let normalized;
  try {
    normalized = validateRequestInput(input);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, (error as Error).message);
  }

  await throwIfOverlapping({
    teamId: member.teamId,
    requesterId: request.requesterId,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    excludeId: request.id,
  });

  const updated = await prisma.timeOffRequest.update({
    where: { id: request.id },
    data: {
      type: input.type as TimeOffType,
      reason: input.reason?.trim() || null,
      ...normalized,
    },
    include: timeOffRequestPeople,
  });
  return serializeTimeOffRequest(updated);
};

export const cancelTimeOffRequest = async (
  member: MemberWithIdentity,
  requestId: string
) => {
  const request = await prisma.timeOffRequest.findFirst({
    where: { id: requestId, teamId: member.teamId },
  });

  if (!request) throw new ApiError(404, 'Time-off request not found.');
  if (
    request.status !== TimeOffStatus.PENDING &&
    request.status !== TimeOffStatus.APPROVED
  ) {
    throw new ApiError(409, 'This request can no longer be canceled.');
  }

  const isApprover = canApproveTimeOff(member);
  if (request.requesterId !== member.userId && !isApprover) {
    throw new ApiError(403, 'You cannot cancel this request.');
  }
  if (
    request.status === TimeOffStatus.APPROVED &&
    request.endDate < new Date(new Date().toISOString().slice(0, 10)) &&
    !isApprover
  ) {
    throw new ApiError(409, 'Past approved time off cannot be canceled.');
  }

  const canceled = await prisma.timeOffRequest.update({
    where: { id: request.id },
    data: { status: TimeOffStatus.CANCELED },
    include: timeOffRequestPeople,
  });
  return serializeTimeOffRequest(canceled);
};

export const reviewTimeOffRequest = async (
  member: MemberWithIdentity,
  requestId: string,
  decision: 'APPROVED' | 'DECLINED',
  reviewNote?: string | null
) => {
  if (!canApproveTimeOff(member)) {
    throw new ApiError(403, 'Only owners and admins can review requests.');
  }

  const request = await prisma.timeOffRequest.findFirst({
    where: { id: requestId, teamId: member.teamId },
  });

  if (!request) throw new ApiError(404, 'Time-off request not found.');
  if (request.status !== TimeOffStatus.PENDING) {
    throw new ApiError(409, 'Only pending requests can be reviewed.');
  }

  const reviewed = await prisma.timeOffRequest.update({
    where: { id: request.id },
    data: {
      status: decision as TimeOffStatus,
      reviewerId: member.userId,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || null,
    },
    include: timeOffRequestPeople,
  });
  return serializeTimeOffRequest(reviewed);
};

export const updateTimeOffPolicies = async (
  member: MemberWithIdentity,
  allowances: Partial<Record<TimeOffTypeValue, number | null>>
) => {
  if (!canApproveTimeOff(member)) {
    throw new ApiError(403, 'Only owners and admins can change allowances.');
  }

  await ensureDefaultTimeOffPolicies(member.teamId);

  await prisma.$transaction(
    Object.entries(allowances).map(([type, allowance]) =>
      prisma.timeOffPolicy.update({
        where: {
          teamId_type: {
            teamId: member.teamId,
            type: type as TimeOffType,
          },
        },
        data: { annualAllowanceHalfDays: allowance },
      })
    )
  );
};

const emptyBalance = (
  allowanceHalfDays: number | null
): TimeOffBalanceData => ({
  allowanceHalfDays,
  approvedHalfDays: 0,
  pendingHalfDays: 0,
  remainingHalfDays: allowanceHalfDays,
});

export const getTimeOffWorkspace = async (
  member: MemberWithIdentity,
  year: number
): Promise<TimeOffWorkspaceData> => {
  await ensureDefaultTimeOffPolicies(member.teamId);
  const canApprove = canApproveTimeOff(member);
  const { start, end } = getYearBounds(year);

  const [policies, requests, members] = await Promise.all([
    prisma.timeOffPolicy.findMany({
      where: { teamId: member.teamId },
      orderBy: { type: 'asc' },
    }),
    prisma.timeOffRequest.findMany({
      where: {
        teamId: member.teamId,
        requesterId: canApprove ? undefined : member.userId,
        startDate: { gte: start, lt: end },
      },
      include: timeOffRequestPeople,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.teamMember.findMany({
      where: { teamId: member.teamId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
  ]);

  const policyMap = Object.fromEntries(
    policies.map((policy) => [policy.type, policy.annualAllowanceHalfDays])
  ) as Record<TimeOffTypeValue, number | null>;
  const balances: TimeOffWorkspaceData['balances'] = {};

  for (const teamMember of members) {
    balances[teamMember.userId] = Object.fromEntries(
      TIME_OFF_TYPES.map((type) => [type, emptyBalance(policyMap[type])])
    ) as Record<TimeOffTypeValue, TimeOffBalanceData>;
  }

  for (const request of requests) {
    const balance = balances[request.requesterId]?.[request.type];
    if (!balance) continue;
    if (request.status === TimeOffStatus.APPROVED) {
      balance.approvedHalfDays += request.requestedHalfDays;
    }
    if (request.status === TimeOffStatus.PENDING) {
      balance.pendingHalfDays += request.requestedHalfDays;
    }
    if (balance.allowanceHalfDays !== null) {
      balance.remainingHalfDays =
        balance.allowanceHalfDays - balance.approvedHalfDays;
    }
  }

  return {
    year,
    canApprove,
    currentUserId: member.userId,
    policies: policies.map((policy) => ({
      id: policy.id,
      type: policy.type,
      annualAllowanceHalfDays: policy.annualAllowanceHalfDays,
    })),
    members: members.map((teamMember) => ({
      id: teamMember.user.id,
      name: teamMember.user.name,
      email: teamMember.user.email,
      role: teamMember.role,
    })),
    balances,
    requests: requests.map(serializeTimeOffRequest),
  };
};
