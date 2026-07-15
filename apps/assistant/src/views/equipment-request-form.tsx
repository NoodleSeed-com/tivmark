import { useState } from 'react';
import { useCallTool, useLayout, useToolInfo, useViewState } from '../helpers.js';
import './widget-style.css';

type FormResult = { readonly team?: string; readonly prompt?: string };

const CATEGORIES = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'PERIPHERAL', label: 'Peripheral' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'OTHER', label: 'Other' },
] as const;

export default function EquipmentRequestForm() {
  const { theme } = useLayout();
  const shown = useToolInfo('request_equipment').structuredContent as FormResult | undefined;
  const team = shown?.team ?? '';
  const submit = useCallTool('submit_equipment');

  const [category, setCategory] = useViewState('category', 'LAPTOP');
  const [item, setItem] = useViewState('item', '');
  const [quantity, setQuantity] = useViewState('quantity', 1);
  const [justification, setJustification] = useViewState('justification', '');
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);

  const canSubmit = Boolean(team && item.trim() && quantity >= 1 && !submit.isPending && !done);

  async function send() {
    if (!canSubmit) return;
    setStatus('');
    try {
      const result = await submit.callTool({
        team,
        category,
        item: item.trim(),
        quantity,
        justification,
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
      data-llm={`Equipment request form (team ${team || '—'}): ${quantity}× ${item || '?'} (${category})${done ? ' — submitted' : ''}`}
    >
      <section className="tv-card">
        <header className="tv-header">
          <span className="tv-mark" aria-hidden="true">
            <PlusIcon />
          </span>
          <div className="tv-title-block">
            <h1 className="tv-title">Request equipment</h1>
            <p className="tv-subtitle">Team {team || '—'}</p>
          </div>
        </header>
        <div className="tv-body">
          <div className="tv-row-2">
            <div className="tv-field">
              <label htmlFor="tv-cat">Category</label>
              <select
                id="tv-cat"
                className="tv-select"
                value={category}
                disabled={done}
                onChange={(e) => setCategory(e.currentTarget.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="tv-field">
              <label htmlFor="tv-qty">Quantity</label>
              <input
                id="tv-qty"
                className="tv-input"
                type="number"
                min={1}
                max={20}
                value={quantity}
                disabled={done}
                onChange={(e) =>
                  setQuantity(Math.max(1, Math.min(20, Number(e.currentTarget.value) || 1)))
                }
              />
            </div>
          </div>
          <div className="tv-field">
            <label htmlFor="tv-item">Item</label>
            <input
              id="tv-item"
              className="tv-input"
              type="text"
              value={item}
              disabled={done}
              placeholder='e.g. MacBook Pro 16"'
              onChange={(e) => setItem(e.currentTarget.value)}
            />
          </div>
          <div className="tv-field">
            <label htmlFor="tv-just">Justification (optional)</label>
            <textarea
              id="tv-just"
              className="tv-textarea"
              value={justification}
              disabled={done}
              placeholder="Why do you need this?"
              onChange={(e) => setJustification(e.currentTarget.value)}
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
