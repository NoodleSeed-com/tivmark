import { useLayout, useToolInfo } from '../helpers.js';
import {
  formatDateRange,
  formatHalfDays,
  normalizeTimeOffRequests,
  type TimeOffRequestsViewState,
} from './widget-data.js';
import {
  RequestRow,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

export function TimeOffRequestsView({
  theme,
  state,
}: {
  readonly theme: WidgetTheme;
  readonly state: TimeOffRequestsViewState;
}) {
  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;

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
          {data.requests.map((request) => (
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
              status={request.status}
              statusLabel={request.statusLabel}
            />
          ))}
        </ul>
      ) : null}
    </WidgetFrame>
  );
}

export default function TimeOffRequests() {
  const { theme } = useLayout();
  const toolInfo = useToolInfo();
  const pending = Object.keys(toolInfo).length === 0;
  const state = normalizeTimeOffRequests(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });
  return <TimeOffRequestsView theme={theme} state={state} />;
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
