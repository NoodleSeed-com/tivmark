import { useState } from 'react';
import {
  DataCard,
  DataList,
  EmptyState,
  Flow,
  Frame,
  StatusBadge,
  SubmitButton,
  useCallTool,
  useToolInfo,
} from '../helpers.js';

type Request = {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly duration: string;
  readonly reason?: string | null;
};
type Result = { readonly team?: string; readonly requests?: readonly Request[] };

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const statusTone: Record<string, Tone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  DECLINED: 'danger',
  CANCELED: 'neutral',
};

export default function RequestsList() {
  const data = useToolInfo('my_time_off').structuredContent as Result | undefined;
  const team = data?.team ?? '';
  const cancel = useCallTool('cancel_time_off');
  const [canceled, setCanceled] = useState<Record<string, boolean>>({});

  const requests = (data?.requests ?? []).filter((r) => !canceled[r.id]);

  async function onCancel(id: string) {
    setCanceled((c) => ({ ...c, [id]: true })); // optimistic
    try {
      await cancel.callTool({ team, id });
    } catch {
      setCanceled((c) => ({ ...c, [id]: false })); // rollback
    }
  }

  return (
    <main data-llm={`Time-off requests: ${requests.length} shown`}>
      <Frame title="Your time-off requests">
        {requests.length === 0 ? (
          <EmptyState>No time-off requests yet.</EmptyState>
        ) : (
          <DataList>
            {requests.map((r) => (
              <DataCard key={r.id}>
                <Flow variant="split" density="comfortable">
                  <div>
                    <strong>
                      {r.startDate} → {r.endDate}
                    </strong>
                    <div>
                      {r.type}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </div>
                  </div>
                  <StatusBadge tone={statusTone[r.status] ?? 'neutral'}>
                    {r.status}
                  </StatusBadge>
                  {(r.status === 'PENDING' || r.status === 'APPROVED') && (
                    <SubmitButton
                      pending={cancel.isPending}
                      pendingLabel="Canceling…"
                      onClick={() => onCancel(r.id)}
                    >
                      Cancel
                    </SubmitButton>
                  )}
                </Flow>
              </DataCard>
            ))}
          </DataList>
        )}
      </Frame>
    </main>
  );
}
