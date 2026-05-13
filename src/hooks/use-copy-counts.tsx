import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type CountMap = Record<string, number>;

type RealtimeStatus = "connecting" | "live" | "fallback";

type Ctx = {
  getCopy: (id: string, fallback: number) => number;
  getView: (id: string, fallback: number) => number;
  bump: (id: string) => void;
  status: RealtimeStatus;
};

const CountsContext = createContext<Ctx | null>(null);

export function CopyCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<CountMap>({});
  const [views, setViews] = useState<CountMap>({});
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const localBumpsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    // Mark realtime as fallback if first connection takes too long, so the UI
    // doesn't sit in a "connecting" limbo forever — counts already display via
    // the per-prompt fallback prop.
    let slowTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setStatus((s) => (s === "connecting" ? "fallback" : s));
    }, 4000);

    const clearSlowTimer = () => {
      if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    };

    const scheduleRetry = () => {
      if (cancelled) return;
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
      const delay = Math.min(1000 * 2 ** attempt, 30000);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (cancelled) return;
      // Tear down any previous channel before creating a new one
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channel = null;
      }
      channel = supabase
        .channel("prompts-live-counts")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "prompts" },
          (payload) => {
            const row = payload.new as { id?: string; copy_count?: number; view_count?: number };
            const id = row?.id;
            if (!id) return;
            if (typeof row.copy_count === "number") {
              localBumpsRef.current[id] = 0;
              const c = row.copy_count;
              setCounts((prev) => (prev[id] === c ? prev : { ...prev, [id]: c }));
            }
            if (typeof row.view_count === "number") {
              const v = row.view_count;
              setViews((prev) => (prev[id] === v ? prev : { ...prev, [id]: v }));
            }
          },
        )
        .subscribe((subStatus) => {
          if (cancelled) return;
          if (subStatus === "SUBSCRIBED") {
            attempt = 0;
            clearSlowTimer();
            setStatus("live");
          } else if (
            subStatus === "CHANNEL_ERROR" ||
            subStatus === "TIMED_OUT" ||
            subStatus === "CLOSED"
          ) {
            clearSlowTimer();
            setStatus("fallback");
            scheduleRetry();
          }
        });
    };

    connect();

    return () => {
      cancelled = true;
      clearSlowTimer();
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
    };
  }, []);

  // Always prefer the larger of (realtime value, prop fallback) so a stale or
  // missing subscription never causes the displayed number to go backwards.
  const getCopy = useCallback(
    (id: string, fallback: number) => {
      const live = counts[id];
      const base = typeof live === "number" ? Math.max(live, fallback) : fallback;
      return base + (localBumpsRef.current[id] ?? 0);
    },
    [counts],
  );
  const getView = useCallback(
    (id: string, fallback: number) => {
      const live = views[id];
      return typeof live === "number" ? Math.max(live, fallback) : fallback;
    },
    [views],
  );

  const bump = useCallback((id: string) => {
    localBumpsRef.current[id] = (localBumpsRef.current[id] ?? 0) + 1;
    setCounts((prev) => ({ ...prev }));
  }, []);

  return <CountsContext.Provider value={{ getCopy, getView, bump, status }}>{children}</CountsContext.Provider>;
}

export function useCopyCount(id: string, fallback: number) {
  const ctx = useContext(CountsContext);
  return ctx ? ctx.getCopy(id, fallback) : fallback;
}

export function useViewCount(id: string, fallback: number) {
  const ctx = useContext(CountsContext);
  return ctx ? ctx.getView(id, fallback) : fallback;
}

export function useBumpCopyCount() {
  const ctx = useContext(CountsContext);
  return ctx?.bump ?? (() => {});
}

export function useLiveCountsStatus(): RealtimeStatus {
  const ctx = useContext(CountsContext);
  return ctx?.status ?? "fallback";
}
