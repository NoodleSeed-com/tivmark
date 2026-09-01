import {
  Role,
  ServiceAudience,
  ServiceRequestPriority,
  ServiceRequestSource,
  ServiceRequestStatus,
  type TeamMember,
} from '@prisma/client';

import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import type {
  ActionDeskWorkspaceData,
  ServiceAudienceValue,
  ServiceRequestPriorityValue,
  ServiceRequestSourceValue,
  ServiceRequestStatusValue,
} from 'types/action-desk';

type MemberWithIdentity = TeamMember & {
  team: { id: string; slug: string; name: string };
  user: { id: string; name?: string | null; email?: string | null };
};

export interface ServiceRequestInput {
  serviceId: string;
  subject: string;
  description: string;
  priority?: ServiceRequestPriorityValue;
  source?: ServiceRequestSourceValue;
}

export interface ActionServiceInput {
  name: string;
  description: string;
  audience: ServiceAudienceValue;
  active?: boolean;
  slaHours?: number | null;
  requiresApproval?: boolean;
}

export const DEFAULT_ACTION_SERVICES = [
  {
    slug: 'sales-consultation',
    name: 'Sales consultation',
    description:
      'Explore the right plan, discuss requirements, or arrange a product walkthrough.',
    audience: ServiceAudience.PUBLIC,
    slaHours: 4,
    requiresApproval: false,
  },
  {
    slug: 'customer-support',
    name: 'Customer support',
    description:
      'Get help with a product question, account issue, order, or unexpected problem.',
    audience: ServiceAudience.CUSTOMER,
    slaHours: 8,
    requiresApproval: false,
  },
  {
    slug: 'software-access',
    name: 'Software access',
    description:
      'Request access to an application, workspace, entitlement, or internal system.',
    audience: ServiceAudience.EMPLOYEE,
    slaHours: 24,
    requiresApproval: true,
  },
  {
    slug: 'general-request',
    name: 'General request',
    description:
      'Start here when your need does not fit another service; the team will route it.',
    audience: ServiceAudience.PUBLIC,
    slaHours: 24,
    requiresApproval: false,
  },
] as const;

export const canManageActionDesk = (member: Pick<TeamMember, 'role'>) =>
  member.role === Role.OWNER || member.role === Role.ADMIN;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const validateServiceInput = (input: ActionServiceInput) => {
  const name = input.name?.trim();
  const description = input.description?.trim();
  if (!name) throw new ApiError(422, 'Give this service a name.');
  if (name.length > 100)
    throw new ApiError(422, 'Service names can be at most 100 characters.');
  if (!description)
    throw new ApiError(422, 'Describe what this service helps with.');
  if (description.length > 500)
    throw new ApiError(
      422,
      'Service descriptions can be at most 500 characters.'
    );
  if (
    input.slaHours != null &&
    (!Number.isInteger(input.slaHours) ||
      input.slaHours < 1 ||
      input.slaHours > 8760)
  ) {
    throw new ApiError(422, 'Response target must be 1 to 8,760 hours.');
  }
  return {
    name,
    description,
    audience: input.audience as ServiceAudience,
    active: input.active ?? true,
    slaHours: input.slaHours ?? null,
    requiresApproval: input.requiresApproval ?? false,
  };
};

const validateRequestInput = (input: ServiceRequestInput) => {
  const subject = input.subject?.trim();
  const description = input.description?.trim();
  if (!subject) throw new ApiError(422, 'Summarize what you need.');
  if (subject.length > 160)
    throw new ApiError(422, 'The summary can be at most 160 characters.');
  if (!description) throw new ApiError(422, 'Add a little more detail.');
  if (description.length > 2000)
    throw new ApiError(422, 'Details can be at most 2,000 characters.');
  return {
    subject,
    description,
    priority: (input.priority || 'NORMAL') as ServiceRequestPriority,
    source: (input.source || 'WEB') as ServiceRequestSource,
  };
};

export const ensureDefaultActionServices = async (teamId: string) => {
  await prisma.$transaction(
    DEFAULT_ACTION_SERVICES.map((service) =>
      prisma.actionService.upsert({
        where: { teamId_slug: { teamId, slug: service.slug } },
        update: {},
        create: { teamId, ...service },
      })
    )
  );
};

const requestInclude = {
  service: true,
  requester: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  events: {
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

const serviceData = (service: {
  id: string;
  slug: string;
  name: string;
  description: string;
  audience: ServiceAudience;
  active: boolean;
  slaHours: number | null;
  requiresApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...service,
  audience: service.audience as ServiceAudienceValue,
  createdAt: service.createdAt.toISOString(),
  updatedAt: service.updatedAt.toISOString(),
});

const requestData = (request: any) => ({
  id: request.id,
  subject: request.subject,
  description: request.description,
  priority: request.priority as ServiceRequestPriorityValue,
  status: request.status as ServiceRequestStatusValue,
  source: request.source as ServiceRequestSourceValue,
  resolution: request.resolution,
  resolvedAt: request.resolvedAt?.toISOString() || null,
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
  service: serviceData(request.service),
  requester: request.requester,
  assignee: request.assignee,
  events: request.events.map((event: any) => ({
    id: event.id,
    type: event.type,
    message: event.message,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor,
  })),
});

export const getActionDeskWorkspace = async (
  member: MemberWithIdentity
): Promise<ActionDeskWorkspaceData> => {
  await ensureDefaultActionServices(member.teamId);
  const canManage = canManageActionDesk(member);
  const [services, requests] = await Promise.all([
    prisma.actionService.findMany({
      where: { teamId: member.teamId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    prisma.serviceRequest.findMany({
      where: {
        teamId: member.teamId,
        requesterId: canManage ? undefined : member.userId,
      },
      include: requestInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    }),
  ]);
  return {
    canManage,
    currentUserId: member.userId,
    services: services.map(serviceData),
    requests: requests.map(requestData),
  };
};

export const createActionService = async (
  member: MemberWithIdentity,
  input: ActionServiceInput
) => {
  if (!canManageActionDesk(member))
    throw new ApiError(403, 'Only owners and admins can manage services.');
  const data = validateServiceInput(input);
  const baseSlug = slugify(data.name);
  if (!baseSlug)
    throw new ApiError(422, 'Choose a service name with letters or numbers.');
  const collision = await prisma.actionService.count({
    where: { teamId: member.teamId, slug: { startsWith: baseSlug } },
  });
  return prisma.actionService.create({
    data: {
      teamId: member.teamId,
      slug: collision ? `${baseSlug}-${collision + 1}`.slice(0, 80) : baseSlug,
      ...data,
    },
  });
};

export const updateActionService = async (
  member: MemberWithIdentity,
  serviceId: string,
  input: ActionServiceInput
) => {
  if (!canManageActionDesk(member))
    throw new ApiError(403, 'Only owners and admins can manage services.');
  const service = await prisma.actionService.findFirst({
    where: { id: serviceId, teamId: member.teamId },
  });
  if (!service) throw new ApiError(404, 'Service not found.');
  return prisma.actionService.update({
    where: { id: service.id },
    data: validateServiceInput(input),
  });
};

export const createServiceRequest = async (
  member: MemberWithIdentity,
  input: ServiceRequestInput
) => {
  const normalized = validateRequestInput(input);
  const service = await prisma.actionService.findFirst({
    where: { id: input.serviceId, teamId: member.teamId, active: true },
  });
  if (!service)
    throw new ApiError(
      404,
      'That service is not available. Refresh the catalog and try again.'
    );

  const created = await prisma.serviceRequest.create({
    data: {
      teamId: member.teamId,
      serviceId: service.id,
      requesterId: member.userId,
      ...normalized,
      events: {
        create: {
          actorId: member.userId,
          type: 'CREATED',
          message: `Request created for ${service.name}.`,
        },
      },
    },
    include: requestInclude,
  });
  return requestData(created);
};

const validTransitions: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  OPEN: [
    ServiceRequestStatus.IN_PROGRESS,
    ServiceRequestStatus.WAITING_ON_REQUESTER,
    ServiceRequestStatus.RESOLVED,
    ServiceRequestStatus.CANCELED,
  ],
  IN_PROGRESS: [
    ServiceRequestStatus.WAITING_ON_REQUESTER,
    ServiceRequestStatus.RESOLVED,
    ServiceRequestStatus.CANCELED,
  ],
  WAITING_ON_REQUESTER: [
    ServiceRequestStatus.IN_PROGRESS,
    ServiceRequestStatus.RESOLVED,
    ServiceRequestStatus.CANCELED,
  ],
  RESOLVED: [ServiceRequestStatus.IN_PROGRESS],
  CANCELED: [],
};

export const transitionServiceRequest = async (
  member: MemberWithIdentity,
  requestId: string,
  status: ServiceRequestStatusValue,
  note?: string | null
) => {
  const request = await prisma.serviceRequest.findFirst({
    where: { id: requestId, teamId: member.teamId },
  });
  if (!request) throw new ApiError(404, 'Service request not found.');
  const manager = canManageActionDesk(member);
  const nextStatus = status as ServiceRequestStatus;
  if (!manager) {
    if (request.requesterId !== member.userId)
      throw new ApiError(403, 'You cannot update this request.');
    if (nextStatus !== ServiceRequestStatus.CANCELED)
      throw new ApiError(
        403,
        'Only owners and admins can move requests through the queue.'
      );
  }
  if (!validTransitions[request.status].includes(nextStatus)) {
    throw new ApiError(
      409,
      `A ${request.status.toLowerCase()} request cannot move to ${status.toLowerCase()}.`
    );
  }
  const resolution = note?.trim() || null;
  if (resolution && resolution.length > 1000)
    throw new ApiError(422, 'Notes can be at most 1,000 characters.');
  const updated = await prisma.serviceRequest.update({
    where: { id: request.id },
    data: {
      status: nextStatus,
      assigneeId: manager ? member.userId : request.assigneeId,
      resolvedAt:
        nextStatus === ServiceRequestStatus.RESOLVED ? new Date() : null,
      resolution:
        nextStatus === ServiceRequestStatus.RESOLVED
          ? resolution
          : request.status === ServiceRequestStatus.RESOLVED
            ? null
            : request.resolution,
      events: {
        create: {
          actorId: member.userId,
          type: 'STATUS_CHANGED',
          message: resolution
            ? `Status changed to ${status.replaceAll('_', ' ').toLowerCase()}: ${resolution}`
            : `Status changed to ${status.replaceAll('_', ' ').toLowerCase()}.`,
        },
      },
    },
    include: requestInclude,
  });
  return requestData(updated);
};
