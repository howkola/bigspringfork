import Link from "next/link";
import { requireWriter } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Desk" },
  { href: "/letters", label: "Letters" },
  { href: "/replies", label: "Replies" },
  { href: "/concordance", label: "Concordance" },
  { href: "/bible", label: "Bible" },
  { href: "/libraries", label: "Libraries" },
  { href: "/settings", label: "Settings" },
];

export default async function WriterLayout({ children }: { children: React.ReactNode }) {
  await requireWriter();
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 md:pb-8">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-paper-deep py-4">
        <Link href="/" className="font-display text-xl tracking-tight">
          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-seal font-display text-sm text-paper">T</span>
          Correspondence
        </Link>
        <nav className="hidden gap-4 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="font-mono text-xs uppercase tracking-wider text-ink-soft hover:text-seal">
              {item.label}
            </Link>
          ))}
        </nav>
        <form action="/bible" method="get" className="ml-auto">
          <input
            className="input w-40 md:w-64"
            type="search"
            name="q"
            placeholder="Search the bible… (did I name his horse?)"
            aria-label="Search"
          />
        </form>
      </header>
      <main className="py-6">{children}</main>

      {/* one-thumb mobile bar; Log reply is the time-critical path */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-paper-deep bg-paper/95 py-2 backdrop-blur md:hidden">
        <Link href="/" className="font-mono text-[11px] uppercase text-ink-soft">Desk</Link>
        <Link href="/letters" className="font-mono text-[11px] uppercase text-ink-soft">Letters</Link>
        <Link href="/replies/new" className="btn btn-seal -mt-6 rounded-full px-5 py-3 shadow-lg">Log reply</Link>
        <Link href="/bible" className="font-mono text-[11px] uppercase text-ink-soft">Bible</Link>
        <Link href="/libraries" className="font-mono text-[11px] uppercase text-ink-soft">Library</Link>
      </nav>
    </div>
  );
}
