export type EquipmentCategoryValue =
  | 'LAPTOP'
  | 'MONITOR'
  | 'PHONE'
  | 'PERIPHERAL'
  | 'FURNITURE'
  | 'OTHER';

export type EquipmentStatusValue =
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'FULFILLED'
  | 'CANCELED';

export interface EquipmentPerson {
  id: string;
  name: string;
  email: string;
}

export interface EquipmentRequestData {
  id: string;
  category: EquipmentCategoryValue;
  item: string;
  quantity: number;
  justification: string | null;
  status: EquipmentStatusValue;
  reviewNote: string | null;
  reviewedAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  requester: EquipmentPerson;
  reviewer: EquipmentPerson | null;
}

export interface EquipmentMemberData extends EquipmentPerson {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface EquipmentWorkspaceData {
  canReview: boolean;
  currentUserId: string;
  requests: EquipmentRequestData[];
  members: EquipmentMemberData[];
}
