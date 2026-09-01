jest.mock('../../lib/api/auth', () => ({
  requireApiPrincipal: jest.fn(),
  requireScope: jest.fn(),
}));

jest.mock('../../models/team', () => ({
  createTeam: jest.fn(),
}));

jest.mock('../../lib/prisma', () => {
  const tx = {
    team: { update: jest.fn() },
    timeOffPolicy: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };
  return {
    prisma: {
      teamMember: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      team: { count: jest.fn() },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx)
      ),
    },
    __tx: tx,
  };
});

import handler from '../../pages/api/v1/onboarding/complete';
import { requireApiPrincipal, requireScope } from '../../lib/api/auth';
import { prisma } from '../../lib/prisma';
import { createTeam } from '../../models/team';

const { __tx: tx } = jest.requireMock('../../lib/prisma') as {
  __tx: {
    team: { update: jest.Mock };
    timeOffPolicy: { upsert: jest.Mock; findMany: jest.Mock };
  };
};

const input = {
  businessName: 'Acme Studio',
  teamSize: '11-50',
  timeZone: 'America/Los_Angeles',
  primaryGoal: 'BOTH',
  vacationAllowanceDays: 20,
  sickAllowanceDays: 10,
  personalAllowanceDays: 3,
};

const team = {
  id: 'team-1',
  name: input.businessName,
  slug: 'acme-studio',
  businessSizeBand: input.teamSize,
  timeZone: input.timeZone,
  onboardingGoal: input.primaryGoal,
  onboardingCompletedAt: new Date('2026-09-01T18:00:00.000Z'),
};

const invoke = async (body: unknown = input) => {
  const captured = { status: 0, body: undefined as any };
  const res: any = {
    setHeader: jest.fn(),
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  };
  await handler(
    {
      method: 'POST',
      headers: {},
      body,
      url: '/api/v1/onboarding/complete',
    } as any,
    res
  );
  return captured;
};

describe('POST /api/v1/onboarding/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireApiPrincipal).mockResolvedValue({
      type: 'user',
      userId: 'user-1',
      scopes: ['teams', 'time_off.policy'],
    });
    jest.mocked(prisma.teamMember.findFirst).mockResolvedValue({
      teamId: team.id,
      team,
    } as any);
    tx.team.update.mockResolvedValue(team);
    tx.timeOffPolicy.findMany.mockResolvedValue([
      { type: 'VACATION', annualAllowanceHalfDays: 40 },
      { type: 'SICK', annualAllowanceHalfDays: 20 },
      { type: 'PERSONAL', annualAllowanceHalfDays: 6 },
      { type: 'UNPAID', annualAllowanceHalfDays: null },
    ]);
  });

  it('applies the profile and all policy types to the matching owner team', async () => {
    const response = await invoke();

    expect(response.status).toBe(200);
    expect(requireScope).toHaveBeenCalledWith(
      expect.anything(),
      'time_off.policy'
    );
    expect(tx.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: team.id },
        data: expect.objectContaining({
          businessSizeBand: '11-50',
          timeZone: 'America/Los_Angeles',
          onboardingGoal: 'BOTH',
        }),
      })
    );
    expect(tx.timeOffPolicy.upsert).toHaveBeenCalledTimes(4);
    expect(response.body.data).toMatchObject({
      status: 'READY',
      authenticated: true,
      team: { name: 'Acme Studio', slug: 'acme-studio' },
    });
  });

  it('creates a separate business for an existing user without a matching owner team', async () => {
    jest.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);
    jest.mocked(prisma.team.count).mockResolvedValue(0);
    jest.mocked(createTeam).mockResolvedValue(team as any);
    jest.mocked(prisma.teamMember.findUniqueOrThrow).mockResolvedValue({
      teamId: team.id,
      team,
    } as any);

    const response = await invoke();

    expect(response.status).toBe(200);
    expect(createTeam).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Acme Studio',
      slug: 'acme-studio',
    });
  });

  it('rejects malformed blueprint input before writing anything', async () => {
    const response = await invoke({ ...input, timeZone: 'Mars/Olympus' });

    expect(response.status).toBe(422);
    expect(tx.team.update).not.toHaveBeenCalled();
    expect(tx.timeOffPolicy.upsert).not.toHaveBeenCalled();
  });
});
