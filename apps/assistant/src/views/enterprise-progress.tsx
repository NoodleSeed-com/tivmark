import '@noodleseed/one/react/styles.css';
import { Action, Feedback, Flow, Frame, Region } from '@noodleseed/one/react';
import { z } from 'zod';
import {
  useLayout,
  useOpenExternal,
  useToolInfo,
  useWidgetReady,
} from '../helpers.js';

const cardResult = z.object({
  workspace: z.object({
    id: z.string().nullable(),
    team: z.string(),
    teamName: z.string(),
    version: z.number(),
    status: z.string(),
    url: z.string().url(),
    nextAction: z.string(),
    boundary: z.string(),
    metrics: z.object({ complete: z.number(), total: z.number() }),
    research: z.object({ status: z.string(), stale: z.boolean() }).nullable(),
  }),
});

export default function EnterpriseProgress() {
  const ready = useWidgetReady();
  const layout = useLayout();
  const info = useToolInfo();
  const openExternal = useOpenExternal();
  const parsed = cardResult.safeParse(info.structuredContent);
  const pending = !ready || Object.keys(info).length === 0;
  const workspace = parsed.success ? parsed.data.workspace : undefined;
  const safeUrl = workspace && new URL(workspace.url);
  const canOpen =
    safeUrl &&
    safeUrl.origin === 'https://app.tivmark.com' &&
    safeUrl.pathname === `/teams/${workspace.team}/enterprise-onboarding`;
  return (
    <Frame
      className={layout.theme === 'dark' ? 'dark' : ''}
      title={
        workspace
          ? `${workspace.teamName} · enterprise launch`
          : 'Enterprise launch'
      }
      subtitle="One saved plan · manual or with Mark"
      displayMode="auto"
    >
      {pending ? (
        <Feedback status="loading">Reading the saved plan…</Feedback>
      ) : info.isError || !workspace ? (
        <Feedback status="error">
          The saved plan could not be verified. Ask Mark to read enterprise
          onboarding again.
        </Feedback>
      ) : (
        <Flow variant="stack" density="compact">
          <Feedback status={workspace.status === 'READY' ? 'success' : 'info'}>
            {workspace.id
              ? `${workspace.metrics.complete} of ${workspace.metrics.total} stages reviewed · revision ${workspace.version}`
              : 'No launch plan yet. Ask Mark to create one after reviewing the scope.'}
          </Feedback>
          <Region title="Next useful action">
            <p>{workspace.nextAction}</p>
            {workspace.research && (
              <p>
                Company research: {workspace.research.status.toLowerCase()}
                {workspace.research.stale ? ' · requires fresh review' : ''}
              </p>
            )}
          </Region>
          <p>{workspace.boundary}</p>
          {canOpen && layout.supports?.openExternal !== false ? (
            <Action
              type="button"
              variant="primary"
              onClick={() => openExternal(workspace.url)}
            >
              Open full launch plan
            </Action>
          ) : (
            <p>Continue on app.tivmark.com → Enterprise Launch.</p>
          )}
        </Flow>
      )}
    </Frame>
  );
}
