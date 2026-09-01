import { useState } from 'react';
import { useCallTool, useLayout, useToolInfo } from '../helpers.js';
import {
  normalizeServiceRequests,
  type ServiceRequestItem,
} from './widget-data.js';
import {
  RequestRow,
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
} from './widget-ui.js';
import './widget-style.css';

type NextStatus = 'IN_PROGRESS' | 'WAITING_ON_REQUESTER' | 'RESOLVED';

export default function ServiceRequestQueue() {
  const { theme } = useLayout();
  const info = useToolInfo('team_service_request_queue');
  const state = normalizeServiceRequests(info.structuredContent, {
    pending: Object.keys(info).length === 0,
    error: info.isError,
  });
  const update = useCallTool('review_service_request_app');
  const [confirming, setConfirming] = useState<{
    id: string;
    status: NextStatus;
  }>();
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState<Record<string, NextStatus>>({});
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  }>();
  const data = state.kind === 'ready' ? state.data : undefined;
  const requests = (data?.requests ?? []).filter(
    (request) => !resolved[request.id] && request.status !== 'CANCELED'
  );

  async function apply(request: ServiceRequestItem, status: NextStatus) {
    setBusy(true);
    setFeedback(undefined);
    try {
      await update.callTool({
        team: data?.team ?? '',
        id: request.id,
        status,
        note: '',
      });
      setResolved((current) => ({ ...current, [request.id]: status }));
      setConfirming(undefined);
      setFeedback({
        kind: 'success',
        message: `Updated “${request.subject}” to ${status.toLowerCase().replaceAll('_', ' ')}.`,
      });
    } catch {
      setFeedback({
        kind: 'error',
        message: `Could not update “${request.subject}”. Please try again.`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <WidgetFrame
      theme={theme}
      title="Action Desk queue"
      subtitle={`Team ${data?.team ?? '—'} · manager view`}
      icon={<QueueIcon />}
      badge={
        data ? <span className="tv-chip">{data.activeCount} active</span> : null
      }
      dataLlm={
        data
          ? `${data.activeCount} active Action Desk requests for ${data.team}`
          : state.kind
      }
    >
      {state.kind === 'loading' ? (
        <WidgetFeedback kind="loading">Loading the queue…</WidgetFeedback>
      ) : null}
      {state.kind === 'error' ? (
        <WidgetFeedback kind="error">{state.message}</WidgetFeedback>
      ) : null}
      {state.kind === 'empty' || (data && !requests.length) ? (
        <WidgetFeedback kind="empty">
          No requests need attention.
        </WidgetFeedback>
      ) : null}
      {requests.length ? (
        <ul className="tv-list">
          {requests.map((request) => {
            const choice =
              confirming?.id === request.id ? confirming.status : undefined;
            return (
              <RequestRow
                key={request.id}
                title={request.subject}
                meta={`${request.requesterName ?? 'Requester'} · ${request.serviceName} · ${request.priority.toLowerCase()}`}
                detail={request.description}
                status={request.status}
                actions={
                  choice ? (
                    <span className="tv-confirm">
                      Confirm {choice.toLowerCase().replaceAll('_', ' ')}?
                      <WidgetAction
                        tone={choice === 'RESOLVED' ? 'success' : 'primary'}
                        pending={busy}
                        pendingLabel="Updating…"
                        onClick={() => void apply(request, choice)}
                      >
                        Confirm
                      </WidgetAction>
                      <WidgetAction
                        tone="quiet"
                        disabled={busy}
                        onClick={() => setConfirming(undefined)}
                      >
                        Keep
                      </WidgetAction>
                    </span>
                  ) : (
                    <>
                      {request.status !== 'IN_PROGRESS' ? (
                        <WidgetAction
                          tone="quiet"
                          onClick={() =>
                            setConfirming({
                              id: request.id,
                              status: 'IN_PROGRESS',
                            })
                          }
                        >
                          Start
                        </WidgetAction>
                      ) : null}
                      {request.status !== 'RESOLVED' ? (
                        <WidgetAction
                          tone="success"
                          onClick={() =>
                            setConfirming({
                              id: request.id,
                              status: 'RESOLVED',
                            })
                          }
                        >
                          Resolve
                        </WidgetAction>
                      ) : null}
                    </>
                  )
                }
              />
            );
          })}
        </ul>
      ) : null}
      {feedback ? (
        <div className="tv-action-feedback">
          <WidgetFeedback kind={feedback.kind}>
            {feedback.message}
          </WidgetFeedback>
        </div>
      ) : null}
    </WidgetFrame>
  );
}

function QueueIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h14M5 12h14M5 18h9" />
      <circle cx="3" cy="6" r=".5" />
      <circle cx="3" cy="12" r=".5" />
      <circle cx="3" cy="18" r=".5" />
    </svg>
  );
}
