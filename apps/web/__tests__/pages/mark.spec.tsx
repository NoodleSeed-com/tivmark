jest.mock('../../lib/session', () => ({ getSession: jest.fn() }));
jest.mock('../../models/team', () => ({ getTeams: jest.fn() }));

import { getServerSideProps } from '../../pages/mark';
import { getSession } from '../../lib/session';
import { getTeams } from '../../models/team';

const mockedGetSession = jest.mocked(getSession);
const mockedGetTeams = jest.mocked(getTeams);

const ctx = { req: {}, res: {} } as any;

describe('/mark (sign-in landing redirect)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the signed-out to login and back', async () => {
    mockedGetSession.mockResolvedValue(null as any);

    await expect(getServerSideProps(ctx)).resolves.toEqual({
      redirect: {
        destination: '/auth/login?callbackUrl=%2Fmark',
        permanent: false,
      },
    });
  });

  it('lands a one-team user on that team, menu intact', async () => {
    // The whole point of the redirect: the sign-in handoff finishes on a page whose
    // sidebar still says time off and equipment, with the drawer opening over it.
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as any);
    mockedGetTeams.mockResolvedValue([{ slug: 'noodle' }] as any);

    await expect(getServerSideProps(ctx)).resolves.toEqual({
      redirect: { destination: '/teams/noodle/time-off', permanent: false },
    });
  });

  it('lands a multi-team user on the teams list', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as any);
    mockedGetTeams.mockResolvedValue([
      { slug: 'noodle' },
      { slug: 'acme' },
    ] as any);

    await expect(getServerSideProps(ctx)).resolves.toEqual({
      redirect: { destination: '/teams', permanent: false },
    });
  });

  it('falls back to the teams list when the lookup fails', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as any);
    mockedGetTeams.mockRejectedValue(new Error('database unavailable'));

    await expect(getServerSideProps(ctx)).resolves.toEqual({
      redirect: { destination: '/teams', permanent: false },
    });
  });
});
