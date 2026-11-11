import { useCallback, useRef } from "react";

/**
 * Runs an async action at most once at a time; calls made while it is still running are ignored.
 *
 * Why not just `disabled={mutation.isPending}`: TanStack Query delivers `isPending` to the
 * component through its notify scheduler, so a fast double click sends the second request
 * before the button re-renders as disabled. Without the old "Save changes?" question in the
 * way, that double click would create a duplicate record. A ref flips synchronously.
 */
export function useSingleFlight(): (fn: () => Promise<unknown>) => Promise<void> {
  const running = useRef(false);
  return useCallback(async (fn: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    try {
      await fn();
    } finally {
      running.current = false;
    }
  }, []);
}
