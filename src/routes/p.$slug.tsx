import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/p/$slug")({
  component: PromptDetailPlaceholder,
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Prompt Vault` }] }),
});

function PromptDetailPlaceholder() {
  const { slug } = Route.useParams();
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="vault-card rounded-2xl p-10">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Prompt</p>
        <h1 className="mt-1 text-2xl font-bold break-words">{slug}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Prompt detail coming soon.</p>
      </div>
    </div>
  );
}