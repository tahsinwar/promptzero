import { useEffect, useState, useCallback } from "react";

const KEY = "bookmark_folders";
export type Folders = Record<string, string[]>; // folder name -> slugs

function read(): Folders {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useFolders() {
  const [folders, setFolders] = useState<Folders>({});

  useEffect(() => {
    setFolders(read());
    const sync = () => setFolders(read());
    listeners.add(sync);
    window.addEventListener("storage", sync);
    return () => { listeners.delete(sync); window.removeEventListener("storage", sync); };
  }, []);

  const save = (f: Folders) => { localStorage.setItem(KEY, JSON.stringify(f)); notify(); };

  const create = useCallback((name: string) => {
    const f = read();
    if (!f[name]) { f[name] = []; save(f); }
  }, []);
  const remove = useCallback((name: string) => {
    const f = read(); delete f[name]; save(f);
  }, []);
  const rename = useCallback((from: string, to: string) => {
    const f = read();
    if (f[from] && !f[to]) { f[to] = f[from]; delete f[from]; save(f); }
  }, []);
  const addSlug = useCallback((name: string, slug: string) => {
    const f = read();
    if (!f[name]) f[name] = [];
    if (!f[name].includes(slug)) f[name].push(slug);
    save(f);
  }, []);
  const removeSlug = useCallback((name: string, slug: string) => {
    const f = read();
    if (f[name]) { f[name] = f[name].filter((s) => s !== slug); save(f); }
  }, []);

  return { folders, create, remove, rename, addSlug, removeSlug };
}
