import fetcher from '@/lib/fetcher';
import type { EndpointOut } from 'svix';
import useSWR, { mutate } from 'swr';
import type { ApiResponse } from 'types';

const useWebhook = (slug: string, endpointId: string | null) => {
  const url = `/api/v1/teams/${slug}/webhooks/${endpointId}`;

  const { data, error, isLoading } = useSWR<ApiResponse<EndpointOut>>(
    slug ? url : null,
    fetcher
  );

  const mutateWebhook = async () => {
    mutate(url);
  };

  return {
    isLoading,
    isError: error,
    webhook: data?.data,
    mutateWebhook,
  };
};

export default useWebhook;
