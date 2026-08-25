jest.mock('@noodleseed/assistant/server', () => ({
  createAssistantSession: jest.fn(),
  // The real class, so `instanceof` and the `elevationRefusal` getter behave as they do in
  // production rather than being faked into agreeing with the code under test.
  AssistantSessionExchangeError: jest.requireActual(
    '@noodleseed/assistant/server'
  ).AssistantSessionExchangeError,
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

import {
  AssistantSessionExchangeError,
  createAssistantSession,
} from '@noodleseed/assistant/server';
import handler from '../../pages/api/assistant/session';
import { getSession } from '../../lib/session';
import { getTeamMembershipsWithSlug } from '../../models/team';

const mockedCreateAssistantSession = jest.mocked(createAssistantSession);
const mockedGetSession = jest.mocked(getSession);
const mockedGetTeamMemberships = jest.mocked(getTeamMembershipsWithSlug);

const invoke = async (cookies: Record<string, string> = {}) => {
  const captured = { status: 0, body: undefined as unknown };
  const headers: Record<string, unknown> = {};
  const res: any = {
    getHeader: (name: string) => headers[name],
    setHeader: jest.fn((name: string, value: unknown) => {
      headers[name] = value;
    }),
    headers,
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
      headers: { origin: 'http://localhost:4002', host: 'app.tivmark.com' },
      cookies: {
        tiv_locale: 'en-US',
        tiv_tz: 'America/Los_Angeles',
        ...cookies,
      },
    } as any,
    res
  );
  return { ...captured, setHeaderCalls: res.setHeader.mock.calls };
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

  it("spends a sign-in ticket to join the visitor's existing conversation", async () => {
    const response = await invoke({ tiv_assistant_signin: 'tkt_abc' });

    expect(response.status).toBe(200);
    const [input] = mockedCreateAssistantSession.mock.calls.at(-1) ?? [];
    expect((input as any).signInTicket).toBe('tkt_abc');
    // The origin the conversation CONTINUES on -- this app -- not the marketing origin it
    // began on. Sessions are origin-pinned, so this is what makes the elevated token usable.
    expect((input as any).origin).toBe('http://localhost:4002');
    // An elevation is still this backend vouching for the person, so identity travels with it.
    expect((input as any).user).toEqual(
      expect.objectContaining({ id: 'user-1' })
    );
  });

  it('spends the ticket exactly once by clearing the cookie', async () => {
    const response = await invoke({ tiv_assistant_signin: 'tkt_abc' });

    expect(response.status).toBe(200);
    // Tickets are single-use, so a presented one must not survive the request that presented it.
    const cleared = response.setHeaderCalls.find(
      ([name, value]) =>
        name === 'Set-Cookie' &&
        String(value).includes('tiv_assistant_signin=') &&
        String(value).includes('Max-Age=0')
    );
    expect(cleared).toBeDefined();
  });

  it('mints an ordinary session when no ticket is present', async () => {
    await invoke();

    const [input] = mockedCreateAssistantSession.mock.calls.at(-1) ?? [];
    expect((input as any).signInTicket).toBeUndefined();
  });

  it('falls back to a fresh conversation when the ticket expired', async () => {
    // The visitor took too long. Losing the thread is acceptable; losing the assistant is not.
    mockedCreateAssistantSession
      .mockRejectedValueOnce(
        new AssistantSessionExchangeError(
          {
            code: 'session_exchange_failed',
            status: 403,
            retryable: false,
            serviceCode: 'elevation_ticket_expired',
          },
          'sign-in ticket expired'
        )
      )
      .mockResolvedValueOnce({
        token: 'fresh-session',
        expiresAt: '2099-01-01T00:00:00.000Z',
        endpoints: {
          turns: 'https://cloud.noodleseed.dev/turns',
          toolConfirmations: 'https://cloud.noodleseed.dev/confirmations',
        },
      } as any);

    const response = await invoke({ tiv_assistant_signin: 'tkt_stale' });

    expect(response.status).toBe(200);
    expect(mockedCreateAssistantSession).toHaveBeenCalledTimes(2);
    // The retry is a plain mint, never a second attempt at the single-use ticket.
    const [retry] = mockedCreateAssistantSession.mock.calls.at(-1) ?? [];
    expect((retry as any).signInTicket).toBeUndefined();
  });

  it('never retries a tenant mismatch', async () => {
    // The route logs this deliberately; keep it out of the test output.
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    // A ticket presented for another tenant's conversation is a boundary event. Retrying it
    // would be useless and exactly the wrong response.
    mockedCreateAssistantSession.mockRejectedValue(
      new AssistantSessionExchangeError(
        {
          code: 'session_exchange_failed',
          status: 403,
          retryable: false,
          serviceCode: 'elevation_tenant_mismatch',
        },
        'tenant mismatch'
      )
    );

    const response = await invoke({ tiv_assistant_signin: 'tkt_other' });

    expect(response.status).toBe(502);
    expect(mockedCreateAssistantSession).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
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
