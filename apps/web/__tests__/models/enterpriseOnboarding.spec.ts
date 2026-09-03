/** @jest-environment node */
jest.mock('../../lib/prisma', () => {
  const tx = {
    enterpriseOnboarding: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    enterpriseResearch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    enterpriseOnboardingEvent: { create: jest.fn() },
    teamMember: { findUnique: jest.fn(), findMany: jest.fn() },
  };
  return {
    prisma: {
      ...tx,
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
});
jest.mock('../../lib/enterprise-research', () => ({
  ...jest.requireActual('../../lib/enterprise-research'),
  researchCompany: jest.fn(),
  enqueueResearch: jest.fn(),
  researchConfigured: jest.fn(() => true),
}));
import { prisma } from '@/lib/prisma';
import { initialJourney } from '@/lib/enterprise-onboarding';
import { ApiError } from '@/lib/errors';
import { researchCompany } from '@/lib/enterprise-research';
import {
  changeEnterpriseWorkspace,
  processEnterpriseResearch,
} from 'models/enterpriseOnboarding';

const db = prisma as any;
const member = {
  teamId: 'team-1',
  userId: 'user-1',
  role: 'OWNER',
  user: { name: 'Owner' },
  team: { name: 'Example', slug: 'example' },
} as any;
const run = {
  id: 'run-1',
  journeyId: 'journey-1',
  status: 'QUEUED',
  attempts: 0,
  input: { companyName: 'Example', companyDomain: 'example.com' },
  model: 'gemini-3.8-flash',
};
describe('enterprise persistence and background boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.enterpriseOnboarding.findUnique.mockResolvedValue({
      id: 'journey-1',
      teamId: 'team-1',
      version: 4,
      state: initialJourney('Example'),
    });
    db.enterpriseOnboarding.updateMany.mockResolvedValue({ count: 1 });
    db.enterpriseResearch.findUnique.mockResolvedValue(run);
    db.enterpriseResearch.updateMany.mockResolvedValue({ count: 1 });
  });
  it('rejects stale and guessed future revisions before writing', async () => {
    for (const version of [3, 5])
      await expect(
        changeEnterpriseWorkspace(member, {
          action: 'save-step',
          version,
          stepId: 'organization',
          source: 'manual',
        })
      ).rejects.toMatchObject({ status: 409 });
    expect(db.enterpriseOnboarding.updateMany).not.toHaveBeenCalled();
  });
  it('rejects concurrent compare-and-swap failure', async () => {
    db.enterpriseOnboarding.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      changeEnterpriseWorkspace(member, {
        action: 'save-step',
        version: 4,
        stepId: 'organization',
        source: 'manual',
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(db.enterpriseOnboarding.update).not.toHaveBeenCalled();
  });
  it('does not allow unassigned members, cross-team assignment, or non-admin launch', async () => {
    await expect(
      changeEnterpriseWorkspace(
        { ...member, role: 'MEMBER' },
        {
          action: 'save-step',
          version: 4,
          stepId: 'organization',
          source: 'manual',
        }
      )
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      changeEnterpriseWorkspace(
        { ...member, role: 'MEMBER' },
        {
          action: 'complete-step',
          version: 4,
          stepId: 'launch',
          source: 'manual',
        }
      )
    ).rejects.toMatchObject({ status: 403 });
    db.teamMember.findUnique.mockResolvedValue(null);
    await expect(
      changeEnterpriseWorkspace(member, {
        action: 'assign',
        version: 4,
        stepId: 'security',
        ownerId: 'outsider',
        source: 'manual',
      })
    ).rejects.toMatchObject({ status: 422 });
  });
  it('requires explicit research consent and exact saved identity', async () => {
    db.enterpriseResearch.findFirst.mockResolvedValue(null);
    db.enterpriseResearch.count.mockResolvedValue(0);
    await expect(
      changeEnterpriseWorkspace(member, {
        action: 'start-research',
        version: 4,
        source: 'manual',
      })
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      changeEnterpriseWorkspace(member, {
        action: 'start-research',
        version: 4,
        source: 'manual',
        researchConsent: true,
        researchIdentity: { companyName: 'Wrong', companyDomain: 'wrong.com' },
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(db.enterpriseResearch.create).not.toHaveBeenCalled();
  });
  it('enforces the daily research limit server-side', async () => {
    db.enterpriseResearch.findFirst.mockResolvedValue(null);
    db.enterpriseResearch.count.mockResolvedValue(3);
    await expect(
      changeEnterpriseWorkspace(member, {
        action: 'start-research',
        version: 4,
        source: 'manual',
        researchConsent: true,
      })
    ).rejects.toMatchObject({ status: 429 });
  });
  it.each(['CANCELED', 'SUCCEEDED'])(
    'does not execute duplicate delivery for %s research',
    async (status) => {
      db.enterpriseResearch.findUnique.mockResolvedValue({ ...run, status });
      await processEnterpriseResearch(run.id);
      expect(researchCompany).not.toHaveBeenCalled();
    }
  );
  it('does not publish late results when cancellation wins the compare-and-swap', async () => {
    db.enterpriseResearch.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    jest
      .mocked(researchCompany)
      .mockResolvedValue({ model: run.model, suggestions: [] } as any);
    await processEnterpriseResearch(run.id);
    expect(db.enterpriseOnboardingEvent.create).not.toHaveBeenCalled();
    expect(db.enterpriseOnboarding.update).not.toHaveBeenCalled();
  });
  it('keeps transient failures queued for bounded retry and makes bad evidence terminal', async () => {
    jest
      .mocked(researchCompany)
      .mockRejectedValue(new ApiError(503, 'Unavailable'));
    await expect(processEnterpriseResearch(run.id)).rejects.toMatchObject({
      status: 503,
    });
    expect(db.enterpriseResearch.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUEUED', attempts: 1 }),
      })
    );
    jest
      .mocked(researchCompany)
      .mockRejectedValue(new ApiError(422, 'No cited evidence'));
    await processEnterpriseResearch(run.id);
    expect(db.enterpriseResearch.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', attempts: 3 }),
      })
    );
  });
  it('closes a crashed final attempt without starting another provider call', async () => {
    db.enterpriseResearch.findUnique.mockResolvedValue({
      ...run,
      status: 'RUNNING',
      attempts: 3,
      startedAt: new Date(Date.now() - 200000),
    });
    await processEnterpriseResearch(run.id);
    expect(researchCompany).not.toHaveBeenCalled();
    expect(db.enterpriseResearch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    );
  });
});
