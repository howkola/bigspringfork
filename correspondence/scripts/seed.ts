// Loads the structured JSON seeds into Supabase. Idempotent: safe to re-run.
// Requires .env with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// Optionally WRITER_EMAIL to stamp the single account with the writer role.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function loadJson<T>(name: string): T {
  const p = join(process.cwd(), "seeds", "json", name);
  if (!existsSync(p)) {
    console.error(`Missing ${p}. Restore the private seed bundle, then run: npm run seeds:build`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

type AnyRow = Record<string, unknown>;

async function upsert(table: string, rows: AnyRow[], onConflict: string) {
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table}: ${rows.length} rows upserted`);
}

async function main() {
  console.log("Seeding…");

  // config: one row per top-level key, plus the glossary
  const config = loadJson<Record<string, unknown>>("config.json");
  const glossary = loadJson<Record<string, unknown>>("glossary.json");
  const configRows = [
    ...Object.entries(config).map(([key, value]) => ({ key, value })),
    { key: "glossary", value: glossary },
  ];
  await upsert("config", configRows, "key");

  // libraries — strip helper fields the schema doesn't know
  const poems = loadJson<AnyRow[]>("poems.json");
  await upsert("poems", poems, "poet,title");

  const clippings = loadJson<AnyRow[]>("clippings.json");
  await upsert("clippings", clippings, "number");

  const austen = loadJson<AnyRow[]>("austen_items.json");
  await upsert("austen_items", austen, "code");

  // letters (Letter 1)
  const letters = loadJson<AnyRow[]>("letters.json");
  await upsert("letters", letters, "number");

  // journal
  const journal = loadJson<AnyRow[]>("journal_entries.json");
  await upsert("journal_entries", journal, "in_story_date");

  // bible facts: insert-if-missing keyed on (category, body); resolve letter links
  const facts = loadJson<(AnyRow & { letter_number?: number })[]>("bible_facts.json");
  const { data: letterRows, error: lErr } = await admin.from("letters").select("id,number");
  if (lErr) throw lErr;
  const byNumber = new Map((letterRows ?? []).map((l) => [l.number as number, l.id as string]));
  let inserted = 0;
  for (const fact of facts) {
    const { letter_number, ...row } = fact;
    if (letter_number && byNumber.has(letter_number)) {
      row.established_in_letter_id = byNumber.get(letter_number);
    }
    const { data: existing, error: qErr } = await admin
      .from("bible_facts").select("id").eq("category", row.category as string).eq("body", row.body as string).limit(1);
    if (qErr) throw qErr;
    if (!existing?.length) {
      const { error } = await admin.from("bible_facts").insert(row);
      if (error) throw new Error(`bible_facts: ${error.message}`);
      inserted++;
    }
  }
  console.log(`  bible_facts: ${inserted} new (of ${facts.length})`);

  // storage bucket for letter/reply photographs
  const { error: bucketErr } = await admin.storage.createBucket("photos", { public: false });
  if (bucketErr && !/already exists/i.test(bucketErr.message)) throw bucketErr;
  console.log("  storage: photos bucket ready");

  // stamp the writer role on the single account
  const writerEmail = process.env.WRITER_EMAIL;
  const { data: usersData, error: uErr } = await admin.auth.admin.listUsers();
  if (uErr) throw uErr;
  const users = usersData?.users ?? [];
  const target = writerEmail
    ? users.find((u) => u.email?.toLowerCase() === writerEmail.toLowerCase())
    : users.length === 1 ? users[0] : undefined;
  if (target) {
    if ((target.app_metadata as AnyRow)?.app_role !== "writer") {
      const { error } = await admin.auth.admin.updateUserById(target.id, {
        app_metadata: { ...target.app_metadata, app_role: "writer" },
      });
      if (error) throw error;
      console.log(`  auth: writer role granted to ${target.email}`);
    } else {
      console.log(`  auth: ${target.email} already has the writer role`);
    }
  } else {
    console.log("  auth: no user stamped (create the account in Supabase, set WRITER_EMAIL, re-run)");
  }

  console.log("Done. The post is slow in 1817; the database is not.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
