import { NextResponse } from "next/server";
import { PassThrough, Readable } from "node:stream";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleOf } from "@/lib/auth";
import { buildExportArchive } from "@/lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || roleOf(user) !== "writer") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const archive = await buildExportArchive(admin);
  const pass = new PassThrough();
  archive.pipe(pass);
  archive.finalize();

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="correspondence-export-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
