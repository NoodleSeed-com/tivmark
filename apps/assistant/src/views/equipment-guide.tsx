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

export type EquipmentGuideData = {
  readonly categories: readonly {
    category: string;
    label: string;
    examples: string;
  }[];
  readonly lifecycle: readonly { stage: string; detail: string }[];
};

type EquipmentGuideViewProps = {
  readonly theme: WidgetTheme;
  readonly data?: EquipmentGuideData;
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

export function EquipmentGuideView({
  theme,
  data,
  loading,
  error,
  onFollowUp,
}: EquipmentGuideViewProps) {
  return (
    <WidgetFrame
      theme={theme}
      title="Equipment in Tivmark"
      subtitle="Six categories, three lifecycle stages"
      icon={<BoxIcon />}
      dataLlm={
        data
          ? `Equipment guide: ${data.categories.map((c) => c.label).join(', ')}`
          : 'Equipment guide'
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
            {data.categories.map((category) => (
              <li key={category.category} className="tv-guide-row">
                <span className="tv-guide-term">{category.label}</span>
                <span className="tv-guide-detail">{category.examples}</span>
              </li>
            ))}
          </ul>
          <ol className="tv-steps" style={{ marginTop: 10 }}>
            {data.lifecycle.map((stage) => (
              <li key={stage.stage} className="tv-step">
                <div>
                  <div className="tv-step-title">{stage.stage}</div>
                  <div className="tv-step-detail">{stage.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {onFollowUp ? (
        <FollowUpChips
          chips={[
            {
              id: 'approvals',
              label: 'How do approvals work?',
              prompt: 'Who can approve requests in Tivmark?',
            },
            {
              id: 'mine',
              label: 'Show my equipment',
              prompt: 'Show me my equipment requests',
            },
          ]}
          onSend={onFollowUp}
        />
      ) : null}
    </WidgetFrame>
  );
}

export default function EquipmentGuide() {
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo('equipment_guide');
  const sendFollowUp = useSendFollowUpMessage();
  const pending = Object.keys(toolInfo).length === 0;
  const data = toolInfo.structuredContent as EquipmentGuideData | undefined;
  const followUpsSupported = supports?.followUpMessage !== false;
  return (
    <EquipmentGuideView
      theme={theme === 'dark' ? 'dark' : 'light'}
      data={data && Array.isArray(data.categories) ? data : undefined}
      loading={pending}
      error={toolInfo.isError === true}
      onFollowUp={
        followUpsSupported ? (prompt) => sendFollowUp({ prompt }) : undefined
      }
    />
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}
