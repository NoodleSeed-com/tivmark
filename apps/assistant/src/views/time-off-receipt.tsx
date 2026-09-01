import { useEffect, useState } from 'react';
import {
  useCallTool,
  useLayout,
  useSendFollowUpMessage,
  useToolInfo,
  useUpdateModelContext,
  useViewState,
  useWidgetLifecycle,
  useWidgetReady,
} from '../helpers.js';
import {
  formatDateRange,
  formatHalfDays,
  normalizeBookingReceipt,
  type BookingReceiptViewState,
} from './widget-data.js';
import {
  FollowUpChips,
  StatusBadge,
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

type TimeOffReceiptViewProps = {
  readonly theme: WidgetTheme;
  readonly state: BookingReceiptViewState;
  readonly canceled?: boolean;
  readonly actionReady?: boolean;
  readonly onCancel?: (id: string) => Promise<void>;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

export function TimeOffReceiptView({
  theme,
  state,
  canceled = false,
  actionReady = true,
  onCancel,
  onFollowUp,
}: TimeOffReceiptViewProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localCanceled, setLocalCanceled] = useState(false);
  const [failure, setFailure] = useState<string>();
  const data = state.kind === 'ready' ? state.data : undefined;
  const isCanceled = canceled || localCanceled;

  async function cancel() {
    if (!data || !onCancel) return;
    setBusy(true);
    setFailure(undefined);
    try {
      await onCancel(data.receipt.requestId);
      setLocalCanceled(true);
      setConfirming(false);
    } catch {
      setFailure("Couldn't cancel that request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WidgetFrame
      theme={theme}
      title={isCanceled ? 'Request canceled' : 'Request submitted'}
      subtitle={
        data
          ? `${formatDateRange(data.receipt.startDate, data.receipt.endDate)} · Team ${data.team}`
          : 'Authenticated Tivmark action'
      }
      icon={<ReceiptIcon />}
      badge={
        data ? (
          <StatusBadge
            status={isCanceled ? 'CANCELED' : data.receipt.status}
            label={isCanceled ? 'Canceled' : 'Pending'}
          />
        ) : undefined
      }
      dataLlm={
        data
          ? `Time-off request ${data.receipt.requestId}: ${isCanceled ? 'canceled' : data.receipt.status}, ${data.receipt.type} ${data.receipt.startDate} to ${data.receipt.endDate}`
          : `Time-off receipt: ${state.kind}`
      }
    >
      {state.kind === 'loading' ? (
        <WidgetFeedback kind="loading">Loading your receipt…</WidgetFeedback>
      ) : null}
      {state.kind === 'error' ? (
        <WidgetFeedback kind="error">{state.message}</WidgetFeedback>
      ) : null}
      {data ? (
        <>
          <WidgetFeedback kind="success">
            {isCanceled
              ? 'The pending request was canceled through your authenticated Tivmark account.'
              : 'Tivmark created a pending request after your confirmation.'}
          </WidgetFeedback>
          <dl className="tv-facts tv-receipt-facts">
            <div>
              <dt>Request</dt>
              <dd>
                {data.receipt.type.charAt(0) +
                  data.receipt.type.slice(1).toLowerCase()}{' '}
                · {formatHalfDays(data.receipt.requestedHalfDays)}
              </dd>
            </div>
            <div>
              <dt>After pending time</dt>
              <dd>
                {data.receipt.remainingAfterPendingHalfDays === null
                  ? 'Unlimited'
                  : formatHalfDays(data.receipt.remainingAfterPendingHalfDays)}
              </dd>
            </div>
            <div className="tv-fact-wide">
              <dt>Request ID</dt>
              <dd className="tv-mono">{data.receipt.requestId}</dd>
            </div>
          </dl>
          <p className="tv-trust-line">
            <span aria-hidden="true">✓</span>
            Verified identity · delegated authorization · confirmed write
          </p>
          {!isCanceled && onCancel ? (
            <div className="tv-receipt-actions">
              {confirming ? (
                <div className="tv-confirm">
                  Cancel this pending request?
                  <WidgetAction
                    tone="danger"
                    pending={busy}
                    pendingLabel="Canceling…"
                    disabled={!actionReady}
                    onClick={() => void cancel()}
                  >
                    Yes, cancel
                  </WidgetAction>
                  <WidgetAction
                    tone="quiet"
                    disabled={busy}
                    onClick={() => setConfirming(false)}
                  >
                    Keep
                  </WidgetAction>
                </div>
              ) : (
                <WidgetAction
                  tone="quiet"
                  disabled={!actionReady}
                  onClick={() => setConfirming(true)}
                >
                  Cancel request
                </WidgetAction>
              )}
            </div>
          ) : null}
          {failure ? (
            <div className="tv-action-feedback">
              <WidgetFeedback kind="error">{failure}</WidgetFeedback>
            </div>
          ) : null}
          {onFollowUp ? (
            <FollowUpChips
              chips={[
                {
                  id: 'requests',
                  label: 'Show all requests',
                  prompt: 'Show me my time-off requests',
                },
              ]}
              onSend={onFollowUp}
            />
          ) : null}
        </>
      ) : null}
    </WidgetFrame>
  );
}

export default function TimeOffReceipt() {
  const ready = useWidgetReady();
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo('book_time_off');
  const cancelTool = useCallTool('cancel_time_off_app');
  const sendFollowUp = useSendFollowUpMessage();
  const updateModelContext = useUpdateModelContext();
  const publishLifecycle = useWidgetLifecycle('time-off-receipt');
  const [canceled, setCanceled] = useViewState('canceled', false);
  const [receiptPublished, setReceiptPublished] = useViewState(
    'receipt_published',
    false
  );
  const pending = !ready || Object.keys(toolInfo).length === 0;
  const state = normalizeBookingReceipt(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });
  const data = state.kind === 'ready' ? state.data : undefined;

  useEffect(() => {
    if (!data || receiptPublished) return;
    const snapshot = {
      team: data.team,
      requestId: data.receipt.requestId,
      type: data.receipt.type,
      startDate: data.receipt.startDate,
      endDate: data.receipt.endDate,
      status: data.receipt.status,
      remainingAfterPendingHalfDays:
        data.receipt.remainingAfterPendingHalfDays,
    };
    if (supports?.modelContext === true) {
      void updateModelContext({
        content: [
          {
            type: 'text',
            text: `Submitted pending ${data.receipt.type} request ${data.receipt.requestId} for ${data.receipt.startDate} to ${data.receipt.endDate}.`,
          },
        ],
        structuredContent: {
          widget: { name: 'time-off-receipt', lifecycle: 'submitted' },
          request: snapshot,
        },
      });
    }
    void publishLifecycle('submitted', snapshot);
    setReceiptPublished(true);
  }, [
    data,
    publishLifecycle,
    receiptPublished,
    setReceiptPublished,
    supports?.modelContext,
    updateModelContext,
  ]);

  return (
    <TimeOffReceiptView
      theme={theme}
      state={state}
      canceled={canceled}
      actionReady={ready}
      onCancel={
        data
          ? async (id) => {
              await cancelTool.callTool({ team: data.team, id });
              setCanceled(true);
              const snapshot = {
                team: data.team,
                requestId: id,
                type: data.receipt.type,
                startDate: data.receipt.startDate,
                endDate: data.receipt.endDate,
                status: 'CANCELED',
              };
              if (supports?.modelContext === true) {
                await updateModelContext({
                  content: [
                    {
                      type: 'text',
                      text: `Canceled time-off request ${id}.`,
                    },
                  ],
                  structuredContent: {
                    widget: {
                      name: 'time-off-receipt',
                      lifecycle: 'cancelled',
                    },
                    request: snapshot,
                  },
                });
              }
              await publishLifecycle('cancelled', snapshot);
            }
          : undefined
      }
      onFollowUp={
        ready && supports?.followUpMessage !== false
          ? (prompt) => sendFollowUp({ prompt })
          : undefined
      }
    />
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}
