import {
  EquipmentCategory,
  EquipmentStatus,
  Role,
  type TeamMember,
} from '@prisma/client';

import { ApiError } from '@/lib/errors';
import { MAX_EQUIPMENT_QUANTITY } from '@/lib/equipment';
import { prisma } from '@/lib/prisma';
import type {
  EquipmentCategoryValue,
  EquipmentWorkspaceData,
} from 'types/equipment';

type MemberWithIdentity = TeamMember & {
  team: { id: string; slug: string; name: string };
  user: { id: string; name?: string | null; email?: string | null };
};

export interface EquipmentRequestInput {
  category: EquipmentCategoryValue;
  item: string;
  quantity: number;
  justification?: string | null;
}

export const canReviewEquipment = (member: Pick<TeamMember, 'role'>) =>
  member.role === Role.OWNER || member.role === Role.ADMIN;

const validateInput = (input: EquipmentRequestInput) => {
  const item = input.item?.trim();
  if (!item) {
    throw new ApiError(422, 'Describe the equipment you need.');
  }
  if (item.length > 200) {
    throw new ApiError(422, 'Item name is too long (200 characters max).');
  }

  const quantity = Number(input.quantity);
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_EQUIPMENT_QUANTITY
  ) {
    throw new ApiError(
      422,
      `Quantity must be a whole number between 1 and ${MAX_EQUIPMENT_QUANTITY}.`
    );
  }

  return {
    item,
    quantity,
    category: input.category as EquipmentCategory,
    justification: input.justification?.trim() || null,
  };
};

export const createEquipmentRequest = async (
  member: MemberWithIdentity,
  input: EquipmentRequestInput
) => {
  const normalized = validateInput(input);

  return prisma.equipmentRequest.create({
    data: {
      teamId: member.teamId,
      requesterId: member.userId,
      ...normalized,
    },
  });
};

export const updateEquipmentRequest = async (
  member: MemberWithIdentity,
  requestId: string,
  input: EquipmentRequestInput
) => {
  const request = await prisma.equipmentRequest.findFirst({
    where: { id: requestId, teamId: member.teamId },
  });

  if (!request) throw new ApiError(404, 'Equipment request not found.');
  if (request.status !== EquipmentStatus.PENDING) {
    throw new ApiError(409, 'Only pending requests can be edited.');
  }
  if (request.requesterId !== member.userId && !canReviewEquipment(member)) {
    throw new ApiError(403, 'You cannot edit this request.');
  }

  const normalized = validateInput(input);

  return prisma.equipmentRequest.update({
    where: { id: request.id },
    data: { ...normalized },
  });
};

export const cancelEquipmentRequest = async (
  member: MemberWithIdentity,
  requestId: string
) => {
  const request = await prisma.equipmentRequest.findFirst({
    where: { id: requestId, teamId: member.teamId },
  });

  if (!request) throw new ApiError(404, 'Equipment request not found.');
  if (
    request.status !== EquipmentStatus.PENDING &&
    request.status !== EquipmentStatus.APPROVED
  ) {
    throw new ApiError(409, 'This request can no longer be canceled.');
  }
  if (request.requesterId !== member.userId && !canReviewEquipment(member)) {
    throw new ApiError(403, 'You cannot cancel this request.');
  }

  return prisma.equipmentRequest.update({
    where: { id: request.id },
    data: { status: EquipmentStatus.CANCELED },
  });
};

export const reviewEquipmentRequest = async (
  member: MemberWithIdentity,
  requestId: string,
  decision: 'APPROVED' | 'DECLINED',
  reviewNote?: string | null
) => {
  if (!canReviewEquipment(member)) {
    throw new ApiError(403, 'Only owners and admins can review requests.');
  }

  const request = await prisma.equipmentRequest.findFirst({
    where: { id: requestId, teamId: member.teamId },
  });

  if (!request) throw new ApiError(404, 'Equipment request not found.');
  if (request.status !== EquipmentStatus.PENDING) {
    throw new ApiError(409, 'Only pending requests can be reviewed.');
  }

  return prisma.equipmentRequest.update({
    where: { id: request.id },
    data: {
      status: decision as EquipmentStatus,
      reviewerId: member.userId,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || null,
    },
  });
};

export const fulfillEquipmentRequest = async (
  member: MemberWithIdentity,
  requestId: string
) => {
  if (!canReviewEquipment(member)) {
    throw new ApiError(403, 'Only owners and admins can fulfill requests.');
  }

  const request = await prisma.equipmentRequest.findFirst({
    where: { id: requestId, teamId: member.teamId },
  });

  if (!request) throw new ApiError(404, 'Equipment request not found.');
  if (request.status !== EquipmentStatus.APPROVED) {
    throw new ApiError(409, 'Only approved requests can be fulfilled.');
  }

  return prisma.equipmentRequest.update({
    where: { id: request.id },
    data: { status: EquipmentStatus.FULFILLED, fulfilledAt: new Date() },
  });
};

export const getEquipmentWorkspace = async (
  member: MemberWithIdentity
): Promise<EquipmentWorkspaceData> => {
  const canReview = canReviewEquipment(member);

  const [requests, members] = await Promise.all([
    prisma.equipmentRequest.findMany({
      where: {
        teamId: member.teamId,
        requesterId: canReview ? undefined : member.userId,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    }),
    prisma.teamMember.findMany({
      where: { teamId: member.teamId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
  ]);

  return {
    canReview,
    currentUserId: member.userId,
    members: members.map((teamMember) => ({
      id: teamMember.user.id,
      name: teamMember.user.name,
      email: teamMember.user.email,
      role: teamMember.role,
    })),
    requests: requests.map((request) => ({
      id: request.id,
      category: request.category,
      item: request.item,
      quantity: request.quantity,
      justification: request.justification,
      status: request.status,
      reviewNote: request.reviewNote,
      reviewedAt: request.reviewedAt?.toISOString() || null,
      fulfilledAt: request.fulfilledAt?.toISOString() || null,
      createdAt: request.createdAt.toISOString(),
      requester: request.requester,
      reviewer: request.reviewer,
    })),
  };
};
