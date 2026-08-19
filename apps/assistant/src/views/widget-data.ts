import {
  balanceItemSchema,
  equipmentRequestSchema,
  timeOffRequestSchema,
} from './widget-contracts.js';

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
  const parsed = balanceItemSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const balance = parsed.data;
  if (
    !isNumberOrNull(balance.allowanceHalfDays) ||
    !isFiniteNumber(balance.approvedHalfDays) ||
    !isFiniteNumber(balance.pendingHalfDays) ||
    !isNumberOrNull(balance.remainingHalfDays) ||
    (balance.allowanceHalfDays === null) !==
      (balance.remainingHalfDays === null)
  ) {
    return undefined;
  }
  return {
    allowanceHalfDays: balance.allowanceHalfDays,
    approvedHalfDays: balance.approvedHalfDays,
    pendingHalfDays: balance.pendingHalfDays,
    remainingHalfDays: balance.remainingHalfDays,
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
  const parsed = timeOffRequestSchema.safeParse(value);
  if (
    !parsed.success ||
    !isDateOnly(parsed.data.startDate) ||
    !isDateOnly(parsed.data.endDate)
  ) {
    return undefined;
  }
  const request = parsed.data;
  return {
    id: request.id,
    type: request.type,
    typeLabel:
      TIME_OFF_LABELS[request.type as TimeOffType] ?? statusLabel(request.type),
    status: request.status,
    statusLabel: statusLabel(request.status),
    startDate: request.startDate,
    endDate: request.endDate,
    ...(request.requestedHalfDays !== undefined
      ? { requestedHalfDays: request.requestedHalfDays }
      : {}),
    ...(optionalString(request.reason)
      ? { reason: optionalString(request.reason) }
      : {}),
    ...(requesterName(request.requester)
      ? { requesterName: requesterName(request.requester) }
      : {}),
  };
};

const parseEquipmentRequest = (
  value: unknown
): EquipmentRequestItem | undefined => {
  const parsed = equipmentRequestSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const request = parsed.data;
  return {
    id: request.id,
    category: request.category,
    categoryLabel:
      EQUIPMENT_LABELS[request.category] ?? statusLabel(request.category),
    item: request.item,
    quantity: request.quantity,
    status: request.status,
    statusLabel: statusLabel(request.status),
    ...(optionalString(request.justification)
      ? { justification: optionalString(request.justification) }
      : {}),
    ...(requesterName(request.requester)
      ? { requesterName: requesterName(request.requester) }
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

export type ContactOption = {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly detail: string;
};

export type ContactOptionsViewData = {
  readonly options: readonly ContactOption[];
};

export type ContactOptionsViewState = LoadState<ContactOptionsViewData>;

const parseContactOption = (value: unknown): ContactOption | undefined => {
  if (!isRecord(value)) return undefined;
  const { id, label, url, detail } = value;
  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    typeof url !== 'string' ||
    typeof detail !== 'string' ||
    id.length === 0 ||
    label.length === 0
  ) {
    return undefined;
  }
  // The host opens these, and the server declares which domains it may open. Anything that
  // is not an absolute https URL is dropped rather than rendered as a dead control.
  if (!url.startsWith('https://')) return undefined;
  return { id, label, url, detail };
};

export function normalizeContactOptions(
  input: unknown,
  status?: ToolResultStatus
): ContactOptionsViewState {
  const currentState = statusState<ContactOptionsViewData>(
    status,
    "We couldn't load the ways to reach Tivmark."
  );
  if (currentState) return currentState;
  if (!isRecord(input) || !Array.isArray(input.options)) {
    return { kind: 'error', message: 'The contact options were incomplete.' };
  }

  const options: ContactOption[] = [];
  let dropped = 0;
  for (const raw of input.options) {
    const option = parseContactOption(raw);
    if (option) options.push(option);
    else dropped += 1;
  }

  if (options.length === 0) {
    return dropped > 0
      ? { kind: 'error', message: 'The contact options were incomplete.' }
      : { kind: 'empty', message: 'No contact options are configured.' };
  }
  return dropped > 0
    ? {
        kind: 'partial',
        data: { options },
        message: 'Some options could not be shown.',
      }
    : { kind: 'ready', data: { options } };
}
