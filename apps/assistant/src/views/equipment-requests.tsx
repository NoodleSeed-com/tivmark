import { useState } from 'react';
import {
  useCallTool,
  useLayout,
  useSendFollowUpMessage,
  useToolInfo,
} from '../helpers.js';
import {
  normalizeEquipmentRequests,
  type EquipmentRequestItem,
  type EquipmentRequestsViewState,
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

// Tivmark's API cancels a request while it is PENDING or APPROVED (fulfilled or declined
// requests keep their record); other rows show no cancel affordance.
const cancellable = (request: EquipmentRequestItem) =>
  request.status === 'PENDING' || request.status === 'APPROVED';

type EquipmentRequestsViewProps = {
  readonly theme: WidgetTheme;
  readonly state: EquipmentRequestsViewState;
  /** Absent (e.g. in a host without app tools) hides every cancel affordance. */
  readonly onCancel?: (id: string) => Promise<void>;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

export function EquipmentRequestsView({
  theme,
  state,
  onCancel,
  onFollowUp,
}: EquipmentRequestsViewProps) {
  const [confirming, setConfirming] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [canceled, setCanceled] = useState<Record<string, true>>({});
  const [feedback, setFeedback] = useState<{
    readonly kind: 'success' | 'error';
    readonly message: string;
  }>();

  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;

  async function cancel(request: EquipmentRequestItem) {
    if (!onCancel) return;
    setBusy(request.id);
    setFeedback(undefined);
    try {
      await onCancel(request.id);
      setCanceled((current) => ({ ...current, [request.id]: true }));
      setConfirming(undefined);
      setFeedback({
        kind: 'success',
        message: `Canceled ${request.quantity} × ${request.item}.`,
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
      title="Your equipment requests"
      subtitle={`Team ${data?.team ?? '—'}`}
      icon={<BoxIcon />}
      badge={
        data ? <span className="tv-chip">{data.pendingCount} pending</span> : null
      }
      dataLlm={
        data
          ? `Equipment requests for ${data.team}: ${data.requests.length} total, ${data.pendingCount} pending`
          : `Equipment requests: ${state.kind}`
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
                title={`${request.quantity} × ${request.item}`}
                meta={request.categoryLabel}
                detail={request.justification}
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
            {
              id: 'order',
              label: 'Request equipment',
              prompt: 'Request some equipment',
            },
            {
              id: 'time-off',
              label: 'Show my time off',
              prompt: 'Show me my time-off requests',
            },
          ]}
          onSend={onFollowUp}
        />
      ) : null}
    </WidgetFrame>
  );
}

export default function EquipmentRequests() {
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo();
  const cancelTool = useCallTool('cancel_equipment_app');
  const sendFollowUp = useSendFollowUpMessage();
  const pending = Object.keys(toolInfo).length === 0;
  const state = normalizeEquipmentRequests(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });
  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;
  const followUpsSupported = supports?.followUpMessage !== false;
  return (
    <EquipmentRequestsView
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

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}
