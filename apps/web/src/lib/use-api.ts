"use client";

import { useCallback } from "react";
import { apiFetch, type ApiFetchOptions } from "./api";
import { useApiToken } from "./auth";

/** apiFetch bound to the current session's bearer token. */
export function useApi(): <T>(path: string, options?: Omit<ApiFetchOptions, "token">) => Promise<T> {
  const getToken = useApiToken();
  return useCallback(
    async <T>(path: string, options: Omit<ApiFetchOptions, "token"> = {}) =>
      apiFetch<T>(path, { ...options, token: await getToken() }),
    [getToken],
  );
}
