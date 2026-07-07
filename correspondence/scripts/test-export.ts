// Export round-trip (SPEC §11 Phase 1): build the zip, re-open it, and prove
// every table's JSON parses and row counts match the live database.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import AdmZip from "adm-zip";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildExportArchive, EXPORT_TABLES } from "../lib/export-core";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

async function main() {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  mkdirSync(join(process.cwd(), "exports"), { recursive: true });
  const zipPath = join(process.cwd(), "exports", "export-roundtrip.zip");

  const archive = await buildExportArchive(admin);
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(zipPath);
    out.on("close", resolve);
    out.on("error", reject);
    archive.on("error", reject);
    archive.pipe(out);
    archive.finalize();
  });
  console.log(`Wrote ${zipPath}`);

  const zip = new AdmZip(zipPath);
  let failures = 0;
  for (const table of EXPORT_TABLES) {
    const entry = zip.getEntry(`database/${table}.json`);
    if (!entry) {
      console.log(`  FAIL  ${table}: missing from zip`);
      failures++;
      continue;
    }
    const rows = JSON.parse(entry.getData().toString("utf8")) as unknown[];
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    const ok = !error && rows.length === (count ?? -1);
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${table}: zip=${rows.length} db=${count}`);
    if (!ok) failures++;
  }

  const docEntries = zip.getEntries().filter((e) => e.entryName.startsWith("seed-docs/"));
  console.log(`  seed-docs files in zip: ${docEntries.length}`);

  console.log(failures === 0 ? "\nExport round-trip passed." : `\n${failures} table(s) FAILED round-trip.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
