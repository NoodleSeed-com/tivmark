jest.mock('@noodleseed/assistant/server', () => ({
  createAssistantSession: jest.fn(),
}));

jest.mock('../../lib/session', () => ({
  getSession: jest.fn(),
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

const mockedCreateAssistantSession = jest.mocked(createAssistantSession);
const mockedGetSession = jest.mocked(getSession);

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

  it('exchanges verified identity and preferences without personalization claims', async () => {
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
    });
  });
});
