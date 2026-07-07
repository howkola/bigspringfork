// THE FLIP. Typed confirmation required; generates the archive reader's
// magic link; archive content locks read-only at the DB level (trigger).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleOf } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || roleOf(user) !== "writer") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { confirmation, reader_email } = (await request.json()) as {
    confirmation?: string;
    reader_email?: string;
  };
  if (confirmation !== "REVEAL") {
    return NextResponse.json(
      { error: 'Type the word REVEAL to bind the volume. No accidental taps.' },
      { status: 400 }
    );
  }
  const email = (reader_email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "The reader's email address is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. ensure the archive_reader account exists
  const { data: usersData, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  let reader = usersData.users.find((u) => u.email?.toLowerCase() === email);
  if (!reader) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { app_role: "archive_reader" },
    });
    if (error || !created.user) return NextResponse.json({ error: error?.message }, { status: 500 });
    reader = created.user;
  } else {
    const role = (reader.app_metadata as Record<string, unknown>)?.app_role;
    if (role === "writer") {
      return NextResponse.json({ error: "That address belongs to the writer account." }, { status: 400 });
    }
    if (role !== "archive_reader") {
      const { error } = await admin.auth.admin.updateUserById(reader.id, {
        app_metadata: { ...reader.app_metadata, app_role: "archive_reader" },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 2. flip the switch — the DB trigger locks archive rows from here on
  const { error: stateErr } = await admin
    .from("app_state")
    .update({ revealed: true, revealed_at: new Date().toISOString() })
    .eq("id", true);
  if (stateErr) return NextResponse.json({ error: stateErr.message }, { status: 500 });

  // 3. mint the magic link that lands on the Archive
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${site}/archive` },
  });
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  // Hand back a link through our own confirm route (SSR cookie flow). Links
  // expire per Supabase OTP settings — run REVEAL again to mint a fresh one;
  // re-running never unbinds the volume.
  const magicLink = `${site}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/archive`;

  return NextResponse.json({
    revealed: true,
    magic_link: magicLink,
    note: "The volume is bound. Archive content is now read-only at the database level.",
  });
}
