import { useEffect } from 'react';

import {
  useLayout,
  useOpenExternal,
  useToolInfo,
  useUpdateModelContext,
  useViewState,
  useWidgetLifecycle,
  useWidgetReady,
} from '../helpers.js';
import {
  onboardingReceiptSchema,
  type OnboardingReceiptData,
} from './widget-contracts.js';
import {
  StatusBadge,
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

type WorkspaceReadyViewProps = {
  readonly theme: WidgetTheme;
  readonly data?: OnboardingReceiptData;
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly onOpen?: (url: string) => void;
};

export function WorkspaceReadyView({
  theme,
  data,
  loading,
  error,
  onOpen,
}: WorkspaceReadyViewProps) {
  return (
    <WidgetFrame
      theme={theme}
      title={data ? `${data.team.name} is ready` : 'Workspace setup'}
      subtitle="Business profile and starter policy are live"
      icon={<ReadyIcon />}
      badge={
        data ? <StatusBadge status="FULFILLED" label="Ready" /> : undefined
      }
      dataLlm={
        data
          ? `Authenticated onboarding receipt: ${data.team.name} (${data.team.slug}) is ready`
          : 'Authenticated onboarding receipt'
      }
    >
      {loading ? (
        <WidgetFeedback kind="loading">
          Finishing your workspace…
        </WidgetFeedback>
      ) : null}
      {error ? (
        <WidgetFeedback kind="error">
          Tivmark could not verify the completed setup. No success was assumed.
        </WidgetFeedback>
      ) : null}
      {data ? (
        <>
          <WidgetFeedback kind="success">
            Tivmark created the workspace after your authenticated confirmation.
          </WidgetFeedback>
          <dl className="tv-facts tv-receipt-facts">
            <div>
              <dt>Workspace</dt>
              <dd>{data.team.name}</dd>
            </div>
            <div>
              <dt>First workflow</dt>
              <dd>{data.team.primaryGoalLabel}</dd>
            </div>
            <div>
              <dt>People</dt>
              <dd>{data.team.teamSize}</dd>
            </div>
            <div>
              <dt>Time zone</dt>
              <dd>{data.team.timeZone}</dd>
            </div>
          </dl>
          <div className="tv-policy-grid" aria-label="Applied leave policy">
            {data.policies.map((policy) => (
              <div key={policy.type}>
                <span>{policy.type.toLowerCase()}</span>
                <strong>
                  {policy.allowanceDays === null
                    ? 'Unlimited'
                    : `${policy.allowanceDays} days`}
                </strong>
              </div>
            ))}
          </div>
          <p className="tv-trust-line">
            <span aria-hidden="true">✓</span>
            Verified identity · delegated authorization · confirmed write
          </p>
          {onOpen ? (
            <div className="tv-next-actions">
              {data.nextSteps.map((step, index) => (
                <WidgetAction
                  key={step.id}
                  tone={index === 0 ? 'primary' : 'default'}
                  onClick={() => onOpen(step.url)}
                >
                  {step.label}
                </WidgetAction>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </WidgetFrame>
  );
}

export default function WorkspaceReady() {
  const ready = useWidgetReady();
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo('complete_business_onboarding');
  const openExternal = useOpenExternal();
  const updateModelContext = useUpdateModelContext();
  const publishLifecycle = useWidgetLifecycle('workspace-ready');
  const [published, setPublished] = useViewState('ready_published', false);
  const candidate = (
    toolInfo.structuredContent as { receipt?: unknown } | undefined
  )?.receipt;
  const parsed = onboardingReceiptSchema.safeParse(candidate);
  const data = parsed.success ? parsed.data : undefined;
  const pending = !ready || Object.keys(toolInfo).length === 0;

  useEffect(() => {
    if (!data || published) return;
    const snapshot = {
      status: data.status,
      team: data.team,
      policies: data.policies,
    };
    if (supports?.modelContext === true) {
      void updateModelContext({
        content: [
          {
            type: 'text',
            text: `${data.team.name} is configured and ready in Tivmark.`,
          },
        ],
        structuredContent: {
          widget: { name: 'workspace-ready', lifecycle: 'completed' },
          receipt: snapshot,
        },
      });
    }
    void publishLifecycle('completed', snapshot);
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
    <WorkspaceReadyView
      theme={theme === 'dark' ? 'dark' : 'light'}
      data={data}
      loading={pending}
      error={!pending && (toolInfo.isError === true || !parsed.success)}
      onOpen={supports?.openExternal === false ? undefined : openExternal}
    />
  );
}

function ReadyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}
