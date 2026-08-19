jest.mock('@noodleseed/assistant/server', () => ({
  createAssistantSession: jest.fn(),
}));

jest.mock('../../lib/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('../../models/team', () => ({
  getTeamMembershipsWithSlug: jest.fn(),
}));

jest.mock('../../lib/env', () => ({
  __esModule: true,
  default: {
    appUrl: 'http://localhost:4002',
    assistant: {
      serviceUrl: 'https://cloud.noodleseed.dev',
      clientId: 'assistant-client',
      clientSecret: 'assistant-secret',
    },
  },
}));

import { createAssistantSession } from '@noodleseed/assistant/server';
import handler from '../../pages/api/assistant/session';
import { getSession } from '../../lib/session';
import { getTeamMembershipsWithSlug } from '../../models/team';

const mockedCreateAssistantSession = jest.mocked(createAssistantSession);
const mockedGetSession = jest.mocked(getSession);
const mockedGetTeamMemberships = jest.mocked(getTeamMembershipsWithSlug);

const invoke = async () => {
  const captured = { status: 0, body: undefined as unknown };
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
      headers: { origin: 'http://localhost:4002' },
      cookies: {
        tiv_locale: 'en-US',
        tiv_tz: 'America/Los_Angeles',
      },
    } as any,
    res
  );
  return captured;
};

describe('POST /api/assistant/session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetTeamMemberships.mockResolvedValue([]);
    mockedGetSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'pat@example.com',
        name: 'Pat',
        roles: [],
      },
      expires: '2099-01-01T00:00:00.000Z',
    });
    mockedCreateAssistantSession.mockResolvedValue({
      token: 'short-lived-session',
      expiresAt: '2099-01-01T00:00:00.000Z',
      endpoints: {
        turns: 'https://cloud.noodleseed.dev/turns',
        toolConfirmations: 'https://cloud.noodleseed.dev/confirmations',
      },
    });
  });

  it('exchanges verified identity, preferences, and declared team claims', async () => {
    mockedGetTeamMemberships.mockResolvedValue([
      { slug: 'engineering', role: 'OWNER' },
      { slug: 'design', role: 'MEMBER' },
    ] as any);

    const response = await invoke();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      token: 'short-lived-session',
      expiresAt: '2099-01-01T00:00:00.000Z',
      endpoints: {
        turns: 'https://cloud.noodleseed.dev/turns',
        toolConfirmations: 'https://cloud.noodleseed.dev/confirmations',
      },
    });
    expect(mockedCreateAssistantSession).toHaveBeenCalledWith({
      serviceUrl: 'https://cloud.noodleseed.dev',
      clientId: 'assistant-client',
      clientSecret: 'assistant-secret',
      origin: 'http://localhost:4002',
      user: {
        id: 'user-1',
        email: 'pat@example.com',
        name: 'Pat',
      },
      preferences: {
        locale: 'en-US',
        timeZone: 'America/Los_Angeles',
      },
      claims: {
        displayName: 'Pat',
        // Slugs, not ids: `team` is what every assistant tool takes as its argument.
        teamSlugs: 'engineering,design',
        // Only where the user is an OWNER or ADMIN. This decides what Mark offers; the
        // Tivmark API still decides what it permits.
        reviewerTeamSlugs: 'engineering',
      },
    });
  });

  it('still mints a session when team lookup fails', async () => {
    // Claims ground the conversation; they are not required to have one. A database hiccup
    // must degrade Mark's grounding, not leave the user with no assistant at all.
    mockedGetTeamMemberships.mockRejectedValue(
      new Error('database unavailable')
    );

    const response = await invoke();

    expect(response.status).toBe(200);
    expect(mockedCreateAssistantSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ claims: expect.anything() })
    );
  });

  it('omits reviewer claims for a member of every team', async () => {
    mockedGetTeamMemberships.mockResolvedValue([
      { slug: 'design', role: 'MEMBER' },
    ] as any);

    await invoke();

    const [input] = mockedCreateAssistantSession.mock.calls.at(-1) ?? [];
    expect((input as any).claims).toEqual({
      displayName: 'Pat',
      teamSlugs: 'design',
    });
  });
});
