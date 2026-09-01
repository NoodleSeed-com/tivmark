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
import { newHirePlanSchema, type NewHirePlanData } from './widget-contracts.js';
import {
  FollowUpChips,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

type NewHireLaunchPlanViewProps = {
  readonly theme: WidgetTheme;
  readonly data?: NewHirePlanData;
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
};

const policyValue = (days: number | null) =>
  days === null ? 'Unlimited' : `${days} days`;

export function NewHireLaunchPlanView({
  theme,
  data,
  loading,
  error,
  onFollowUp,
}: NewHireLaunchPlanViewProps) {
  return (
    <WidgetFrame
      theme={theme}
      title={data ? `${data.newHire.name} launch plan` : 'New-hire launch plan'}
      subtitle={
        data
          ? `${data.team.name} · review before anything changes`
          : 'Verified preview'
      }
      icon={<LaunchIcon />}
      dataLlm={
        data
          ? `Verified new-hire launch plan for ${data.newHire.name} in ${data.team.slug}; no changes yet`
          : 'New-hire launch plan'
      }
    >
      {loading ? (
        <WidgetFeedback kind="loading">
          Checking the team and policies…
        </WidgetFeedback>
      ) : null}
      {error ? (
        <WidgetFeedback kind="error">
          Tivmark could not verify this launch plan. Nothing was changed.
        </WidgetFeedback>
      ) : null}
      {data ? (
        <>
          <dl className="tv-facts tv-new-hire-facts">
            <div>
              <dt>Role</dt>
              <dd>{data.newHire.jobTitle}</dd>
            </div>
            <div>
              <dt>Starts</dt>
              <dd>{data.newHire.startDate}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{data.newHire.workLocation}</dd>
            </div>
            <div className="tv-fact-wide">
              <dt>Work email</dt>
              <dd>{data.newHire.email}</dd>
            </div>
          </dl>
          <div className="tv-launch-bundle">
            <span>Equipment</span>
            <strong>{data.equipment.label}</strong>
            {data.equipment.item ? <small>{data.equipment.item}</small> : null}
          </div>
          <div className="tv-policy-grid" aria-label="Inherited leave policies">
            {data.policies.map((policy) => (
              <div key={policy.type}>
                <span>{policy.type.toLowerCase()}</span>
                <strong>{policyValue(policy.allowanceDays)}</strong>
              </div>
            ))}
          </div>
          <ul className="tv-checklist" aria-label="Changes after confirmation">
            {data.checklist.map((item) => (
              <li key={item.id}>
                <span aria-hidden="true">→</span>
                {item.label}
              </li>
            ))}
          </ul>
          <p className="tv-trust-line tv-plan-line">
            <span aria-hidden="true">✓</span>
            Manager verified · live policies read · no changes yet
          </p>
          {onFollowUp ? (
            <FollowUpChips
              chips={[
                {
                  id: 'launch',
                  label: 'Launch this new hire',
                  prompt: 'Launch this exact new-hire plan now.',
                },
                {
                  id: 'change',
                  label: 'Change the plan',
                  prompt:
                    'I want to change this new-hire plan before launching it.',
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

export default function NewHireLaunchPlan() {
  const ready = useWidgetReady();
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo('plan_new_hire_launch');
  const sendFollowUp = useSendFollowUpMessage();
  const updateModelContext = useUpdateModelContext();
  const publishLifecycle = useWidgetLifecycle('new-hire-launch-plan');
  const [published, setPublished] = useViewState(
    'new_hire_plan_published',
    false
  );
  const candidate = (
    toolInfo.structuredContent as { plan?: unknown } | undefined
  )?.plan;
  const parsed = newHirePlanSchema.safeParse(candidate);
  const data = parsed.success ? parsed.data : undefined;
  const pending = !ready || Object.keys(toolInfo).length === 0;

  useEffect(() => {
    if (!data || published) return;
    if (supports?.modelContext === true) {
      void updateModelContext({
        content: [
          {
            type: 'text',
            text: `Verified a new-hire launch plan for ${data.newHire.name}. Nothing has changed yet.`,
          },
        ],
        structuredContent: {
          widget: { name: 'new-hire-launch-plan', lifecycle: 'planned' },
          plan: data,
        },
      });
    }
    void publishLifecycle('planned', data);
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
    <NewHireLaunchPlanView
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

function LaunchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v16M4 12h16M17 7l3 5-3 5M7 7l-3 5 3 5" />
    </svg>
  );
}
