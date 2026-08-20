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

export type GettingStartedData = {
  readonly steps: readonly { title: string; detail: string }[];
};

type GettingStartedViewProps = {
  readonly theme: WidgetTheme;
  readonly data?: GettingStartedData;
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

export function GettingStartedGuideView({
  theme,
  data,
  loading,
  error,
  onFollowUp,
}: GettingStartedViewProps) {
  return (
    <WidgetFrame
      theme={theme}
      title="Getting started"
      subtitle="From zero to a working workspace"
      icon={<FlagIcon />}
      dataLlm={
        data ? `Getting started: ${data.steps.length} steps` : 'Getting started'
      }
    >
      {loading ? (
        <WidgetFeedback kind="loading">Loading the checklist…</WidgetFeedback>
      ) : null}
      {error ? (
        <WidgetFeedback kind="error">
          The checklist is unavailable right now.
        </WidgetFeedback>
      ) : null}
      {data ? (
        <ol className="tv-steps">
          {data.steps.map((step) => (
            <li key={step.title} className="tv-step">
              <div>
                <div className="tv-step-title">{step.title}</div>
                <div className="tv-step-detail">{step.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {onFollowUp ? (
        <FollowUpChips
          chips={[
            {
              id: 'sales',
              label: 'Talk to the team',
              prompt: 'I would like to talk to the Tivmark team',
            },
            {
              id: 'sso',
              label: 'How does SSO work?',
              prompt: 'How does single sign-on work in Tivmark?',
            },
          ]}
          onSend={onFollowUp}
        />
      ) : null}
    </WidgetFrame>
  );
}

export default function GettingStartedGuide() {
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo('getting_started_guide');
  const sendFollowUp = useSendFollowUpMessage();
  const pending = Object.keys(toolInfo).length === 0;
  const data = toolInfo.structuredContent as GettingStartedData | undefined;
  const followUpsSupported = supports?.followUpMessage !== false;
  return (
    <GettingStartedGuideView
      theme={theme === 'dark' ? 'dark' : 'light'}
      data={data && Array.isArray(data.steps) ? data : undefined}
      loading={pending}
      error={toolInfo.isError === true}
      onFollowUp={
        followUpsSupported ? (prompt) => sendFollowUp({ prompt }) : undefined
      }
    />
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 21V4m0 0h13l-2.5 4L18 12H5" />
    </svg>
  );
}
