import useSWR from 'swr';

import fetcher from '@/lib/fetcher';
import type { ApiResponse, EquipmentWorkspaceData } from 'types';

const useEquipment = (slug: string | undefined) => {
  const url = slug
    ? `/api/v1/teams/${encodeURIComponent(slug)}/equipment`
    : null;
  const { data, error, isLoading, mutate } = useSWR<
    ApiResponse<EquipmentWorkspaceData>
  >(url, fetcher);

  return {
    workspace: data?.data,
    isLoading,
    error,
    refresh: mutate,
  };
};

export default useEquipment;
