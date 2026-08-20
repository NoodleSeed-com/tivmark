import {
  useLayout,
  useOpenExternal,
  useSendFollowUpMessage,
  useToolInfo,
} from '../helpers.js';
import {
  FollowUpChips,
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

export type ExploreTivmarkData = {
  readonly tagline: string;
  readonly features: readonly { title: string; detail: string }[];
  readonly stats: readonly { value: string; label: string }[];
  readonly portalUrl: string;
};

type ExploreTivmarkViewProps = {
  readonly theme: WidgetTheme;
  readonly data?: ExploreTivmarkData;
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly onOpen?: (url: string) => Promise<void> | void;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

export function ExploreTivmarkView({
  theme,
  data,
  loading,
  error,
  onOpen,
  onFollowUp,
}: ExploreTivmarkViewProps) {
  return (
    <WidgetFrame
      theme={theme}
      title="What Tivmark does"
      subtitle={data?.tagline ?? 'People ops for growing teams'}
      icon={<SparkIcon />}
      dataLlm={
        data
          ? `Tivmark overview: ${data.features.length} features, portal at ${data.portalUrl}`
          : 'Tivmark overview'
      }
    >
      {loading ? (
        <WidgetFeedback kind="loading">Loading the overview…</WidgetFeedback>
      ) : null}
      {error ? (
        <WidgetFeedback kind="error">
          The overview is unavailable right now.
        </WidgetFeedback>
      ) : null}
      {data ? (
        <>
          <ul className="tv-guide-list">
            {data.features.map((feature) => (
              <li key={feature.title} className="tv-guide-row">
                <span className="tv-guide-term">{feature.title}</span>
                <span className="tv-guide-detail">{feature.detail}</span>
              </li>
            ))}
          </ul>
          <div className="tv-chips" role="group" aria-label="At a glance">
            {data.stats.map((stat) => (
              <span key={stat.label} className="tv-chip">
                {stat.value} {stat.label}
              </span>
            ))}
          </div>
          {onOpen ? (
            <div className="tv-actions" style={{ marginTop: 12 }}>
              <WidgetAction
                tone="primary"
                onClick={() => void onOpen(data.portalUrl)}
              >
                Open the portal
              </WidgetAction>
            </div>
          ) : null}
        </>
      ) : null}
      {onFollowUp ? (
        <FollowUpChips
          chips={[
            {
              id: 'time-off',
              label: 'How does time off work?',
              prompt: 'How does time off work in Tivmark?',
            },
            {
              id: 'sales',
              label: 'Talk to the team',
              prompt: 'I would like to talk to the Tivmark team',
            },
          ]}
          onSend={onFollowUp}
        />
      ) : null}
    </WidgetFrame>
  );
}

export default function ExploreTivmark() {
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo('explore_tivmark');
  const openExternal = useOpenExternal();
  const sendFollowUp = useSendFollowUpMessage();
  const pending = Object.keys(toolInfo).length === 0;
  const data = toolInfo.structuredContent as ExploreTivmarkData | undefined;
  const followUpsSupported = supports?.followUpMessage !== false;
  return (
    <ExploreTivmarkView
      theme={theme === 'dark' ? 'dark' : 'light'}
      data={data && Array.isArray(data.features) ? data : undefined}
      loading={pending}
      error={toolInfo.isError === true}
      onOpen={(url) => openExternal(url)}
      onFollowUp={
        followUpsSupported ? (prompt) => sendFollowUp({ prompt }) : undefined
      }
    />
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}
