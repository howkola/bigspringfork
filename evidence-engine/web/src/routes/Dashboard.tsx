import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Proposal } from "../lib/types";

export default function Dashboard() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [title, setTitle] = useState("");
  const [funder, setFunder] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) setErr(error.message);
    else setProposals((data ?? []) as Proposal[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const { data: userRes } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userRes.user!.id)
      .single();
    const { error } = await supabase.from("proposals").insert({
      title: title.trim(),
      funder: funder.trim() || null,
      org_id: (profile as { org_id: string }).org_id,
      created_by: userRes.user!.id,
    });
    if (error) setErr(error.message);
    else {
      setTitle("");
      setFunder("");
      load();
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">New proposal</h2>
        <form onSubmit={create} className="flex flex-wrap gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="Proposal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="w-56 rounded border px-3 py-2 text-sm"
            placeholder="Funder (optional)"
            value={funder}
            onChange={(e) => setFunder(e.target.value)}
          />
          <button className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Create
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Your proposals</h2>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : proposals.length === 0 ? (
          <p className="text-slate-500">No proposals yet. Create one above.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-white">
            {proposals.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <Link
                    to={`/proposals/${p.id}`}
                    className="font-medium text-slate-800 hover:underline"
                  >
                    {p.title}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {p.funder ?? "No funder"} · {p.status}
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(p.updated_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
