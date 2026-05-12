// Shared visibility rules for prompt list queries.
// Locked prompts (is_locked=true OR pin_hash set) are hidden by default
// from every public listing. Direct links (/p/$slug, /s/$code) bypass this.

export const PUBLIC_PROMPT_COLUMNS =
  "id,slug,title,description,content,difficulty,ai_models,is_locked,is_featured,view_count,copy_count,rating_avg,pin_hash,category_id,categories(name,color)";

/**
 * Apply visibility filters to a Supabase prompts query builder.
 *
 * @param query  Supabase PostgrestFilterBuilder for the prompts table
 * @param opts.includeLocked  When true, locked prompts ARE returned.
 *                            Defaults to false (hide locked everywhere).
 * @param opts.publishedOnly  When true (default), restrict to published rows.
 */
export function applyPromptVisibility<T>(
  query: T,
  opts: { includeLocked?: boolean; publishedOnly?: boolean } = {},
): T {
  const { includeLocked = false, publishedOnly = true } = opts;
  let q: any = query;
  if (publishedOnly) q = q.eq("is_published", true);
  if (!includeLocked) q = q.eq("is_locked", false).is("pin_hash", null);
  return q as T;
}

/** Predicate to filter already-fetched rows on the client. */
export function isPromptVisible(
  p: { is_locked?: boolean | null; pin_hash?: string | null },
  opts: { includeLocked?: boolean } = {},
): boolean {
  if (opts.includeLocked) return true;
  return !p.is_locked && !p.pin_hash;
}
