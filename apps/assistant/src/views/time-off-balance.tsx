import { useEffect } from 'react';
import {
  useLayout,
  useSendFollowUpMessage,
  useToolInfo,
  useUpdateModelContext,
  useWidgetLifecycle,
  useWidgetReady,
} from '../helpers.js';
import {
  formatDateRange,
  formatHalfDays,
  normalizeBalanceResult,
  type BalanceItem,
  type BalanceViewState,
} from './widget-data.js';
import {
  BalanceTile,
  FollowUpChips,
  StatusBadge,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

const clamp = (value: number) => Math.max(0, Math.min(100, value));

const balancePresentation = (balance: BalanceItem) => {
  if (balance.allowanceHalfDays === null) {
    return {
      value: `${formatHalfDays(balance.approvedHalfDays)} used`,
      detail: 'Unlimited allowance',
      progress: undefined,
    };
  }

  const remaining = balance.remainingHalfDays;
  return {
    value:
      remaining === null ? 'Balance unavailable' : formatHalfDays(remaining),
    detail: `of ${formatHalfDays(balance.allowanceHalfDays)} left`,
    progress:
      remaining === null || balance.allowanceHalfDays <= 0
        ? 0
        : clamp((remaining / balance.allowanceHalfDays) * 100),
  };
};

const balanceSummary = (state: BalanceViewState) => {
  if (state.kind !== 'ready' && state.kind !== 'partial') return state.kind;
  return state.data.balances
    .map((balance) => {
      const shown = balancePresentation(balance);
      return `${balance.label}: ${shown.value}`;
    })
    .join(', ');
};

export function TimeOffBalanceView({
  theme,
  state,
  onFollowUp,
}: {
  readonly theme: WidgetTheme;
  readonly state: BalanceViewState;
  readonly onFollowUp?: (prompt: string) => Promise<void> | void;
}) {
  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;
  const assessment = data?.assessment;

  return (
    <WidgetFrame
      theme={theme}
      title={assessment ? 'Your time-off check' : 'Your time-off balance'}
      subtitle={
        assessment
          ? `${formatDateRange(assessment.startDate, assessment.endDate)} · Team ${data?.team ?? '—'}`
          : `Team ${data?.team ?? '—'} · this year`
      }
      icon={<CalendarIcon />}
      badge={
        assessment ? (
          <StatusBadge
            status={assessment.eligible ? 'APPROVED' : 'DECLINED'}
            label={assessment.eligible ? 'Eligible' : 'Not eligible'}
          />
        ) : undefined
      }
      dataLlm={
        assessment
          ? `${assessment.status} ${assessment.type} ${assessment.startDate} to ${assessment.endDate}.`
          : `Time-off balance: ${balanceSummary(state)}`
      }
    >
      {state.kind === 'loading' ? (
        <WidgetFeedback kind="loading">
          Loading your time-off balance…
        </WidgetFeedback>
      ) : null}
      {state.kind === 'error' ? (
        <WidgetFeedback kind="error">{state.message}</WidgetFeedback>
      ) : null}
      {state.kind === 'empty' ? (
        <WidgetFeedback kind="empty">{state.message}</WidgetFeedback>
      ) : null}
      {state.kind === 'partial' ? (
        <WidgetFeedback kind="partial">{state.message}</WidgetFeedback>
      ) : null}
      {assessment ? (
        <section className="tv-plan" aria-label="Eligibility assessment">
          <WidgetFeedback kind={assessment.eligible ? 'success' : 'partial'}>
            {assessment.status}
          </WidgetFeedback>
          <dl className="tv-facts">
            <div>
              <dt>Request</dt>
              <dd>
                {assessment.type.charAt(0) +
                  assessment.type.slice(1).toLowerCase()}{' '}
                · {formatHalfDays(assessment.requestedHalfDays)}
              </dd>
            </div>
            <div>
              <dt>Available now</dt>
              <dd>
                {assessment.decision === 'POLICY_UNAVAILABLE'
                  ? 'Unavailable'
                  : assessment.availableBeforeHalfDays === null
                  ? 'Unlimited'
                  : formatHalfDays(assessment.availableBeforeHalfDays)}
              </dd>
            </div>
            <div>
              <dt>After pending time</dt>
              <dd>
                {assessment.decision === 'POLICY_UNAVAILABLE'
                  ? 'Unavailable'
                  : assessment.remainingAfterHalfDays === null
                  ? 'Unlimited'
                  : formatHalfDays(assessment.remainingAfterHalfDays)}
              </dd>
            </div>
          </dl>
          <ul className="tv-checks" aria-label="Policy checks">
            <PolicyCheck passed={assessment.checks.weekday} label="Weekday request" />
            <PolicyCheck
              passed={assessment.checks.noOverlap}
              label="No overlapping request"
            />
            <PolicyCheck
              passed={assessment.checks.withinBalance}
              label="Within available balance"
            />
          </ul>
          <p className="tv-source">Checked against {assessment.policySource}.</p>
        </section>
      ) : null}
      {data ? (
        <div className="tv-grid">
          {data.balances.map((balance) => {
            const shown = balancePresentation(balance);
            return (
              <BalanceTile
                key={balance.type}
                label={balance.label}
                value={shown.value}
                detail={shown.detail}
                progress={shown.progress}
                pending={
                  balance.pendingHalfDays > 0
                    ? `${formatHalfDays(balance.pendingHalfDays)} pending`
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : null}
      {onFollowUp ? (
        <FollowUpChips
          chips={
            !assessment
              ? [
                  { id: 'book', label: 'Book time off', prompt: 'Book time off' },
                  {
                    id: 'requests',
                    label: 'Show my requests',
                    prompt: 'Show me my time-off requests',
                  },
                ]
              : assessment.eligible
              ? [
                  {
                    id: 'book',
                    label: 'Book this time off',
                    prompt: `Book ${assessment.type.toLowerCase()} from ${assessment.startDate} to ${assessment.endDate} for team ${assessment.team}`,
                  },
                  {
                    id: 'requests',
                    label: 'Show my requests',
                    prompt: 'Show me my time-off requests',
                  },
                ]
              : [
                  {
                    id: 'dates',
                    label: 'Try other dates',
                    prompt: 'Help me choose other dates for time off',
                  },
                  {
                    id: 'requests',
                    label: 'Show my requests',
                    prompt: 'Show me my time-off requests',
                  },
                ]
          }
          onSend={onFollowUp}
        />
      ) : null}
    </WidgetFrame>
  );
}

export default function TimeOffBalance() {
  const { theme, supports } = useLayout();
  const ready = useWidgetReady();
  const toolInfo = useToolInfo('time_off_balance');
  const sendFollowUp = useSendFollowUpMessage();
  const updateModelContext = useUpdateModelContext();
  useWidgetLifecycle('time-off-balance');
  const pending = Object.keys(toolInfo).length === 0;
  const state = normalizeBalanceResult(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });
  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;
  const assessment = data?.assessment;

  useEffect(() => {
    if (!assessment || supports?.modelContext !== true) return;
    void updateModelContext({
      content: [
        {
          type: 'text',
          text: `${assessment.status} ${assessment.type} ${assessment.startDate} to ${assessment.endDate}.`,
        },
      ],
      structuredContent: {
        widget: { name: 'time-off-balance', lifecycle: 'active' },
        assessment: {
          team: assessment.team,
          type: assessment.type,
          startDate: assessment.startDate,
          endDate: assessment.endDate,
          eligible: assessment.eligible,
          decision: assessment.decision,
          requestedHalfDays: assessment.requestedHalfDays,
          remainingAfterHalfDays: assessment.remainingAfterHalfDays,
        },
      },
    });
  }, [assessment, supports?.modelContext, updateModelContext]);

  const followUpsSupported = supports?.followUpMessage !== false;
  return (
    <TimeOffBalanceView
      theme={theme}
      state={state}
      onFollowUp={
        ready && followUpsSupported
          ? (prompt) => sendFollowUp({ prompt })
          : undefined
      }
    />
  );
}

function PolicyCheck({
  passed,
  label,
}: {
  readonly passed: boolean;
  readonly label: string;
}) {
  return (
    <li className={passed ? 'tv-check-pass' : 'tv-check-fail'}>
      <span aria-hidden="true">{passed ? '✓' : '×'}</span>
      {label}
    </li>
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
