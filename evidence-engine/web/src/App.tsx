import { Navigate, Route, Routes, Link } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import Login from "./routes/Login";
import Dashboard from "./routes/Dashboard";
import ProposalEditor from "./routes/ProposalEditor";

function Shell({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold text-slate-800">
            Evidence&nbsp;→&nbsp;Proposal Engine
          </Link>
          {session && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500">{session.user.email}</span>
              <button
                onClick={signOut}
                className="rounded border px-2 py-1 hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-slate-500">Loading…</div>;
  }

  if (!session) {
    return (
      <Shell>
        <Login />
      </Shell>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/proposals/:id" element={<ProposalEditor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
