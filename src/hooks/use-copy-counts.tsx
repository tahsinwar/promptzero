import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type CountMap = Record<string, number>;

type Ctx = {
  getCopy: (id: string, fallback: number) => number;
  getView: (id: string, fallback: number) => number;
  bump: (id: string) => void;
};

const CountsContext = createContext<Ctx | null>(null);

export function CopyCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<CountMap>({});
  const [views, setViews] = useState<CountMap>({});
  const localBumpsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const channel = supabase
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getCopy = useCallback(
    (id: string, fallback: number) => (counts[id] ?? fallback) + (localBumpsRef.current[id] ?? 0),
    [counts],
  );
  const getView = useCallback(
    (id: string, fallback: number) => views[id] ?? fallback,
    [views],
  );

  const bump = useCallback((id: string) => {
    localBumpsRef.current[id] = (localBumpsRef.current[id] ?? 0) + 1;
    setCounts((prev) => ({ ...prev }));
  }, []);

  return <CountsContext.Provider value={{ getCopy, getView, bump }}>{children}</CountsContext.Provider>;
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
