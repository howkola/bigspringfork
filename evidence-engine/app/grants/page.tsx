import { requireTeamPage } from "@/lib/page-auth";
import GrantForm from "@/components/GrantForm";
import ActionButton from "@/components/ActionButton";
import type { GrantOpportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GrantsPage() {
  const { supabase } = await requireTeamPage();

  const { data } = await supabase
    .from("grant_opportunities")
    .select("*")
    .order("created_at", { ascending: false });
  const grants = (data ?? []) as GrantOpportunity[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Grant opportunities</h1>
      </div>
      <GrantForm />

      {grants.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
          No grant opportunities yet. Add one to start a pipeline run.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grants.map((grant) => (
            <div
              key={grant.id}
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{grant.title}</h2>
                  <p className="text-sm text-stone-500">{grant.funder}</p>
                </div>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                  {grant.status}
                </span>
              </div>
              <p className="mb-2 line-clamp-3 text-sm text-stone-600">
                {grant.description}
              </p>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                {grant.deadline && <span>Deadline: {grant.deadline}</span>}
                {(grant.amount_min || grant.amount_max) && (
                  <span>
                    Award: ${grant.amount_min?.toLocaleString() ?? "?"} – $
                    {grant.amount_max?.toLocaleString() ?? "?"}
                  </span>
                )}
                <span>
                  {grant.required_sections.length} required section
                  {grant.required_sections.length === 1 ? "" : "s"}
                </span>
              </div>
              <ActionButton
                label="Start pipeline run"
                url="/api/runs"
                body={{ grant_opportunity_id: grant.id }}
                pendingLabel="Creating run…"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
