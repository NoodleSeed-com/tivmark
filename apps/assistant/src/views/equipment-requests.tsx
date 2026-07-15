import { useLayout, useToolInfo } from '../helpers.js';
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

type Result = {
  readonly team?: string;
  readonly requests?: readonly EquipmentRequest[];
};

const CATEGORY: Record<string, string> = {
  LAPTOP: 'Laptop',
  MONITOR: 'Monitor',
  PHONE: 'Phone',
  PERIPHERAL: 'Peripheral',
  FURNITURE: 'Furniture',
  OTHER: 'Other',
};

const badgeClass = (status: string) => `tv-badge tv-badge-${status.toLowerCase()}`;

export default function EquipmentRequests() {
  const { theme } = useLayout();
  const shown = useToolInfo('my_equipment').structuredContent as Result | undefined;
  const requests = shown?.requests ?? [];
  const pending = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <main
      className={`tv-shell${theme === 'dark' ? ' dark' : ''}`}
      data-llm={`Equipment requests for team ${shown?.team ?? '—'}: ${requests.length} total, ${pending} pending`}
    >
      <section className="tv-card">
        <header className="tv-header">
          <span className="tv-mark" aria-hidden="true">
            <BoxIcon />
          </span>
          <div className="tv-title-block">
            <h1 className="tv-title">Your equipment requests</h1>
            <p className="tv-subtitle">Team {shown?.team ?? '—'}</p>
          </div>
          <span className="tv-chip">{pending} pending</span>
        </header>
        <div className="tv-body">
          {requests.length === 0 ? (
            <p className="tv-empty">No equipment requests yet.</p>
          ) : (
            <ul className="tv-list">
              {requests.map((r) => (
                <li className="tv-row" key={r.id}>
                  <div className="tv-row-main">
                    <div className="tv-row-title">
                      {r.quantity}× {r.item}
                    </div>
                    <div className="tv-row-meta">
                      {CATEGORY[r.category] ?? r.category}
                      {r.justification ? ` · ${r.justification}` : ''}
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

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}
