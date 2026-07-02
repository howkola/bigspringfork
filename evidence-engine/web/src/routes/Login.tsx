import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { org_name: orgName || "My Organization" } },
        });
        if (error) throw error;
        setMsg("Account created. If confirmations are on, check your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-lg font-semibold">
        {mode === "signin" ? "Sign in" : "Create your team"}
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        {mode === "signin"
          ? "Access your team's proposals."
          : "The first user creates the organization; invite teammates from Supabase."}
      </p>
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
        )}
        <input
          type="email"
          required
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          minLength={6}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          disabled={busy}
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-amber-700">{msg}</p>}
      <button
        className="mt-4 text-sm text-slate-500 underline"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "Need to create a team? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
