import { useLayout, useToolInfo } from '../helpers.js';
import {
  formatHalfDays,
  normalizeBalanceResult,
  type BalanceItem,
  type BalanceViewState,
} from './widget-data.js';
import {
  BalanceTile,
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
}: {
  readonly theme: WidgetTheme;
  readonly state: BalanceViewState;
}) {
  const data =
    state.kind === 'ready' || state.kind === 'partial' ? state.data : undefined;

  return (
    <WidgetFrame
      theme={theme}
      title="Your time-off balance"
      subtitle={`Team ${data?.team ?? '—'} · this year`}
      icon={<CalendarIcon />}
      dataLlm={`Time-off balance: ${balanceSummary(state)}`}
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
    </WidgetFrame>
  );
}

export default function TimeOffBalance() {
  const { theme } = useLayout();
  const toolInfo = useToolInfo('time_off_balance');
  const pending = Object.keys(toolInfo).length === 0;
  const state = normalizeBalanceResult(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });
  return <TimeOffBalanceView theme={theme} state={state} />;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}
