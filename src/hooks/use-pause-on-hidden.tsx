import { useEffect } from "react";

/**
 * Toggles `data-page-hidden` on <html> when the tab loses visibility / focus.
 * CSS rules in styles.css use this to pause orb/shimmer animations and skip
 * tab-switch transitions while the page is in the background, then resume
 * cleanly when the user returns.
 */
export function usePauseOnHidden() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    const setHidden = (hidden: boolean) => {
      if (hidden) root.setAttribute("data-page-hidden", "true");
      else root.removeAttribute("data-page-hidden");
    };

    const onVisibility = () => setHidden(document.visibilityState !== "visible");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(document.visibilityState !== "visible");

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      root.removeAttribute("data-page-hidden");
    };
  }, []);
}