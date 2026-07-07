// Emits the structured JSON seeds from the source modules into seeds/json/.
// Run: npm run seeds:build
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "json");
mkdirSync(out, { recursive: true });

const { poems } = await import("./src/poems.mjs");
const { clippings } = await import("./src/clippings.mjs");
const { austenItems } = await import("./src/austen.mjs");
const { config } = await import("./src/config.mjs");
const { glossary } = await import("./src/glossary.mjs");
const { bibleFacts } = await import("./src/bible.mjs");
const { journalEntries } = await import("./src/journal.mjs");
const { letters } = await import("./src/letters.mjs");

const files = {
  "poems.json": poems,
  "clippings.json": clippings,
  "austen_items.json": austenItems,
  "config.json": config,
  "glossary.json": glossary,
  "bible_facts.json": bibleFacts,
  "journal_entries.json": journalEntries,
  "letters.json": letters,
};

for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(out, name), JSON.stringify(data, null, 2) + "\n");
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`wrote seeds/json/${name} (${count} ${Array.isArray(data) ? "rows" : "keys"})`);
}
