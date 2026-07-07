"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWriter } from "@/lib/auth";
import type { EnclosureKind, LetterStatus, ThroughlineKind } from "@/lib/types";

// ---------- letters ----------

export async function createLetter(formData: FormData) {
  const { supabase } = await requireWriter();
  const number = Number(formData.get("number"));
  const act = Number(formData.get("act"));
  const title = String(formData.get("title") ?? "").trim() || null;
  const { data, error } = await supabase
    .from("letters").insert({ number, act, title }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/letters");
  redirect(`/letters/${data.id}`);
}

export async function updateLetter(formData: FormData) {
  const { supabase } = await requireWriter();
  const id = String(formData.get("id"));
  const fields: Record<string, unknown> = {};
  for (const key of ["title", "final_text", "summary", "in_story_date", "sent_date"]) {
    if (formData.has(key)) fields[key] = String(formData.get(key)) || null;
  }
  for (const key of ["act", "salutation_rung", "closing_rung"]) {
    if (formData.has(key)) {
      const v = String(formData.get(key));
      fields[key] = v ? Number(v) : null;
    }
  }
  const { data: before } = await supabase
    .from("letters").select("salutation_rung,closing_rung").eq("id", id).single();
  const { error } = await supabase.from("letters").update(fields).eq("id", id);
  if (error) throw new Error(error.message);

  // log ladder events (only on change) so the instruments read from throughline_events
  for (const [key, kind] of [["salutation_rung", "ladder_salutation"], ["closing_rung", "ladder_closing"]] as const) {
    if (fields[key] != null && fields[key] !== (before as Record<string, unknown> | null)?.[key]) {
      await supabase.from("throughline_events").insert({
        letter_id: id, kind, value: `rung ${fields[key]}`, numeric_value: fields[key],
      });
    }
  }
  revalidatePath(`/letters/${id}`);
}

const STATUS_ORDER: LetterStatus[] = [
  "outlined", "drafted", "fair_copy", "photographed", "sealed", "delivered", "replied",
];

export async function setLetterStatus(formData: FormData) {
  const { supabase } = await requireWriter();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as LetterStatus;
  if (!STATUS_ORDER.includes(status)) throw new Error("unknown status");
  const { error } = await supabase.from("letters").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/letters/${id}`);
  revalidatePath("/letters");
  revalidatePath("/");
}

export async function saveDraft(formData: FormData) {
  const { supabase } = await requireWriter();
  const letter_id = String(formData.get("letter_id"));
  const body = String(formData.get("body") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const { data: last } = await supabase
    .from("letter_drafts").select("version").eq("letter_id", letter_id)
    .order("version", { ascending: false }).limit(1);
  const version = (last?.[0]?.version ?? 0) + 1;
  const { error } = await supabase
    .from("letter_drafts").insert({ letter_id, version, body, notes });
  if (error) throw new Error(error.message);
  revalidatePath(`/letters/${letter_id}`);
}

export async function uploadLetterPhoto(formData: FormData) {
  const { supabase } = await requireWriter();
  const letter_id = String(formData.get("letter_id"));
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return;
  const path = `letters/${letter_id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error: upErr } = await supabase.storage.from("photos").upload(path, file);
  if (upErr) throw new Error(upErr.message);
  const { data: letter } = await supabase.from("letters").select("photo_paths").eq("id", letter_id).single();
  const { error } = await supabase
    .from("letters").update({ photo_paths: [...(letter?.photo_paths ?? []), path] }).eq("id", letter_id);
  if (error) throw new Error(error.message);
  revalidatePath(`/letters/${letter_id}`);
}

// ---------- enclosures ----------

export async function attachEnclosure(formData: FormData) {
  const { supabase } = await requireWriter();
  const letter_id = String(formData.get("letter_id"));
  const kind = String(formData.get("kind")) as EnclosureKind;
  const ref_id = String(formData.get("ref_id") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const { error } = await supabase
    .from("enclosures").insert({ letter_id, kind, ref_id, description });
  if (error) throw new Error(error.message);
  if (kind === "poem" && ref_id) {
    await supabase.from("letters").update({ poem_id: ref_id }).eq("id", letter_id);
  }
  revalidatePath(`/letters/${letter_id}`);
  revalidatePath("/libraries");
}

export async function removeEnclosure(formData: FormData) {
  const { supabase } = await requireWriter();
  const id = String(formData.get("id"));
  const letter_id = String(formData.get("letter_id"));
  const { error } = await supabase.from("enclosures").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/letters/${letter_id}`);
  revalidatePath("/libraries");
}

export async function setEnclosureVisibility(formData: FormData) {
  const { supabase } = await requireWriter();
  const id = String(formData.get("id"));
  const letter_id = String(formData.get("letter_id"));
  const visibility = String(formData.get("visibility"));
  const { error } = await supabase.from("enclosures").update({ visibility }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/letters/${letter_id}`);
}

// ---------- through-lines ----------

export async function logThroughline(formData: FormData) {
  const { supabase } = await requireWriter();
  const letter_id = String(formData.get("letter_id"));
  const kind = String(formData.get("kind")) as ThroughlineKind;
  const value = String(formData.get("value") ?? "").trim() || null;
  const numericRaw = String(formData.get("numeric_value") ?? "").trim();
  const numeric_value = numericRaw ? Number(numericRaw) : null;
  const { error } = await supabase
    .from("throughline_events").insert({ letter_id, kind, value, numeric_value });
  if (error) throw new Error(error.message);
  revalidatePath(`/letters/${letter_id}`);
  revalidatePath("/");
}

// ---------- replies (mobile-critical) ----------

export async function logReply(formData: FormData) {
  const { supabase } = await requireWriter();
  const letter_id = String(formData.get("letter_id"));
  const received_date = String(formData.get("received_date") || new Date().toISOString().slice(0, 10));
  const body_text = String(formData.get("body_text") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const photo_paths: string[] = [];
  for (const file of formData.getAll("photos")) {
    if (file instanceof File && file.size > 0) {
      const path = `replies/${letter_id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("photos").upload(path, file);
      if (error) throw new Error(error.message);
      photo_paths.push(path);
    }
  }

  const { data, error } = await supabase
    .from("replies")
    .insert({ letter_id, received_date, body_text, notes, photo_paths })
    .select("id").single();
  if (error) throw new Error(error.message);

  // one-thumb flow: an optional first concordance phrase rides along
  const phrase = String(formData.get("phrase") ?? "").trim();
  if (phrase) {
    await supabase.from("concordance_phrases").insert({
      reply_id: data.id, phrase, context_note: String(formData.get("phrase_note") ?? "").trim() || null,
    });
  }

  // mark the letter replied
  await supabase.from("letters").update({ status: "replied" }).eq("id", letter_id);

  revalidatePath("/replies");
  revalidatePath("/");
  redirect(`/replies/${data.id}`);
}

export async function updateReply(formData: FormData) {
  const { supabase } = await requireWriter();
  const id = String(formData.get("id"));
  const fields: Record<string, unknown> = {};
  for (const key of ["body_text", "notes", "received_date"]) {
    if (formData.has(key)) fields[key] = String(formData.get(key)) || null;
  }
  if (formData.has("visibility")) fields.visibility = String(formData.get("visibility"));
  const { error } = await supabase.from("replies").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/replies/${id}`);
}

export async function addPhrase(formData: FormData) {
  const { supabase } = await requireWriter();
  const reply_id = String(formData.get("reply_id") ?? "").trim() || null;
  const phrase = String(formData.get("phrase") ?? "").trim();
  if (!phrase) return;
  const context_note = String(formData.get("context_note") ?? "").trim() || null;
  const { error } = await supabase
    .from("concordance_phrases").insert({ reply_id, phrase, context_note });
  if (error) throw new Error(error.message);
  if (reply_id) revalidatePath(`/replies/${reply_id}`);
  revalidatePath("/concordance");
}

export async function setQuotedBack(formData: FormData) {
  const { supabase } = await requireWriter();
  const id = String(formData.get("id"));
  const letter_id = String(formData.get("letter_id") ?? "").trim() || null;
  const { error } = await supabase
    .from("concordance_phrases").update({ quoted_back_in_letter_id: letter_id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/concordance");
}

// ---------- bible ----------

export async function addFact(formData: FormData) {
  const { supabase } = await requireWriter();
  const category = String(formData.get("category"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const tags = String(formData.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const established_in_letter_id = String(formData.get("letter_id") ?? "").trim() || null;
  const { error } = await supabase
    .from("bible_facts").insert({ category, body, tags, established_in_letter_id });
  if (error) throw new Error(error.message);
  revalidatePath("/bible");
}

export async function resolveFact(formData: FormData) {
  const { supabase } = await requireWriter();
  const id = String(formData.get("id"));
  // resolving an open decision converts it to fixed canon
  const { error } = await supabase
    .from("bible_facts").update({ resolved: true, category: "fixed_canon" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/bible");
}

// ---------- libraries ----------

export async function reserveItem(formData: FormData) {
  const { supabase } = await requireWriter();
  const table = String(formData.get("table"));
  if (!["poems", "clippings", "austen_items"].includes(table)) throw new Error("bad table");
  const id = String(formData.get("id"));
  const raw = String(formData.get("letter_number") ?? "").trim();
  const letter_number = raw ? Number(raw) : null;
  const { error } = await supabase.from(table).update({
    reserved_for_letter_number: letter_number,
    status: letter_number ? "reserved" : "available",
  }).eq("id", id).eq("status", letter_number ? "available" : "reserved");
  if (error) throw new Error(error.message);
  revalidatePath("/libraries");
}

export async function setReaction(formData: FormData) {
  const { supabase } = await requireWriter();
  const table = String(formData.get("table"));
  if (!["poems", "clippings", "austen_items"].includes(table)) throw new Error("bad table");
  const id = String(formData.get("id"));
  const her_reaction = String(formData.get("her_reaction") ?? "").trim() || null;
  const { error } = await supabase.from(table).update({ her_reaction }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/libraries");
}

// ---------- settings ----------

export async function saveSettings(formData: FormData) {
  const { supabase } = await requireWriter();
  const fields: Record<string, unknown> = {};
  if (formData.has("cadence_anchor_date")) {
    fields.cadence_anchor_date = String(formData.get("cadence_anchor_date")) || null;
  }
  fields.archive_include_concordance = formData.get("archive_include_concordance") === "on";
  fields.archive_include_journal = formData.get("archive_include_journal") === "on";
  const { error } = await supabase.from("app_state").update(fields).eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function signOut() {
  const { supabase } = await requireWriter();
  await supabase.auth.signOut();
  redirect("/login");
}
