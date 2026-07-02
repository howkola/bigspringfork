import { useState } from "react";
import type { Citation } from "../lib/types";

// Minimal reference formatting. v1 supports a plain "author-date" style and a
// markdown list; funder-specific styles can be added later.
function formatReference(c: Citation): string {
  const authors = c.authors ?? "Unknown";
  const year = c.year ? `(${c.year})` : "(n.d.)";
  const venue = c.venue ? ` ${c.venue}.` : "";
  const doi = c.doi ? ` https://doi.org/${c.doi}` : c.url ? ` ${c.url}` : "";
  return `${authors} ${year}. ${c.title}.${venue}${doi}`;
}

export default function CitationsExport({ citations }: { citations: Citation[] }) {
  const [copied, setCopied] = useState(false);

  // De-dupe by DOI/openalex id across claims.
  const seen = new Set<string>();
  const unique = citations.filter((c) => {
    const key = c.doi ?? c.openalex_id ?? c.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const text = unique
    .map((c, i) => `${i + 1}. ${formatReference(c)}`)
    .join("\n");

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (unique.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No citations yet — attach evidence to a claim to build the bibliography.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-600">
          {unique.length} reference{unique.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={copy}
          className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
        >
          {copied ? "Copied!" : "Copy list"}
        </button>
      </div>
      <ol className="space-y-1 text-sm text-slate-700">
        {unique.map((c, i) => (
          <li key={c.id} className="flex gap-2">
            <span className="text-slate-400">{i + 1}.</span>
            <span>{formatReference(c)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
