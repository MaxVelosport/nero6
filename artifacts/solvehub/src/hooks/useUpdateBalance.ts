import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

export function useUpdateBalance() {
  const queryClient = useQueryClient();

  return (balanceAfter?: number | null) => {
    if (balanceAfter != null) {
      queryClient.setQueryData(getGetMeQueryKey(), (old: any) =>
        old ? { ...old, balance: balanceAfter } : old
      );
    }
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };
}
