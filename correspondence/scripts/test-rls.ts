// The never-expose test (SPEC §11 Phase 1 + §8).
// Proves: (1) anonymous sees nothing on any table; (2) an archive_reader sees
// nothing pre-reveal; (3) letter_drafts, guardian_reviews and bible_facts
// (incl. name_workshop) are unreachable as archive_reader REGARDLESS of reveal
// state, even with direct API attempts; (4) archive_reader cannot write.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase env (URL, ANON_KEY, SERVICE_ROLE_KEY)");
  process.exit(1);
}

const ALL_TABLES = [
  "app_state", "config", "poems", "clippings", "austen_items", "letters",
  "letter_drafts", "enclosures", "replies", "concordance_phrases",
  "bible_facts", "throughline_events", "journal_entries", "guardian_reviews",
];
const NEVER_EXPOSE = ["letter_drafts", "guardian_reviews", "bible_facts"];

let failures = 0;
function check(ok: boolean, label: string) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
}

async function expectNoRows(client: ReturnType<typeof createClient>, table: string, label: string) {
  const { data, error } = await client.from(table).select("*").limit(5);
  // Either an RLS/permission error or an empty result set is acceptable —
  // what is never acceptable is rows coming back.
  check(!!error || (data ?? []).length === 0, `${label}: ${table} returns nothing`);
}

async function main() {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log("\n1. Anonymous client sees nothing:");
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  for (const table of ALL_TABLES) await expectNoRows(anon, table, "anon");

  console.log("\n2. archive_reader pre-reveal sees nothing:");
  const { data: state } = await admin.from("app_state").select("revealed").single();
  const revealed = !!state?.revealed;
  console.log(`  (app_state.revealed = ${revealed})`);

  const email = `rls-test-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { app_role: "archive_reader" },
  });
  if (cErr || !created.user) throw cErr ?? new Error("could not create test user");

  try {
    const reader = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: sErr } = await reader.auth.signInWithPassword({ email, password });
    if (sErr) throw sErr;

    if (!revealed) {
      for (const table of ALL_TABLES) await expectNoRows(reader, table, "archive_reader(pre-reveal)");
    } else {
      console.log("  (revealed — skipping pre-reveal sweep, running never-expose checks)");
    }

    console.log("\n3. Never-expose tables unreachable regardless of reveal state:");
    for (const table of NEVER_EXPOSE) await expectNoRows(reader, table, "archive_reader");
    {
      const { data, error } = await reader
        .from("bible_facts").select("*").eq("category", "name_workshop").limit(5);
      check(!!error || (data ?? []).length === 0, "archive_reader: name_workshop rows unreachable");
    }

    console.log("\n4. archive_reader cannot write:");
    {
      const { error } = await reader.from("letters").insert({ number: 9999, act: 1 });
      check(!!error, "archive_reader: insert into letters denied");
    }
    {
      const { error } = await reader
        .from("app_state").update({ archive_include_journal: true }).eq("id", true);
      // update either errors or affects zero rows; verify the flag stayed put
      const { data: after } = await admin.from("app_state").select("archive_include_journal").single();
      check(!!error || after?.archive_include_journal === state?.archive_include_journal || after?.archive_include_journal === false,
        "archive_reader: cannot flip archive toggles");
    }
  } finally {
    await admin.auth.admin.deleteUser(created.user.id);
  }

  console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} RLS check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
