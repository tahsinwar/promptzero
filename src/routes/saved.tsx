import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bookmark, Plus, Search, MoreHorizontal, Pencil, Trash2, FolderPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useFolders } from "@/hooks/use-folders";
import { PromptCard, type PromptListItem } from "@/components/prompt-card";

export const Route = createFileRoute("/saved")({
  component: SavedPage,
  head: () => ({ meta: [{ title: "Saved prompts — Prompt Vault" }] }),
});

const ALL = "All Saved";

function SavedPage() {
  const { list: bookmarks, toggle } = useBookmarks();
  const { folders, create, remove, rename, addSlug, removeSlug } = useFolders();
  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["saved-prompts", bookmarks.join(",")],
    enabled: bookmarks.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("prompts")
        .select("id,slug,title,description,content,difficulty,ai_models,is_locked,is_featured,view_count,copy_count,rating_avg,pin_hash, categories(name,color)")
        .in("slug", bookmarks)
        .eq("is_published", true);
      return (data ?? []) as unknown as PromptListItem[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["admin-settings-pin"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("settings").eq("id", 1).maybeSingle();
      return (data?.settings ?? {}) as any;
    },
  });

  const filtered = useMemo(() => {
    let arr = prompts;
    if (activeFolder !== ALL) {
      const slugs = folders[activeFolder] ?? [];
      arr = arr.filter((p) => slugs.includes(p.slug));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((p) => p.title.toLowerCase().includes(q));
    }
    return arr;
  }, [prompts, activeFolder, folders, query]);

  const onNewFolder = () => {
    const name = window.prompt("Folder name")?.trim();
    if (name) { create(name); setActiveFolder(name); }
  };
  const onRename = (name: string) => {
    const next = window.prompt("Rename folder", name)?.trim();
    if (next && next !== name) { rename(name, next); if (activeFolder === name) setActiveFolder(next); }
    setMenuOpen(null);
  };
  const onDelete = (name: string) => {
    if (window.confirm(`Delete folder "${name}"? Bookmarks stay in All Saved.`)) {
      remove(name); if (activeFolder === name) setActiveFolder(ALL);
    }
    setMenuOpen(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Saved prompts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your bookmarks, organized in folders.</p>
      </header>

      {bookmarks.length === 0 ? (
        <div className="vault-card rounded-2xl p-12 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/30">
            <Bookmark className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No saved prompts yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tap the bookmark icon on any prompt to save it here.</p>
          <Link to="/browse" className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">Browse prompts</Link>
        </div>
      ) : (
        <>
          {/* Folder tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <FolderTab name={ALL} active={activeFolder === ALL} count={prompts.length} onClick={() => setActiveFolder(ALL)} />
            {Object.keys(folders).map((name) => (
              <div key={name} className="relative">
                <FolderTab
                  name={name}
                  active={activeFolder === name}
                  count={(folders[name] ?? []).filter((s) => bookmarks.includes(s)).length}
                  onClick={() => setActiveFolder(name)}
                  onMenu={() => setMenuOpen(menuOpen === name ? null : name)}
                />
                {menuOpen === name && (
                  <div className="absolute right-0 top-full mt-1 z-10 vault-card rounded-lg p-1 min-w-[140px]">
                    <button onClick={() => onRename(name)} className="w-full inline-flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-secondary"><Pencil className="h-3 w-3" /> Rename</button>
                    <button onClick={() => onDelete(name)} className="w-full inline-flex items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-secondary"><Trash2 className="h-3 w-3" /> Delete</button>
                  </div>
                )}
              </div>
            ))}
            <button onClick={onNewFolder} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40">
              <FolderPlus className="h-3.5 w-3.5" /> New folder
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-5 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search saved prompts…"
              className="w-full rounded-lg border border-border bg-input/40 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary" />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prompts match this filter.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <SavedCardWrapper
                  key={p.id} p={p}
                  defaultPin={settings?.default_pin ?? "00000"}
                  folders={folders}
                  onAddToFolder={(name) => addSlug(name, p.slug)}
                  onRemoveFromFolder={(name) => removeSlug(name, p.slug)}
                  onUnsave={() => toggle(p.slug)}
                  onCreateFolder={onNewFolder}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FolderTab({ name, active, count, onClick, onMenu }: { name: string; active: boolean; count: number; onClick: () => void; onMenu?: () => void }) {
  return (
    <div className={`inline-flex items-center rounded-full border ${active ? "bg-primary/15 border-primary/40 text-primary" : "border-border hover:bg-secondary"}`}>
      <button onClick={onClick} className="px-3 py-1.5 text-xs font-medium">
        {name} <span className="ml-1 opacity-60">{count}</span>
      </button>
      {onMenu && (
        <button onClick={onMenu} className="px-1.5 py-1.5 text-muted-foreground hover:text-foreground border-l border-border/60">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SavedCardWrapper({
  p, defaultPin, folders, onAddToFolder, onRemoveFromFolder, onUnsave, onCreateFolder,
}: {
  p: PromptListItem; defaultPin: string; folders: Record<string, string[]>;
  onAddToFolder: (n: string) => void; onRemoveFromFolder: (n: string) => void;
  onUnsave: () => void; onCreateFolder: () => void;
}) {
  const [open, setOpen] = useState(false);
  const folderNames = Object.keys(folders);
  return (
    <div className="relative">
      <PromptCard p={p} defaultPin={defaultPin} />
      <div className="absolute top-2 right-2 flex gap-1">
        <button onClick={() => setOpen(!open)} title="Add to folder"
          className="grid h-8 w-8 place-items-center rounded-md bg-card/80 backdrop-blur text-muted-foreground hover:text-foreground border border-border">
          <Plus className="h-4 w-4" />
        </button>
        <button onClick={onUnsave} title="Remove bookmark"
          className="grid h-8 w-8 place-items-center rounded-md bg-card/80 backdrop-blur text-muted-foreground hover:text-destructive border border-border">
          <X className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="absolute top-12 right-2 z-20 vault-card rounded-lg p-2 min-w-[180px]">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Folders</div>
          {folderNames.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No folders yet</div>}
          {folderNames.map((n) => {
            const inFolder = (folders[n] ?? []).includes(p.slug);
            return (
              <button key={n} onClick={() => inFolder ? onRemoveFromFolder(n) : onAddToFolder(n)}
                className="w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-secondary">
                <span className="truncate">{n}</span>
                {inFolder && <span className="text-primary">✓</span>}
              </button>
            );
          })}
          <button onClick={() => { onCreateFolder(); setOpen(false); }}
            className="mt-1 w-full inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-primary hover:bg-secondary">
            <FolderPlus className="h-3 w-3" /> New folder
          </button>
        </div>
      )}
    </div>
  );
}
