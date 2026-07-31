export type ToolResultStatus = {
  readonly pending?: boolean;
  readonly error?: boolean;
};

export type LoadState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'empty'; readonly message: string }
  | { readonly kind: 'partial'; readonly data: T; readonly message: string }
  | { readonly kind: 'ready'; readonly data: T };

export type BalanceItem = {
  readonly type: TimeOffType;
  readonly label: string;
  readonly allowanceHalfDays: number | null;
  readonly approvedHalfDays: number;
  readonly pendingHalfDays: number;
  readonly remainingHalfDays: number | null;
};

export type BalanceViewData = {
  readonly team: string;
  readonly balances: readonly BalanceItem[];
};

export type BalanceViewState = LoadState<BalanceViewData>;

export type TimeOffRequestItem = {
  readonly id: string;
  readonly type: string;
  readonly typeLabel: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly requestedHalfDays?: number;
  readonly reason?: string;
  readonly requesterName?: string;
};

export type TimeOffRequestsViewData = {
  readonly team: string;
  readonly pendingCount: number;
  readonly requests: readonly TimeOffRequestItem[];
};

export type TimeOffRequestsViewState = LoadState<TimeOffRequestsViewData>;

export type EquipmentRequestItem = {
  readonly id: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly item: string;
  readonly quantity: number;
  readonly status: string;
  readonly statusLabel: string;
  readonly justification?: string;
  readonly requesterName?: string;
};

export type EquipmentRequestsViewData = {
  readonly team: string;
  readonly pendingCount: number;
  readonly requests: readonly EquipmentRequestItem[];
};

export type EquipmentRequestsViewState = LoadState<EquipmentRequestsViewData>;

const TIME_OFF_TYPES = ['VACATION', 'SICK', 'PERSONAL', 'UNPAID'] as const;
type TimeOffType = (typeof TIME_OFF_TYPES)[number];

const TIME_OFF_LABELS: Record<TimeOffType, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  PERSONAL: 'Personal',
  UNPAID: 'Unpaid',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  LAPTOP: 'Laptop',
  MONITOR: 'Monitor',
  PHONE: 'Phone',
  PERIPHERAL: 'Peripheral',
  FURNITURE: 'Furniture',
  OTHER: 'Other',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

const isDateOnly = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const statusLabel = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');

const statusState = <T>(
  status: ToolResultStatus | undefined,
  errorMessage: string
): LoadState<T> | undefined => {
  if (status?.error) return { kind: 'error', message: errorMessage };
  if (status?.pending) return { kind: 'loading' };
  return undefined;
};

const parseBalance = (value: unknown): Omit<BalanceItem, 'type' | 'label'> | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    !isNumberOrNull(value.allowanceHalfDays) ||
    !isFiniteNumber(value.approvedHalfDays) ||
    !isFiniteNumber(value.pendingHalfDays) ||
    !isNumberOrNull(value.remainingHalfDays) ||
    (value.allowanceHalfDays === null) !== (value.remainingHalfDays === null)
  ) {
    return undefined;
  }
  return {
    allowanceHalfDays: value.allowanceHalfDays,
    approvedHalfDays: value.approvedHalfDays,
    pendingHalfDays: value.pendingHalfDays,
    remainingHalfDays: value.remainingHalfDays,
  };
};

export function normalizeBalanceResult(
  input: unknown,
  status?: ToolResultStatus
): BalanceViewState {
  const currentState = statusState<BalanceViewData>(
    status,
    "We couldn't load your time-off balance."
  );
  if (currentState) return currentState;
  if (!isRecord(input)) {
    return { kind: 'error', message: 'The balance result was incomplete.' };
  }
  if (
    typeof input.team !== 'string' ||
    typeof input.userId !== 'string' ||
    !isRecord(input.balances)
  ) {
    return { kind: 'error', message: 'The balance result was incomplete.' };
  }

  const mine = input.balances[input.userId];
  if (!isRecord(mine)) {
    return {
      kind: 'error',
      message: "We couldn't match these balances to your account.",
    };
  }

  const balances: BalanceItem[] = [];
  for (const type of TIME_OFF_TYPES) {
    if (!(type in mine)) continue;
    const parsed = parseBalance(mine[type]);
    if (!parsed) {
      return { kind: 'error', message: 'The balance result was incomplete.' };
    }
    balances.push({
      type,
      label: TIME_OFF_LABELS[type],
      ...parsed,
    });
  }

  if (balances.length === 0) {
    return {
      kind: 'empty',
      message: 'No time-off policies are configured for this team yet.',
    };
  }
  return {
    kind: 'ready',
    data: { team: input.team, balances },
  };
}

const requesterName = (value: unknown) => {
  if (!isRecord(value)) return undefined;
  return optionalString(value.name);
};

const parseTimeOffRequest = (value: unknown): TimeOffRequestItem | undefined => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.type !== 'string' ||
    typeof value.status !== 'string' ||
    !isDateOnly(value.startDate) ||
    !isDateOnly(value.endDate)
  ) {
    return undefined;
  }
  if (
    value.requestedHalfDays !== undefined &&
    !isFiniteNumber(value.requestedHalfDays)
  ) {
    return undefined;
  }
  if (
    value.reason !== undefined &&
    value.reason !== null &&
    typeof value.reason !== 'string'
  ) {
    return undefined;
  }
  return {
    id: value.id,
    type: value.type,
    typeLabel:
      TIME_OFF_LABELS[value.type as TimeOffType] ?? statusLabel(value.type),
    status: value.status,
    statusLabel: statusLabel(value.status),
    startDate: value.startDate,
    endDate: value.endDate,
    ...(value.requestedHalfDays !== undefined
      ? { requestedHalfDays: value.requestedHalfDays }
      : {}),
    ...(optionalString(value.reason) ? { reason: optionalString(value.reason) } : {}),
    ...(requesterName(value.requester)
      ? { requesterName: requesterName(value.requester) }
      : {}),
  };
};

const parseEquipmentRequest = (
  value: unknown
): EquipmentRequestItem | undefined => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.category !== 'string' ||
    typeof value.item !== 'string' ||
    !Number.isInteger(value.quantity) ||
    (value.quantity as number) < 1 ||
    typeof value.status !== 'string'
  ) {
    return undefined;
  }
  if (
    value.justification !== undefined &&
    value.justification !== null &&
    typeof value.justification !== 'string'
  ) {
    return undefined;
  }
  return {
    id: value.id,
    category: value.category,
    categoryLabel:
      EQUIPMENT_LABELS[value.category] ?? statusLabel(value.category),
    item: value.item,
    quantity: value.quantity as number,
    status: value.status,
    statusLabel: statusLabel(value.status),
    ...(optionalString(value.justification)
      ? { justification: optionalString(value.justification) }
      : {}),
    ...(requesterName(value.requester)
      ? { requesterName: requesterName(value.requester) }
      : {}),
  };
};

export function normalizeTimeOffRequests(
  input: unknown,
  status?: ToolResultStatus
): TimeOffRequestsViewState {
  const currentState = statusState<TimeOffRequestsViewData>(
    status,
    "We couldn't load your time-off requests."
  );
  if (currentState) return currentState;
  if (
    !isRecord(input) ||
    typeof input.team !== 'string' ||
    !Array.isArray(input.requests)
  ) {
    return {
      kind: 'error',
      message: 'The time-off request result was incomplete.',
    };
  }
  if (input.requests.length === 0) {
    return { kind: 'empty', message: 'No time-off requests yet.' };
  }

  const requests = input.requests
    .map(parseTimeOffRequest)
    .filter((request): request is TimeOffRequestItem => Boolean(request));
  if (requests.length === 0) {
    return {
      kind: 'error',
      message: 'The time-off request result was incomplete.',
    };
  }

  const data = {
    team: input.team,
    pendingCount: requests.filter((request) => request.status === 'PENDING').length,
    requests,
  };
  const omitted = input.requests.length - requests.length;
  return omitted > 0
    ? {
        kind: 'partial',
        data,
        message: `${omitted === 1 ? 'One request' : `${omitted} requests`} could not be displayed.`,
      }
    : { kind: 'ready', data };
}

export function normalizeEquipmentRequests(
  input: unknown,
  status?: ToolResultStatus
): EquipmentRequestsViewState {
  const currentState = statusState<EquipmentRequestsViewData>(
    status,
    "We couldn't load your equipment requests."
  );
  if (currentState) return currentState;
  if (
    !isRecord(input) ||
    typeof input.team !== 'string' ||
    !Array.isArray(input.requests)
  ) {
    return {
      kind: 'error',
      message: 'The equipment request result was incomplete.',
    };
  }
  if (input.requests.length === 0) {
    return { kind: 'empty', message: 'No equipment requests yet.' };
  }

  const requests = input.requests
    .map(parseEquipmentRequest)
    .filter((request): request is EquipmentRequestItem => Boolean(request));
  if (requests.length === 0) {
    return {
      kind: 'error',
      message: 'The equipment request result was incomplete.',
    };
  }

  const data = {
    team: input.team,
    pendingCount: requests.filter((request) => request.status === 'PENDING').length,
    requests,
  };
  const omitted = input.requests.length - requests.length;
  return omitted > 0
    ? {
        kind: 'partial',
        data,
        message: `${omitted === 1 ? 'One request' : `${omitted} requests`} could not be displayed.`,
      }
    : { kind: 'ready', data };
}

export function formatHalfDays(value: number) {
  const days = value / 2;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} ${
    days === 1 ? 'day' : 'days'
  }`;
}

const fullDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));

const shortDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));

export function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) return fullDate(startDate);
  const startYear = startDate.slice(0, 4);
  const endYear = endDate.slice(0, 4);
  return startYear === endYear
    ? `${shortDate(startDate)} – ${fullDate(endDate)}`
    : `${fullDate(startDate)} – ${fullDate(endDate)}`;
}
