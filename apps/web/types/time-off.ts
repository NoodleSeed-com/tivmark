export type TimeOffTypeValue = 'VACATION' | 'SICK' | 'PERSONAL' | 'UNPAID';
export type TimeOffStatusValue =
  'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELED';
export type TimeOffDurationValue = 'FULL_DAY' | 'HALF_DAY';
export type HalfDayPeriodValue = 'MORNING' | 'AFTERNOON';

export interface TimeOffPolicyData {
  id: string;
  type: TimeOffTypeValue;
  annualAllowanceHalfDays: number | null;
}

export interface TimeOffPerson {
  id: string;
  name: string;
  email: string;
}

export interface TimeOffRequestData {
  id: string;
  type: TimeOffTypeValue;
  status: TimeOffStatusValue;
  startDate: string;
  endDate: string;
  duration: TimeOffDurationValue;
  halfDayPeriod: HalfDayPeriodValue | null;
  requestedHalfDays: number;
  reason: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requester: TimeOffPerson;
  reviewer: TimeOffPerson | null;
}

export interface TimeOffMemberData extends TimeOffPerson {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface TimeOffBalanceData {
  allowanceHalfDays: number | null;
  approvedHalfDays: number;
  pendingHalfDays: number;
  remainingHalfDays: number | null;
}

export interface TimeOffWorkspaceData {
  year: number;
  canApprove: boolean;
  currentUserId: string;
  policies: TimeOffPolicyData[];
  requests: TimeOffRequestData[];
  members: TimeOffMemberData[];
  balances: Record<string, Record<TimeOffTypeValue, TimeOffBalanceData>>;
}
