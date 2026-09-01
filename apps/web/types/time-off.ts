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

export type TimeOffEligibilityDecision =
  | 'ELIGIBLE'
  | 'INVALID_DATES'
  | 'OVERLAP'
  | 'INSUFFICIENT_BALANCE'
  | 'POLICY_UNAVAILABLE';

export interface TimeOffEligibilityAssessment {
  status: string;
  team: string;
  userId: string;
  type: TimeOffTypeValue;
  startDate: string;
  endDate: string;
  eligible: boolean;
  decision: TimeOffEligibilityDecision;
  reason: string;
  requestedHalfDays: number;
  pendingHalfDays: number;
  availableBeforeHalfDays: number | null;
  remainingAfterHalfDays: number | null;
  conflict: {
    id: string;
    startDate: string;
    endDate: string;
  } | null;
  checks: {
    weekday: boolean;
    noOverlap: boolean;
    withinBalance: boolean;
  };
  policySource: string;
}

export interface TimeOffReceiptData {
  requestId: string;
  status: string;
  team: string;
  type: TimeOffTypeValue;
  startDate: string;
  endDate: string;
  requestedHalfDays: number;
  pendingHalfDays: number;
  remainingAfterPendingHalfDays: number | null;
  authenticated: true;
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
