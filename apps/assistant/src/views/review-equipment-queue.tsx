import { useState } from 'react';
import { useCallTool, useLayout, useToolInfo } from '../helpers.js';
import {
  normalizeEquipmentRequests,
  type EquipmentRequestItem,
  type EquipmentRequestsViewState,
} from './widget-data.js';
import {
  RequestRow,
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

type Decision = 'APPROVED' | 'DECLINED';

type ReviewEquipmentQueueViewProps = {
  readonly theme: WidgetTheme;
  readonly state: EquipmentRequestsViewState;
  readonly onDecision: (id: string, decision: Decision) => Promise<void>;
};

export function ReviewEquipmentQueueView({
  theme,
  state,
  onDecision,
}: ReviewEquipmentQueueViewProps) {
  const [resolved, setResolved] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState<Record<string, Decision>>({});
  const [feedback, setFeedback] = useState<{
    readonly kind: 'success' | 'error';
    readonly message: string;
  }>();

  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;
  const requests = (data?.requests ?? []).filter(
    (request) => !resolved[request.id]
  );

  async function decide(request: EquipmentRequestItem, decision: Decision) {
    setBusy((current) => ({ ...current, [request.id]: decision }));
    setFeedback(undefined);
    try {
      await onDecision(request.id, decision);
      setResolved((current) => ({ ...current, [request.id]: decision }));
      setFeedback({
        kind: 'success',
        message: `${decision === 'APPROVED' ? 'Approved' : 'Declined'} ${
          request.item
        }.`,
      });
    } catch {
      setFeedback({
        kind: 'error',
        message: "Couldn't apply the decision. Try again.",
      });
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
    }
  }

  return (
    <WidgetFrame
      theme={theme}
      title="Equipment approvals"
      subtitle={`Team ${data?.team ?? '—'} · pending review`}
      icon={<BoxIcon />}
      badge={
        data ? <span className="tv-chip">{requests.length} pending</span> : null
      }
      dataLlm={`Equipment review queue: ${requests.length} pending`}
    >
      {state.kind === 'loading' ? (
        <WidgetFeedback kind="loading">
          Loading the review queue…
        </WidgetFeedback>
      ) : null}
      {state.kind === 'error' ? (
        <WidgetFeedback kind="error">{state.message}</WidgetFeedback>
      ) : null}
      {state.kind === 'partial' ? (
        <WidgetFeedback kind="partial">{state.message}</WidgetFeedback>
      ) : null}
      {state.kind === 'empty' || (data && requests.length === 0) ? (
        <WidgetFeedback kind="empty">
          Nothing awaiting review. You're all caught up.
        </WidgetFeedback>
      ) : null}
      {requests.length > 0 ? (
        <ul className="tv-list">
          {requests.map((request) => {
            const rowDecision = busy[request.id];
            const rowBusy = rowDecision !== undefined;
            return (
              <RequestRow
                key={request.id}
                title={request.requesterName ?? 'Teammate'}
                meta={`${request.quantity}× ${request.item} · ${request.categoryLabel}`}
                detail={request.justification}
                actions={
                  <>
                    <WidgetAction
                      tone="success"
                      pending={rowDecision === 'APPROVED'}
                      pendingLabel="Approving…"
                      disabled={rowBusy}
                      onClick={() => void decide(request, 'APPROVED')}
                    >
                      Approve
                    </WidgetAction>
                    <WidgetAction
                      tone="danger"
                      pending={rowDecision === 'DECLINED'}
                      pendingLabel="Declining…"
                      disabled={rowBusy}
                      onClick={() => void decide(request, 'DECLINED')}
                    >
                      Decline
                    </WidgetAction>
                  </>
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

export default function ReviewEquipmentQueue() {
  const { theme } = useLayout();
  const toolInfo = useToolInfo('team_equipment_queue');
  const pending = Object.keys(toolInfo).length === 0;
  const state = normalizeEquipmentRequests(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });
  const review = useCallTool('review_equipment_app');
  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;

  return (
    <ReviewEquipmentQueueView
      theme={theme}
      state={state}
      onDecision={async (id, decision) => {
        await review.callTool({ team: data?.team ?? '', id, decision });
      }}
    />
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z" />
      <path d="M3 8.5 12 13l9-4.5M12 13v7" />
    </svg>
  );
}
