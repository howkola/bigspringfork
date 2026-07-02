"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();

    try {
      if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        setMessage(
          "Account created. If email confirmation is enabled, confirm your address, then sign in. Access is limited to allowlisted grants-team emails.",
        );
        setMode("sign_in");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(searchParams.get("next") ?? "/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-lg font-semibold">
        {mode === "sign_in" ? "Sign in" : "Create account"}
      </h1>
      <p className="mb-4 text-sm text-stone-500">
        Grants team access only. Your email must be on the team allowlist.
      </p>
      <form onSubmit={submit} className="space-y-3">
        {mode === "sign_up" && (
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded border border-stone-300 p-2 text-sm"
          />
        )}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded border border-stone-300 p-2 text-sm"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded border border-stone-300 p-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
        >
          {pending
            ? "Working…"
            : mode === "sign_in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      <button
        onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
        className="mt-4 text-sm text-indigo-600 hover:underline"
      >
        {mode === "sign_in"
          ? "First time? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
