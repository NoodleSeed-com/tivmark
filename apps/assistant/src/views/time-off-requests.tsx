import { useLayout, useToolInfo } from '../helpers.js';
import './widget-style.css';

type Requester = { readonly id?: string; readonly name?: string | null };

type TimeOffRequest = {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly requestedHalfDays?: number;
  readonly reason?: string | null;
  readonly requester?: Requester;
};

type Result = {
  readonly team?: string;
  readonly requests?: readonly TimeOffRequest[];
};

const LABEL: Record<string, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  PERSONAL: 'Personal',
  UNPAID: 'Unpaid',
};

const badgeClass = (status: string) => `tv-badge tv-badge-${status.toLowerCase()}`;

const range = (r: TimeOffRequest) =>
  r.startDate === r.endDate ? r.startDate : `${r.startDate} → ${r.endDate}`;

const days = (halfDays?: number) =>
  halfDays == null ? '' : ` · ${halfDays / 2} day${halfDays === 2 ? '' : 's'}`;

export default function TimeOffRequests() {
  const { theme } = useLayout();
  // No-arg useToolInfo() reads the INVOKING tool's own output, so this one widget backs both the
  // my_time_off read and the book_time_off write result (both return { team, requests }).
  const shown = useToolInfo().structuredContent as Result | undefined;
  const requests = shown?.requests ?? [];
  const pending = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <main
      className={`tv-shell${theme === 'dark' ? ' dark' : ''}`}
      data-llm={`Time-off requests for team ${shown?.team ?? '—'}: ${requests.length} total, ${pending} pending`}
    >
      <section className="tv-card">
        <header className="tv-header">
          <span className="tv-mark" aria-hidden="true">
            <ListIcon />
          </span>
          <div className="tv-title-block">
            <h1 className="tv-title">Your time-off requests</h1>
            <p className="tv-subtitle">Team {shown?.team ?? '—'}</p>
          </div>
          <span className="tv-chip">{pending} pending</span>
        </header>
        <div className="tv-body">
          {requests.length === 0 ? (
            <p className="tv-empty">No time-off requests yet.</p>
          ) : (
            <ul className="tv-list">
              {requests.map((r) => (
                <li className="tv-row" key={r.id}>
                  <div className="tv-row-main">
                    <div className="tv-row-title">
                      {LABEL[r.type] ?? r.type} · {range(r)}
                    </div>
                    <div className="tv-row-meta">
                      {days(r.requestedHalfDays)}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </div>
                  </div>
                  <span className={badgeClass(r.status)}>{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
