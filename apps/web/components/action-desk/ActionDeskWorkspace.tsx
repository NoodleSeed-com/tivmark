/* eslint-disable i18next/no-literal-string -- The showcase launches in the repository's only configured locale; localization follows the validated demo contract. */
import {
  ArrowPathIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Loading } from '@/components/shared';
import { openAssistant } from '@/components/shared/shell/assistantSurface';
import { defaultHeaders } from '@/lib/common';
import useActionDesk from 'hooks/useActionDesk';
import type {
  ActionServiceData,
  ApiResponse,
  ServiceAudienceValue,
  ServiceRequestData,
  ServiceRequestPriorityValue,
  ServiceRequestStatusValue,
} from 'types';

const STATUS_LABELS: Record<ServiceRequestStatusValue, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_REQUESTER: 'Waiting on requester',
  RESOLVED: 'Resolved',
  CANCELED: 'Canceled',
};

const STATUS_STYLES: Record<ServiceRequestStatusValue, string> = {
  OPEN: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  IN_PROGRESS: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  WAITING_ON_REQUESTER:
    'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  RESOLVED:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  CANCELED: 'border-ui-border bg-ui-surface-muted text-ui-muted',
};

const AUDIENCE_LABELS: Record<ServiceAudienceValue, string> = {
  PUBLIC: 'Anyone',
  CUSTOMER: 'Customers',
  EMPLOYEE: 'Employees',
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiResponse<T> & {
    detail?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error?.message || payload.detail || 'Request failed'
    );
  }
  return payload.data;
}

const ServiceCard = ({
  service,
  selected,
  onSelect,
}: {
  service: ActionServiceData;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`group flex h-full w-full flex-col border p-4 text-left transition-colors ${
      selected
        ? 'border-ui-accent bg-ui-accent/5'
        : 'border-ui-border bg-ui-surface hover:border-ui-accent/60'
    }`}
  >
    <div className="flex w-full items-start justify-between gap-3">
      <ChatBubbleLeftRightIcon className="h-6 w-6 text-ui-accent" />
      <span className="border border-ui-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
        {AUDIENCE_LABELS[service.audience]}
      </span>
    </div>
    <h3 className="mt-4 font-serif text-lg text-ui-heading">{service.name}</h3>
    <p className="mt-1 flex-1 text-sm leading-6 text-ui-muted">
      {service.description}
    </p>
    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-ui-text">
      <ClockIcon className="h-4 w-4" />
      {service.slaHours
        ? `Response target: ${service.slaHours}h`
        : 'Response target varies'}
      {service.requiresApproval && <span>· approval</span>}
    </div>
  </button>
);

const RequestCard = ({
  request,
  canManage,
  onTransition,
}: {
  request: ServiceRequestData;
  canManage: boolean;
  onTransition: (
    request: ServiceRequestData,
    status: ServiceRequestStatusValue
  ) => void;
}) => (
  <article className="border border-ui-border bg-ui-surface p-4 sm:p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[request.status]}`}
          >
            {STATUS_LABELS[request.status]}
          </span>
          <span className="text-xs uppercase tracking-wide text-ui-muted">
            {request.priority} priority · {request.service.name}
          </span>
        </div>
        <h3 className="mt-3 font-serif text-lg text-ui-heading">
          {request.subject}
        </h3>
        <p className="mt-1 text-sm leading-6 text-ui-muted">
          {request.description}
        </p>
      </div>
      <div className="shrink-0 text-left text-xs text-ui-muted sm:text-right">
        <div>{request.requester.name || request.requester.email}</div>
        <div>{formatDate(request.createdAt)}</div>
        <div className="font-mono">#{request.id.slice(0, 8)}</div>
      </div>
    </div>
    {request.resolution && (
      <div className="mt-4 border-l-2 border-emerald-500 bg-emerald-500/5 px-3 py-2 text-sm text-ui-text">
        <strong>Resolution:</strong> {request.resolution}
      </div>
    )}
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-medium text-ui-heading">
        Activity ({request.events.length})
      </summary>
      <ol className="mt-3 space-y-2 border-l border-ui-border pl-4 text-ui-muted">
        {request.events.map((event) => (
          <li key={event.id}>
            <span className="text-ui-text">{event.message}</span>{' '}
            <span className="text-xs">{formatDate(event.createdAt)}</span>
          </li>
        ))}
      </ol>
    </details>
    {canManage && request.status !== 'CANCELED' && (
      <div className="mt-4 flex flex-wrap gap-2 border-t border-ui-border pt-4">
        {request.status !== 'IN_PROGRESS' && request.status !== 'RESOLVED' && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onTransition(request, 'IN_PROGRESS')}
          >
            Start work
          </button>
        )}
        {request.status !== 'WAITING_ON_REQUESTER' &&
          request.status !== 'RESOLVED' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onTransition(request, 'WAITING_ON_REQUESTER')}
            >
              Ask requester
            </button>
          )}
        {request.status !== 'RESOLVED' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onTransition(request, 'RESOLVED')}
          >
            <CheckCircleIcon className="h-4 w-4" /> Resolve
          </button>
        )}
        {request.status === 'RESOLVED' && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onTransition(request, 'IN_PROGRESS')}
          >
            Reopen
          </button>
        )}
      </div>
    )}
  </article>
);

const ActionDeskWorkspace = () => {
  const router = useRouter();
  const { slug } = router.query as { slug?: string };
  const { workspace, error, isLoading, refresh } = useActionDesk(slug);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] =
    useState<ServiceRequestPriorityValue>('NORMAL');
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<'mine' | 'team'>('mine');
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    audience: 'CUSTOMER' as ServiceAudienceValue,
    slaHours: 24,
  });

  const activeServices = useMemo(
    () => workspace?.services.filter((service) => service.active) || [],
    [workspace]
  );
  useEffect(() => {
    if (!selectedServiceId && activeServices[0])
      setSelectedServiceId(activeServices[0].id);
  }, [activeServices, selectedServiceId]);

  const requests = useMemo(() => {
    if (!workspace) return [];
    return workspace.requests.filter(
      (request) =>
        view === 'team' || request.requester.id === workspace.currentUserId
    );
  }, [view, workspace]);

  if (isLoading || !slug) return <Loading />;
  if (error || !workspace)
    return (
      <div className="p-8 text-red-700 dark:text-red-300">
        Could not load Action Desk. Please refresh and try again.
      </div>
    );

  const baseUrl = `/api/v1/teams/${encodeURIComponent(slug)}/action-desk`;

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api(`${baseUrl}/requests`, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({
          serviceId: selectedServiceId,
          subject,
          description,
          priority,
          source: 'WEB',
        }),
      });
      setSubject('');
      setDescription('');
      setPriority('NORMAL');
      await refresh();
      toast.success('Request sent to the Action Desk.');
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const transition = async (
    request: ServiceRequestData,
    status: ServiceRequestStatusValue
  ) => {
    const note =
      status === 'RESOLVED'
        ? window.prompt('What was the outcome? (optional)')
        : null;
    if (status === 'RESOLVED' && note === null) return;
    try {
      await api(`${baseUrl}/requests/${request.id}`, {
        method: 'PATCH',
        headers: defaultHeaders,
        body: JSON.stringify({ status, note }),
      });
      await refresh();
      toast.success(`Request moved to ${STATUS_LABELS[status].toLowerCase()}.`);
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  };

  const createService = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api(`${baseUrl}/services`, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({
          ...newService,
          requiresApproval: false,
        }),
      });
      setNewService({
        name: '',
        description: '',
        audience: 'CUSTOMER',
        slaHours: 24,
      });
      await refresh();
      toast.success('Service added to the catalog.');
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  };

  const toggleService = async (service: ActionServiceData) => {
    try {
      await api(`${baseUrl}/services/${service.id}`, {
        method: 'PATCH',
        headers: defaultHeaders,
        body: JSON.stringify({ ...service, active: !service.active }),
      });
      await refresh();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border border-ui-border bg-ui-surface p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-ui-accent">
              <BoltIcon className="h-5 w-5" /> Tivmark Action Desk
            </div>
            <h1 className="mt-3 font-serif text-3xl text-ui-heading sm:text-4xl">
              Tell us what you need. Track what happens next.
            </h1>
            <p className="mt-3 max-w-3xl text-ui-muted">
              One front door for customer questions, sales conversations,
              employee access, and every request your business handles.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openAssistant()}
          >
            <SparklesIcon className="h-5 w-5" /> Ask Mark instead
          </button>
        </div>
      </header>

      <section aria-labelledby="services-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2
              id="services-heading"
              className="font-serif text-2xl text-ui-heading"
            >
              Choose a service
            </h2>
            <p className="mt-1 text-sm text-ui-muted">
              Mark can also match your need to the best option conversationally.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => refresh()}
          >
            <ArrowPathIcon className="h-4 w-4" /> Refresh
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {activeServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              selected={service.id === selectedServiceId}
              onSelect={() => setSelectedServiceId(service.id)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          onSubmit={submitRequest}
          className="border border-ui-border bg-ui-surface p-5 sm:p-6"
        >
          <h2 className="font-serif text-2xl text-ui-heading">
            Start a request
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_10rem]">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ui-heading">
                What do you need?
              </span>
              <input
                required
                maxLength={160}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="input input-bordered w-full bg-ui-surface text-ui-text"
                placeholder="A short, specific summary"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ui-heading">
                Priority
              </span>
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as ServiceRequestPriorityValue)
                }
                className="select select-bordered w-full bg-ui-surface text-ui-text"
              >
                {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-ui-heading">
              Helpful context
            </span>
            <textarea
              required
              maxLength={2000}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="textarea textarea-bordered w-full bg-ui-surface text-ui-text"
              placeholder="Include the desired outcome, what you have tried, or any deadline."
            />
          </label>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !selectedServiceId}
            >
              {submitting ? 'Sending...' : 'Send request'}
            </button>
          </div>
        </form>
        <aside className="border border-ui-border bg-ui-surface-muted p-5">
          <SparklesIcon className="h-7 w-7 text-ui-accent" />
          <h2 className="mt-4 font-serif text-xl text-ui-heading">
            The same workflow, powered by AI
          </h2>
          <ol className="mt-4 space-y-4 text-sm text-ui-muted">
            <li>
              <strong className="text-ui-heading">1.</strong> Explain the need
              naturally.
            </li>
            <li>
              <strong className="text-ui-heading">2.</strong> Mark finds the
              right live service.
            </li>
            <li>
              <strong className="text-ui-heading">3.</strong> Review and confirm
              the request.
            </li>
            <li>
              <strong className="text-ui-heading">4.</strong> Return anytime for
              grounded status.
            </li>
          </ol>
        </aside>
      </section>

      <section aria-labelledby="requests-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="requests-heading"
              className="font-serif text-2xl text-ui-heading"
            >
              Request activity
            </h2>
            <p className="mt-1 text-sm text-ui-muted">
              Every update is reflected here and in Mark.
            </p>
          </div>
          {workspace.canManage && (
            <div className="join">
              <button
                type="button"
                className={`btn btn-sm join-item ${view === 'mine' ? 'btn-active' : ''}`}
                onClick={() => setView('mine')}
              >
                Mine
              </button>
              <button
                type="button"
                className={`btn btn-sm join-item ${view === 'team' ? 'btn-active' : ''}`}
                onClick={() => setView('team')}
              >
                <UserGroupIcon className="h-4 w-4" /> Team queue
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4">
          {requests.length ? (
            requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                canManage={workspace.canManage && view === 'team'}
                onTransition={transition}
              />
            ))
          ) : (
            <div className="border border-dashed border-ui-border p-10 text-center text-ui-muted">
              No requests in this view yet.
            </div>
          )}
        </div>
      </section>

      {workspace.canManage && (
        <section className="border border-ui-border bg-ui-surface p-5 sm:p-6">
          <h2 className="font-serif text-2xl text-ui-heading">
            Configure the catalog
          </h2>
          <p className="mt-1 text-sm text-ui-muted">
            This is what makes the Action Desk reusable for any business.
          </p>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              {workspace.services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between gap-3 border border-ui-border px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-ui-heading">
                      {service.name}
                    </div>
                    <div className="text-xs text-ui-muted">
                      {AUDIENCE_LABELS[service.audience]} ·{' '}
                      {service.slaHours || 'No'}h target
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => toggleService(service)}
                  >
                    {service.active ? 'Pause' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={createService} className="space-y-3">
              <h3 className="font-medium text-ui-heading">
                Add a business service
              </h3>
              <input
                required
                maxLength={100}
                value={newService.name}
                onChange={(event) =>
                  setNewService({ ...newService, name: event.target.value })
                }
                className="input input-bordered w-full bg-ui-surface text-ui-text"
                placeholder="Returns and exchanges"
              />
              <textarea
                required
                maxLength={500}
                rows={3}
                value={newService.description}
                onChange={(event) =>
                  setNewService({
                    ...newService,
                    description: event.target.value,
                  })
                }
                className="textarea textarea-bordered w-full bg-ui-surface text-ui-text"
                placeholder="Describe when someone should use this service."
              />
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <select
                  value={newService.audience}
                  onChange={(event) =>
                    setNewService({
                      ...newService,
                      audience: event.target.value as ServiceAudienceValue,
                    })
                  }
                  className="select select-bordered w-full bg-ui-surface text-ui-text"
                >
                  <option value="PUBLIC">Anyone</option>
                  <option value="CUSTOMER">Customers</option>
                  <option value="EMPLOYEE">Employees</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={newService.slaHours}
                  onChange={(event) =>
                    setNewService({
                      ...newService,
                      slaHours: Number(event.target.value),
                    })
                  }
                  className="input input-bordered w-full bg-ui-surface text-ui-text"
                  aria-label="Response target in hours"
                />
              </div>
              <button type="submit" className="btn btn-outline">
                <PlusIcon className="h-4 w-4" /> Add service
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
};

export default ActionDeskWorkspace;
