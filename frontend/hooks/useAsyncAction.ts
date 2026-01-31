"use client";

import { useState, useCallback } from "react";

interface UseAsyncActionOptions<T> {
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for managing async operations with loading state.
 * Reduces boilerplate for try/catch/finally patterns.
 *
 * @example
 * const { isLoading, execute } = useAsyncAction(async () => {
 *   await api.saveData(data);
 * });
 *
 * <Button isLoading={isLoading} onClick={execute}>Save</Button>
 */
export function useAsyncAction<T = void>(
  action: () => Promise<T>,
  options: UseAsyncActionOptions<T> = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await action();
      options.onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [action, options]);

  return { isLoading, error, execute };
}

/**
 * Simpler version that wraps any async function with loading state.
 *
 * @example
 * const [isLoading, wrappedFn] = useLoadingState(async (id) => {
 *   return await api.fetchItem(id);
 * });
 */
export function useLoadingState<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
): [boolean, (...args: TArgs) => Promise<TResult>] {
  const [isLoading, setIsLoading] = useState(false);

  const wrappedFn = useCallback(
    async (...args: TArgs) => {
      setIsLoading(true);
      try {
        return await fn(...args);
      } finally {
        setIsLoading(false);
      }
    },
    [fn]
  );

  return [isLoading, wrappedFn];
}
