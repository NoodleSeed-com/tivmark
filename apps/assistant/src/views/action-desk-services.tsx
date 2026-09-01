import { useLayout, useSendFollowUpMessage, useToolInfo } from '../helpers.js';
import { normalizeActionServices } from './widget-data.js';
import { FollowUpChips, WidgetFeedback, WidgetFrame } from './widget-ui.js';
import './widget-style.css';

export default function ActionDeskServices() {
  const { theme, supports } = useLayout();
  const info = useToolInfo();
  const followUp = useSendFollowUpMessage();
  const state = normalizeActionServices(info.structuredContent, {
    pending: Object.keys(info).length === 0,
    error: info.isError,
  });
  const data = state.kind === 'ready' ? state.data : undefined;

  return (
    <WidgetFrame
      theme={theme}
      title="Action Desk services"
      subtitle={`Team ${data?.team ?? '—'} · live catalog`}
      icon={<RouteIcon />}
      badge={
        data ? (
          <span className="tv-chip">{data.services.length} active</span>
        ) : null
      }
      dataLlm={
        data
          ? `${data.services.length} Action Desk services for ${data.team}`
          : state.kind
      }
    >
      {state.kind === 'loading' ? (
        <WidgetFeedback kind="loading">Loading the catalog…</WidgetFeedback>
      ) : null}
      {state.kind === 'error' ? (
        <WidgetFeedback kind="error">{state.message}</WidgetFeedback>
      ) : null}
      {state.kind === 'empty' ? (
        <WidgetFeedback kind="empty">{state.message}</WidgetFeedback>
      ) : null}
      {data ? (
        <ul className="tv-guide-list">
          {data.services.map((service) => (
            <li key={service.id} className="tv-guide-row">
              <span className="tv-guide-term">{service.name}</span>
              <span className="tv-guide-detail">
                {service.description}
                <br />
                {service.audience.toLowerCase()} ·{' '}
                {service.slaHours
                  ? `${service.slaHours}h target`
                  : 'flexible target'}
                {service.requiresApproval ? ' · approval' : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {data && supports?.followUpMessage !== false ? (
        <FollowUpChips
          chips={data.services.slice(0, 4).map((service) => ({
            id: service.id,
            label: service.name,
            prompt: `Start a ${service.name} request. Ask me for any detail you still need.`,
          }))}
          onSend={(prompt) => followUp({ prompt })}
        />
      ) : null}
    </WidgetFrame>
  );
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M7 6h5a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3" />
    </svg>
  );
}
