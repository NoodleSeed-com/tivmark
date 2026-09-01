jest.mock('../../lib/api/auth', () => ({
  requireApiPrincipal: jest.fn(),
  requireScope: jest.fn(),
}));

jest.mock('../../lib/api/team', () => ({
  requireTeamPrincipal: jest.fn(),
}));

jest.mock('../../lib/email/sendTeamInviteEmail', () => ({
  sendTeamInviteEmail: jest.fn(),
}));

jest.mock('../../lib/prisma', () => {
  const tx = {
    teamMember: { findFirst: jest.fn() },
    newHireLaunch: { findUnique: jest.fn(), create: jest.fn() },
    invitation: { upsert: jest.fn() },
    equipmentRequest: { create: jest.fn() },
    timeOffPolicy: { findMany: jest.fn() },
  };
  return {
    prisma: {
      newHireLaunch: { findMany: jest.fn(), findUnique: jest.fn() },
      timeOffPolicy: { findMany: jest.fn() },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx)
      ),
    },
    __tx: tx,
  };
});

import handler from '../../pages/api/v1/teams/[teamId]/new-hire-launches';
import planHandler from '../../pages/api/v1/teams/[teamId]/new-hire-launches/plan';
import { requireScope } from '../../lib/api/auth';
import { requireTeamPrincipal } from '../../lib/api/team';
import { sendTeamInviteEmail } from '../../lib/email/sendTeamInviteEmail';
import { prisma } from '../../lib/prisma';

const { __tx: tx } = jest.requireMock('../../lib/prisma') as {
  __tx: {
    teamMember: { findFirst: jest.Mock };
    newHireLaunch: { findUnique: jest.Mock; create: jest.Mock };
    invitation: { upsert: jest.Mock };
    equipmentRequest: { create: jest.Mock };
    timeOffPolicy: { findMany: jest.Mock };
  };
};

const team = {
  id: '4ee3cfc0-e6ab-4e19-aede-fec1e0e83856',
  name: 'Noodle',
  slug: 'noodle',
};
const input = {
  employeeName: 'Maya Chen',
  employeeEmail: 'maya@example.com',
  jobTitle: 'Product Designer',
  startDate: '2026-10-05',
  workLocation: 'London',
  timeZone: 'Europe/London',
  role: 'MEMBER',
  equipmentPackage: 'DESIGN',
};
const invitation = {
  id: 'fa4b79a2-5f2b-46aa-9f6b-9169731028da',
  teamId: team.id,
  invitedBy: 'user-1',
  email: input.employeeEmail,
  role: input.role,
  token: '5c989d6a-21df-4af4-a0e7-167e2b8f515e',
  expires: new Date('2026-09-08T00:00:00.000Z'),
  sentViaEmail: true,
  allowedDomains: [],
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
};
const equipmentRequest = {
  id: '3bd532b1-b28e-42f6-b5e8-62cbaf935e89',
  item: 'Design package — MacBook Pro, color-accurate monitor, keyboard, mouse, and tablet',
  status: 'PENDING',
};
const policies = [
  { type: 'VACATION', annualAllowanceHalfDays: 40 },
  { type: 'SICK', annualAllowanceHalfDays: 20 },
] as any;
const launch = {
  id: '11169ccb-684d-4080-bda8-9791c634f128',
  teamId: team.id,
  createdById: 'user-1',
  invitationId: invitation.id,
  equipmentRequestId: equipmentRequest.id,
  employeeName: input.employeeName,
  employeeEmail: input.employeeEmail,
  jobTitle: input.jobTitle,
  startDate: new Date('2026-10-05T00:00:00.000Z'),
  workLocation: input.workLocation,
  timeZone: input.timeZone,
  role: input.role,
  equipmentPackage: input.equipmentPackage,
  status: 'READY',
  activatedAt: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  team,
  invitation,
  equipmentRequest,
};

const invoke = async (
  endpoint: typeof handler,
  method: string,
  body: unknown = input
) => {
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
  await endpoint(
    {
      method,
      query: { teamId: team.slug },
      headers: {},
      body,
      url: `/api/v1/teams/${team.slug}/new-hire-launches`,
    } as any,
    res
  );
  return captured;
};

describe('new-hire launch API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireTeamPrincipal).mockResolvedValue({
      principal: {
        type: 'user',
        userId: 'user-1',
        scopes: ['invitations', 'equipment', 'time_off.policy'],
      },
      team,
      member: { role: 'ADMIN' },
    } as any);
    tx.teamMember.findFirst.mockResolvedValue(null);
    tx.newHireLaunch.findUnique.mockResolvedValue(null);
    tx.invitation.upsert.mockResolvedValue(invitation);
    tx.equipmentRequest.create.mockResolvedValue(equipmentRequest);
    tx.newHireLaunch.create.mockResolvedValue(launch);
    tx.timeOffPolicy.findMany.mockResolvedValue(policies);
  });

  it('atomically creates every readiness artifact and returns a verified receipt', async () => {
    const response = await invoke(handler, 'POST');

    expect(response.status).toBe(201);
    expect(tx.invitation.upsert).toHaveBeenCalledTimes(1);
    expect(tx.equipmentRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requesterId: 'user-1', quantity: 1 }),
      })
    );
    expect(tx.newHireLaunch.create).toHaveBeenCalledTimes(1);
    expect(sendTeamInviteEmail).toHaveBeenCalledWith(team, invitation);
    expect(response.body.data).toMatchObject({
      status: 'READY',
      authenticated: true,
      newHire: { name: 'Maya Chen', startDate: '2026-10-05' },
      invitation: { status: 'PENDING' },
      equipment: { package: 'DESIGN', status: 'PENDING' },
    });
    expect(response.body.data.checklist).toHaveLength(4);
  });

  it('returns the same receipt without duplicating writes on an exact retry', async () => {
    tx.newHireLaunch.findUnique.mockResolvedValue(launch);

    const response = await invoke(handler, 'POST');

    expect(response.status).toBe(201);
    expect(tx.invitation.upsert).not.toHaveBeenCalled();
    expect(tx.equipmentRequest.create).not.toHaveBeenCalled();
    expect(tx.newHireLaunch.create).not.toHaveBeenCalled();
    expect(sendTeamInviteEmail).not.toHaveBeenCalled();
    expect(response.body.data.launchId).toBe(launch.id);
  });

  it('previews live policies without making a write', async () => {
    jest.mocked(prisma.newHireLaunch.findUnique).mockResolvedValue(null);
    jest.mocked(prisma.timeOffPolicy.findMany).mockResolvedValue(policies);
    (prisma as any).teamMember = {
      findFirst: jest.fn().mockResolvedValue(null),
    };

    const response = await invoke(planHandler, 'POST');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'PLANNED',
      team: { slug: 'noodle' },
      newHire: { name: 'Maya Chen' },
      equipment: { package: 'DESIGN' },
    });
    expect(tx.newHireLaunch.create).not.toHaveBeenCalled();
    expect(requireScope).toHaveBeenCalledWith(
      expect.anything(),
      'time_off.policy'
    );
  });

  it('rejects non-manager launches before the transaction', async () => {
    jest.mocked(requireTeamPrincipal).mockResolvedValue({
      principal: { type: 'user', userId: 'user-1' },
      team,
      member: { role: 'MEMBER' },
    } as any);

    const response = await invoke(handler, 'POST');

    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
