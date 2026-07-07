"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? "That link has expired. Ask for a fresh one." : null
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
      <div>
        <div className="font-display text-2xl">Correspondence</div>
        <div className="chrome-label mt-1">the writing room</div>
      </div>
      <label className="block space-y-1">
        <span className="chrome-label">email</span>
        <input className="input" type="email" value={email} autoComplete="username"
          onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="block space-y-1">
        <span className="chrome-label">password</span>
        <input className="input" type="password" value={password} autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="text-sm text-seal">{error}</p>}
      <button className="btn btn-seal w-full" disabled={busy}>
        {busy ? "Unlocking…" : "Enter"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
