"use client";

import { useState } from "react";
import useSWR from "swr";
import { Empty, ErrorState, Loading, Pill, SearchBox } from "@/components/ui";
import { ddmmyyyy, gradeColor, searchMatch } from "@/lib/format";
import type { Members } from "@/lib/types";

const COLS = "80px minmax(0,1.6fr) minmax(0,1.3fr) 120px 140px";

export default function MembriPage() {
  const [q, setQ] = useState("");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const { data, error, isLoading, mutate } = useSWR<Members>("/members");

  const all = data?.groups.flatMap((g) => g.members) ?? [];
  const groups = (data?.groups ?? [])
    .map((g) => ({ ...g, shown: g.members.filter((m) => searchMatch(q, m.callsign, m.name)) }))
    .filter((g) => g.shown.length);

  return (
    <>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} label="Caută membru" />
        {data && (
          <span className="glass box">
            {all.length} membri · {all.filter((m) => m.on_leave).length} în concediu
          </span>
        )}
      </div>
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : isLoading || !data ? (
        <Loading rows={8} framed />
      ) : groups.length === 0 ? (
        <Empty>{q ? "Niciun membru nu se potrivește căutării." : "Nu există membri activi în sheet."}</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((g) => {
            const open = !closed[g.grade] || !!q;
            const color = gradeColor(g.grade).bg;
            return (
              <section key={g.grade} className="glass" style={{ borderRadius: 18, overflow: "hidden" }}>
                <button
                  type="button"
                  className="group-toggle"
                  aria-expanded={open}
                  onClick={() => setClosed({ ...closed, [g.grade]: open })}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "13px 18px",
                    background: `${color}33`,
                    border: 0,
                    borderLeft: `4px solid ${color}`,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span className="num" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.06em" }}>
                    {g.grade}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    {g.members.length} membri
                    <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
                {/* Always mounted so height can animate; inert keeps the closed rows out of Tab order. */}
                <div className="collapse" data-open={open} inert={!open}>
                  <div>
                  <div className="scroll-x">
                    <div style={{ minWidth: 640, padding: "6px 10px 10px" }}>
                      <div className="th" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: 8 }}>
                        <span>Callsign</span>
                        <span>Nume</span>
                        <span>Grad</span>
                        <span>Data intrare</span>
                        <span style={{ textAlign: "right" }}>Medie pontaje</span>
                      </div>
                      {g.shown.map((m) => (
                        <div key={m.callsign} className="row" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "9px 8px", fontSize: 14, alignItems: "center" }}>
                          <span>
                            <Pill callsign={m.callsign} grade={m.grade} />
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {m.name}
                            {m.on_leave && <span className="tag tag-leave">CONCEDIU</span>}
                          </span>
                          <span style={{ color: "var(--muted)" }}>{m.grade}</span>
                          <span style={{ color: "var(--muted)" }}>{m.hired ? ddmmyyyy(m.hired) : "—"}</span>
                          <span className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                            {m.avg ?? "—"}
                            {m.avg && <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 12, color: "var(--muted-2)" }}> min/zi</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
