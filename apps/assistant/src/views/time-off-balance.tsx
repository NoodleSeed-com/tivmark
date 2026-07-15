import { useLayout, useToolInfo } from '../helpers.js';
import './widget-style.css';

type Balance = {
  readonly allowanceHalfDays: number | null;
  readonly approvedHalfDays: number;
  readonly pendingHalfDays: number;
  readonly remainingHalfDays: number;
};

type BalanceResult = {
  readonly team?: string;
  readonly userId?: string;
  // balances is keyed by userId, then by leave type.
  readonly balances?: Record<string, Record<string, Balance>>;
};

const TYPES = ['VACATION', 'SICK', 'PERSONAL', 'UNPAID'] as const;
const LABEL: Record<string, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  PERSONAL: 'Personal',
  UNPAID: 'Unpaid',
};

// Tivmark stores allowances in half-days; show whole days (1 day = 2 half-days).
const days = (halfDays: number) => {
  const value = halfDays / 2;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

export default function TimeOffBalance() {
  const { theme } = useLayout();
  const shown = useToolInfo('time_off_balance').structuredContent as
    | BalanceResult
    | undefined;
  const mine =
    (shown?.userId && shown?.balances?.[shown.userId]) || ({} as Record<string, Balance>);

  const summary = TYPES.filter((t) => mine[t])
    .map((t) => `${LABEL[t]} ${days(mine[t]!.remainingHalfDays)} left`)
    .join(', ');

  return (
    <main
      className={`tv-shell${theme === 'dark' ? ' dark' : ''}`}
      data-llm={`Time-off balance for team ${shown?.team ?? '—'}: ${summary || 'no policies'}`}
    >
      <section className="tv-card">
        <header className="tv-header">
          <span className="tv-mark" aria-hidden="true">
            <CalendarIcon />
          </span>
          <div className="tv-title-block">
            <h1 className="tv-title">Your time-off balance</h1>
            <p className="tv-subtitle">Team {shown?.team ?? '—'} · this year</p>
          </div>
        </header>
        <div className="tv-body">
          {summary ? (
            <div className="tv-grid">
              {TYPES.filter((t) => mine[t]).map((t) => {
                const b = mine[t]!;
                const allowance = b.allowanceHalfDays;
                const pct =
                  allowance && allowance > 0
                    ? Math.max(0, Math.min(100, (b.remainingHalfDays / allowance) * 100))
                    : 0;
                return (
                  <div className="tv-cell" key={t}>
                    <div className="tv-cell-label">{LABEL[t]}</div>
                    <div className="tv-cell-value">
                      {allowance === null ? (
                        <>
                          {days(b.approvedHalfDays)} <small>days used</small>
                        </>
                      ) : (
                        <>
                          {days(b.remainingHalfDays)}{' '}
                          <small>of {days(allowance)} days left</small>
                        </>
                      )}
                    </div>
                    {allowance !== null && (
                      <div className="tv-meter" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {b.pendingHalfDays > 0 && (
                      <div className="tv-row-meta">{days(b.pendingHalfDays)} days pending</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="tv-empty">No time-off policies are configured for this team yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}
