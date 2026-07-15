import { useState } from 'react';
import { useCallTool, useLayout, useToolInfo } from '../helpers.js';
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

type Result = { readonly team?: string; readonly requests?: readonly TimeOffRequest[] };

const LABEL: Record<string, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  PERSONAL: 'Personal',
  UNPAID: 'Unpaid',
};

const range = (r: TimeOffRequest) =>
  r.startDate === r.endDate ? r.startDate : `${r.startDate} → ${r.endDate}`;

export default function ReviewTimeOffQueue() {
  const { theme } = useLayout();
  const shown = useToolInfo('team_time_off_queue').structuredContent as Result | undefined;
  const team = shown?.team ?? '';
  const review = useCallTool('review_time_off_app');

  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const requests = (shown?.requests ?? []).filter((r) => !resolved[r.id]);

  async function decide(r: TimeOffRequest, decision: 'APPROVED' | 'DECLINED') {
    setBusy(r.id);
    setStatus('');
    try {
      await review.callTool({ team, id: r.id, decision });
      setResolved((cur) => ({ ...cur, [r.id]: decision }));
      setStatus(`${decision === 'APPROVED' ? 'Approved' : 'Declined'} ${r.requester?.name ?? 'request'}.`);
    } catch {
      setStatus("Couldn't apply the decision — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main
      className={`tv-shell${theme === 'dark' ? ' dark' : ''}`}
      data-llm={`Time-off review queue (team ${team || '—'}): ${requests.length} pending`}
    >
      <section className="tv-card">
        <header className="tv-header">
          <span className="tv-mark" aria-hidden="true">
            <CheckIcon />
          </span>
          <div className="tv-title-block">
            <h1 className="tv-title">Time-off approvals</h1>
            <p className="tv-subtitle">Team {team || '—'} · pending review</p>
          </div>
          <span className="tv-chip">{requests.length} pending</span>
        </header>
        <div className="tv-body">
          {requests.length === 0 ? (
            <p className="tv-empty">Nothing awaiting review. You’re all caught up.</p>
          ) : (
            <ul className="tv-list">
              {requests.map((r) => (
                <li className="tv-row" key={r.id}>
                  <div className="tv-row-main">
                    <div className="tv-row-title">{r.requester?.name ?? 'Teammate'}</div>
                    <div className="tv-row-meta">
                      {LABEL[r.type] ?? r.type} · {range(r)}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </div>
                  </div>
                  <div className="tv-actions">
                    <button
                      type="button"
                      className="tv-btn tv-btn-sm tv-btn-ok"
                      disabled={busy === r.id}
                      onClick={() => decide(r, 'APPROVED')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="tv-btn tv-btn-sm tv-btn-bad"
                      disabled={busy === r.id}
                      onClick={() => decide(r, 'DECLINED')}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {status && (
            <p className="tv-note" aria-live="polite">
              {status}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
