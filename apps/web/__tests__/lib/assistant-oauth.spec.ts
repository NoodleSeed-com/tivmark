import {
  ASSISTANT_DELEGATED_SCOPES,
  resolveAssistantDelegatedScopes,
} from '@/lib/api/assistant-oauth';

describe('assistant delegated OAuth scopes', () => {
  it('covers every capability requested by the hosted assistant connector', () => {
    expect(ASSISTANT_DELEGATED_SCOPES).toEqual([
      'teams',
      'time_off',
      'time_off.policy',
      'time_off.approve',
      'equipment',
      'equipment.approve',
      'invitations',
      'service_requests',
      'service_requests.manage',
    ]);
  });

  it('preserves invitation and Action Desk scopes instead of silently dropping them', () => {
    expect(
      resolveAssistantDelegatedScopes(
        'teams invitations service_requests service_requests.manage'
      )
    ).toEqual({
      ok: true,
      scopes: [
        'teams',
        'invitations',
        'service_requests',
        'service_requests.manage',
      ],
    });
  });

  it('rejects contract drift rather than issuing a partially privileged token', () => {
    expect(
      resolveAssistantDelegatedScopes('teams unknown.capability invitations')
    ).toEqual({ ok: false, unsupported: ['unknown.capability'] });
  });

  it('deduplicates scopes and keeps the legacy safe default for an empty request', () => {
    expect(resolveAssistantDelegatedScopes('teams teams')).toEqual({
      ok: true,
      scopes: ['teams'],
    });
    expect(resolveAssistantDelegatedScopes('')).toEqual({
      ok: true,
      scopes: ['time_off'],
    });
  });
});
