import { EmptyState, Fact, Flow, Frame, useLayout, useToolInfo } from '../helpers.js';

type Balance = {
  readonly allowanceHalfDays: number | null;
  readonly approvedHalfDays: number;
  readonly pendingHalfDays: number;
  readonly remainingHalfDays: number | null;
};
type BalanceResult = {
  readonly userId?: string;
  readonly balances?: Record<string, Record<string, Balance>>;
};

const TYPES = [
  { key: 'VACATION', label: 'Vacation' },
  { key: 'SICK', label: 'Sick' },
  { key: 'PERSONAL', label: 'Personal' },
  { key: 'UNPAID', label: 'Unpaid' },
] as const;

// The Tivmark API counts leave in half-days; show whole days.
function days(halfDays: number | null | undefined): string {
  if (halfDays == null) return '—';
  return `${halfDays / 2} days`;
}

export default function BalanceCard() {
  const { theme } = useLayout();
  const data = useToolInfo('time_off_balance').structuredContent as
    | BalanceResult
    | undefined;
  const mine = (data?.userId && data?.balances?.[data.userId]) || undefined;

  const rows = TYPES.map((t) => ({ ...t, b: mine?.[t.key] }));
  const summary = rows
    .filter((r) => r.b)
    .map((r) => `${r.label} ${days(r.b?.remainingHalfDays)} left`)
    .join('; ');

  return (
    <main
      className={theme === 'dark' ? 'dark' : undefined}
      data-llm={`Time-off balance — ${summary || 'no balances found'}`}
    >
      <Frame title="Your time off" subtitle="Remaining balance this year">
        {mine ? (
          <Flow variant="grid" density="comfortable">
            {rows.map((r) => (
              <Fact
                key={r.key}
                label={r.label}
                value={days(r.b?.remainingHalfDays)}
                detail={
                  r.b?.allowanceHalfDays != null
                    ? `of ${r.b.allowanceHalfDays / 2} days`
                    : 'no allowance'
                }
                tone={
                  r.b && r.b.remainingHalfDays != null && r.b.remainingHalfDays <= 0
                    ? 'danger'
                    : 'success'
                }
              />
            ))}
          </Flow>
        ) : (
          <EmptyState>No balance found for your account.</EmptyState>
        )}
      </Frame>
    </main>
  );
}
