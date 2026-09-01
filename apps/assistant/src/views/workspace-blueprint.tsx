import { useEffect } from 'react';

import {
  useLayout,
  useSendFollowUpMessage,
  useToolInfo,
  useUpdateModelContext,
  useViewState,
  useWidgetLifecycle,
  useWidgetReady,
} from '../helpers.js';
import {
  onboardingBlueprintSchema,
  type OnboardingBlueprintData,
} from './widget-contracts.js';
import {
  FollowUpChips,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

type WorkspaceBlueprintViewProps = {
  readonly theme: WidgetTheme;
  readonly data?: OnboardingBlueprintData;
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

const goalLabel = (goal: OnboardingBlueprintData['primaryGoal']) =>
  goal === 'BOTH'
    ? 'Time off and equipment'
    : goal === 'TIME_OFF'
      ? 'Time off'
      : 'Equipment';

export function WorkspaceBlueprintView({
  theme,
  data,
  loading,
  error,
  onFollowUp,
}: WorkspaceBlueprintViewProps) {
  return (
    <WidgetFrame
      theme={theme}
      title={data ? `${data.businessName} blueprint` : 'Workspace blueprint'}
      subtitle="Designed in conversation · nothing created yet"
      icon={<BlueprintIcon />}
      dataLlm={
        data
          ? `Onboarding blueprint for ${data.businessName}: ${data.teamSize}, ${data.timeZone}, ${data.primaryGoal}`
          : 'Business onboarding blueprint'
      }
    >
      {loading ? (
        <WidgetFeedback kind="loading">
          Designing your workspace…
        </WidgetFeedback>
      ) : null}
      {error ? (
        <WidgetFeedback kind="error">
          The blueprint could not be prepared. Your conversation is still here.
        </WidgetFeedback>
      ) : null}
      {data ? (
        <>
          <dl className="tv-facts tv-onboarding-facts">
            <div>
              <dt>Business</dt>
              <dd>{data.businessName}</dd>
            </div>
            <div>
              <dt>People</dt>
              <dd>{data.teamSize}</dd>
            </div>
            <div>
              <dt>Time zone</dt>
              <dd>{data.timeZone}</dd>
            </div>
            <div className="tv-fact-wide">
              <dt>First workflow</dt>
              <dd>{goalLabel(data.primaryGoal)}</dd>
            </div>
          </dl>
          <div className="tv-policy-grid" aria-label="Starter leave policy">
            {[
              ['Vacation', data.vacationAllowanceDays],
              ['Sick', data.sickAllowanceDays],
              ['Personal', data.personalAllowanceDays],
              ['Unpaid', null],
            ].map(([label, days]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{days === null ? 'Unlimited' : `${days} days`}</strong>
              </div>
            ))}
          </div>
          <p className="tv-trust-line tv-plan-line">
            <span aria-hidden="true">✓</span>
            Anonymous plan · account and confirmation required before any write
          </p>
          {onFollowUp ? (
            <FollowUpChips
              chips={[
                {
                  id: 'create',
                  label: 'Create this workspace',
                  prompt: 'Create this workspace from the blueprint.',
                },
                {
                  id: 'change',
                  label: 'Change the policy',
                  prompt: 'I want to adjust the starter leave policy.',
                },
              ]}
              onSend={onFollowUp}
            />
          ) : null}
        </>
      ) : null}
    </WidgetFrame>
  );
}

export default function WorkspaceBlueprint() {
  const ready = useWidgetReady();
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo('design_business_workspace');
  const sendFollowUp = useSendFollowUpMessage();
  const updateModelContext = useUpdateModelContext();
  const publishLifecycle = useWidgetLifecycle('workspace-blueprint');
  const [published, setPublished] = useViewState('blueprint_published', false);
  const parsed = onboardingBlueprintSchema.safeParse(
    toolInfo.structuredContent
  );
  const data = parsed.success ? parsed.data : undefined;
  const pending = !ready || Object.keys(toolInfo).length === 0;

  useEffect(() => {
    if (!data || published) return;
    if (supports?.modelContext === true) {
      void updateModelContext({
        content: [
          {
            type: 'text',
            text: `Designed a workspace blueprint for ${data.businessName}. It has not been created yet.`,
          },
        ],
        structuredContent: {
          widget: { name: 'workspace-blueprint', lifecycle: 'designed' },
          blueprint: data,
        },
      });
    }
    void publishLifecycle('designed', data);
    setPublished(true);
  }, [
    data,
    publishLifecycle,
    published,
    setPublished,
    supports?.modelContext,
    updateModelContext,
  ]);

  return (
    <WorkspaceBlueprintView
      theme={theme === 'dark' ? 'dark' : 'light'}
      data={data}
      loading={pending}
      error={!pending && (toolInfo.isError === true || !parsed.success)}
      onFollowUp={
        supports?.followUpMessage === false
          ? undefined
          : (prompt) => sendFollowUp({ prompt })
      }
    />
  );
}

function BlueprintIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16v16H4zM8 4v16M4 9h16M12 13h5M12 16h5" />
    </svg>
  );
}
