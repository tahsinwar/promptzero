import { useRouterState } from "@tanstack/react-router";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const SHOW_DELAY = 150; // don't flash for fast ops
const MIN_VISIBLE = 300; // once visible, stay at least this long

export function GlobalLoader() {
  const isNavigating = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const busy = isNavigating || isFetching > 0 || isMutating > 0;

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let shownAt = 0;

    if (busy) {
      if (!visible) {
        showTimer = setTimeout(() => {
          shownAt = Date.now();
          setVisible(true);
        }, SHOW_DELAY);
      }
    } else if (visible) {
      const elapsed = Date.now() - shownAt;
      const remaining = Math.max(0, MIN_VISIBLE - elapsed);
      hideTimer = setTimeout(() => setVisible(false), remaining);
    }

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [busy, visible]);

  if (!visible) return null;
  return (
    <>
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary/20">
        <div className="h-full w-1/3 animate-[loader-slide_1.1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur animate-fade-in">
        <span className="relative inline-flex h-3 w-3">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
          <span className="relative inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </span>
        Loading
      </div>
    </>
  );
}
