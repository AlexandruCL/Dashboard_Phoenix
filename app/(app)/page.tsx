"use client";

import { useState } from "react";
import useSWR from "swr";
import { Bone, Empty, ErrorState, Loading, Meter, Pill, Ring, Tooltip } from "@/components/ui";
import { gradeColor, pctText } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");
const titleCase = (g: string) => g.toLowerCase().replace(/(^|-)\p{L}/gu, (m) => m.toUpperCase());

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR<Dashboard>("/dashboard", { refreshInterval: 30_000 });
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (isLoading || !data) return <DashboardSkeleton />;

  const { conducere, efectiv, grades, active_yesterday: ay, active_week: aw } = data;
  return (
    <div className="fit">
      <section aria-label="Evidență grade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid-cards">
          <div className="glass stat" style={{ background: "linear-gradient(135deg, rgba(10,36,114,0.55), rgba(17,85,204,0.18))" }}>
            <span className="stat-label">Birou conducere</span>
            <span className="num stat-big" style={{ color: "var(--blue-soft)" }}>
              {conducere.count}
            </span>
            <span className="stat-note">{conducere.by_grade.map((g) => `${g.count} ${titleCase(g.grade)}`).join(" · ")}</span>
          </div>
          <div className="glass stat">
            <span className="stat-label">Activi · ziua precedentă</span>
            <Tooltip
              label={`${pctText(ay.pct)}% activi ieri: ${ay.active} polițiști`}
              tip={`${ay.active} polițiști activi ieri`}
            >
              <Ring pct={ay.pct} />
              <span className="num stat-big">
                {pctText(ay.pct)}
                <span style={{ fontSize: 22, color: "var(--muted-2)" }}>%</span>
              </span>
            </Tooltip>
            <span className="stat-note">fără conducere</span>
          </div>
          <div className="glass stat">
            <span className="stat-label">Activi · săptămâna curentă</span>
            <Tooltip
              label={`${pctText(aw.pct)}% activi săptămâna aceasta: în medie ${fmt1(aw.avg_active)} polițiști pe zi`}
              tip={`În medie ${fmt1(aw.avg_active)} polițiști activi pe zi`}
            >
              <Ring pct={aw.pct} />
              <span className="num stat-big">
                {pctText(aw.pct)}
                <span style={{ fontSize: 22, color: "var(--muted-2)" }}>%</span>
              </span>
            </Tooltip>
            <span className="stat-note">{aw.days ? `${aw.days} ${aw.days === 1 ? "zi încheiată" : "zile încheiate"} · fără conducere` : "Nicio zi încheiată încă"}</span>
          </div>
          <div className="glass stat">
            <span className="stat-label">Efectiv total</span>
            <span className="num stat-big">{efectiv.total}</span>
            <span className="stat-note">{efectiv.on_leave} în concediu</span>
          </div>
        </div>
        <div className="grid-strip">
          {grades.map((g) => (
            <div key={g.grade} className="glass" style={{ borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span aria-hidden="true" style={{ width: 6, alignSelf: "stretch", borderRadius: 4, background: gradeColor(g.grade).bg }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span className="num" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
                  {g.count}
                </span>
                <span style={{ fontSize: 11, letterSpacing: "0.04em", color: "#C9CFF0" }}>{g.grade}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid-2 fill">
        <Top5 rows={data.top5} />
        <GradeChart rows={data.grade_activity} />
      </div>
    </div>
  );
}

function Top5({ rows }: { rows: Dashboard["top5"] }) {
  return (
    <section className="glass panel" aria-labelledby="top5-title">
      <div className="panel-head">
        <h2 id="top5-title" className="num panel-title">
          Top 10 pontaje
        </h2>
        <span className="hint">săptămâna curentă, minute</span>
      </div>
      {rows.length === 0 ? (
        <Empty>Nimeni nu s-a pontat încă săptămâna aceasta.</Empty>
      ) : (
        <div className="list-scroll">
          <div className="th top-row" style={{ padding: "0 8px 6px" }}>
            <span>Callsign</span>
            <span>Nume</span>
            <span>Grad</span>
            <span style={{ textAlign: "right" }}>Total min</span>
          </div>
          {rows.map((t) => (
            <div key={t.callsign} className="row top-row" style={{ padding: "6px 8px", fontSize: 14 }}>
              <Pill callsign={t.callsign} grade={t.grade} />
              <span className="ellipsis">{t.name}</span>
              <span className="ellipsis" style={{ color: "var(--muted)", fontSize: 12.5 }}>
                {t.grade}
              </span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span className="num" style={{ fontWeight: 700 }}>
                  {t.total}
                </span>
                <Meter pct={t.total / 7} background="linear-gradient(90deg, #3B6BFF, #A855F7, #FF4D3D)" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GradeChart({ rows }: { rows: Dashboard["grade_activity"] }) {
  const [hover, setHover] = useState<string | null>(null);
  const bars = [...rows].sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  return (
    <section className="glass panel" aria-labelledby="chart-title">
      <div className="panel-head">
        <h2 id="chart-title" className="num panel-title">
          Cele mai active grade
        </h2>
        <span className="hint">% activitate · săpt. curentă</span>
      </div>
      {bars.every((b) => b.pct === null) ? (
        <Empty>Nicio zi încheiată încă săptămâna aceasta.</Empty>
      ) : (
        <>
          <div className="chart-area" style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 14, padding: "34px 6px 0", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
            {bars.map((c) => {
              const h = Math.max(c.pct ?? 0, 2); // % of the chart height; 2% keeps a 0 visible
              return (
                <div key={c.grade} style={{ position: "relative", flex: "1 1 0", display: "flex", justifyContent: "center", alignItems: "flex-end", height: "100%" }}>
                  {hover === c.grade && (
                    <div role="tooltip" className="tip" style={{ left: "50%", transform: "translateX(-50%)", bottom: `calc(${h}% + 10px)` }}>
                      <strong style={{ fontWeight: 600 }}>{c.grade}</strong> ·{" "}
                      <span className="num" style={{ fontWeight: 700, color: "var(--blue-soft)" }}>
                        {pctText(c.pct)}%
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="bar-btn"
                    aria-label={`${c.grade}: ${pctText(c.pct)}% activitate`}
                    onMouseEnter={() => setHover(c.grade)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(c.grade)}
                    onBlur={() => setHover(null)}
                    style={{
                      width: "100%",
                      maxWidth: 46,
                      height: `${h}%`,
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "10px 10px 4px 4px",
                      padding: 0,
                      cursor: "pointer",
                      background: `linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0) 45%), ${gradeColor(c.grade).bg}`,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, padding: "0 6px" }}>
            {bars.map((c) => (
              <span key={c.grade} className="ellipsis" style={{ flex: "1 1 0", textAlign: "center", fontSize: 11, color: "var(--muted-2)" }}>
                {c.grade}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="grid-cards">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass stat">
            <Bone w="55%" h={13} />
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {(i === 1 || i === 2) && <Bone w={52} h={52} r={26} />}
              <Bone w={84} h={40} r={8} />
            </span>
            <Bone w="70%" h={11} />
          </div>
        ))}
      </div>
      <div className="grid-strip">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="glass" style={{ borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Bone w={34} h={26} />
            <Bone w="60%" h={10} />
          </div>
        ))}
      </div>
      <div className="grid-2">
        <section className="glass panel">
          <Bone w="40%" h={18} />
          <Loading rows={10} />
        </section>
        <section className="glass panel">
          <Bone w="50%" h={18} />
          <div style={{ height: 236, display: "flex", alignItems: "flex-end", gap: 14, padding: "34px 6px 0" }}>
            {[88, 72, 64, 50, 38, 24].map((p) => (
              <span key={p} style={{ flex: "1 1 0", display: "flex", justifyContent: "center" }}>
                <Bone w="min(46px, 100%)" h={p * 1.9} r={10} />
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
