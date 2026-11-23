"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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

export function Bone({ w = "100%", h = 14, r = 6 }: { w?: number | string; h?: number; r?: number }) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r }} />;
}

// Table-shaped skeleton: callsign pill (unless the table has none), name + sub line, number on the right.
export function Loading({ rows = 4, framed, pill = true }: { rows?: number; framed?: boolean; pill?: boolean }) {
  return (
    <div role="status" aria-label="Se încarcă" className={framed ? "glass" : undefined} style={framed ? { borderRadius: 18, padding: "8px 10px" } : undefined}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row" style={pill ? undefined : { gridTemplateColumns: "minmax(0, 1fr) 64px" }}>
          {pill && <Bone w={44} h={24} r={7} />}
          <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Bone w={`${[62, 48, 70, 55][i % 4]}%`} />
            <Bone w={`${[30, 22, 26, 34][i % 4]}%`} h={10} />
          </span>
          <Bone w={40} h={16} />
        </div>
      ))}
    </div>
  );
}

export type Option = { value: string; label: string; hint?: string; lead?: ReactNode; search?: string };

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Dropdown with a search box (ARIA select-only combobox: button opens a popup with a combobox input + listbox).
// Lives inside <label> at call sites, so clicks in the popup preventDefault to stop the label re-clicking the button.
export function Select({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Caută",
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  searchPlaceholder?: string;
  loading?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const shown = q ? options.filter((o) => fold(`${o.search ?? o.label} ${o.hint ?? ""}`).includes(fold(q.trim()))) : options;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show(seed = "") {
    setQ(seed);
    setActive(seed ? 0 : Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function close() {
    setOpen(false);
    button.current?.focus();
  }
  function pick(o: Option) {
    onChange(o.value);
    close();
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") setActive((a) => Math.min(shown.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter" && shown[active]) pick(shown[active]);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") return setOpen(false);
    else return;
    e.preventDefault();
  }

  return (
    <div className="select" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="field select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={`${id}-v`}
        disabled={loading}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            show();
          } else if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            show(e.key); // start typing on the closed select = search
          }
        }}
      >
        <span id={`${id}-v`} className="select-value">
          {loading ? (
            <Bone w="60%" />
          ) : selected ? (
            <>
              {selected.lead}
              <span className="ellipsis">{selected.label}</span>
            </>
          ) : (
            <span className="select-placeholder ellipsis">{placeholder}</span>
          )}
        </span>
        <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="select-pop" onClick={(e) => e.preventDefault()}>
          <div className="select-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A9B0D6" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              autoFocus
              role="combobox"
              aria-label={searchPlaceholder}
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={shown[active] ? `${id}-${active}` : undefined}
              placeholder={searchPlaceholder}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
            />
          </div>
          <ul id={`${id}-list`} ref={list} role="listbox" className="select-list">
            {shown.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                data-active={i === active || undefined}
                className="select-opt"
                onPointerMove={() => setActive(i)}
                onClick={() => pick(o)}
              >
                {o.lead}
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span className="ellipsis">{o.label}</span>
                  {o.hint && <span className="sub ellipsis">{o.hint}</span>}
                </span>
                {o.value === value && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue-soft)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </li>
            ))}
            {shown.length === 0 && <li className="select-empty">Niciun rezultat pentru „{q.trim()}”.</li>}
          </ul>
        </div>
      )}
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
