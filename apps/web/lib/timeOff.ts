import type {
  TimeOffDurationValue,
  TimeOffRequestData,
  TimeOffTypeValue,
} from 'types/time-off';

export const TIME_OFF_TYPES: TimeOffTypeValue[] = [
  'VACATION',
  'SICK',
  'PERSONAL',
  'UNPAID',
];

export const DEFAULT_TIME_OFF_ALLOWANCES: Record<
  TimeOffTypeValue,
  number | null
> = {
  VACATION: 30,
  SICK: 20,
  PERSONAL: 6,
  UNPAID: null,
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parseDateOnly = (value: string) => {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new Error('Use a valid date in YYYY-MM-DD format.');
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Use a valid calendar date.');
  }

  return date;
};

export const formatDateOnly = (date: Date | string) =>
  new Date(date).toISOString().slice(0, 10);

type TimeOffRequestRecord = Omit<
  TimeOffRequestData,
  'startDate' | 'endDate' | 'reviewedAt' | 'createdAt'
> & {
  startDate: Date | string;
  endDate: Date | string;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
};

export const serializeTimeOffRequest = (
  request: TimeOffRequestRecord
): TimeOffRequestData => ({
  id: request.id,
  type: request.type,
  status: request.status,
  startDate: formatDateOnly(request.startDate),
  endDate: formatDateOnly(request.endDate),
  duration: request.duration,
  halfDayPeriod: request.halfDayPeriod,
  requestedHalfDays: request.requestedHalfDays,
  reason: request.reason,
  reviewNote: request.reviewNote,
  reviewedAt:
    request.reviewedAt === null
      ? null
      : new Date(request.reviewedAt).toISOString(),
  createdAt: new Date(request.createdAt).toISOString(),
  requester: request.requester,
  reviewer: request.reviewer,
});

export const countWeekdays = (startDate: string, endDate: string) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (end < start) {
    throw new Error('End date must be on or after the start date.');
  }

  let weekdays = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      weekdays += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return weekdays;
};

export const calculateRequestedHalfDays = ({
  startDate,
  endDate,
  duration,
}: {
  startDate: string;
  endDate: string;
  duration: TimeOffDurationValue;
}) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    throw new Error('A request cannot cross calendar years.');
  }

  if (duration === 'HALF_DAY') {
    if (startDate !== endDate) {
      throw new Error('Half-day requests must use a single date.');
    }

    const day = start.getUTCDay();
    if (day === 0 || day === 6) {
      throw new Error('Half-day requests must be on a weekday.');
    }

    return 1;
  }

  const weekdays = countWeekdays(startDate, endDate);
  if (weekdays === 0) {
    throw new Error('Choose a range containing at least one weekday.');
  }

  return weekdays * 2;
};

export const getYearBounds = (year: number) => ({
  start: new Date(Date.UTC(year, 0, 1)),
  end: new Date(Date.UTC(year + 1, 0, 1)),
});

export const halfDaysToDays = (halfDays: number) => halfDays / 2;
