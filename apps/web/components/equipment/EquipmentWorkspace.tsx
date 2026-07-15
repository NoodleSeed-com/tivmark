import {
  CheckIcon,
  ClockIcon,
  ComputerDesktopIcon,
  PencilSquareIcon,
  PlusIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Loading } from '@/components/shared';
import { defaultHeaders } from '@/lib/common';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  MAX_EQUIPMENT_QUANTITY,
} from '@/lib/equipment';
import useEquipment from 'hooks/useEquipment';
import type {
  ApiResponse,
  EquipmentCategoryValue,
  EquipmentRequestData,
  EquipmentStatusValue,
} from 'types';

const STATUS_LABELS: Record<EquipmentStatusValue, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  FULFILLED: 'Fulfilled',
  CANCELED: 'Canceled',
};

const STATUS_STYLES: Record<EquipmentStatusValue, string> = {
  PENDING:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  APPROVED: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  DECLINED: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  FULFILLED:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  CANCELED: 'border-ui-border bg-ui-surface-muted text-ui-muted',
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));

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
  category: EquipmentCategoryValue;
  item: string;
  quantity: number;
  justification: string;
};

const RequestDialog = ({
  request,
  onClose,
  onSave,
}: {
  request: EquipmentRequestData | null;
  onClose: () => void;
  onSave: (values: RequestFormValue) => Promise<void>;
}) => {
  const { t } = useTranslation('common');
  const [values, setValues] = useState<RequestFormValue>({
    category: request?.category || 'LAPTOP',
    item: request?.item || '',
    quantity: request?.quantity || 1,
    justification: request?.justification || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.item.trim()) {
      setError('Describe the equipment you need.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...values, item: values.item.trim() });
    } catch (caught) {
      setError((caught as Error).message);
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={request ? 'Edit request' : 'Request equipment'}
      description={t('equipment-dialog-subtitle')}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ui-heading">
            {t('equipment-category')}
          </span>
          <select
            value={values.category}
            onChange={(event) =>
              setValues({
                ...values,
                category: event.target.value as EquipmentCategoryValue,
              })
            }
            className="select select-bordered w-full bg-ui-surface text-ui-text"
          >
            {EQUIPMENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {EQUIPMENT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ui-heading">
              {t('equipment-item')}
            </span>
            <input
              type="text"
              required
              maxLength={200}
              value={values.item}
              onChange={(event) =>
                setValues({ ...values, item: event.target.value })
              }
              className="input input-bordered w-full bg-ui-surface text-ui-text"
              placeholder='e.g. 16" MacBook Pro'
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ui-heading">
              {t('equipment-quantity')}
            </span>
            <input
              type="number"
              min={1}
              max={MAX_EQUIPMENT_QUANTITY}
              value={values.quantity}
              onChange={(event) =>
                setValues({
                  ...values,
                  quantity: Number(event.target.value),
                })
              }
              className="input input-bordered w-full bg-ui-surface text-ui-text"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ui-heading">
            {t('equipment-justification')}
          </span>
          <textarea
            value={values.justification}
            maxLength={500}
            rows={3}
            onChange={(event) =>
              setValues({ ...values, justification: event.target.value })
            }
            className="textarea textarea-bordered w-full bg-ui-surface text-ui-text"
            placeholder="Add any context your approver needs"
          />
        </label>

        {error && (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
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
  request: EquipmentRequestData;
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
      description={`${request.requester.name} requested ${request.quantity} × ${request.item}.`}
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

const EquipmentWorkspace = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { slug } = router.query as { slug?: string };
  const { workspace, isLoading, error, refresh } = useEquipment(slug);
  const [view, setView] = useState<'mine' | 'team'>('mine');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | EquipmentStatusValue
  >('ALL');
  const [categoryFilter, setCategoryFilter] = useState<
    'ALL' | EquipmentCategoryValue
  >('ALL');
  const [memberFilter, setMemberFilter] = useState('ALL');
  const [requestDialog, setRequestDialog] = useState<
    EquipmentRequestData | 'new' | null
  >(null);
  const [reviewDialog, setReviewDialog] = useState<{
    request: EquipmentRequestData;
    decision: 'APPROVED' | 'DECLINED';
  } | null>(null);
  const [cancelDialog, setCancelDialog] = useState<EquipmentRequestData | null>(
    null
  );

  const apiBase = slug
    ? `/api/v1/teams/${encodeURIComponent(slug)}/equipment`
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
      if (categoryFilter !== 'ALL' && request.category !== categoryFilter)
        return false;
      if (
        view === 'team' &&
        memberFilter !== 'ALL' &&
        request.requester.id !== memberFilter
      )
        return false;
      return true;
    });
  }, [categoryFilter, memberFilter, statusFilter, view, workspace]);

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

  const renderActions = (request: EquipmentRequestData) => {
    const isMine = request.requester.id === workspace.currentUserId;
    const canEdit =
      request.status === 'PENDING' && (isMine || workspace.canReview);
    const canCancel =
      ['PENDING', 'APPROVED'].includes(request.status) &&
      (isMine || workspace.canReview);

    return (
      <div className="flex justify-end gap-2">
        {workspace.canReview && request.status === 'PENDING' && (
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
        {workspace.canReview && request.status === 'APPROVED' && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={async () => {
              try {
                await action(`/requests/${request.id}`, { action: 'fulfill' });
                toast.success('Marked as fulfilled.');
              } catch (caught) {
                toast.error((caught as Error).message);
              }
            }}
          >
            <TruckIcon className="h-4 w-4" />
            {t('mark-fulfilled')}
          </button>
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
            <ComputerDesktopIcon className="h-5 w-5" />
            <span className="text-sm font-semibold">{t('equipment')}</span>
          </div>
          <h1 className="mt-2 font-serif text-3xl text-ui-heading">
            {t('equipment-heading')}
          </h1>
          <p className="mt-1 text-sm text-ui-muted">
            {t('equipment-subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setRequestDialog('new')}
          >
            <PlusIcon className="h-5 w-5" />
            {t('request-equipment')}
          </button>
        </div>
      </div>

      <section aria-labelledby="requests-heading">
        <div className="flex flex-col gap-4 border-b border-ui-border pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2
              id="requests-heading"
              className="font-serif text-xl text-ui-heading"
            >
              {t('requests')}
            </h2>
            {workspace.canReview && (
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
                    {option === 'mine' ? 'My requests' : 'Team requests'}
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
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as typeof categoryFilter)
              }
              className="select select-bordered select-sm bg-ui-surface text-ui-text"
              aria-label="Filter by category"
            >
              <option value="ALL">{t('all-categories')}</option>
              {EQUIPMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {EQUIPMENT_CATEGORY_LABELS[category]}
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
                    <th className="px-4 py-3 font-medium">
                      {t('equipment-item')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('equipment-category')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('equipment-quantity')}
                    </th>
                    <th className="px-4 py-3 font-medium">{t('requested')}</th>
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
                        <div>{request.item}</div>
                        {request.justification && (
                          <div
                            className="mt-1 max-w-xs truncate text-xs text-ui-muted"
                            title={request.justification}
                          >
                            {request.justification}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-ui-muted">
                        {EQUIPMENT_CATEGORY_LABELS[request.category]}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-ui-muted">
                        {request.quantity}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-ui-muted">
                        {formatDate(request.createdAt)}
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
                        {request.quantity} × {request.item}
                      </h3>
                      <p className="mt-1 text-sm text-ui-muted">
                        {EQUIPMENT_CATEGORY_LABELS[request.category]}
                      </p>
                    </div>
                    <span
                      className={`inline-flex border px-2 py-1 text-xs font-medium ${STATUS_STYLES[request.status]}`}
                    >
                      {STATUS_LABELS[request.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-4">
                    {renderActions(request)}
                  </div>
                  {request.justification && (
                    <p className="mt-3 text-sm text-ui-muted">
                      {request.justification}
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
      {cancelDialog && (
        <Dialog
          title="Cancel request"
          description={`${cancelDialog.quantity} × ${cancelDialog.item}`}
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

export default EquipmentWorkspace;
