// Typed wrappers around the Supabase edge functions.
import { supabase } from "./supabase";
import type { DraftResult, Paper, VerifyResult } from "./types";

export interface DraftCitationInput {
  id: string;
  title: string;
  authors?: string | null;
  year?: number | null;
  abstract?: string | null;
  verdict?: string | null;
}

async function invoke<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

export function researchSearch(query: string, limit = 8) {
  return invoke<{ papers: Paper[]; cached: boolean }>("research-search", {
    query,
    limit,
  });
}

export function verifyCitation(
  claimText: string,
  citationAbstract: string,
  title?: string,
) {
  return invoke<VerifyResult>("verify-citation", {
    claimText,
    citationAbstract,
    title,
  });
}

export function draftSection(input: {
  passage: string;
  sectionContext?: string;
  claims?: string[];
  citations: DraftCitationInput[];
}) {
  return invoke<DraftResult>("draft-section", input);
}
