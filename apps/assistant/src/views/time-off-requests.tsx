import { useState } from 'react';
import {
  useCallTool,
  useLayout,
  useSendFollowUpMessage,
  useToolInfo,
} from '../helpers.js';
import {
  formatDateRange,
  formatHalfDays,
  normalizeTimeOffRequests,
  type TimeOffRequestItem,
  type TimeOffRequestsViewState,
} from './widget-data.js';
import {
  FollowUpChips,
  RequestRow,
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

// Tivmark's API cancels a request while it is PENDING or APPROVED; anything else has no
// cancel affordance, so the row shows none.
const cancellable = (request: TimeOffRequestItem) =>
  request.status === 'PENDING' || request.status === 'APPROVED';

type TimeOffRequestsViewProps = {
  readonly theme: WidgetTheme;
  readonly state: TimeOffRequestsViewState;
  /** Absent (e.g. in a host without app tools) hides every cancel affordance. */
  readonly onCancel?: (id: string) => Promise<void>;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

export function TimeOffRequestsView({
  theme,
  state,
  onCancel,
  onFollowUp,
}: TimeOffRequestsViewProps) {
  // Row id whose inline confirm strip is open; only one at a time.
  const [confirming, setConfirming] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [canceled, setCanceled] = useState<Record<string, true>>({});
  const [feedback, setFeedback] = useState<{
    readonly kind: 'success' | 'error';
    readonly message: string;
  }>();

  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;

  async function cancel(request: TimeOffRequestItem) {
    if (!onCancel) return;
    setBusy(request.id);
    setFeedback(undefined);
    try {
      await onCancel(request.id);
      setCanceled((current) => ({ ...current, [request.id]: true }));
      setConfirming(undefined);
      setFeedback({
        kind: 'success',
        message: `Canceled ${request.typeLabel.toLowerCase()} ${formatDateRange(
          request.startDate,
          request.endDate
        )}.`,
      });
    } catch {
      setFeedback({
        kind: 'error',
        message: "Couldn't cancel that request. Try again.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <WidgetFrame
      theme={theme}
      title="Your time-off requests"
      subtitle={`Team ${data?.team ?? '—'}`}
      icon={<ListIcon />}
      badge={
        data ? <span className="tv-chip">{data.pendingCount} pending</span> : null
      }
      dataLlm={
        data
          ? `Time-off requests for ${data.team}: ${data.requests.length} total, ${data.pendingCount} pending`
          : `Time-off requests: ${state.kind}`
      }
    >
      {state.kind === 'loading' ? (
        <WidgetFeedback kind="loading">Loading your requests…</WidgetFeedback>
      ) : null}
      {state.kind === 'error' ? (
        <WidgetFeedback kind="error">{state.message}</WidgetFeedback>
      ) : null}
      {state.kind === 'empty' ? (
        <WidgetFeedback kind="empty">{state.message}</WidgetFeedback>
      ) : null}
      {state.kind === 'partial' ? (
        <WidgetFeedback kind="partial">{state.message}</WidgetFeedback>
      ) : null}
      {data ? (
        <ul className="tv-list">
          {data.requests.map((request) => {
            const isCanceled = canceled[request.id] === true;
            const rowBusy = busy === request.id;
            const showCancel =
              !isCanceled && cancellable(request) && onCancel !== undefined;
            return (
              <RequestRow
                key={request.id}
                title={`${request.typeLabel} · ${formatDateRange(
                  request.startDate,
                  request.endDate
                )}`}
                meta={
                  request.requestedHalfDays === undefined
                    ? undefined
                    : formatHalfDays(request.requestedHalfDays)
                }
                detail={request.reason}
                status={isCanceled ? 'CANCELED' : request.status}
                statusLabel={isCanceled ? 'Canceled' : request.statusLabel}
                actions={
                  showCancel ? (
                    confirming === request.id ? (
                      <span className="tv-confirm">
                        Cancel this request?
                        <WidgetAction
                          tone="danger"
                          pending={rowBusy}
                          pendingLabel="Canceling…"
                          onClick={() => void cancel(request)}
                        >
                          Yes, cancel
                        </WidgetAction>
                        <WidgetAction
                          tone="quiet"
                          disabled={rowBusy}
                          onClick={() => setConfirming(undefined)}
                        >
                          Keep
                        </WidgetAction>
                      </span>
                    ) : (
                      <WidgetAction
                        tone="quiet"
                        disabled={busy !== undefined}
                        onClick={() => setConfirming(request.id)}
                      >
                        Cancel
                      </WidgetAction>
                    )
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      ) : null}
      {feedback ? (
        <div className="tv-action-feedback">
          <WidgetFeedback kind={feedback.kind}>{feedback.message}</WidgetFeedback>
        </div>
      ) : null}
      {onFollowUp ? (
        <FollowUpChips
          chips={[
            { id: 'book', label: 'Book time off', prompt: 'Book time off' },
            {
              id: 'balance',
              label: 'Check my balance',
              prompt: 'Show me my time-off balance',
            },
          ]}
          onSend={onFollowUp}
        />
      ) : null}
    </WidgetFrame>
  );
}

export default function TimeOffRequests() {
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo();
  const cancelTool = useCallTool('cancel_time_off_app');
  const sendFollowUp = useSendFollowUpMessage();
  const pending = Object.keys(toolInfo).length === 0;
  const state = normalizeTimeOffRequests(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });
  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;
  // Hide chips only when the host says follow-ups are unsupported; the embedded
  // assistant leaves `supports` unset and does support them.
  const followUpsSupported = supports?.followUpMessage !== false;
  return (
    <TimeOffRequestsView
      theme={theme}
      state={state}
      onCancel={async (id) => {
        await cancelTool.callTool({ team: data?.team ?? '', id });
      }}
      onFollowUp={
        followUpsSupported
          ? (prompt) => sendFollowUp({ prompt })
          : undefined
      }
    />
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
