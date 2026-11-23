"use client";

import { useEffect, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Empty, ErrorState, Loading, SearchBox } from "@/components/ui";
import type { LogRow, Logs } from "@/lib/types";

const FILTERS = [
  ["all", "Toate"],
  ["changes", "Modificări"],
  ["info", "Informări"],
  ["failures", "Eșecuri"],
] as const;
type Filter = (typeof FILTERS)[number][0];

const COLS = "118px 170px minmax(140px,1fr) minmax(140px,1fr) minmax(190px,1.4fr) 190px";

// Colours from design §7: Modificare blue, Informare slate, Eșec red.
const edge = (r: LogRow) => (!r.success ? "#FF4D3D" : r.changed ? "#3D7BFF" : "#8B93C9");

const tsFmt = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function when(ts: string) {
  const d = new Date(ts.endsWith("Z") || ts.includes("+") ? ts : `${ts}Z`);
  const parts = Object.fromEntries(tsFmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { date: `${parts.day}.${parts.month}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
}

export default function LoguriPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(id);
  }, [input]);

  const key = (i: number, prev: Logs | null) => {
    if (prev && !prev.next_cursor) return null;
    const params = new URLSearchParams({ type: filter });
    if (q) params.set("q", q);
    if (prev?.next_cursor) params.set("cursor", prev.next_cursor);
    return `/logs?${params}`;
  };
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<Logs>(key, { refreshInterval: 30_000 });
  const rows = data?.flatMap((p) => p.rows) ?? [];
  const more = !!data?.[data.length - 1]?.next_cursor;

  return (
    <>
      <div className="toolbar">
        <SearchBox value={input} onChange={setInput} label="Caută în loguri" />
        <div className="glass tabs" role="group" aria-label="Filtru loguri">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className="tab" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <span className="hint">Aceleași loguri se trimit în continuare și pe canalele de loguri de pe Discord.</span>

      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : isLoading || !data ? (
        <Loading rows={8} />
      ) : rows.length === 0 ? (
        <Empty>{q || filter !== "all" ? "Niciun log nu se potrivește filtrului." : "Nu există loguri încă."}</Empty>
      ) : (
        <div className="glass scroll-x" style={{ borderRadius: 18 }}>
          <div style={{ minWidth: 900, padding: "8px 10px 12px" }}>
            <div className="th" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 8px 10px 12px" }}>
              <span>Timp</span>
              <span>Acțiune</span>
              <span>Executor</span>
              <span>Target</span>
              <span>Detalii</span>
              <span>Tip · Status · Sursă</span>
            </div>
            {rows.map((r) => {
              const t = when(r.ts_utc);
              return (
                <div
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: COLS,
                    gap: 10,
                    padding: "10px 8px 10px 12px",
                    marginTop: 6,
                    borderRadius: 10,
                    fontSize: 13.5,
                    alignItems: "center",
                    background: "rgba(255,255,255,0.03)",
                    borderLeft: `3px solid ${edge(r)}`,
                  }}
                >
                  <span className="num" style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.3 }}>
                    {t.date}
                    <br />
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{t.time}</span>
                  </span>
                  <span>
                    <span style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12, padding: "3px 7px", borderRadius: 6, background: "rgba(255,255,255,0.08)", wordBreak: "break-all" }}>
                      {r.action}
                    </span>
                  </span>
                  <span>{r.actor_name ?? r.actor_id ?? "—"}</span>
                  <span style={{ color: "var(--muted)" }}>{r.target_name ?? r.target_id ?? "—"}</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)", wordBreak: "break-word" }}>{r.extra || "—"}</span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    <span className="tag" style={r.changed ? { background: "rgba(61,123,255,0.22)", color: "#CFE0FF" } : { background: "rgba(139,147,201,0.2)", color: "#D5D9F2" }}>
                      {r.changed ? "Modificare" : "Informare"}
                    </span>
                    <span className="tag" style={r.success ? { background: "rgba(255,255,255,0.08)", color: "#DDE3FF" } : { background: "rgba(255,77,61,0.22)", color: "#FFC2BC" }}>
                      {r.success ? "Succes" : "Eșec"}
                    </span>
                    <span className="tag" style={{ background: "rgba(255,255,255,0.08)", color: "var(--muted)" }}>
                      {r.source}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {more && (
        <button type="button" className="btn btn-ghost" style={{ alignSelf: "center" }} disabled={isValidating} onClick={() => setSize(size + 1)}>
          {isValidating ? "Se încarcă…" : "Încarcă mai multe"}
        </button>
      )}
    </>
  );
}
