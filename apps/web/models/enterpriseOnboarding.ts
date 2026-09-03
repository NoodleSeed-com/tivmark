import type { Prisma, TeamMember, Team, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/errors';
import {
  applyStepCommand,
  descendants,
  enterpriseSteps,
  enterpriseWorkspaceSchema,
  evidenceSchema,
  initialJourney,
  currentJourney,
  isCurrentField,
  type EnterpriseCommand,
} from '@/lib/enterprise-onboarding';
import {
  enqueueResearch,
  researchCompany,
  researchConfigured,
  researchInputSchema,
  researchModel,
} from '@/lib/enterprise-research';

type Member = TeamMember & { team: Team; user: User };
const admin = (member: Member) => ['ADMIN', 'OWNER'].includes(member.role);
const json = (value: unknown) => value as Prisma.InputJsonValue;
const boundary =
  'This saves an onboarding plan. It does not configure SSO, grant legal approval, connect systems, migrate data, or perform production cutover.';

export async function getEnterpriseWorkspace(member: Member) {
  const [journey, members] = await Promise.all([
    prisma.enterpriseOnboarding.findUnique({
      where: { teamId: member.teamId },
      include: {
        research: { orderBy: { createdAt: 'desc' }, take: 1 },
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    }),
    prisma.teamMember.findMany({
      where: { teamId: member.teamId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
  ]);
  const state = journey
    ? currentJourney(journey.state)
    : initialJourney(member.team.name);
  const steps = enterpriseSteps.map((step) => ({
    ...step,
    adminOnly: step.adminOnly ?? false,
    ...state.steps[step.id],
    values: Object.fromEntries(
      Object.entries(state.steps[step.id].values).filter(([id]) =>
        isCurrentField(step.id, id)
      )
    ),
    origins: Object.fromEntries(
      Object.entries(state.steps[step.id].origins).filter(([id]) =>
        isCurrentField(step.id, id)
      )
    ),
    evidenceRefs: Object.fromEntries(
      Object.entries(state.steps[step.id].evidenceRefs).filter(([id]) =>
        isCurrentField(step.id, id)
      )
    ),
    state: state.steps[step.id].completedAt
      ? ('complete' as const)
      : step.dependsOn.some((id) => !state.steps[id].completedAt)
        ? ('blocked' as const)
        : ('ready' as const),
    missing: step.fields
      .filter((f) => !f.optional && !state.steps[step.id].values[f.id]?.trim())
      .map((f) => f.label),
  }));
  const run = journey?.research[0];
  const input = run ? researchInputSchema.safeParse(run.input) : null;
  const organization = state.steps.organization.values;
  const stale = Boolean(
    run &&
    (!input?.success ||
      input.data.companyName !== organization.companyName ||
      input.data.companyDomain !== organization.companyDomain ||
      Date.now() - run.createdAt.getTime() > 7 * 86400000)
  );
  const result = evidenceSchema.safeParse(run?.result);
  const origins = steps.flatMap((s) =>
    Object.entries(s.values)
      .filter(([, value]) => value.trim())
      .map(([key]) => s.origins[key] ?? 'manual')
  );
  return enterpriseWorkspaceSchema.parse({
    id: journey?.id ?? null,
    team: member.team.slug,
    teamName: member.team.name,
    version: journey?.version ?? 0,
    status: state.steps.launch.completedAt
      ? 'READY'
      : journey
        ? 'ACTIVE'
        : 'NOT_STARTED',
    canManage: admin(member),
    currentUserId: member.userId,
    createdAt: journey?.createdAt.toISOString() ?? null,
    updatedAt: journey?.updatedAt.toISOString() ?? null,
    url: `https://app.tivmark.com/teams/${encodeURIComponent(member.team.slug)}/enterprise-onboarding`,
    steps,
    members: members.map((m) => ({
      id: m.userId,
      name: m.user.name,
      role: m.role,
    })),
    research: run
      ? {
          id: run.id,
          status: run.status,
          attempts: run.attempts,
          model: run.model,
          error: run.error,
          createdAt: run.createdAt.toISOString(),
          evidence: result.success
            ? {
                ...result.data,
                suggestions: result.data.suggestions.filter((s) =>
                  isCurrentField(s.stepId, s.fieldId)
                ),
              }
            : null,
          acceptedIds: run.acceptedIds,
          stale,
        }
      : null,
    metrics: {
      complete: steps.filter((s) => s.state === 'complete').length,
      total: steps.length,
      manualFields: origins.filter((o) => o === 'manual').length,
      assistedFields: origins.filter((o) => o !== 'manual').length,
      blockers: steps.filter((s) => s.state === 'blocked').length,
    },
    events: (journey?.events ?? []).map((e) => ({
      id: e.id,
      actor: e.actor,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    })),
    researchAvailable: researchConfigured(),
    nextAction:
      steps.find((s) => s.state === 'ready')?.title ??
      'Readiness plan approved. Coordinate the actual production cutover with your launch owner.',
    boundary:
      boundary +
      (state.previousSteps
        ? ' Earlier detailed-plan notes and approvals are retained in storage; the five-stage plan requires fresh review.'
        : ''),
  });
}

export async function changeEnterpriseWorkspace(
  member: Member,
  input: EnterpriseCommand
) {
  let enqueueId: string | null = null;
  if (input.action === 'create') {
    if (!admin(member))
      throw new ApiError(
        403,
        'Only an owner or administrator can start enterprise onboarding'
      );
    if (input.version !== 0)
      throw new ApiError(409, 'Refresh the workspace before creating a plan');
    await prisma.enterpriseOnboarding.upsert({
      where: { teamId: member.teamId },
      update: {},
      create: {
        teamId: member.teamId,
        state: json(initialJourney(member.team.name)),
        events: {
          create: {
            actor: member.user.name,
            actorId: member.userId,
            message: 'Started the five-stage onboarding plan.',
          },
        },
      },
    });
    return getEnterpriseWorkspace(member);
  }

  await prisma.$transaction(async (tx) => {
    const journey = await tx.enterpriseOnboarding.findUnique({
      where: { teamId: member.teamId },
    });
    if (!journey) throw new ApiError(404, 'Start enterprise onboarding first');
    if (journey.version !== input.version)
      throw new ApiError(
        409,
        'This plan changed. Refresh and review the latest version before saving.'
      );
    const locked = await tx.enterpriseOnboarding.updateMany({
      where: { id: journey.id, version: input.version },
      data: { version: { increment: 1 } },
    });
    if (!locked.count)
      throw new ApiError(
        409,
        'This plan changed. Refresh and review the latest version before saving.'
      );
    let state = currentJourney(journey.state);
    let message = '';
    if (
      ['save-step', 'complete-step', 'reopen-step', 'assign'].includes(
        input.action
      )
    ) {
      const step = enterpriseSteps.find((s) => s.id === input.stepId);
      if (!step) throw new ApiError(422, 'Choose a stage');
      if (
        !admin(member) &&
        (step.adminOnly ||
          state.steps[step.id].ownerId !== member.userId ||
          input.action === 'assign')
      )
        throw new ApiError(
          403,
          'Only the assigned member or an administrator can change this stage'
        );
      if (
        input.ownerId &&
        !(await tx.teamMember.findUnique({
          where: {
            teamId_userId: { teamId: member.teamId, userId: input.ownerId },
          },
        }))
      )
        throw new ApiError(422, 'Assign an existing member of this team');
      try {
        state = applyStepCommand(
          state,
          input,
          admin(member),
          new Date().toISOString()
        );
      } catch (error) {
        throw new ApiError(
          422,
          error instanceof Error ? error.message : 'Invalid stage'
        );
      }
      message = `${input.action === 'complete-step' ? 'Reviewed and completed' : input.action === 'reopen-step' ? 'Reopened' : input.action === 'assign' ? 'Assigned' : 'Saved draft for'} ${step.title} (${input.source}).${input.action !== 'assign' ? ' Dependent sign-offs require fresh review.' : ''}`;
    } else {
      if (!admin(member))
        throw new ApiError(
          403,
          'Only an owner or administrator can manage research'
        );
      const run = await tx.enterpriseResearch.findFirst({
        where: { journeyId: journey.id },
        orderBy: { createdAt: 'desc' },
      });
      if (input.action === 'start-research') {
        if (!input.researchConsent)
          throw new ApiError(
            422,
            'Confirm sending the public company name and domain to Google for research'
          );
        if (!researchConfigured())
          throw new ApiError(503, 'Google research is not configured');
        if (run && ['QUEUED', 'RUNNING'].includes(run.status))
          throw new ApiError(409, 'Research is already in progress');
        const daily = await tx.enterpriseResearch.count({
          where: {
            journeyId: journey.id,
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        });
        if (daily >= 3)
          throw new ApiError(
            429,
            'The limit is three research runs per team in a rolling 24-hour period'
          );
        const organization = state.steps.organization.values;
        if (
          !input.researchIdentity ||
          input.researchIdentity.companyName !== organization.companyName ||
          input.researchIdentity.companyDomain !== organization.companyDomain
        )
          throw new ApiError(
            409,
            'Review and confirm the current company name and domain before research.'
          );
        const request = researchInputSchema.parse({
          companyName: organization.companyName,
          companyDomain: organization.companyDomain,
        });
        const created = await tx.enterpriseResearch.create({
          data: {
            journeyId: journey.id,
            model: researchModel(),
            input: json(request),
          },
        });
        enqueueId = created.id;
        message =
          'Requested public organization research through Google Cloud. Only the company name and domain were selected for transmission; no findings are automatically accepted.';
      } else if (input.action === 'cancel-research') {
        if (!run || !['QUEUED', 'RUNNING', 'FAILED'].includes(run.status))
          throw new ApiError(409, 'There is no cancellable research run');
        await tx.enterpriseResearch.update({
          where: { id: run.id },
          data: { status: 'CANCELED', finishedAt: new Date() },
        });
        message =
          'Canceled research. Late results will be discarded; already incurred provider usage cannot be reversed.';
      } else if (input.action === 'accept-suggestions') {
        if (!run || run.status !== 'SUCCEEDED')
          throw new ApiError(
            409,
            'Complete research before reviewing suggestions'
          );
        const request = researchInputSchema.parse(run.input);
        if (
          request.companyName !== state.steps.organization.values.companyName ||
          request.companyDomain !==
            state.steps.organization.values.companyDomain ||
          Date.now() - run.createdAt.getTime() > 7 * 86400000
        )
          throw new ApiError(
            409,
            'Research is stale for this company. Run it again or enter reviewed facts manually.'
          );
        const evidence = evidenceSchema.parse(run.result);
        if (!input.suggestionIds?.length)
          throw new ApiError(422, 'Select at least one suggestion to accept');
        let applied = 0;
        for (const id of Array.from(new Set(input.suggestionIds))) {
          const suggestion = evidence.suggestions.find((s) => s.id === id);
          if (!suggestion)
            throw new ApiError(422, 'Unknown research suggestion');
          if (!isCurrentField(suggestion.stepId, suggestion.fieldId))
            throw new ApiError(
              422,
              'This suggestion belongs to the earlier detailed plan. Refresh to review current suggestions.'
            );
          if (run.acceptedIds.includes(id)) continue;
          applied += 1;
          state.steps[suggestion.stepId].values[suggestion.fieldId] =
            suggestion.value;
          state.steps[suggestion.stepId].origins[suggestion.fieldId] =
            'research';
          state.steps[suggestion.stepId].evidenceRefs[suggestion.fieldId] = {
            runId: run.id,
            suggestionId: suggestion.id,
            retrievedAt: evidence.retrievedAt,
            sourceUrls: suggestion.sourceIds
              .map((id) => evidence.sources.find((s) => s.id === id)?.url)
              .filter((url): url is string => Boolean(url)),
          };
          for (const step of [
            suggestion.stepId,
            ...descendants(suggestion.stepId),
          ])
            state.steps[step].completedAt = null;
        }
        await tx.enterpriseResearch.update({
          where: { id: run.id },
          data: {
            acceptedIds: Array.from(
              new Set([...run.acceptedIds, ...input.suggestionIds])
            ),
          },
        });
        message = `Accepted ${applied} reviewed research suggestions into draft fields. Stage completion and approval remain separate.`;
      }
    }
    await tx.enterpriseOnboarding.update({
      where: { id: journey.id },
      data: { state: json(state) },
    });
    await tx.enterpriseOnboardingEvent.create({
      data: {
        journeyId: journey.id,
        actor: member.user.name,
        actorId: member.userId,
        message,
      },
    });
  });
  if (enqueueId) {
    try {
      await enqueueResearch(enqueueId);
    } catch {
      await prisma.enterpriseResearch.updateMany({
        where: { id: enqueueId, status: 'QUEUED' },
        data: {
          status: 'FAILED',
          error:
            'The background job could not be queued. Check Google Cloud Tasks configuration, then request a new run.',
          finishedAt: new Date(),
        },
      });
    }
  }
  return getEnterpriseWorkspace(member);
}

export async function processEnterpriseResearch(runId: string) {
  const run = await prisma.enterpriseResearch.findUnique({
    where: { id: runId },
  });
  if (!run || ['SUCCEEDED', 'CANCELED'].includes(run.status)) return;
  const stale = new Date(Date.now() - 180000);
  if (run.attempts >= 3) {
    if (run.status === 'RUNNING' && run.startedAt && run.startedAt >= stale)
      throw new ApiError(409, 'Research is already running');
    await prisma.enterpriseResearch.updateMany({
      where: { id: run.id, status: { in: ['RUNNING', 'QUEUED'] } },
      data: {
        status: 'FAILED',
        error:
          'Research exhausted its bounded attempts. No late result will be applied; request a new run if needed.',
        finishedAt: new Date(),
      },
    });
    return;
  }
  const acquired = await prisma.enterpriseResearch.updateMany({
    where: {
      id: run.id,
      // The lease must belong to the revision read above. A delayed duplicate
      // cannot claim a newer retry and then discard its result under an old attempt.
      attempts: run.attempts,
      OR: [
        { status: { in: ['QUEUED', 'FAILED'] } },
        { status: 'RUNNING', startedAt: { lt: stale } },
      ],
    },
    data: {
      status: 'RUNNING',
      attempts: { increment: 1 },
      startedAt: new Date(),
      error: null,
    },
  });
  if (!acquired.count) throw new ApiError(409, 'Research is already running');
  try {
    const evidence = await researchCompany(
      researchInputSchema.parse(run.input),
      run.model
    );
    await prisma.$transaction(async (tx) => {
      const saved = await tx.enterpriseResearch.updateMany({
        where: { id: run.id, status: 'RUNNING', attempts: run.attempts + 1 },
        data: {
          status: 'SUCCEEDED',
          result: json(evidence),
          finishedAt: new Date(),
        },
      });
      if (saved.count)
        await tx.enterpriseOnboardingEvent.create({
          data: {
            journeyId: run.journeyId,
            actor: 'Google research',
            message: `Completed cited organization research with ${evidence.model}. ${evidence.suggestions.length} provisional suggestions await review. No fields were changed.`,
          },
        });
    });
  } catch (error) {
    const terminal = error instanceof ApiError && error.status === 422;
    await prisma.enterpriseResearch.updateMany({
      where: { id: run.id, status: 'RUNNING', attempts: run.attempts + 1 },
      data: {
        status: terminal || run.attempts + 1 >= 3 ? 'FAILED' : 'QUEUED',
        attempts: terminal ? 3 : run.attempts + 1,
        error:
          error instanceof ApiError
            ? error.message
            : 'Research failed safely. No findings were applied.',
        finishedAt: new Date(),
      },
    });
    if (!terminal && run.attempts + 1 < 3)
      throw new ApiError(503, 'Retryable research failure');
  }
}
