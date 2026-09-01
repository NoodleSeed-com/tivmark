import { useLayout, useSendFollowUpMessage, useToolInfo } from '../helpers.js';
import { normalizeServiceRequests } from './widget-data.js';
import {
  FollowUpChips,
  RequestRow,
  WidgetFeedback,
  WidgetFrame,
} from './widget-ui.js';
import './widget-style.css';

export default function ServiceRequests() {
  const { theme, supports } = useLayout();
  const info = useToolInfo();
  const followUp = useSendFollowUpMessage();
  const state = normalizeServiceRequests(info.structuredContent, {
    pending: Object.keys(info).length === 0,
    error: info.isError,
  });
  const data = state.kind === 'ready' ? state.data : undefined;

  return (
    <WidgetFrame
      theme={theme}
      title="Your Action Desk requests"
      subtitle={`Team ${data?.team ?? '—'}`}
      icon={<TicketIcon />}
      badge={
        data ? <span className="tv-chip">{data.activeCount} active</span> : null
      }
      dataLlm={
        data
          ? `${data.requests.length} requests, ${data.activeCount} active for ${data.team}`
          : state.kind
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
      {data ? (
        <ul className="tv-list">
          {data.requests.map((request) => (
            <RequestRow
              key={request.id}
              title={request.subject}
              meta={`${request.serviceName} · ${request.priority.toLowerCase()} · #${request.id.slice(0, 8)}`}
              detail={request.resolution ?? request.description}
              status={request.status}
            />
          ))}
        </ul>
      ) : null}
      {supports?.followUpMessage !== false ? (
        <FollowUpChips
          chips={[
            {
              id: 'new',
              label: 'Start another',
              prompt: 'Start a new Action Desk request.',
            },
            {
              id: 'status',
              label: 'Explain status',
              prompt:
                'Explain the latest status and next step for my Action Desk requests.',
            },
          ]}
          onSend={(prompt) => followUp({ prompt })}
        />
      ) : null}
    </WidgetFrame>
  );
}

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4zM9 8v8" />
    </svg>
  );
}
