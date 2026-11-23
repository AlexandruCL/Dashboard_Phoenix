"use client";

import { useEffect, useState, type ReactNode } from "react";
import { gradeColor } from "@/lib/format";

export function Pill({ callsign, grade }: { callsign: string | null; grade: string }) {
  const c = gradeColor(grade);
  return (
    <span className="pill" style={{ background: c.bg, color: c.fg }}>
      {callsign ?? "—"}
    </span>
  );
}

export function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="glass search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A9B0D6" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <span className="sr-only">{label}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Caută după callsign sau nume" />
    </label>
  );
}

// Opens on hover and on keyboard focus (design §9).
export function Tooltip({ tip, label, children }: { tip: ReactNode; label: string; children: ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <span className="tip-wrap">
      <button
        type="button"
        aria-label={label}
        onMouseEnter={() => setOn(true)}
        onMouseLeave={() => setOn(false)}
        onFocus={() => setOn(true)}
        onBlur={() => setOn(false)}
        onKeyDown={(e) => e.key === "Escape" && setOn(false)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: 0, border: 0, background: "none", cursor: "help", borderRadius: 12 }}
      >
        {children}
      </button>
      {on && (
        <span role="tooltip" className="tip">
          {tip}
        </span>
      )}
    </span>
  );
}

export function Ring({ pct }: { pct: number | null }) {
  const dash = (163.4 * Math.max(0, Math.min(100, pct ?? 0))) / 100;
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
      <circle
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="#3D7BFF"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} 163.4`}
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
}

export function Meter({ pct, background, width = 76 }: { pct: number; background: string; width?: number }) {
  return (
    <span style={{ width, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden", display: "block" }}>
      <span style={{ display: "block", height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background }} />
    </span>
  );
}

// Oprește / Șterge → "Sigur?" → Confirmă / Anulează, inline in the row.
export function ConfirmInline({
  label,
  busy,
  onConfirm,
}: {
  label: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(true)} disabled={busy}>
        {label}
      </button>
    );
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#FFB4AC" }}>Sigur?</span>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={busy}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        Confirmă
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>
        Anulează
      </button>
    </span>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="state" role="status" aria-label="Se încarcă" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="state state-error" role="alert" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <span>Nu am putut încărca datele: {error.message}</span>
      {retry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>
          Reîncearcă
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="state">{children}</div>;
}

// Short toast after writes; one at a time is enough for this panel.
let pushToast: ((t: { text: string; error?: boolean }) => void) | null = null;
export const toast = (text: string, error = false) => pushToast?.({ text, error });

export function Toaster() {
  const [t, setT] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    pushToast = setT;
    return () => {
      pushToast = null;
    };
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 4000);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return (
    <div className={`toast${t.error ? " toast-error" : ""}`} role={t.error ? "alert" : "status"}>
      {t.text}
    </div>
  );
}
