import { useState } from 'react';
import { useCallTool, useLayout, useToolInfo } from '../helpers.js';
import './widget-style.css';

type Requester = { readonly id?: string; readonly name?: string | null };

type EquipmentRequest = {
  readonly id: string;
  readonly category: string;
  readonly item: string;
  readonly quantity: number;
  readonly status: string;
  readonly justification?: string | null;
  readonly requester?: Requester;
};

type Result = { readonly team?: string; readonly requests?: readonly EquipmentRequest[] };

const CATEGORY: Record<string, string> = {
  LAPTOP: 'Laptop',
  MONITOR: 'Monitor',
  PHONE: 'Phone',
  PERIPHERAL: 'Peripheral',
  FURNITURE: 'Furniture',
  OTHER: 'Other',
};

export default function ReviewEquipmentQueue() {
  const { theme } = useLayout();
  const shown = useToolInfo('team_equipment_queue').structuredContent as Result | undefined;
  const team = shown?.team ?? '';
  const review = useCallTool('review_equipment_app');

  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const requests = (shown?.requests ?? []).filter((r) => !resolved[r.id]);

  async function decide(r: EquipmentRequest, decision: 'APPROVED' | 'DECLINED') {
    setBusy(r.id);
    setStatus('');
    try {
      await review.callTool({ team, id: r.id, decision });
      setResolved((cur) => ({ ...cur, [r.id]: decision }));
      setStatus(`${decision === 'APPROVED' ? 'Approved' : 'Declined'} ${r.item}.`);
    } catch {
      setStatus("Couldn't apply the decision — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main
      className={`tv-shell${theme === 'dark' ? ' dark' : ''}`}
      data-llm={`Equipment review queue (team ${team || '—'}): ${requests.length} pending`}
    >
      <section className="tv-card">
        <header className="tv-header">
          <span className="tv-mark" aria-hidden="true">
            <CheckIcon />
          </span>
          <div className="tv-title-block">
            <h1 className="tv-title">Equipment approvals</h1>
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
                    <div className="tv-row-title">
                      {r.requester?.name ?? 'Teammate'} — {r.quantity}× {r.item}
                    </div>
                    <div className="tv-row-meta">
                      {CATEGORY[r.category] ?? r.category}
                      {r.justification ? ` · ${r.justification}` : ''}
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
