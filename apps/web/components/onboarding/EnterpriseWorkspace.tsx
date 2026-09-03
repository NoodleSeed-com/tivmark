/* eslint-disable i18next/no-literal-string -- The enterprise showcase is English-first, matching the existing showcase surfaces. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  SparklesIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import type { NoodleAssistantElement } from '@noodleseed/assistant';
import { openAssistant } from '@/components/shared/shell/assistantSurface';
import useEnterpriseOnboarding, {
  type EnterpriseWorkspaceData,
  type EnterpriseCommandData,
} from 'hooks/useEnterpriseOnboarding';

type Stage = EnterpriseWorkspaceData['steps'][number];
type Change = (
  command: EnterpriseCommandData
) => Promise<EnterpriseWorkspaceData>;

async function askMark(team: string, stage?: string) {
  if (!openAssistant())
    throw new Error(
      'Mark is unavailable. You can continue with the same forms here.'
    );
  const assistant = document.querySelector(
    'noodle-assistant'
  ) as NoodleAssistantElement | null;
  if (!assistant?.sendMessage)
    throw new Error('Open Mark and ask for enterprise onboarding.');
  await assistant.sendMessage(
    `Help me with enterprise onboarding for team ${team}${stage ? `, especially stage ${stage}` : ''}. Read the current enterprise onboarding first. Ask only for missing facts, preserve reviewed evidence, and never invent approvals or test results.`
  );
}

function StageEditor({
  stage,
  workspace,
  change,
  assisted,
  reportError,
  onDirtyChange,
}: {
  stage: Stage;
  workspace: EnterpriseWorkspaceData;
  change: Change;
  assisted: boolean;
  reportError: (s: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [values, setValues] = useState(stage.values);
  const [version, setVersion] = useState(workspace.version);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const canEdit =
    workspace.canManage ||
    (!stage.adminOnly && stage.ownerId === workspace.currentUserId);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) {
      setValues(stage.values);
      setVersion(workspace.version);
    }
  }, [stage.values, workspace.version, dirty]);
  async function submit(action: 'save-step' | 'complete-step' | 'reopen-step') {
    setBusy(true);
    reportError('');
    try {
      await change({
        action,
        version,
        stepId: stage.id,
        values,
        source: 'manual',
      });
      setDirty(false);
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="border border-ui-border bg-ui-surface p-5 sm:p-7"
      aria-labelledby="stage-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ui-accent">
            {stage.owner} · {stage.state}
          </p>
          <h2
            id="stage-title"
            className="mt-2 font-serif text-2xl text-ui-heading"
          >
            {stage.title}
          </h2>
        </div>
        {stage.completedAt && (
          <CheckCircleIcon className="h-7 w-7 text-emerald-600" />
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-ui-muted">
        {stage.description}
      </p>
      {stage.state === 'blocked' && (
        <p className="mt-4 border-l-2 border-amber-500 bg-amber-500/5 p-3 text-sm text-ui-text">
          You can prepare a draft now. Completion waits for:{' '}
          {stage.dependsOn
            .filter(
              (id) => !workspace.steps.find((s) => s.id === id)?.completedAt
            )
            .map((id) => workspace.steps.find((s) => s.id === id)?.title)
            .join(', ')}
          .
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor={`owner-${stage.id}`} className="text-ui-muted">
          Assigned to
        </label>
        <select
          id={`owner-${stage.id}`}
          className="select select-bordered select-sm max-w-full"
          value={stage.ownerId ?? ''}
          disabled={!workspace.canManage || busy || dirty}
          onChange={async (e) => {
            setBusy(true);
            try {
              await change({
                action: 'assign',
                version: workspace.version,
                stepId: stage.id,
                ownerId: e.target.value || null,
                source: 'manual',
              });
            } catch (error) {
              reportError(
                error instanceof Error ? error.message : 'Assignment failed'
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="">Unassigned</option>
          {workspace.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.role.toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      {assisted && (
        <button
          type="button"
          className="btn btn-outline btn-sm mt-5"
          onClick={() =>
            void askMark(workspace.team, stage.id).catch((e) =>
              reportError(e.message)
            )
          }
        >
          <SparklesIcon className="h-4 w-4" />
          Work through this with Mark
        </button>
      )}
      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit('save-step');
        }}
      >
        {stage.fields.map((f) => (
          <div key={f.id}>
            <label
              className="mb-1.5 block text-sm font-semibold text-ui-heading"
              htmlFor={`field-${f.id}`}
            >
              {f.label}{' '}
              <span className="font-normal text-ui-muted">· required</span>
            </label>
            {f.choices ? (
              <select
                id={`field-${f.id}`}
                className="select select-bordered w-full"
                value={values[f.id] ?? ''}
                disabled={!canEdit || busy}
                onChange={(e) => {
                  setValues({ ...values, [f.id]: e.target.value });
                  setDirty(true);
                }}
              >
                <option value="">Choose after review</option>
                {f.choices.map((choice) => (
                  <option key={choice}>{choice}</option>
                ))}
              </select>
            ) : (
              <textarea
                id={`field-${f.id}`}
                className="textarea textarea-bordered min-h-[80px] w-full text-sm"
                value={values[f.id] ?? ''}
                maxLength={2000}
                disabled={!canEdit || busy}
                onChange={(e) => {
                  setValues({ ...values, [f.id]: e.target.value });
                  setDirty(true);
                }}
                aria-describedby={`hint-${f.id}`}
              />
            )}
            <p
              id={`hint-${f.id}`}
              className="mt-1 text-xs leading-5 text-ui-muted"
            >
              {f.hint}
              {stage.origins[f.id] === 'research'
                ? ' · Prefilled from reviewed research; verify before completing.'
                : stage.origins[f.id] === 'assistant'
                  ? ' · Entered with Mark.'
                  : ''}
            </p>
            {stage.evidenceRefs[f.id] && (
              <p className="mt-1 break-words text-xs leading-5 text-ui-muted">
                Reviewed proposal from{' '}
                {new Date(
                  stage.evidenceRefs[f.id].retrievedAt
                ).toLocaleString()}
                .
                {stage.evidenceRefs[f.id].sourceUrls.length
                  ? ' Source context: '
                  : ' Suggested plan, not a sourced fact.'}
                {stage.evidenceRefs[f.id].sourceUrls.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mr-2 underline"
                  >
                    Source {index + 1}
                  </a>
                ))}
              </p>
            )}
          </div>
        ))}
        {dirty && version !== workspace.version && (
          <p role="alert" className="text-sm text-amber-700">
            The saved plan changed while you were editing. Your draft is
            preserved. Copy any changes, then discard this draft to review the
            latest version.
          </p>
        )}
        {!canEdit && (
          <p className="text-sm text-ui-muted">
            An administrator or the assigned stage owner can edit this stage.
          </p>
        )}
        {canEdit && (
          <div className="flex flex-wrap gap-2 border-t border-ui-border pt-5">
            <button
              className="btn btn-outline"
              type="submit"
              disabled={busy || (dirty && version !== workspace.version)}
            >
              Save draft
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={
                busy ||
                stage.state === 'blocked' ||
                (dirty && version !== workspace.version)
              }
              onClick={() =>
                void submit(stage.completedAt ? 'reopen-step' : 'complete-step')
              }
            >
              {busy
                ? 'Saving…'
                : stage.completedAt
                  ? 'Reopen for review'
                  : stage.id === 'launch'
                    ? 'Approve readiness plan'
                    : 'Reviewed — complete stage'}
            </button>
            {dirty && (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setDirty(false)}
              >
                Discard draft
              </button>
            )}
          </div>
        )}
        <p className="text-xs leading-5 text-ui-muted">
          Saving changed evidence requires fresh review of dependent sign-offs.
          Completing a stage records your attestation; it does not execute work
          in another system.
        </p>
      </form>
    </section>
  );
}

function ResearchPanel({
  workspace,
  change,
  reportError,
}: {
  workspace: EnterpriseWorkspaceData;
  change: Change;
  reportError: (s: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const research = workspace.research;
  const evidence = research?.evidence;
  const organization = workspace.steps.find(
    (s) => s.id === 'organization'
  )!.values;
  useEffect(() => {
    setSelected([]);
    setConsent(false);
  }, [research?.id, organization.companyName, organization.companyDomain]);
  const running = research && ['QUEUED', 'RUNNING'].includes(research.status);
  async function act(
    action: 'start-research' | 'cancel-research' | 'accept-suggestions'
  ) {
    setBusy(true);
    reportError('');
    try {
      await change({
        action,
        version: workspace.version,
        source: 'manual',
        ...(action === 'start-research'
          ? {
              researchConsent: true as const,
              researchIdentity: {
                companyName: organization.companyName ?? '',
                companyDomain: organization.companyDomain ?? '',
              },
            }
          : {}),
        ...(action === 'accept-suggestions' ? { suggestionIds: selected } : {}),
      });
      setSelected([]);
    } catch (error) {
      reportError(
        error instanceof Error ? error.message : 'Research action failed'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="border border-ui-border bg-ui-surface p-5 sm:p-7"
      aria-labelledby="research-title"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-ui-accent">
        Google Cloud · Gemini Flash
      </p>
      <h2
        id="research-title"
        className="mt-2 font-serif text-2xl text-ui-heading"
      >
        Research once. Review the evidence.
      </h2>
      <p className="mt-3 text-sm font-semibold text-ui-heading">
        Research target: {organization.companyName || 'Company name not saved'}{' '}
        · {organization.companyDomain || 'Public domain not saved'}
      </p>
      <p className="mt-3 text-sm leading-6 text-ui-muted">
        Analyze the supplied public company homepage, then review suggested
        fields. This is website analysis, not broad web search. Competitors and
        customer claims may remain unknown. Internal onboarding data is not sent
        to Google. Nothing is accepted or marked complete automatically.
      </p>
      {!running && workspace.canManage && (
        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-3 text-sm text-ui-text">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-0.5"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I authorize sending the saved public company name and domain to
              Google to analyze its public homepage. The URL and public page
              content are handled by Google as Service Data; do not provide
              confidential or internal domains. Up to two model calls per
              attempt, three attempts per run, and three runs per team per 24
              hours. Cloud billing charges may apply; credit eligibility depends
              on the billing grant.
            </span>
          </label>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!consent || busy || !workspace.researchAvailable}
            onClick={() => void act('start-research')}
          >
            {busy
              ? 'Starting…'
              : research
                ? 'Run fresh research'
                : 'Research public company'}
          </button>
          {!workspace.researchAvailable && (
            <p className="text-sm text-amber-700">
              Research is not configured in this environment. You can still
              provide and review customer context manually.
            </p>
          )}
        </div>
      )}
      {research && (
        <div className="mt-5 border border-ui-border bg-ui-canvas p-4">
          <p className="text-sm font-semibold text-ui-heading">
            {research.status.replaceAll('_', ' ')} · attempt {research.attempts}
            /3
          </p>
          <p className="mt-1 text-xs text-ui-muted">
            {research.model} · requested{' '}
            {new Date(research.createdAt).toLocaleString()}
          </p>
          {running && (
            <p className="mt-2 text-sm text-ui-text">
              The job continues if you close this page. Progress refreshes
              automatically.
            </p>
          )}
          {research.error && (
            <p role="alert" className="mt-2 text-sm text-amber-700">
              {research.error}
            </p>
          )}
          {research.stale && (
            <p className="mt-2 text-sm text-amber-700">
              This research is stale or belongs to a previous company identity.
              It cannot prefill the current plan.
            </p>
          )}
          {running && workspace.canManage && (
            <button
              className="btn btn-outline btn-sm mt-3"
              type="button"
              disabled={busy}
              onClick={() => void act('cancel-research')}
            >
              Cancel research
            </button>
          )}
        </div>
      )}
      {evidence && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap gap-3 text-xs text-ui-muted">
            <span>{evidence.sources.length} sources</span>
            <span>{evidence.inputTokens.toLocaleString()} input tokens</span>
            <span>
              {evidence.outputTokens.toLocaleString()} output / reasoning tokens
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-ui-heading">
              Draft suggestions — choose what to accept
            </h3>
            <p className="mt-1 text-xs text-ui-muted">
              Acceptance saves draft values and their provenance; it is not a
              sign-off. Suggested plans are not verified facts.
            </p>
            <div className="mt-3 space-y-3">
              {evidence.suggestions.map((s) => (
                <label
                  key={s.id}
                  className="flex items-start gap-3 border border-ui-border p-3"
                >
                  <input
                    className="checkbox checkbox-sm mt-1"
                    type="checkbox"
                    disabled={
                      !workspace.canManage ||
                      busy ||
                      research?.stale ||
                      research?.acceptedIds.includes(s.id)
                    }
                    checked={
                      selected.includes(s.id) ||
                      Boolean(research?.acceptedIds.includes(s.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, s.id]
                          : selected.filter((id) => id !== s.id)
                      )
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-ui-accent">
                      {s.stepId} · {s.fieldId} ·{' '}
                      {research?.acceptedIds.includes(s.id)
                        ? 'accepted into draft'
                        : s.kind === 'sourced'
                          ? 'source-backed proposal'
                          : 'suggested plan'}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-ui-text">
                      {s.value}
                    </span>
                    <span className="mt-1 block text-xs text-ui-muted">
                      {s.sourceIds
                        .map(
                          (id) =>
                            evidence.sources.find((source) => source.id === id)
                              ?.title
                        )
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {workspace.canManage && (
              <button
                className="btn btn-primary mt-4"
                type="button"
                disabled={!selected.length || busy || research?.stale}
                onClick={() => void act('accept-suggestions')}
              >
                Accept {selected.length} selected into draft
              </button>
            )}
          </div>
          {evidence.unknowns.length > 0 && (
            <div className="border-l-2 border-amber-500 p-3">
              <h3 className="text-sm font-semibold text-ui-heading">
                Unknowns and limitations
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ui-muted">
                {evidence.unknowns.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary className="cursor-pointer font-semibold text-ui-heading">
              Source-linked findings and full report
            </summary>
            <div className="mt-4 space-y-3">
              {evidence.claims.map((c) => (
                <p key={c.id} className="text-sm leading-6 text-ui-text">
                  {c.text}{' '}
                  {c.sourceIds.map((id) => {
                    const source = evidence.sources.find((s) => s.id === id);
                    return source ? (
                      <a
                        key={id}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ui-accent underline"
                      >
                        [{source.title}]{' '}
                      </a>
                    ) : null;
                  })}
                </p>
              ))}
              <pre className="whitespace-pre-wrap break-words border-t border-ui-border pt-4 font-sans text-sm leading-6 text-ui-muted">
                {evidence.report}
              </pre>
            </div>
          </details>
          <div>
            <h3 className="text-sm font-semibold text-ui-heading">
              Sources consulted
            </h3>
            <ul className="mt-2 space-y-1">
              {evidence.sources.map((s) => (
                <li key={s.id}>
                  <a
                    className="break-words text-sm text-ui-accent underline"
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

export default function EnterpriseWorkspace() {
  const router = useRouter();
  const slug =
    typeof router.query.slug === 'string' ? router.query.slug : undefined;
  const { workspace, error, isLoading, change, refresh } =
    useEnterpriseOnboarding(slug);
  const [selected, setSelected] = useState('organization');
  const [assisted, setAssisted] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  if (isLoading)
    return (
      <p role="status" className="p-8 text-ui-muted">
        Loading enterprise onboarding…
      </p>
    );
  if (error || !workspace)
    return (
      <div role="alert" className="border border-ui-border p-8">
        <h1 className="font-serif text-2xl">Could not load onboarding</h1>
        <p className="mt-2">Sign in as a member of this team, then retry.</p>
        <button
          type="button"
          className="btn btn-outline mt-4"
          onClick={() => void refresh()}
        >
          Retry
        </button>
      </div>
    );
  const stage =
    workspace.steps.find((s) => s.id === selected) ?? workspace.steps[0];
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="border border-ui-border bg-ui-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ui-accent">
              Enterprise launch · {workspace.teamName}
            </p>
            <h1 className="mt-2 font-serif text-3xl text-ui-heading sm:text-4xl">
              Complex setup. One clear path.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ui-muted">
              Fourteen readiness stages, multiple owners, and one shared plan.
              Complete the same requirements yourself or let Mark help with
              context, drafts, and the next action.
            </p>
          </div>
          <span className="border border-ui-border px-3 py-1.5 text-xs font-semibold text-ui-heading">
            {workspace.status === 'READY'
              ? 'Readiness approved'
              : workspace.id
                ? 'In progress'
                : 'Ready to begin'}
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [
              `${workspace.metrics.complete}/${workspace.metrics.total}`,
              'Stages reviewed',
            ],
            [String(workspace.metrics.manualFields), 'Fields entered manually'],
            [
              String(workspace.metrics.assistedFields),
              'Fields entered with assistance',
            ],
            [
              String(workspace.metrics.blockers),
              'Stages awaiting prerequisites',
            ],
          ].map(([value, label]) => (
            <div
              key={label}
              className="border border-ui-border bg-ui-canvas p-4"
            >
              <p className="text-2xl font-semibold text-ui-heading">{value}</p>
              <p className="mt-1 text-xs text-ui-muted">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ui-muted">
          Observed counts from this plan—not a claimed time-saving benchmark.{' '}
          {workspace.createdAt
            ? `Started ${new Date(workspace.createdAt).toLocaleString()}.`
            : ''}
        </p>
        {workspace.id && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex border border-ui-border p-1"
              role="group"
              aria-label="Onboarding mode"
            >
              <button
                type="button"
                aria-pressed={!assisted}
                className={`btn btn-sm ${!assisted ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setAssisted(false)}
              >
                Manual
              </button>
              <button
                type="button"
                aria-pressed={assisted}
                className={`btn btn-sm ${assisted ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setAssisted(true)}
              >
                With Mark
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void refresh()}
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh saved plan
            </button>
          </div>
        )}
      </header>
      {message && (
        <div
          role="alert"
          className="border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-ui-text"
        >
          {message}
        </div>
      )}
      {!workspace.id ? (
        <section className="border border-ui-border bg-ui-surface p-8">
          <h2 className="font-serif text-2xl text-ui-heading">
            Start with a durable launch plan
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ui-muted">
            Progress is saved for your team across sessions. Research is opt-in.
            Assign stages to existing members; administrators retain final
            sign-off. No external systems are changed.
          </p>
          <button
            className="btn btn-primary mt-5"
            type="button"
            disabled={!workspace.canManage || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await change({
                  action: 'create',
                  version: 0,
                  source: 'manual',
                });
              } catch (e) {
                setMessage(e instanceof Error ? e.message : 'Could not start');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Creating…' : 'Create enterprise launch plan'}
          </button>
          {!workspace.canManage && (
            <p className="mt-3 text-sm">
              Ask a team owner or administrator to start the plan.
            </p>
          )}
        </section>
      ) : (
        <>
          {assisted && (
            <div className="flex flex-wrap items-center justify-between gap-4 border border-ui-accent/30 bg-ui-accent/5 p-5">
              <div>
                <p className="text-sm font-semibold text-ui-heading">
                  Next useful action: {workspace.nextAction}
                </p>
                <p className="mt-1 text-xs text-ui-muted">
                  Mark reads the saved plan, helps fill gaps, and asks for
                  confirmation before changes.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() =>
                  void askMark(workspace.team).catch((e) =>
                    setMessage(e.message)
                  )
                }
              >
                <SparklesIcon className="h-4 w-4" />
                Continue with Mark
              </button>
            </div>
          )}
          <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <nav
              className="border border-ui-border bg-ui-surface p-3"
              aria-label="Readiness stages"
            >
              <ol className="space-y-1">
                {workspace.steps.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`flex w-full items-start gap-3 p-3 text-left text-sm ${selected === s.id ? 'bg-ui-accent/10 text-ui-heading' : 'text-ui-muted hover:bg-ui-canvas'}`}
                      aria-current={selected === s.id ? 'step' : undefined}
                      onClick={() => {
                        if (draftDirty && s.id !== selected) {
                          setMessage(
                            'Save or discard your current draft before switching stages.'
                          );
                          return;
                        }
                        setSelected(s.id);
                        setMessage('');
                      }}
                    >
                      {s.state === 'complete' ? (
                        <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      ) : s.state === 'blocked' ? (
                        <LockClosedIcon className="mt-0.5 h-5 w-5 shrink-0" />
                      ) : (
                        <span className="w-5 shrink-0 text-center font-semibold">
                          {i + 1}
                        </span>
                      )}
                      <span>
                        <span className="block font-medium">{s.title}</span>
                        <span className="mt-0.5 block text-[11px]">
                          {s.ownerId
                            ? workspace.members.find((m) => m.id === s.ownerId)
                                ?.name
                            : s.owner}{' '}
                          · {s.state}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="min-w-0 space-y-5">
              {selected === 'research' && (
                <ResearchPanel
                  workspace={workspace}
                  change={change}
                  reportError={setMessage}
                />
              )}
              <StageEditor
                onDirtyChange={setDraftDirty}
                key={stage.id}
                stage={stage}
                workspace={workspace}
                change={change}
                assisted={assisted}
                reportError={setMessage}
              />
            </div>
          </div>
          <section className="border border-ui-border bg-ui-surface p-5">
            <details>
              <summary className="cursor-pointer font-semibold text-ui-heading">
                Activity & accountability · revision {workspace.version}
              </summary>
              <ol className="mt-4 space-y-3">
                {workspace.events.map((e) => (
                  <li
                    key={e.id}
                    className="border-l-2 border-ui-border pl-3 text-sm text-ui-text"
                  >
                    <p>{e.message}</p>
                    <p className="mt-1 text-xs text-ui-muted">
                      {e.actor} · {new Date(e.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          </section>
        </>
      )}
      <p className="border-l-2 border-ui-border pl-4 text-xs leading-6 text-ui-muted">
        {workspace.boundary}
      </p>
    </div>
  );
}
