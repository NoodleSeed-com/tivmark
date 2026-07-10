import {
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Loading } from '@/components/shared';
import { defaultHeaders } from '@/lib/common';
import {
  calculateRequestedHalfDays,
  halfDaysToDays,
  TIME_OFF_TYPES,
} from '@/lib/timeOff';
import useTimeOff from 'hooks/useTimeOff';
import type {
  ApiResponse,
  HalfDayPeriodValue,
  TimeOffDurationValue,
  TimeOffRequestData,
  TimeOffStatusValue,
  TimeOffTypeValue,
} from 'types';

const TYPE_LABELS: Record<TimeOffTypeValue, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  PERSONAL: 'Personal',
  UNPAID: 'Unpaid',
};

const STATUS_LABELS: Record<TimeOffStatusValue, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  CANCELED: 'Canceled',
};

const STATUS_STYLES: Record<TimeOffStatusValue, string> = {
  PENDING:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  APPROVED:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  DECLINED: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  CANCELED: 'border-ui-border bg-ui-surface-muted text-ui-muted',
};

const today = () => new Date().toISOString().slice(0, 10);

const formatDays = (halfDays: number | null) => {
  if (halfDays === null) return 'Unlimited';
  const days = halfDaysToDays(halfDays);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));

const dateRangeLabel = (request: TimeOffRequestData) => {
  if (request.duration === 'HALF_DAY') {
    return `${formatDate(request.startDate)}, ${
      request.halfDayPeriod === 'MORNING' ? 'morning' : 'afternoon'
    }`;
  }
  if (request.startDate === request.endDate)
    return formatDate(request.startDate);
  return `${formatDate(request.startDate)} - ${formatDate(request.endDate)}`;
};

const IconButton = ({
  label,
  onClick,
  children,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'danger';
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={`inline-flex h-9 w-9 items-center justify-center border transition-colors ${
      tone === 'success'
        ? 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300'
        : tone === 'danger'
          ? 'border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-300'
          : 'border-ui-border text-ui-muted hover:border-ui-accent hover:text-ui-heading'
    }`}
  >
    {children}
  </button>
);

const Dialog = ({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <div className="fixed inset-0 z-[70] flex items-end justify-center bg-tivmark-deep/75 p-0 sm:items-center sm:p-6">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className="max-h-[92vh] w-full overflow-y-auto border border-ui-border bg-ui-surface p-5 text-ui-text shadow-xl sm:max-w-lg sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="dialog-title" className="font-serif text-xl text-ui-heading">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-ui-muted">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-ui-muted hover:bg-ui-surface-muted hover:text-ui-heading"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  </div>
);

type RequestFormValue = {
  type: TimeOffTypeValue;
  startDate: string;
  endDate: string;
  duration: TimeOffDurationValue;
  halfDayPeriod: HalfDayPeriodValue;
  reason: string;
};

const RequestDialog = ({
  request,
  remainingHalfDays,
  onClose,
  onSave,
}: {
  request: TimeOffRequestData | null;
  remainingHalfDays: Record<TimeOffTypeValue, number | null>;
  onClose: () => void;
  onSave: (values: RequestFormValue) => Promise<void>;
}) => {
  const { t } = useTranslation('common');
  const [values, setValues] = useState<RequestFormValue>({
    type: request?.type || 'VACATION',
    startDate: request?.startDate || today(),
    endDate: request?.endDate || today(),
    duration: request?.duration || 'FULL_DAY',
    halfDayPeriod: request?.halfDayPeriod || 'MORNING',
    reason: request?.reason || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  let requestedHalfDays = 0;
  let calculationError = '';
  try {
    requestedHalfDays = calculateRequestedHalfDays(values);
  } catch (caught) {
    calculationError = (caught as Error).message;
  }

  const remaining = remainingHalfDays[values.type];
  const overBalance = remaining !== null && requestedHalfDays > remaining;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (calculationError) {
      setError(calculationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(values);
    } catch (caught) {
      setError((caught as Error).message);
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={request ? 'Edit request' : 'Request time off'}
      description={t('time-off-weekends')}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ui-heading">
            {t('leave-type')}
          </span>
          <select
            value={values.type}
            onChange={(event) =>
              setValues({
                ...values,
                type: event.target.value as TimeOffTypeValue,
              })
            }
            className="select select-bordered w-full bg-ui-surface text-ui-text"
          >
            {TIME_OFF_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ui-heading">
            {t('duration')}
          </legend>
          <div className="grid grid-cols-2 border border-ui-border p-1">
            {(['FULL_DAY', 'HALF_DAY'] as TimeOffDurationValue[]).map(
              (duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() =>
                    setValues({
                      ...values,
                      duration,
                      endDate:
                        duration === 'HALF_DAY'
                          ? values.startDate
                          : values.endDate,
                    })
                  }
                  className={`px-3 py-2 text-sm font-medium ${
                    values.duration === duration
                      ? 'bg-tivmark-navy text-white dark:bg-tivmark-gold dark:text-tivmark-deep'
                      : 'text-ui-muted hover:bg-ui-surface-muted hover:text-ui-heading'
                  }`}
                >
                  {duration === 'FULL_DAY' ? 'Full day(s)' : 'Half day'}
                </button>
              )
            )}
          </div>
        </fieldset>

        <div
          className={`grid gap-4 ${values.duration === 'FULL_DAY' ? 'sm:grid-cols-2' : ''}`}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ui-heading">
              {values.duration === 'FULL_DAY' ? 'Start date' : 'Date'}
            </span>
            <input
              type="date"
              required
              value={values.startDate}
              onChange={(event) =>
                setValues({
                  ...values,
                  startDate: event.target.value,
                  endDate:
                    values.duration === 'HALF_DAY'
                      ? event.target.value
                      : values.endDate,
                })
              }
              className="input input-bordered w-full bg-ui-surface text-ui-text"
            />
          </label>
          {values.duration === 'FULL_DAY' && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ui-heading">
                {t('end-date')}
              </span>
              <input
                type="date"
                required
                min={values.startDate}
                value={values.endDate}
                onChange={(event) =>
                  setValues({ ...values, endDate: event.target.value })
                }
                className="input input-bordered w-full bg-ui-surface text-ui-text"
              />
            </label>
          )}
        </div>

        {values.duration === 'HALF_DAY' && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ui-heading">
              {t('part-of-day')}
            </legend>
            <div className="flex gap-5">
              {(['MORNING', 'AFTERNOON'] as HalfDayPeriodValue[]).map(
                (period) => (
                  <label
                    key={period}
                    className="flex items-center gap-2 text-sm text-ui-text"
                  >
                    <input
                      type="radio"
                      name="halfDayPeriod"
                      checked={values.halfDayPeriod === period}
                      onChange={() =>
                        setValues({ ...values, halfDayPeriod: period })
                      }
                      className="radio radio-sm radio-primary"
                    />
                    {period === 'MORNING' ? 'Morning' : 'Afternoon'}
                  </label>
                )
              )}
            </div>
          </fieldset>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ui-heading">
            {t('reason-optional')}
          </span>
          <textarea
            value={values.reason}
            maxLength={500}
            rows={3}
            onChange={(event) =>
              setValues({ ...values, reason: event.target.value })
            }
            className="textarea textarea-bordered w-full bg-ui-surface text-ui-text"
            placeholder="Add any context your approver needs"
          />
        </label>

        {!calculationError && (
          <div className="flex items-center justify-between border-y border-ui-border py-3 text-sm">
            <span className="text-ui-muted">{t('requested')}</span>
            <strong className="text-ui-heading">
              {formatDays(requestedHalfDays)}
            </strong>
          </div>
        )}

        {overBalance && (
          <div className="border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            {t('time-off-over-balance', {
              type: TYPE_LABELS[values.type].toLowerCase(),
            })}
          </div>
        )}
        {(error || calculationError) && (
          <p className="text-sm text-red-700 dark:text-red-300">
            {error || calculationError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : request ? 'Save changes' : 'Submit request'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

const ReviewDialog = ({
  request,
  decision,
  onClose,
  onReview,
}: {
  request: TimeOffRequestData;
  decision: 'APPROVED' | 'DECLINED';
  onClose: () => void;
  onReview: (note: string) => Promise<void>;
}) => {
  const { t } = useTranslation('common');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      title={`${decision === 'APPROVED' ? 'Approve' : 'Decline'} request`}
      description={`${request.requester.name} requested ${formatDays(request.requestedHalfDays)} of ${TYPE_LABELS[request.type].toLowerCase()} leave.`}
      onClose={onClose}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ui-heading">
          {t('note-optional')}
        </span>
        <textarea
          value={note}
          maxLength={500}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          className="textarea textarea-bordered w-full bg-ui-surface text-ui-text"
        />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          {t('cancel')}
        </button>
        <button
          type="button"
          className={`btn ${decision === 'APPROVED' ? 'btn-primary' : 'btn-error'}`}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onReview(note);
            } catch {
              setSaving(false);
            }
          }}
        >
          {saving
            ? 'Saving...'
            : decision === 'APPROVED'
              ? 'Approve'
              : 'Decline'}
        </button>
      </div>
    </Dialog>
  );
};

const PolicyDialog = ({
  initial,
  onClose,
  onSave,
}: {
  initial: Record<TimeOffTypeValue, number | null>;
  onClose: () => void;
  onSave: (values: Record<TimeOffTypeValue, number | null>) => Promise<void>;
}) => {
  const { t } = useTranslation('common');
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      title="Annual allowances"
      description={t('allowances-description')}
      onClose={onClose}
    >
      <div className="space-y-4">
        {TIME_OFF_TYPES.map((type) => (
          <div
            key={type}
            className="grid grid-cols-[1fr_7rem] items-center gap-4"
          >
            <div>
              <div className="text-sm font-medium text-ui-heading">
                {TYPE_LABELS[type]}
              </div>
              <label className="mt-1 flex items-center gap-2 text-xs text-ui-muted">
                <input
                  type="checkbox"
                  checked={values[type] === null}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      [type]: event.target.checked ? null : 0,
                    })
                  }
                  className="checkbox checkbox-xs checkbox-primary"
                />
                {t('unlimited')}
              </label>
            </div>
            <input
              type="number"
              min="0"
              max="365"
              step="0.5"
              disabled={values[type] === null}
              value={
                values[type] === null ? '' : halfDaysToDays(values[type] || 0)
              }
              onChange={(event) =>
                setValues({
                  ...values,
                  [type]: Math.round(Number(event.target.value) * 2),
                })
              }
              aria-label={`${TYPE_LABELS[type]} allowance in days`}
              className="input input-bordered w-full bg-ui-surface text-right text-ui-text disabled:bg-ui-surface-muted"
            />
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(values);
            } catch {
              setSaving(false);
            }
          }}
        >
          {saving ? 'Saving...' : 'Save allowances'}
        </button>
      </div>
    </Dialog>
  );
};

const TimeOffWorkspace = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { slug } = router.query as { slug?: string };
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const { workspace, isLoading, error, refresh } = useTimeOff(slug, year);
  const [view, setView] = useState<'mine' | 'team'>('mine');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TimeOffStatusValue>(
    'ALL'
  );
  const [typeFilter, setTypeFilter] = useState<'ALL' | TimeOffTypeValue>('ALL');
  const [memberFilter, setMemberFilter] = useState('ALL');
  const [requestDialog, setRequestDialog] = useState<
    TimeOffRequestData | 'new' | null
  >(null);
  const [reviewDialog, setReviewDialog] = useState<{
    request: TimeOffRequestData;
    decision: 'APPROVED' | 'DECLINED';
  } | null>(null);
  const [cancelDialog, setCancelDialog] = useState<TimeOffRequestData | null>(
    null
  );
  const [policyDialog, setPolicyDialog] = useState(false);

  const apiBase = slug
    ? `/api/v1/teams/${encodeURIComponent(slug)}/time-off`
    : '';

  const action = async (path: string, body: unknown, method = 'PATCH') => {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers: defaultHeaders,
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as ApiResponse;
    if (!response.ok) throw new Error(json.error.message);
    await refresh();
  };

  const visibleRequests = useMemo(() => {
    if (!workspace) return [];
    return workspace.requests.filter((request) => {
      if (view === 'mine' && request.requester.id !== workspace.currentUserId)
        return false;
      if (statusFilter !== 'ALL' && request.status !== statusFilter)
        return false;
      if (typeFilter !== 'ALL' && request.type !== typeFilter) return false;
      if (
        view === 'team' &&
        memberFilter !== 'ALL' &&
        request.requester.id !== memberFilter
      )
        return false;
      return true;
    });
  }, [memberFilter, statusFilter, typeFilter, view, workspace]);

  if (isLoading || !workspace) {
    if (error) {
      return (
        <div className="border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {error.message}
        </div>
      );
    }
    return <Loading />;
  }

  const myBalances = workspace.balances[workspace.currentUserId];
  const remainingHalfDays = Object.fromEntries(
    TIME_OFF_TYPES.map((type) => [type, myBalances[type].remainingHalfDays])
  ) as Record<TimeOffTypeValue, number | null>;
  const policies = Object.fromEntries(
    workspace.policies.map((policy) => [
      policy.type,
      policy.annualAllowanceHalfDays,
    ])
  ) as Record<TimeOffTypeValue, number | null>;

  const saveRequest = async (values: RequestFormValue) => {
    const editing =
      requestDialog !== null && requestDialog !== 'new' ? requestDialog : null;
    await action(
      editing ? `/requests/${editing.id}` : '/requests',
      editing ? { action: 'update', ...values } : values,
      editing ? 'PATCH' : 'POST'
    );
    toast.success(editing ? 'Request updated.' : 'Request submitted.');
    setRequestDialog(null);
  };

  const renderActions = (request: TimeOffRequestData) => {
    const isMine = request.requester.id === workspace.currentUserId;
    const canEdit =
      request.status === 'PENDING' && (isMine || workspace.canApprove);
    const canCancel =
      ['PENDING', 'APPROVED'].includes(request.status) &&
      (isMine || workspace.canApprove);

    return (
      <div className="flex justify-end gap-2">
        {workspace.canApprove && request.status === 'PENDING' && (
          <>
            <IconButton
              label="Approve"
              tone="success"
              onClick={() => setReviewDialog({ request, decision: 'APPROVED' })}
            >
              <CheckIcon className="h-5 w-5" />
            </IconButton>
            <IconButton
              label="Decline"
              tone="danger"
              onClick={() => setReviewDialog({ request, decision: 'DECLINED' })}
            >
              <XMarkIcon className="h-5 w-5" />
            </IconButton>
          </>
        )}
        {canEdit && (
          <IconButton
            label="Edit request"
            onClick={() => setRequestDialog(request)}
          >
            <PencilSquareIcon className="h-5 w-5" />
          </IconButton>
        )}
        {canCancel && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setCancelDialog(request)}
          >
            {t('cancel')}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-7 pb-8">
      <div className="flex flex-col gap-4 border-b border-ui-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-ui-accent">
            <CalendarDaysIcon className="h-5 w-5" />
            <span className="text-sm font-semibold">{t('time-off')}</span>
          </div>
          <h1 className="mt-2 font-serif text-3xl text-ui-heading">
            {t('plan-time-away')}
          </h1>
          <p className="mt-1 text-sm text-ui-muted">{t('time-off-subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {workspace.canApprove && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setPolicyDialog(true)}
            >
              <Cog6ToothIcon className="h-5 w-5" />
              {t('allowances')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setRequestDialog('new')}
          >
            <PlusIcon className="h-5 w-5" />
            {t('request-time-off')}
          </button>
        </div>
      </div>

      <section aria-labelledby="balance-heading">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2
            id="balance-heading"
            className="text-sm font-semibold text-ui-heading"
          >
            {t('your-year-balances', { year })}
          </h2>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label="Balance year"
            className="select select-bordered select-sm bg-ui-surface text-ui-text"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TIME_OFF_TYPES.map((type) => {
            const balance = myBalances[type];
            const overdrawn =
              balance.remainingHalfDays !== null &&
              balance.remainingHalfDays < 0;
            return (
              <article
                key={type}
                className="border border-ui-border bg-ui-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium text-ui-heading">
                    {TYPE_LABELS[type]}
                  </h3>
                  <span className="text-xs text-ui-muted">
                    {formatDays(balance.allowanceHalfDays)}
                  </span>
                </div>
                <div
                  className={`mt-5 text-2xl font-semibold ${overdrawn ? 'text-red-700 dark:text-red-300' : 'text-ui-heading'}`}
                >
                  {formatDays(balance.remainingHalfDays)}
                </div>
                <div className="mt-1 flex gap-3 text-xs text-ui-muted">
                  <span>
                    {t('days-used', {
                      amount: formatDays(balance.approvedHalfDays),
                    })}
                  </span>
                  {balance.pendingHalfDays > 0 && (
                    <span>
                      {t('days-pending', {
                        amount: formatDays(balance.pendingHalfDays),
                      })}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="requests-heading">
        <div className="flex flex-col gap-4 border-b border-ui-border pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2
              id="requests-heading"
              className="font-serif text-xl text-ui-heading"
            >
              {t('requests')}
            </h2>
            {workspace.canApprove && (
              <div className="mt-3 inline-flex border border-ui-border p-1">
                {(['mine', 'team'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setView(option)}
                    className={`px-4 py-2 text-sm font-medium ${
                      view === option
                        ? 'bg-tivmark-navy text-white dark:bg-tivmark-gold dark:text-tivmark-deep'
                        : 'text-ui-muted hover:bg-ui-surface-muted hover:text-ui-heading'
                    }`}
                  >
                    {option === 'mine' ? 'My time off' : 'Team requests'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as typeof statusFilter)
              }
              className="select select-bordered select-sm bg-ui-surface text-ui-text"
              aria-label="Filter by status"
            >
              <option value="ALL">{t('all-statuses')}</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as typeof typeFilter)
              }
              className="select select-bordered select-sm bg-ui-surface text-ui-text"
              aria-label="Filter by leave type"
            >
              <option value="ALL">{t('all-leave-types')}</option>
              {TIME_OFF_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {view === 'team' && (
              <select
                value={memberFilter}
                onChange={(event) => setMemberFilter(event.target.value)}
                className="select select-bordered select-sm bg-ui-surface text-ui-text"
                aria-label="Filter by employee"
              >
                <option value="ALL">{t('all-employees')}</option>
                {workspace.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="py-14 text-center">
            <ClockIcon className="mx-auto h-8 w-8 text-ui-accent" />
            <h3 className="mt-3 font-medium text-ui-heading">
              {t('no-matching-requests')}
            </h3>
            <p className="mt-1 text-sm text-ui-muted">
              {t('new-requests-appear-here')}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto border-b border-ui-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ui-border bg-ui-surface-muted text-xs uppercase text-ui-muted">
                  <tr>
                    {view === 'team' && (
                      <th className="px-4 py-3 font-medium">{t('employee')}</th>
                    )}
                    <th className="px-4 py-3 font-medium">{t('leave')}</th>
                    <th className="px-4 py-3 font-medium">{t('dates')}</th>
                    <th className="px-4 py-3 font-medium">{t('duration')}</th>
                    <th className="px-4 py-3 font-medium">{t('status')}</th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border">
                  {visibleRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="bg-ui-surface hover:bg-ui-surface-muted"
                    >
                      {view === 'team' && (
                        <td className="px-4 py-4 font-medium text-ui-heading">
                          {request.requester.name}
                        </td>
                      )}
                      <td className="px-4 py-4 text-ui-heading">
                        <div>{TYPE_LABELS[request.type]}</div>
                        {request.reason && (
                          <div
                            className="mt-1 max-w-xs truncate text-xs text-ui-muted"
                            title={request.reason}
                          >
                            {request.reason}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-ui-muted">
                        {dateRangeLabel(request)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-ui-muted">
                        {formatDays(request.requestedHalfDays)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex border px-2 py-1 text-xs font-medium ${STATUS_STYLES[request.status]}`}
                        >
                          {STATUS_LABELS[request.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4">{renderActions(request)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-ui-border md:hidden">
              {visibleRequests.map((request) => (
                <article key={request.id} className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {view === 'team' && (
                        <p className="text-xs font-medium text-ui-accent">
                          {request.requester.name}
                        </p>
                      )}
                      <h3 className="mt-1 font-medium text-ui-heading">
                        {TYPE_LABELS[request.type]}
                      </h3>
                      <p className="mt-1 text-sm text-ui-muted">
                        {dateRangeLabel(request)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex border px-2 py-1 text-xs font-medium ${STATUS_STYLES[request.status]}`}
                    >
                      {STATUS_LABELS[request.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="text-sm text-ui-muted">
                      {formatDays(request.requestedHalfDays)}
                    </span>
                    {renderActions(request)}
                  </div>
                  {request.reason && (
                    <p className="mt-3 text-sm text-ui-muted">
                      {request.reason}
                    </p>
                  )}
                  {request.reviewNote && (
                    <p className="mt-2 border-l-2 border-ui-accent pl-3 text-sm text-ui-muted">
                      {request.reviewNote}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {requestDialog && (
        <RequestDialog
          request={requestDialog === 'new' ? null : requestDialog}
          remainingHalfDays={remainingHalfDays}
          onClose={() => setRequestDialog(null)}
          onSave={saveRequest}
        />
      )}
      {reviewDialog && (
        <ReviewDialog
          request={reviewDialog.request}
          decision={reviewDialog.decision}
          onClose={() => setReviewDialog(null)}
          onReview={async (reviewNote) => {
            try {
              await action(`/requests/${reviewDialog.request.id}`, {
                action: 'review',
                decision: reviewDialog.decision,
                reviewNote,
              });
              toast.success(
                reviewDialog.decision === 'APPROVED'
                  ? 'Request approved.'
                  : 'Request declined.'
              );
              setReviewDialog(null);
            } catch (caught) {
              toast.error((caught as Error).message);
              throw caught;
            }
          }}
        />
      )}
      {policyDialog && (
        <PolicyDialog
          initial={policies}
          onClose={() => setPolicyDialog(false)}
          onSave={async (allowances) => {
            try {
              await action('/policies', { allowances });
              toast.success('Allowances updated.');
              setPolicyDialog(false);
            } catch (caught) {
              toast.error((caught as Error).message);
              throw caught;
            }
          }}
        />
      )}
      {cancelDialog && (
        <Dialog
          title="Cancel request"
          description={`${TYPE_LABELS[cancelDialog.type]} - ${dateRangeLabel(cancelDialog)}`}
          onClose={() => setCancelDialog(null)}
        >
          <p className="text-sm text-ui-muted">
            {t('cancel-request-confirmation')}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setCancelDialog(null)}
            >
              {t('keep-request')}
            </button>
            <button
              type="button"
              className="btn btn-error"
              onClick={async () => {
                try {
                  await action(`/requests/${cancelDialog.id}`, {
                    action: 'cancel',
                  });
                  toast.success('Request canceled.');
                  setCancelDialog(null);
                } catch (caught) {
                  toast.error((caught as Error).message);
                }
              }}
            >
              {t('cancel-request')}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default TimeOffWorkspace;
