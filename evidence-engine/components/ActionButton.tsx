"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ActionButtonProps {
  label: string;
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  confirmMessage?: string;
  variant?: "primary" | "secondary" | "danger";
  /** Shown while the request is in flight (model calls can take minutes). */
  pendingLabel?: string;
}

const VARIANTS = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
  secondary:
    "bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 disabled:text-stone-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

export default function ActionButton({
  label,
  url,
  method = "POST",
  body,
  confirmMessage,
  variant = "primary",
  pendingLabel,
}: ActionButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error ??
            `Request failed (${res.status})${data.retryable ? " — retryable, try again" : ""}`,
        );
      } else if (data.outcome) {
        setNotice(data.outcome);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        onClick={run}
        disabled={pending}
        className={`rounded px-3 py-1.5 text-sm font-medium transition ${VARIANTS[variant]}`}
      >
        {pending ? (pendingLabel ?? "Working…") : label}
      </button>
      {error && <span className="max-w-xs text-xs text-red-600">{error}</span>}
      {notice && (
        <span className="max-w-xs text-xs text-emerald-700">{notice}</span>
      )}
    </span>
  );
}
