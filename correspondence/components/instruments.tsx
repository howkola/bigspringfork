// Dashboard instruments — drawn as period devices, not progress bars.

export function StellaBarometer({ readings }: { readings: { value: string | null; numeric: number | null }[] }) {
  const latest = readings.at(-1);
  const n = Math.max(-5, Math.min(5, latest?.numeric ?? 0));
  const angle = (n / 5) * 70; // -70°..70°
  const history = readings.map((r) => r.numeric ?? 0).slice(-16);
  const points = history
    .map((v, i) => `${8 + (i * 104) / Math.max(1, history.length - 1)},${28 - (Math.max(-5, Math.min(5, v)) * 9) / 5}`)
    .join(" ");
  return (
    <div className="card">
      <div className="chrome-label">Stella Barometer</div>
      <svg viewBox="0 0 120 78" className="mx-auto mt-2 w-full max-w-[220px]">
        <circle cx="60" cy="60" r="52" fill="#fff" fillOpacity="0.5" stroke="#A08862" strokeWidth="2" />
        <path d="M 16 60 A 44 44 0 0 1 104 60" fill="none" stroke="#C7B896" strokeWidth="6" strokeLinecap="round" />
        {["Displeasure", "No Opinion", "Favour"].map((label, i) => (
          <text key={label} x={[24, 60, 96][i]} y={[44, 20, 44][i]} textAnchor="middle" fontSize="6" fill="#8A7A64" fontFamily="monospace">
            {label}
          </text>
        ))}
        <g transform={`rotate(${angle} 60 60)`}>
          <line x1="60" y1="60" x2="60" y2="24" stroke="#8E2C21" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <circle cx="60" cy="60" r="4" fill="#8E2C21" />
      </svg>
      <p className="mt-2 min-h-10 font-display text-sm italic text-ink-soft">
        {latest?.value ?? "No reading taken. These things cannot be hurried."}
      </p>
      {history.length > 1 && (
        <svg viewBox="0 0 120 34" className="mt-1 w-full">
          <line x1="8" y1="28" x2="112" y2="28" stroke="#E6DAC4" strokeWidth="1" />
          <polyline points={points} fill="none" stroke="#A08862" strokeWidth="1.5" />
        </svg>
      )}
    </div>
  );
}

export function SalutationLadder({
  rung, closingRung, rungs,
}: { rung: number; closingRung: number; rungs: string[] }) {
  const total = Math.max(rungs.length, 5);
  return (
    <div className="card">
      <div className="chrome-label">Salutation Ladder</div>
      <div className="mt-2 flex gap-4">
        <svg viewBox="0 0 60 150" className="h-40 w-16 shrink-0">
          <line x1="15" y1="5" x2="15" y2="145" stroke="#A08862" strokeWidth="3" />
          <line x1="45" y1="5" x2="45" y2="145" stroke="#A08862" strokeWidth="3" />
          {Array.from({ length: total }).map((_, i) => {
            const y = 135 - (i * 125) / (total - 1);
            const active = i + 1 === rung;
            return (
              <g key={i}>
                <line x1="15" y1={y} x2="45" y2={y} stroke={active ? "#8E2C21" : "#C7B896"} strokeWidth={active ? 4 : 2.5} />
                {active && <circle cx="30" cy={y} r="5" fill="#8E2C21" />}
              </g>
            );
          })}
        </svg>
        <div className="space-y-1 text-sm">
          {rungs.map((label, i) => (
            <div key={i} className={i + 1 === rung ? "font-semibold text-seal" : "text-ink-faint"}>
              <span className="font-mono text-[10px]">{i + 1}.</span>{" "}
              <span className="font-display italic">{label}</span>
            </div>
          ))}
          <p className="pt-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            closing rung {closingRung || "—"} · one rung max · one retreat, Act IV
          </p>
        </div>
      </div>
    </div>
  );
}

export function LedgerCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="chrome-label">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
