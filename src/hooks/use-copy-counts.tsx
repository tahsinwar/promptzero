import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type CountMap = Record<string, number>;

type Ctx = {
  get: (id: string, fallback: number) => number;
  bump: (id: string) => void;
};

const CopyCountsContext = createContext<Ctx | null>(null);

export function CopyCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<CountMap>({});
  const localBumpsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const channel = supabase
      .channel("prompts-copy-counts")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "prompts" },
        (payload) => {
          const row = payload.new as { id?: string; copy_count?: number };
          if (!row?.id || typeof row.copy_count !== "number") return;
          // Server value is authoritative — clear any local optimistic bump.
          localBumpsRef.current[row.id] = 0;
          setCounts((prev) =>
            prev[row.id] === row.copy_count ? prev : { ...prev, [row.id]: row.copy_count! },
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const get = useCallback(
    (id: string, fallback: number) => {
      const base = counts[id] ?? fallback;
      return base + (localBumpsRef.current[id] ?? 0);
    },
    [counts],
  );

  const bump = useCallback((id: string) => {
    localBumpsRef.current[id] = (localBumpsRef.current[id] ?? 0) + 1;
    // Force a re-render so consumers reflect the optimistic bump.
    setCounts((prev) => ({ ...prev }));
  }, []);

  return (
    <CopyCountsContext.Provider value={{ get, bump }}>{children}</CopyCountsContext.Provider>
  );
}

export function useCopyCount(id: string, fallback: number) {
  const ctx = useContext(CopyCountsContext);
  return ctx ? ctx.get(id, fallback) : fallback;
}

export function useBumpCopyCount() {
  const ctx = useContext(CopyCountsContext);
  return ctx?.bump ?? (() => {});
}
