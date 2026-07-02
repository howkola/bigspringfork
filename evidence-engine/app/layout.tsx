import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export const metadata: Metadata = {
  title: "Evidence-to-Proposal Engine — Project Harmony CAC",
  description:
    "Grant proposal research pipeline with citation integrity guardrails",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-semibold text-indigo-700">
                Evidence → Proposal Engine
              </Link>
              {user && (
                <nav className="flex gap-4 text-sm text-stone-600">
                  <Link href="/" className="hover:text-stone-900">Runs</Link>
                  <Link href="/grants" className="hover:text-stone-900">Grants</Link>
                  <Link href="/corpus" className="hover:text-stone-900">Corpus</Link>
                  <Link href="/audit" className="hover:text-stone-900">Audit trail</Link>
                </nav>
              )}
            </div>
            {user && (
              <div className="flex items-center gap-3 text-sm text-stone-500">
                <span>{user.email}</span>
                <SignOutButton />
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
