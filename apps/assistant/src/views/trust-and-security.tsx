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

export type TrustAndSecurityData = {
  readonly points: readonly { title: string; detail: string }[];
  readonly privacyUrl: string;
};

type TrustAndSecurityViewProps = {
  readonly theme: WidgetTheme;
  readonly data?: TrustAndSecurityData;
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly onOpen?: (url: string) => Promise<void> | void;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

export function TrustAndSecurityView({
  theme,
  data,
  loading,
  error,
  onOpen,
  onFollowUp,
}: TrustAndSecurityViewProps) {
  return (
    <WidgetFrame
      theme={theme}
      title="Security and privacy"
      subtitle="How Tivmark handles access and data"
      icon={<ShieldIcon />}
      dataLlm={
        data
          ? `Security guide: ${data.points.map((p) => p.title).join(', ')}`
          : 'Security guide'
      }
    >
      {loading ? (
        <WidgetFeedback kind="loading">Loading…</WidgetFeedback>
      ) : null}
      {error ? (
        <WidgetFeedback kind="error">
          The security overview is unavailable right now.
        </WidgetFeedback>
      ) : null}
      {data ? (
        <>
          <ul className="tv-guide-list">
            {data.points.map((point) => (
              <li key={point.title} className="tv-guide-row">
                <span className="tv-guide-term">{point.title}</span>
                <span className="tv-guide-detail">{point.detail}</span>
              </li>
            ))}
          </ul>
          {onOpen ? (
            <div className="tv-actions" style={{ marginTop: 12 }}>
              <WidgetAction onClick={() => void onOpen(data.privacyUrl)}>
                Read the privacy policy
              </WidgetAction>
            </div>
          ) : null}
        </>
      ) : null}
      {onFollowUp ? (
        <FollowUpChips
          chips={[
            {
              id: 'roles',
              label: 'Who sees what?',
              prompt: 'Who can see what in Tivmark?',
            },
          ]}
          onSend={onFollowUp}
        />
      ) : null}
    </WidgetFrame>
  );
}

export default function TrustAndSecurity() {
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo('trust_and_security');
  const openExternal = useOpenExternal();
  const sendFollowUp = useSendFollowUpMessage();
  const pending = Object.keys(toolInfo).length === 0;
  const data = toolInfo.structuredContent as TrustAndSecurityData | undefined;
  const followUpsSupported = supports?.followUpMessage !== false;
  return (
    <TrustAndSecurityView
      theme={theme === 'dark' ? 'dark' : 'light'}
      data={data && Array.isArray(data.points) ? data : undefined}
      loading={pending}
      error={toolInfo.isError === true}
      onOpen={(url) => openExternal(url)}
      onFollowUp={
        followUpsSupported ? (prompt) => sendFollowUp({ prompt }) : undefined
      }
    />
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l8 3v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3z" />
    </svg>
  );
}
