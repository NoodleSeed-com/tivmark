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
  newHireReceiptSchema,
  type NewHireReceiptData,
} from './widget-contracts.js';
import {
  StatusBadge,
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

type NewHireReadyViewProps = {
  readonly theme: WidgetTheme;
  readonly data?: NewHireReceiptData;
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly onOpen?: (url: string) => void;
};

export function NewHireReadyView({
  theme,
  data,
  loading,
  error,
  onOpen,
}: NewHireReadyViewProps) {
  const active = data?.status === 'ACTIVE';
  return (
    <WidgetFrame
      theme={theme}
      title={
        data
          ? `${data.newHire.name} is ${active ? 'active' : 'ready'}`
          : 'New-hire readiness'
      }
      subtitle={
        data
          ? `${data.team.name} · ${data.newHire.jobTitle}`
          : 'Verified launch receipt'
      }
      icon={<ReadyIcon />}
      badge={
        data ? (
          <StatusBadge status="FULFILLED" label={active ? 'Active' : 'Ready'} />
        ) : undefined
      }
      dataLlm={
        data
          ? `Verified new-hire receipt for ${data.newHire.name}: ${data.status}, invitation ${data.invitation.status}`
          : 'Verified new-hire launch receipt'
      }
    >
      {loading ? (
        <WidgetFeedback kind="loading">
          Verifying launch readiness…
        </WidgetFeedback>
      ) : null}
      {error ? (
        <WidgetFeedback kind="error">
          Tivmark could not verify the launch receipt. No success was assumed.
        </WidgetFeedback>
      ) : null}
      {data ? (
        <>
          <WidgetFeedback kind="success">
            {active
              ? 'The invitation was accepted and the equipment request now belongs to the employee.'
              : 'Tivmark created the complete readiness plan after your confirmation.'}
          </WidgetFeedback>
          <dl className="tv-facts tv-receipt-facts">
            <div>
              <dt>Invitation</dt>
              <dd>
                {data.invitation.status === 'ACCEPTED' ? 'Accepted' : 'Pending'}
              </dd>
            </div>
            <div>
              <dt>Starts</dt>
              <dd>{data.newHire.startDate}</dd>
            </div>
            <div>
              <dt>Leave</dt>
              <dd>{data.policies.length} policies prepared</dd>
            </div>
            <div>
              <dt>Equipment</dt>
              <dd>
                {data.equipment.requestId ? 'Request created' : 'Not needed'}
              </dd>
            </div>
          </dl>
          <ul
            className="tv-checklist tv-checklist-complete"
            aria-label="Readiness checklist"
          >
            {data.checklist.map((item) => (
              <li key={item.id}>
                <span aria-hidden="true">✓</span>
                {item.label}
              </li>
            ))}
          </ul>
          <p className="tv-trust-line">
            <span aria-hidden="true">✓</span>
            Verified identity · delegated authorization · one confirmed
            transaction
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

export function NewHireReceiptWidget({
  toolName,
  lifecycleName,
}: {
  readonly toolName: 'launch_new_hire' | 'get_new_hire_status';
  readonly lifecycleName: 'new-hire-ready' | 'new-hire-status';
}) {
  const ready = useWidgetReady();
  const { theme, supports } = useLayout();
  const toolInfo = useToolInfo(toolName);
  const openExternal = useOpenExternal();
  const updateModelContext = useUpdateModelContext();
  const publishLifecycle = useWidgetLifecycle(lifecycleName);
  const [published, setPublished] = useViewState(
    `${lifecycleName}_published`,
    false
  );
  const candidate = (
    toolInfo.structuredContent as { receipt?: unknown } | undefined
  )?.receipt;
  const parsed = newHireReceiptSchema.safeParse(candidate);
  const data = parsed.success ? parsed.data : undefined;
  const pending = !ready || Object.keys(toolInfo).length === 0;

  useEffect(() => {
    if (!data || published) return;
    const snapshot = {
      status: data.status,
      launchId: data.launchId,
      team: data.team,
      newHire: data.newHire,
      invitation: data.invitation,
    };
    if (supports?.modelContext === true) {
      void updateModelContext({
        content: [
          {
            type: 'text',
            text: `${data.newHire.name} is ${data.status.toLowerCase()} in Tivmark; invitation ${data.invitation.status.toLowerCase()}.`,
          },
        ],
        structuredContent: {
          widget: { name: lifecycleName, lifecycle: 'verified' },
          receipt: snapshot,
        },
      });
    }
    void publishLifecycle('verified', snapshot);
    setPublished(true);
  }, [
    data,
    lifecycleName,
    publishLifecycle,
    published,
    setPublished,
    supports?.modelContext,
    updateModelContext,
  ]);

  return (
    <NewHireReadyView
      theme={theme === 'dark' ? 'dark' : 'light'}
      data={data}
      loading={pending}
      error={!pending && (toolInfo.isError === true || !parsed.success)}
      onOpen={supports?.openExternal === false ? undefined : openExternal}
    />
  );
}

export default function NewHireReady() {
  return (
    <NewHireReceiptWidget
      toolName="launch_new_hire"
      lifecycleName="new-hire-ready"
    />
  );
}

function ReadyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12l5 5L20 6M12 3v4M21 12h-4M12 21v-4" />
    </svg>
  );
}
