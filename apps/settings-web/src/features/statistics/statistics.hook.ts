import type { StatisticsView } from "@gc/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ApiResult, clearStatistics, fetchStatistics } from "../../lib/settings-api.client";
import { type RefreshEvent, shouldRefetchStatistics } from "./statistics-refresh.util";

/**
 * The statistics, read when the page opens, again when the window regains focus or the page is
 * shown again (the core keeps counting while it is away), and after a reset. `clear` forgets
 * them all and shows the answered (empty) view.
 */
export const useStatistics = (token: string) => {
  const [result, setResult] = useState<ApiResult<StatisticsView> | null>(null);
  // Only the newest read may set the result, so a slow read can't overwrite a later one.
  const latestRead = useRef(0);

  const reload = useCallback(async (): Promise<void> => {
    const read = ++latestRead.current;
    const next = await fetchStatistics(token);
    if (read === latestRead.current) setResult(next);
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const refetchOn = (event: RefreshEvent) => {
      if (shouldRefetchStatistics(event)) void reload();
    };
    const onFocus = () => refetchOn({ type: "focus" });
    const onVisibility = () => refetchOn({ type: "visibility", state: document.visibilityState });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reload]);

  const clear = useCallback(async (): Promise<ApiResult<StatisticsView>> => {
    const next = await clearStatistics(token);
    if (next.ok) {
      setResult(next);
      void reload();
    }
    return next;
  }, [token, reload]);

  return { result, clear };
};
