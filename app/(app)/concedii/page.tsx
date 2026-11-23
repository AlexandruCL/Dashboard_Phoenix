"use client";

import useSWR from "swr";
import { Empty, ErrorState, Loading, Pill } from "@/components/ui";
import { addDays, ddmm, ddmmyyyy, todayRo } from "@/lib/format";
import type { Concedii } from "@/lib/types";

const COLS = "74px minmax(170px,1.5fr) 110px 110px 220px 130px";
const DAYS = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sa"];
const STATUS = {
  ongoing: ["În desfășurare", { background: "#1155CC", color: "#FFFFFF" }],
  ended: ["Încheiat", { background: "rgba(255,255,255,0.08)", color: "#B4BBE0" }],
  scheduled: ["Programat", { background: "rgba(61,123,255,0.18)", color: "#BFD0FF" }],
} as const;

export default function ConcediiPage() {
  const { data, error, isLoading, mutate } = useSWR<Concedii>("/concedii");
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (isLoading || !data) return <Loading rows={6} />;

  const today = todayRo();
  const ongoing = data.rows.filter((r) => r.status === "ongoing").length;
  return (
    <>
      <div className="toolbar">
        <div className="glass box">
          <span className="dot" aria-hidden="true" />
          <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>
            Săptămâna curentă · {ddmm(data.week_start)} – {ddmmyyyy(addDays(data.week_start, 6))}
          </span>
        </div>
        <span className="glass box">
          {data.rows.length} concedii · {ongoing} în desfășurare
        </span>
      </div>
      {data.rows.length === 0 ? (
        <Empty>Niciun concediu nu se suprapune cu săptămâna curentă.</Empty>
      ) : (
        <div className="glass scroll-x" style={{ borderRadius: 18 }}>
          <div style={{ minWidth: 760, padding: "8px 10px 12px" }}>
            <div className="th" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 8px", borderBottom: "1px solid var(--line)" }}>
              <span>Callsign</span>
              <span>Nume</span>
              <span>Data început</span>
              <span>Data sfârșit</span>
              <span>{DAYS.join(" · ")}</span>
              <span style={{ textAlign: "right" }}>Status</span>
            </div>
            {data.rows.map((r) => {
              const [label, tag] = STATUS[r.status];
              const n = r.days.filter(Boolean).length;
              return (
                <div key={`${r.callsign}-${r.start}`} className="row" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 8px", fontSize: 14, alignItems: "center" }}>
                  <span>
                    <Pill callsign={r.callsign} grade={r.grade ?? ""} />
                  </span>
                  <span>{r.name}</span>
                  <span className="num" style={{ fontWeight: 600 }}>
                    {ddmmyyyy(r.start)}
                  </span>
                  <span className="num" style={{ fontWeight: 600 }}>
                    {ddmmyyyy(r.end)}
                  </span>
                  <span role="img" aria-label={`În concediu ${n} ${n === 1 ? "zi" : "zile"} din săptămâna curentă`} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 4 }}>
                    {r.days.map((on, i) => (
                      <span
                        key={i}
                        style={{
                          height: 22,
                          borderRadius: 6,
                          background: on ? "linear-gradient(180deg,#3D7BFF,#1155CC)" : "rgba(255,255,255,0.06)",
                          outline: addDays(data.week_start, i) === today ? "1px solid rgba(255,255,255,0.55)" : undefined,
                          outlineOffset: 1,
                        }}
                      />
                    ))}
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <span className="tag" style={tag}>
                      {label}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
