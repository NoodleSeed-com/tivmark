// Keep this allowlist aligned with the delegated connector in apps/assistant/src/server.ts. The
// token exchange rejects unknown scopes instead of silently dropping them: a future drift should
// fail at the authentication boundary with invalid_scope, not much later as a misleading API error.
export const ASSISTANT_DELEGATED_SCOPES = [
  'teams',
  'time_off',
  'time_off.policy',
  'time_off.approve',
  'equipment',
  'equipment.approve',
  'invitations',
  'service_requests',
  'service_requests.manage',
] as const;

const allowedScopes: ReadonlySet<string> = new Set(ASSISTANT_DELEGATED_SCOPES);

export type AssistantScopeResolution =
  { ok: true; scopes: string[] } | { ok: false; unsupported: string[] };

export function resolveAssistantDelegatedScopes(
  rawScope: unknown
): AssistantScopeResolution {
  const requested = String(rawScope ?? '')
    .split(' ')
    .filter(Boolean);
  if (requested.length === 0) return { ok: true, scopes: ['time_off'] };

  const unsupported = requested.filter((scope) => !allowedScopes.has(scope));
  if (unsupported.length > 0) {
    return { ok: false, unsupported: Array.from(new Set(unsupported)) };
  }

  return { ok: true, scopes: Array.from(new Set(requested)) };
}
