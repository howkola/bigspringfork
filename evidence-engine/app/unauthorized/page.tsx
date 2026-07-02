import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-stone-200 bg-white p-6 text-center shadow-sm">
      <h1 className="mb-2 text-lg font-semibold">Not on the grants team</h1>
      <p className="text-sm text-stone-600">
        Your account exists but is not activated for the Evidence-to-Proposal
        Engine. Ask a team admin to add your email to the allowlist
        (team_allowlist table), then sign in again.
      </p>
      <Link
        href="/login"
        className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
