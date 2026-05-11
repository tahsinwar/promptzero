/**
 * End-to-end test: drag-and-drop reorder of sub_prompts in the admin flow.
 *
 * This script exercises the exact path the admin UI uses when a drag-and-drop
 * reorder is saved: it calls the `sync_sub_prompts` RPC with the reordered
 * items array (same payload shape as `src/routes/admin.prompts.$id.tsx`).
 *
 * Asserts:
 *   1. created_at is unchanged for every sub_prompt after reorder.
 *   2. updated_at is unchanged for every sub_prompt (reorder-only branch must
 *      not touch updated_at — see sync_sub_prompts SQL).
 *   3. display_order matches the new order.
 *   4. Server `check_sub_prompt_order(p_id)` reports `consistent: true`,
 *      0 duplicates, 0 gaps, 0 missing display_order.
 *   5. The client-side deterministic sort `(display_order, created_at, id)`
 *      matches the DB row order — same invariant the admin banner enforces.
 *
 * Usage:
 *   ADMIN_EMAIL=...  ADMIN_PASSWORD=...  TEST_PROMPT_ID=<uuid> \
 *     bun tests/e2e/reorder-sub-prompts.test.ts
 *
 * The prompt referenced by TEST_PROMPT_ID must have >= 2 sub_prompts.
 * The script restores the original order at the end (best-effort).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PROMPT_ID = process.env.TEST_PROMPT_ID;

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
function ok(msg: string) {
  console.log(`✓ ${msg}`);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) die(msg);
}

if (!SUPABASE_URL || !SUPABASE_KEY) die("Missing SUPABASE URL / key env");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) die("Set ADMIN_EMAIL and ADMIN_PASSWORD");
if (!PROMPT_ID) die("Set TEST_PROMPT_ID to a prompt uuid with >= 2 sub_prompts");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = {
  id: string;
  prompt_id: string;
  title: string;
  content: string;
  description: string | null;
  ai_models: string[] | null;
  difficulty: string | null;
  notes: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
};

async function fetchAll(): Promise<Row[]> {
  const { data, error } = await supabase
    .from("sub_prompts")
    .select("*")
    .eq("prompt_id", PROMPT_ID!)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) die(`fetch sub_prompts: ${error.message}`);
  return (data ?? []) as Row[];
}

function toPayload(rows: Row[]) {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    description: r.description,
    ai_models: r.ai_models ?? [],
    difficulty: r.difficulty,
    notes: r.notes,
  }));
}

function clientSort(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    const d = (a.display_order ?? 0) - (b.display_order ?? 0);
    if (d !== 0) return d;
    const ca = a.created_at ?? "";
    const cb = b.created_at ?? "";
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

async function callSync(items: ReturnType<typeof toPayload>) {
  const { error } = await supabase.rpc("sync_sub_prompts", {
    p_id: PROMPT_ID!,
    items: items as unknown as any,
  });
  if (error) die(`sync_sub_prompts: ${error.message}`);
}

async function serverCheck() {
  const { data, error } = await supabase.rpc("check_sub_prompt_order", { p_id: PROMPT_ID! });
  if (error) die(`check_sub_prompt_order: ${error.message}`);
  return data as {
    total: number;
    duplicates: number;
    gaps_or_mismatches: number;
    missing_display_order: number;
    missing_created_at: number;
    consistent: boolean;
  };
}

// --- run ---
const { error: signInErr } = await supabase.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
if (signInErr) die(`admin sign-in: ${signInErr.message}`);
ok("admin signed in");

const before = await fetchAll();
assert(before.length >= 2, `need >= 2 sub_prompts, got ${before.length}`);
ok(`loaded ${before.length} sub_prompts`);

const originalById = new Map(before.map((r) => [r.id, r]));
const originalOrder = before.map((r) => r.id);

// Simulate a drag-and-drop reorder: reverse the list.
const reordered = [...before].reverse();
await callSync(toPayload(reordered));
ok("called sync_sub_prompts with reversed order (drag simulation)");

const after = await fetchAll();
assert(after.length === before.length, "row count changed");

// 1. created_at invariant
for (const row of after) {
  const orig = originalById.get(row.id);
  assert(orig, `row ${row.id} disappeared`);
  assert(
    row.created_at === orig.created_at,
    `created_at CHURNED for ${row.id}: ${orig.created_at} -> ${row.created_at}`,
  );
}
ok("created_at unchanged for every row");

// 2. updated_at invariant (reorder-only branch must not bump updated_at)
for (const row of after) {
  const orig = originalById.get(row.id)!;
  assert(
    row.updated_at === orig.updated_at,
    `updated_at CHURNED for ${row.id}: ${orig.updated_at} -> ${row.updated_at}`,
  );
}
ok("updated_at unchanged for every row (no churn on reorder-only)");

// 3. display_order matches reversed sequence
const sorted = clientSort(after);
const newOrder = sorted.map((r) => r.id);
const expected = [...originalOrder].reverse();
assert(
  JSON.stringify(newOrder) === JSON.stringify(expected),
  `order mismatch:\n  expected ${expected.join(",")}\n  got      ${newOrder.join(",")}`,
);
for (let i = 0; i < sorted.length; i++) {
  assert(sorted[i].display_order === i, `display_order at idx ${i} is ${sorted[i].display_order}`);
}
ok("display_order reflects new (reversed) order");

// 4. Server check
const srv = await serverCheck();
assert(srv.consistent, `server check_sub_prompt_order not consistent: ${JSON.stringify(srv)}`);
assert(srv.duplicates === 0, `duplicates=${srv.duplicates}`);
assert(srv.gaps_or_mismatches === 0, `gaps_or_mismatches=${srv.gaps_or_mismatches}`);
assert(srv.missing_display_order === 0, `missing_display_order=${srv.missing_display_order}`);
ok(`server check_sub_prompt_order consistent (total=${srv.total})`);

// 5. Client-vs-DB sort agreement
const dbOrder = after.map((r) => r.id); // already ordered by display_order, created_at, id
const clientOrder = clientSort(after).map((r) => r.id);
assert(
  JSON.stringify(dbOrder) === JSON.stringify(clientOrder),
  `client deterministic sort disagrees with DB order`,
);
ok("client sort agrees with DB order");

// Restore original order (best-effort cleanup)
try {
  const restorePayload = toPayload(originalOrder.map((id) => originalById.get(id)!));
  await callSync(restorePayload);
  ok("restored original order");
} catch (e) {
  console.warn(`! restore failed: ${(e as Error).message}`);
}

console.log("\n✅ E2E reorder test passed");
process.exit(0);