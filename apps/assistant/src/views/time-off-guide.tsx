import {
  useLayout,
  useSendFollowUpMessage,
  useToolInfo,
} from '../helpers.js';
import {
  FollowUpChips,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

export type TimeOffGuideData = {
  readonly leaveTypes: readonly { type: string; label: string; detail: string }[];
  readonly balanceParts: readonly { term: string; detail: string }[];
  readonly note: string;
};

type TimeOffGuideViewProps = {
  readonly theme: WidgetTheme;
  readonly data?: TimeOffGuideData;
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

export function TimeOffGuideView({
  theme,
  data,
  loading,
  error,
  onFollowUp,
}: TimeOffGuideViewProps) {
  return (
    <WidgetFrame
      theme={theme}
      title="Time off in Tivmark"
      subtitle="Four leave types, counted in half-days"
      icon={<CalendarIcon />}
      dataLlm={
        data
          ? `Time-off guide: ${data.leaveTypes.map((t) => t.label).join(', ')}`
          : 'Time-off guide'
      }
    >
      {loading ? (
        <WidgetFeedback kind="loading">Loading the guide…</WidgetFeedback>
      ) : null}
      {error ? (
        <WidgetFeedback kind="error">
          The guide is unavailable right now.
        </WidgetFeedback>
      ) : null}
      {data ? (
        <>
          <ul className="tv-guide-list">
            {data.leaveTypes.map((leave) => (
              <li key={leave.type} className="tv-guide-row">
                <span className="tv-guide-term">{leave.label}</span>
                <span className="tv-guide-detail">{leave.detail}</span>
              </li>
            ))}
          </ul>
          <div className="tv-chips" role="group" aria-label="How balances work">
            {data.balanceParts.map((part) => (
              <span key={part.term} className="tv-chip">
                {part.term}: {part.detail}
              </span>
            ))}
          </div>
          <p className="tv-guide-detail" style={{ marginTop: 10 }}>
            {data.note}
          </p>
        </>
      ) : null}
      {onFollowUp ? (
        <FollowUpChips
          chips={[
            {
              id: 'equipment',
              label: 'What about equipment?',
              prompt: 'How do equipment requests work in Tivmark?',
            },
            {
              id: 'mine',
              label: 'Show my balance',
              prompt: 'Show me my time-off balance',
            },
          ]}
          onSend={onFollowUp}
        />
      ) : null}
    </WidgetFrame>
  );
}

export default function TimeOffGuide() {
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo('time_off_guide');
  const sendFollowUp = useSendFollowUpMessage();
  const pending = Object.keys(toolInfo).length === 0;
  const data = toolInfo.structuredContent as TimeOffGuideData | undefined;
  const followUpsSupported = supports?.followUpMessage !== false;
  return (
    <TimeOffGuideView
      theme={theme === 'dark' ? 'dark' : 'light'}
      data={data && Array.isArray(data.leaveTypes) ? data : undefined}
      loading={pending}
      error={toolInfo.isError === true}
      onFollowUp={
        followUpsSupported ? (prompt) => sendFollowUp({ prompt }) : undefined
      }
    />
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}
