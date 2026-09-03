/** Local integration test only: creates disposable fixtures in the named task database. */
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { enterpriseSteps } from '../lib/enterprise-onboarding';

const database = new URL(process.env.DATABASE_URL || 'http://invalid');
assert(
  ['localhost', '127.0.0.1'].includes(database.hostname) &&
    database.port === '55433' &&
    database.pathname === '/enterprise_onboarding',
  'Use the isolated enterprise_onboarding database on localhost:55433 only.'
);
const prisma = new PrismaClient();
const origin = 'http://localhost:4002';
const password = 'local-enterprise-test-only';

async function login(email: string) {
  const csrf = await fetch(`${origin}/api/auth/csrf`);
  const csrfBody = await csrf.json();
  const cookies = csrf.headers.getSetCookie().map((c) => c.split(';')[0]);
  const signedIn = await fetch(`${origin}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Cookie: cookies.join('; '),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken: csrfBody.csrfToken,
      callbackUrl: origin,
      json: 'true',
    }),
  });
  cookies.push(...signedIn.headers.getSetCookie().map((c) => c.split(';')[0]));
  const cookie = cookies.join('; ');
  const session = await (
    await fetch(`${origin}/api/auth/session`, { headers: { Cookie: cookie } })
  ).json();
  assert(session.user?.email === email, `Fixture login failed for ${email}`);
  return cookie;
}

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: 'enterprise-owner@example.test' },
    update: {},
    create: {
      name: 'Enterprise Demo Owner',
      email: 'enterprise-owner@example.test',
      password: await hash(password, 12),
      emailVerified: new Date(),
    },
  });
  const member = await prisma.user.upsert({
    where: { email: 'enterprise-member@example.test' },
    update: {},
    create: {
      name: 'Enterprise Demo Member',
      email: 'enterprise-member@example.test',
      password: await hash(password, 12),
      emailVerified: new Date(),
    },
  });
  const team = await prisma.team.upsert({
    where: { slug: 'enterprise-demo' },
    update: {},
    create: { name: 'Enterprise Demo', slug: 'enterprise-demo' },
  });
  const otherTeam = await prisma.team.upsert({
    where: { slug: 'enterprise-outsider' },
    update: {},
    create: { name: 'Other Test Team', slug: 'enterprise-outsider' },
  });
  for (const [userId, role] of [
    [owner.id, 'OWNER'],
    [member.id, 'MEMBER'],
  ] as const)
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId } },
      update: {},
      create: { teamId: team.id, userId, role },
    });
  // Reset only this script's named fixture journey, never a general database cleanup.
  await prisma.enterpriseOnboarding.deleteMany({ where: { teamId: team.id } });
  const ownerCookie = await login(owner.email);
  const memberCookie = await login(member.email);
  const route = `/api/v1/teams/${team.slug}/enterprise-onboarding`;
  async function api(
    cookie: string,
    body?: unknown,
    key?: string,
    path = route
  ) {
    const response = await fetch(`${origin}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Cookie: cookie,
        Origin: origin,
        'Content-Type': 'application/json',
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await api('')).status, 401);
  assert.equal(
    (
      await api(
        ownerCookie,
        undefined,
        undefined,
        `/api/v1/teams/${otherTeam.slug}/enterprise-onboarding`
      )
    ).status,
    403
  );
  assert.equal(
    (await api(memberCookie, { action: 'create', version: 0 })).status,
    403
  );
  const created = await api(ownerCookie, { action: 'create', version: 0 });
  assert.equal(created.status, 200);
  let workspace = created.data.data;
  assert.equal(workspace.steps.length, 5);
  assert.equal(
    (
      await api(memberCookie, {
        action: 'complete-step',
        version: workspace.version,
        stepId: 'launch',
      })
    ).status,
    403
  );
  assert.equal(
    (
      await api(ownerCookie, {
        action: 'complete-step',
        version: workspace.version,
        stepId: 'launch',
      })
    ).status,
    422
  );
  assert.equal(
    (await api(ownerCookie)).data.data.version,
    workspace.version,
    'Rejected writes must roll back revision'
  );
  const assigned = await api(ownerCookie, {
    action: 'assign',
    version: workspace.version,
    stepId: 'organization',
    ownerId: member.id,
  });
  assert.equal(assigned.status, 200);
  workspace = assigned.data.data;
  const edited = await api(memberCookie, {
    action: 'save-step',
    version: workspace.version,
    stepId: 'organization',
    values: { industry: 'Business software' },
    source: 'manual',
  });
  assert.equal(edited.status, 200);
  workspace = edited.data.data;
  assert.equal(
    (
      await api(ownerCookie, {
        action: 'save-step',
        version: workspace.version - 1,
        stepId: 'organization',
      })
    ).status,
    409
  );
  for (const step of enterpriseSteps) {
    const values = Object.fromEntries(
      step.fields.map((f) => [
        f.id,
        f.choices?.[0] ??
          (f.id === 'companyDomain'
            ? 'example.com'
            : `Synthetic test: ${f.label}`),
      ])
    );
    const payload = {
      action: 'complete-step',
      version: workspace.version,
      stepId: step.id,
      values,
      source: 'manual',
    };
    const key = `enterprise-${created.data.data.id}-${step.id}`;
    const completed = await api(ownerCookie, payload, key);
    assert.equal(completed.status, 200, JSON.stringify(completed.data));
    workspace = completed.data.data;
    const duplicate = await api(ownerCookie, payload, key);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.data.data.version, workspace.version);
    assert.equal(
      (await api(ownerCookie, { ...payload, version: 999 }, key)).status,
      409
    );
  }
  assert.equal(workspace.status, 'READY');
  assert.equal(workspace.metrics.complete, 5);
  const reopened = await api(ownerCookie, {
    action: 'save-step',
    version: workspace.version,
    stepId: 'access',
    values: { roleModel: 'Revised synthetic pilot roles' },
  });
  assert.equal(reopened.status, 200);
  workspace = reopened.data.data;
  assert.equal(workspace.status, 'ACTIVE');
  assert.equal(
    workspace.steps.find((s: any) => s.id === 'launch').state,
    'blocked'
  );
  assert.equal((await api(ownerCookie)).data.data.version, workspace.version);
  // Provider output is a labeled local fixture, not a live Google research claim.
  const identity = workspace.steps.find(
    (s: any) => s.id === 'organization'
  ).values;
  const fixtureEvidence = {
    report:
      'SYNTHETIC TEST DATA: an example public-company report for acceptance testing.',
    sources: [
      {
        id: 'source-0',
        title: 'Example test source',
        url: 'https://example.com/',
      },
    ],
    claims: [],
    suggestions: [
      {
        id: 'suggestion-0',
        stepId: 'research',
        fieldId: 'companySummary',
        value: 'SYNTHETIC TEST DATA: reviewed company context.',
        kind: 'sourced',
        sourceIds: ['source-0'],
      },
    ],
    unknowns: ['SYNTHETIC TEST DATA: no live provider was called.'],
    model: 'synthetic-local-fixture',
    retrievedAt: new Date().toISOString(),
    inputTokens: 0,
    outputTokens: 0,
  };
  const research = await prisma.enterpriseResearch.create({
    data: {
      journeyId: workspace.id,
      status: 'SUCCEEDED',
      attempts: 1,
      model: fixtureEvidence.model,
      input: {
        companyName: identity.companyName,
        companyDomain: identity.companyDomain,
      },
      result: fixtureEvidence,
      finishedAt: new Date(),
    },
  });
  assert.notEqual(
    workspace.steps.find((s: any) => s.id === 'research').values.companySummary,
    fixtureEvidence.suggestions[0].value
  );
  const accepted = await api(ownerCookie, {
    action: 'accept-suggestions',
    version: workspace.version,
    suggestionIds: ['suggestion-0'],
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
  workspace = accepted.data.data;
  let researchStage = workspace.steps.find((s: any) => s.id === 'research');
  assert.equal(
    researchStage.values.companySummary,
    fixtureEvidence.suggestions[0].value
  );
  assert.equal(researchStage.origins.companySummary, 'research');
  assert.equal(researchStage.evidenceRefs.companySummary.runId, research.id);
  assert.deepEqual(researchStage.evidenceRefs.companySummary.sourceUrls, [
    'https://example.com/',
  ]);
  assert.equal(
    researchStage.completedAt,
    null,
    'Accepting a draft must not complete a stage'
  );
  const reviewed = await api(ownerCookie, {
    action: 'complete-step',
    version: workspace.version,
    stepId: 'research',
    values: researchStage.values,
    source: 'manual',
  });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.data));
  workspace = reviewed.data.data;
  researchStage = workspace.steps.find((s: any) => s.id === 'research');
  assert.equal(
    researchStage.origins.companySummary,
    'research',
    'Reviewing unchanged fields preserves attribution'
  );
  assert.equal(researchStage.evidenceRefs.companySummary.runId, research.id);
  await prisma.enterpriseResearch.create({
    data: {
      journeyId: workspace.id,
      status: 'SUCCEEDED',
      attempts: 1,
      model: fixtureEvidence.model,
      input: {
        companyName: identity.companyName,
        companyDomain: identity.companyDomain,
      },
      result: {
        ...fixtureEvidence,
        suggestions: [
          {
            ...fixtureEvidence.suggestions[0],
            id: 'suggestion-1',
            stepId: 'organization',
            fieldId: 'industry',
            value: 'SYNTHETIC TEST DATA: public business software.',
          },
        ],
      },
      finishedAt: new Date(),
    },
  });
  const refreshed = (await api(ownerCookie)).data.data;
  assert.equal(
    refreshed.steps.find((s: any) => s.id === 'research').evidenceRefs
      .companySummary.runId,
    research.id,
    'A newer research job must not detach accepted source context'
  );
  const assistant = await api(
    ownerCookie,
    undefined,
    undefined,
    `${route}?view=assistant`
  );
  assert.equal(
    assistant.data.data.research.evidence.report,
    '',
    'Verbose reports stay out of assistant context'
  );
  console.log(
    'PASS: authenticated API, team isolation, role/owner checks, transaction rollback, five-stage completion, idempotent replay, stale conflicts, dependency invalidation, persistence, explicit research acceptance, durable source context, preserved attribution.'
  );
  console.log(
    'Local UI fixture: enterprise-owner@example.test / local-enterprise-test-only at http://localhost:4002/teams/enterprise-demo/enterprise-onboarding'
  );
}
main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
