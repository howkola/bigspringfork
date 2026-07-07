// Export everything: full-database JSON (writer_only included — this is the
// authenticated writer's export), all Storage media, and the seed-docs folder.
// Shared by the /api/export route and scripts/test-export.ts — no "server-only"
// import here so the round-trip test can run outside Next.js.
import archiver from "archiver";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

export const EXPORT_TABLES = [
  "app_state",
  "config",
  "poems",
  "clippings",
  "austen_items",
  "letters",
  "letter_drafts",
  "enclosures",
  "replies",
  "concordance_phrases",
  "bible_facts",
  "throughline_events",
  "journal_entries",
  "guardian_reviews",
] as const;

export const STORAGE_BUCKET = "photos";

async function fetchAllRows(admin: SupabaseClient, table: string) {
  const pageSize = 1000;
  let from = 0;
  const rows: unknown[] = [];
  for (;;) {
    const { data, error } = await admin.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw new Error(`export: ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function listStoragePaths(admin: SupabaseClient, prefix = ""): Promise<string[]> {
  const { data, error } = await admin.storage.from(STORAGE_BUCKET).list(prefix, { limit: 1000 });
  if (error) return []; // bucket may not exist yet
  const paths: string[] = [];
  for (const entry of data ?? []) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      paths.push(...(await listStoragePaths(admin, full))); // folder
    } else {
      paths.push(full);
    }
  }
  return paths;
}

/** Builds the archive and returns it; caller pipes archive to a response or file. */
export async function buildExportArchive(admin: SupabaseClient, seedDocsDir?: string) {
  const archive = archiver("zip", { zlib: { level: 6 } });

  // (a) full-database JSON
  for (const table of EXPORT_TABLES) {
    const rows = await fetchAllRows(admin, table);
    archive.append(JSON.stringify(rows, null, 2), { name: `database/${table}.json` });
  }

  // (b) storage media
  for (const path of await listStoragePaths(admin)) {
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(path);
    if (error || !data) continue;
    archive.append(Buffer.from(await data.arrayBuffer()), { name: `storage/${STORAGE_BUCKET}/${path}` });
  }

  // (c) the seed-docs folder, when present on disk
  const docs = seedDocsDir ?? join(process.cwd(), "seed-docs");
  if (existsSync(docs)) {
    for (const name of readdirSync(docs)) {
      const p = join(docs, name);
      if (statSync(p).isFile()) archive.append(readFileSync(p), { name: `seed-docs/${name}` });
    }
  }

  return archive;
}
