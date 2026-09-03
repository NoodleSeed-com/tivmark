import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import type { components } from 'types/api.generated';
export type EnterpriseWorkspaceData =
  components['schemas']['EnterpriseWorkspace'];
export type EnterpriseCommandData = components['schemas']['EnterpriseCommand'];

export default function useEnterpriseOnboarding(slug?: string) {
  const url = slug
    ? `/api/v1/teams/${encodeURIComponent(slug)}/enterprise-onboarding`
    : null;
  const { data, error, isLoading, mutate } = useSWR<{
    data: EnterpriseWorkspaceData;
  }>(url, fetcher, { refreshInterval: 5000 });
  async function change(command: EnterpriseCommandData) {
    if (!url) throw new Error('Choose a team first');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(command),
    });
    const payload = await response.json();
    if (!response.ok) {
      await mutate();
      throw new Error(payload.detail || 'The update failed');
    }
    await mutate(payload, false);
    return payload.data as EnterpriseWorkspaceData;
  }
  return { workspace: data?.data, error, isLoading, change, refresh: mutate };
}
