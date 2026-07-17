/**
 * Manual hook for the "Delete for me" feature.
 * Kept separate from Orval-generated code so it survives codegen reruns.
 */
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface HideMessageResponse {
  success: boolean;
}

export const hideMessage = async (
  id: number,
  options?: RequestInit,
): Promise<HideMessageResponse> => {
  return customFetch<HideMessageResponse>(
    `/messages/${id}/hide`,
    { ...options, method: "POST" },
  );
};

export const useHideMessage = <TError = { error: string }, TContext = unknown>(
  options?: UseMutationOptions<HideMessageResponse, TError, { id: number }, TContext>,
) => {
  return useMutation<HideMessageResponse, TError, { id: number }, TContext>({
    mutationKey: ["hideMessage"],
    mutationFn: ({ id }) => hideMessage(id),
    ...options,
  });
};
