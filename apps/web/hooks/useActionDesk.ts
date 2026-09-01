import useSWR from 'swr';

import fetcher from '@/lib/fetcher';
import type { ActionDeskWorkspaceData, ApiResponse } from 'types';

const useActionDesk = (slug: string | undefined) => {
  const url = slug
    ? `/api/v1/teams/${encodeURIComponent(slug)}/action-desk`
    : null;
  const { data, error, isLoading, mutate } = useSWR<
    ApiResponse<ActionDeskWorkspaceData>
  >(url, fetcher);

  return {
    workspace: data?.data,
    error,
    isLoading,
    refresh: mutate,
  };
};

export default useActionDesk;
