import { useLayout, useToolInfo } from '../helpers.js';
import {
  normalizeEquipmentRequests,
  type EquipmentRequestsViewState,
} from './widget-data.js';
import {
  RequestRow,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

export function EquipmentRequestsView({
  theme,
  state,
}: {
  readonly theme: WidgetTheme;
  readonly state: EquipmentRequestsViewState;
}) {
  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;

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
          {data.requests.map((request) => (
            <RequestRow
              key={request.id}
              title={`${request.quantity} × ${request.item}`}
              meta={request.categoryLabel}
              detail={request.justification}
              status={request.status}
              statusLabel={request.statusLabel}
            />
          ))}
        </ul>
      ) : null}
    </WidgetFrame>
  );
}

export default function EquipmentRequests() {
  const { theme } = useLayout();
  const toolInfo = useToolInfo();
  const pending = Object.keys(toolInfo).length === 0;
  const state = normalizeEquipmentRequests(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });
  return <EquipmentRequestsView theme={theme} state={state} />;
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}
