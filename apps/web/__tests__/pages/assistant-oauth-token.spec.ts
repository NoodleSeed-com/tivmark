jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => ({})),
  jwtVerify: jest.fn(async () => ({ payload: { sub: 'user-1' } })),
}));

jest.mock('../../lib/api/oauth', () => ({
  issueAccessToken: jest.fn(async () => 'delegated-access-token'),
}));

jest.mock('../../lib/env', () => ({
  __esModule: true,
  default: {
    appUrl: 'https://app.tivmark.com',
    assistant: {
      delegClientId: 'deleg-client',
      delegClientSecret: 'deleg-secret',
      platformIssuer: 'https://cloud.noodleseed.dev',
    },
  },
}));

import { issueAccessToken } from '../../lib/api/oauth';
import handler from '../../pages/api/assistant/oauth/token';

const mockedIssueAccessToken = jest.mocked(issueAccessToken);
const basic = `Basic ${Buffer.from('deleg-client:deleg-secret').toString(
  'base64'
)}`;

async function invoke(scope: string) {
  const captured = { status: 0, body: undefined as unknown };
  const headers: Record<string, unknown> = {};
  const res: any = {
    setHeader: jest.fn((name: string, value: unknown) => {
      headers[name] = value;
    }),
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
      headers: { authorization: basic },
      body: {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: 'platform-assertion',
        scope,
      },
    } as any,
    res
  );

  return { ...captured, headers };
}

describe('POST /api/assistant/oauth/token', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mints all requested new-hire and Action Desk privileges', async () => {
    const response = await invoke(
      'teams invitations equipment time_off.policy service_requests service_requests.manage'
    );

    expect(response).toMatchObject({
      status: 200,
      body: {
        access_token: 'delegated-access-token',
        token_type: 'Bearer',
        expires_in: 900,
      },
      headers: { 'Cache-Control': 'no-store' },
    });
    expect(mockedIssueAccessToken).toHaveBeenCalledWith(
      'user-1',
      'deleg-client',
      [
        'teams',
        'invitations',
        'equipment',
        'time_off.policy',
        'service_requests',
        'service_requests.manage',
      ]
    );
  });

  it('returns invalid_scope instead of silently issuing a weaker token', async () => {
    const response = await invoke('teams future.capability');

    expect(response).toMatchObject({
      status: 400,
      body: {
        error: 'invalid_scope',
        error_description: 'Requested scope is not allowed',
      },
      headers: { 'Cache-Control': 'no-store' },
    });
    expect(mockedIssueAccessToken).not.toHaveBeenCalled();
  });
});
