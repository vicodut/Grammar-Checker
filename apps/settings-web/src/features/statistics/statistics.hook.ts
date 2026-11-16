import type { StatisticsView } from "@gc/protocol";
import { useCallback, useEffect, useState } from "react";
import { type ApiResult, clearStatistics, fetchStatistics } from "../../lib/settings-api.client";
import { type RefreshEvent, shouldRefetchStatistics } from "./statistics-refresh.util";

/**
 * The statistics, read when the page opens, again when the window regains focus or the page is
 * shown again (the core keeps counting while it is away), and after a reset. `clear` forgets
 * them all and shows the answered (empty) view.
 */
export const useStatistics = (token: string) => {
  const [result, setResult] = useState<ApiResult<StatisticsView> | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    void fetchStatistics(token).then((next) => {
      if (current) setResult(next);
    });
    return () => {
      current = false;
    };
  }, [token, round]);

  useEffect(() => {
    const refetchOn = (event: RefreshEvent) => {
      if (shouldRefetchStatistics(event)) setRound((n) => n + 1);
    };
    const onFocus = () => refetchOn({ type: "focus" });
    const onVisibility = () => refetchOn({ type: "visibility", state: document.visibilityState });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const clear = useCallback(async (): Promise<ApiResult<StatisticsView>> => {
    const next = await clearStatistics(token);
    if (next.ok) {
      setResult(next);
      setRound((n) => n + 1);
    }
    return next;
  }, [token]);

  return { result, clear };
};
