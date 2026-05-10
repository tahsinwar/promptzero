import { createFileRoute } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/saved")({
  component: SavedPage,
  head: () => ({ meta: [{ title: "Saved prompts — Prompt Vault" }] }),
});

function SavedPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="vault-card rounded-2xl p-10 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/30">
          <Bookmark className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Saved prompts</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your saved prompts will appear here.</p>
      </div>
    </div>
  );
}