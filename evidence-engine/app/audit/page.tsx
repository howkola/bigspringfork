import { requireTeamPage } from "@/lib/page-auth";
import type { AuditLogEntry, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const { supabase } = await requireTeamPage();

  const [{ data: entries }, { data: profiles }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("profiles").select("id, email"),
  ]);

  const emailById = new Map(
    ((profiles ?? []) as Pick<Profile, "id" | "email">[]).map((p) => [
      p.id,
      p.email,
    ]),
  );
  const log = (entries ?? []) as AuditLogEntry[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Audit trail</h1>
        <p className="text-sm text-stone-500">
          Every pipeline action, review decision, edit, and freshness event.
          Append-only — history cannot be rewritten. Showing the latest 300.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Who</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {log.map((entry) => (
              <tr key={entry.id} className="align-top hover:bg-stone-50">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-stone-500">
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-xs text-stone-600">
                  {entry.actor_id
                    ? (emailById.get(entry.actor_id) ?? "unknown")
                    : "system"}
                </td>
                <td className="px-4 py-2">
                  <span className="font-mono text-xs">{entry.action}</span>
                </td>
                <td className="px-4 py-2 text-xs text-stone-600">
                  <pre className="max-w-md overflow-auto whitespace-pre-wrap font-sans">
                    {JSON.stringify(entry.detail, null, 0)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
