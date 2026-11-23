"use client";

import { useState } from "react";
import useSWR from "swr";
import { Empty, ErrorState, Loading, Meter, Pill, SearchBox, toast } from "@/components/ui";
import { post } from "@/lib/api";
import { addDays, ddmm, ddmmyyyy, searchMatch, todayRo, weekday } from "@/lib/format";
import type { Cell, Pontaje } from "@/lib/types";

const COLS = "74px minmax(170px,1.7fr) repeat(7, minmax(52px,1fr)) 106px";

function cellView(c: Cell, target: number): { text: string; color: string; label: string } {
  if (c.value === "CO") return { text: "CO", color: "#8FA8FF", label: "concediu" };
  if (c.value === "/") return { text: "/", color: "var(--muted-2)", label: "angajat în ziua respectivă" };
  if (c.value === null) return { text: "", color: "inherit", label: "netrimis" };
  const color = c.value === 0 ? "#FF6B5E" : c.value < target ? "#FFAA6B" : "var(--text)";
  return { text: String(c.value), color, label: `${c.value} minute${c.live ? ", live (încă netrimis în Sheet)" : ""}` };
}

export default function PontajePage() {
  const [q, setQ] = useState("");
  const { data, error, isLoading, mutate } = useSWR<Pontaje>("/pontaje");
  const today = todayRo();
  const [busy, setBusy] = useState(false);

  async function updateNames() {
    setBusy(true);
    try {
      const { rows } = await post<{ rows: number }>("/pontaje/names");
      await mutate();
      toast(rows ? `Nume actualizate în Sheet: ${rows} rânduri.` : "Numele din Sheet erau deja la zi.");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  const rows = data?.rows.filter((r) => searchMatch(q, r.callsign, r.name)) ?? [];
  const weekTarget = (data?.daily_target ?? 100) * 7;

  return (
    <>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} label="Caută membru" />
        {data && (
          <div className="glass box">
            <span className="dot" aria-hidden="true" />
            <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>
              Săptămâna curentă · {ddmm(data.week_start)} – {ddmmyyyy(addDays(data.week_start, 6))}
            </span>
          </div>
        )}
        <span className="hint">Se resetează la final de săptămână</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={updateNames} title="Rulează și automat în fiecare noapte la 00:00">
          {busy ? "Se actualizează…" : "Actualizează membrii"}
        </button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        <span style={{ color: "#8FA8FF" }}>CO</span> concediu · <span style={{ color: "#FFAA6B" }}>portocaliu</span> sub {data?.daily_target ?? 100} min ·{" "}
        <span style={{ color: "#FF6B5E" }}>roșu</span> 0 min · <span style={{ textDecoration: "underline dotted" }}>subliniat</span> = live, încă netrimis în Sheet
      </p>

      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : isLoading || !data ? (
        <Loading rows={8} framed />
      ) : (
        <div className="glass scroll-x" style={{ borderRadius: 18 }}>
          <div style={{ minWidth: 780, padding: "8px 10px 12px" }} role="table" aria-label="Pontaje săptămâna curentă">
            <div role="row" className="th" style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, padding: "10px 8px", borderBottom: "1px solid var(--line)" }}>
              <span role="columnheader">Callsign</span>
              <span role="columnheader">Nume</span>
              {data.days.map((d) => (
                <span
                  role="columnheader"
                  key={d}
                  style={{ textAlign: "center", lineHeight: 1.3, borderRadius: 8, padding: "2px 0", ...(d === today ? { background: "rgba(61,123,255,0.22)", color: "#DCE6FF" } : {}) }}
                >
                  {weekday(d)}
                  <br />
                  <span style={{ letterSpacing: 0, color: "var(--muted-3)" }}>{ddmm(d)}</span>
                </span>
              ))}
              <span role="columnheader" style={{ textAlign: "right" }}>
                Total
              </span>
            </div>
            {rows.length === 0 ? (
              <Empty>{q ? "Niciun membru nu se potrivește căutării." : "Nu există membri în sheet."}</Empty>
            ) : (
              rows.map((r) => (
                <div role="row" key={r.callsign} className="row" style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, padding: 8, fontSize: 14, alignItems: "center" }}>
                  <span role="cell">
                    <Pill callsign={r.callsign} grade={r.grade} />
                  </span>
                  <span role="cell" style={{ display: "flex", flexDirection: "column" }}>
                    <span>{r.name}</span>
                    <span className="sub">{r.grade}</span>
                  </span>
                  {r.cells.map((c, i) => {
                    const v = cellView(c, data.daily_target);
                    return (
                      <span
                        role="cell"
                        key={i}
                        aria-label={`${weekday(data.days[i])}: ${v.label}`}
                        className="num"
                        style={{ textAlign: "center", fontWeight: 600, color: v.color, textDecoration: c.live ? "underline dotted" : undefined, textUnderlineOffset: 4 }}
                      >
                        {v.text}
                      </span>
                    );
                  })}
                  <div role="cell" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span className="num" style={{ fontWeight: 700 }}>
                      {r.total ?? "—"}
                    </span>
                    <Meter
                      width={86}
                      pct={((r.total ?? 0) / weekTarget) * 100}
                      background={(r.total ?? 0) >= weekTarget ? "linear-gradient(90deg,#3B6BFF,#A855F7)" : "linear-gradient(90deg,#FF8A3D,#FF4D3D)"}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
