export type ServiceAudienceValue = 'PUBLIC' | 'CUSTOMER' | 'EMPLOYEE';
export type ServiceRequestStatusValue =
  'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_REQUESTER' | 'RESOLVED' | 'CANCELED';
export type ServiceRequestPriorityValue = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ServiceRequestSourceValue = 'WEB' | 'ASSISTANT' | 'MCP';

export interface ActionServiceData {
  id: string;
  slug: string;
  name: string;
  description: string;
  audience: ServiceAudienceValue;
  active: boolean;
  slaHours: number | null;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequestPerson {
  id: string;
  name: string;
  email: string;
}

export interface ServiceRequestEventData {
  id: string;
  type: 'CREATED' | 'STATUS_CHANGED' | 'COMMENT' | 'ASSIGNED';
  message: string;
  createdAt: string;
  actor: ServiceRequestPerson | null;
}

export interface ServiceRequestData {
  id: string;
  subject: string;
  description: string;
  priority: ServiceRequestPriorityValue;
  status: ServiceRequestStatusValue;
  source: ServiceRequestSourceValue;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  service: ActionServiceData;
  requester: ServiceRequestPerson;
  assignee: ServiceRequestPerson | null;
  events: ServiceRequestEventData[];
}

export interface ActionDeskWorkspaceData {
  canManage: boolean;
  currentUserId: string;
  services: ActionServiceData[];
  requests: ServiceRequestData[];
}
