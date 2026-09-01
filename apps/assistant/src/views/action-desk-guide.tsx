import { useLayout, useSendFollowUpMessage, useToolInfo } from '../helpers.js';
import { actionDeskGuideSchema } from './widget-contracts.js';
import { FollowUpChips, WidgetFeedback, WidgetFrame } from './widget-ui.js';
import './widget-style.css';

export default function ActionDeskGuide() {
  const { theme, supports } = useLayout();
  const info = useToolInfo();
  const followUp = useSendFollowUpMessage();
  const pending = Object.keys(info).length === 0;
  const parsed = actionDeskGuideSchema.safeParse(info.structuredContent);

  return (
    <WidgetFrame
      theme={theme}
      title="Tivmark Action Desk"
      subtitle={
        parsed.success
          ? parsed.data.headline
          : 'One front door for business requests'
      }
      icon={<DeskIcon />}
      badge={<span className="tv-chip">AI + operations</span>}
      dataLlm="Action Desk routes sales, support, access, and custom requests into durable workflows."
    >
      {pending ? (
        <WidgetFeedback kind="loading">Opening the Action Desk…</WidgetFeedback>
      ) : null}
      {!pending && !parsed.success ? (
        <WidgetFeedback kind="error">
          The Action Desk guide was incomplete.
        </WidgetFeedback>
      ) : null}
      {parsed.success ? (
        <>
          <ul className="tv-guide-list">
            {parsed.data.services.map((service) => (
              <li key={service.id} className="tv-guide-row">
                <span className="tv-guide-term">{service.name}</span>
                <span className="tv-guide-detail">
                  {service.description} <strong>{service.audience}</strong>
                </span>
              </li>
            ))}
          </ul>
          <ol className="tv-steps tv-section-gap">
            {parsed.data.steps.map((step) => (
              <li key={step} className="tv-step">
                <div className="tv-step-detail">{step}</div>
              </li>
            ))}
          </ol>
          {supports?.followUpMessage !== false ? (
            <FollowUpChips
              chips={[
                {
                  id: 'start',
                  label: 'Start a request',
                  prompt:
                    'Find the right Action Desk service and start a request for me.',
                },
                {
                  id: 'catalog',
                  label: 'Show my catalog',
                  prompt: "Show me my team's live Action Desk services.",
                },
              ]}
              onSend={(prompt) => followUp({ prompt })}
            />
          ) : null}
        </>
      ) : null}
    </WidgetFrame>
  );
}

function DeskIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v11H4zM8 20v-4m8 4v-4M2 20h20" />
      <path d="m8 10 2 2 5-5" />
    </svg>
  );
}
