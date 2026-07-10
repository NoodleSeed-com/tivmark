import useSWR from 'swr';

import fetcher from '@/lib/fetcher';
import type { ApiResponse, TimeOffWorkspaceData } from 'types';

const useTimeOff = (slug: string | undefined, year: number) => {
  const url = slug
    ? `/api/v1/teams/${encodeURIComponent(slug)}/time-off/requests?year=${year}`
    : null;
  const { data, error, isLoading, mutate } = useSWR<
    ApiResponse<TimeOffWorkspaceData>
  >(url, fetcher);

  return {
    workspace: data?.data,
    isLoading,
    error,
    refresh: mutate,
  };
};

export default useTimeOff;
