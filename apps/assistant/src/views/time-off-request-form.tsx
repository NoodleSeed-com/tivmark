import { useState } from 'react';
import { useCallTool, useLayout, useToolInfo, useViewState } from '../helpers.js';
import './widget-style.css';

type FormResult = { readonly team?: string; readonly prompt?: string };

const TYPES = [
  { value: 'VACATION', label: 'Vacation' },
  { value: 'SICK', label: 'Sick' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'UNPAID', label: 'Unpaid' },
] as const;

export default function TimeOffRequestForm() {
  const { theme } = useLayout();
  const shown = useToolInfo('request_time_off').structuredContent as FormResult | undefined;
  const team = shown?.team ?? '';
  const submit = useCallTool('submit_time_off');

  const [type, setType] = useViewState('type', 'VACATION');
  const [startDate, setStartDate] = useViewState('startDate', '');
  const [endDate, setEndDate] = useViewState('endDate', '');
  const [reason, setReason] = useViewState('reason', '');
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);

  const canSubmit = Boolean(team && startDate && endDate && !submit.isPending && !done);

  async function send() {
    if (!canSubmit) return;
    setStatus('');
    try {
      const result = await submit.callTool({
        team,
        type,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
        reason,
      });
      const s = result.structuredContent as { readonly status?: string } | undefined;
      setStatus(s?.status ?? 'Request submitted.');
      setDone(true);
    } catch {
      setStatus("Couldn't submit the request — please try again.");
    }
  }

  return (
    <main
      className={`tv-shell${theme === 'dark' ? ' dark' : ''}`}
      data-llm={`Time-off request form (team ${team || '—'}): ${type}, ${startDate || '?'} to ${endDate || '?'}${done ? ' — submitted' : ''}`}
    >
      <section className="tv-card">
        <header className="tv-header">
          <span className="tv-mark" aria-hidden="true">
            <PlusIcon />
          </span>
          <div className="tv-title-block">
            <h1 className="tv-title">Request time off</h1>
            <p className="tv-subtitle">Team {team || '—'} · full days</p>
          </div>
        </header>
        <div className="tv-body">
          <div className="tv-field">
            <label htmlFor="tv-type">Type</label>
            <select
              id="tv-type"
              className="tv-select"
              value={type}
              disabled={done}
              onChange={(e) => setType(e.currentTarget.value)}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="tv-row-2">
            <div className="tv-field">
              <label htmlFor="tv-start">Start date</label>
              <input
                id="tv-start"
                className="tv-input"
                type="date"
                value={startDate}
                disabled={done}
                onChange={(e) => setStartDate(e.currentTarget.value)}
              />
            </div>
            <div className="tv-field">
              <label htmlFor="tv-end">End date</label>
              <input
                id="tv-end"
                className="tv-input"
                type="date"
                value={endDate}
                disabled={done}
                onChange={(e) => setEndDate(e.currentTarget.value)}
              />
            </div>
          </div>
          <div className="tv-field">
            <label htmlFor="tv-reason">Reason (optional)</label>
            <textarea
              id="tv-reason"
              className="tv-textarea"
              value={reason}
              disabled={done}
              placeholder="e.g. Family trip"
              onChange={(e) => setReason(e.currentTarget.value)}
            />
          </div>
          <div className="tv-actions">
            <button
              type="button"
              className="tv-btn tv-btn-primary"
              disabled={!canSubmit}
              onClick={send}
            >
              {done ? 'Submitted' : submit.isPending ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
