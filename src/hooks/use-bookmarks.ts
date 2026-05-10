import { useEffect, useState, useCallback } from "react";

const KEY = "pv:bookmarks";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }

export function useBookmarks() {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    setList(read());
    const sync = () => setList(read());
    listeners.add(sync);
    window.addEventListener("storage", sync);
    return () => { listeners.delete(sync); window.removeEventListener("storage", sync); };
  }, []);

  const toggle = useCallback((slug: string) => {
    const cur = read();
    const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug];
    localStorage.setItem(KEY, JSON.stringify(next));
    notify();
  }, []);

  const has = useCallback((slug: string) => list.includes(slug), [list]);

  return { list, has, toggle };
}

export function useViewMode(defaultMode: "grid" | "list" = "grid") {
  const [mode, setMode] = useState<"grid" | "list">(defaultMode);
  useEffect(() => {
    const v = localStorage.getItem("pv:view");
    if (v === "grid" || v === "list") setMode(v);
  }, []);
  const set = (m: "grid" | "list") => { setMode(m); localStorage.setItem("pv:view", m); };
  return [mode, set] as const;
}