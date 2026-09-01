import useSWR from 'swr';

import fetcher from '@/lib/fetcher';
import type { ApiResponse, NewHireLaunchReceipt } from 'types';

const useNewHireLaunches = (slug: string, enabled: boolean) => {
  const url = `/api/v1/teams/${slug}/new-hire-launches`;
  const { data, error, isLoading } = useSWR<
    ApiResponse<NewHireLaunchReceipt[]>
  >(enabled ? url : null, fetcher);

  return {
    isLoading: enabled && isLoading,
    isError: error,
    launches: data?.data,
  };
};

export default useNewHireLaunches;
