"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import useSWR, { SWRConfig, useSWRConfig } from "swr";
import { fetcher, post } from "@/lib/api";
import { addDays, ddmm, todayRo, unixToRo, weekday } from "@/lib/format";
import type { Level } from "@/lib/types";
import { Bone, toast, Toaster } from "./ui";

const ICONS: Record<string, string> = {
  "/": "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  "/pontaje": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2",
  "/concedii": "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4",
  "/membri": "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  "/actiuni-hr": "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6zM9 12l2 2 4-4",
  "/loguri": "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
};

const PAGES: Record<string, [crumb: string, title: string]> = {
  "/": ["Prezentare generală", "Dashboard"],
  "/pontaje": ["Săptămâna curentă · Du – Sa", "Pontaje"],
  "/concedii": ["Săptămâna curentă", "Concedii"],
  "/membri": ["Membrii LSPD", "Evidență membri"],
  "/actiuni-hr": ["Panou HR", "Acțiuni HR"],
  "/loguri": ["Birou conducere", "Loguri"],
};

const GROUPS: { title: string; conducere?: boolean; items: string[] }[] = [
  { title: "General", items: ["/", "/pontaje", "/concedii"] },
  { title: "HR", items: ["/membri", "/actiuni-hr"] },
  { title: "Birou conducere", conducere: true, items: ["/loguri"] },
];

const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const DAYS = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];

function dateChip() {
  const today = todayRo();
  const dow = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sa"].indexOf(weekday(today));
  const start = addDays(today, -dow);
  return `${DAYS[dow]}, ${+today.slice(8)} ${MONTHS[+today.slice(5, 7) - 1]} ${today.slice(0, 4)} · Săpt. ${ddmm(start).slice(0, 2)}–${ddmm(addDays(start, 6))}`;
}

function SyncButton() {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost icon-btn"
      disabled={busy}
      aria-label={busy ? "Se sincronizează" : "Sincronizează datele din Sheet"}
      title="Sincronizează"
      onClick={async () => {
        setBusy(true);
        try {
          await post("/sync");
          await mutate(() => true);
          toast("Datele au fost reîncărcate din Sheet.");
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <svg className={busy ? "spin" : undefined} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4" />
      </svg>
    </button>
  );
}

// Last time the bot pulled fresh data from the Sheet: by = who pressed Sincronizează, null = automatic refresh.
function LastSync() {
  const { data, error } = useSWR<{ at: number | null; by: string | null }>("/sync", { refreshInterval: 30_000 });
  if (error) return null; // older bot without GET /sync
  if (!data) return <Bone w="80%" h={11} />;
  if (!data.at) return <span className="sub">Nicio sincronizare încă</span>;
  const text = `${unixToRo(data.at)} · ${data.by ?? "automat"}`;
  return (
    <span className="sub" style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      Ultima sincronizare
      <span className="ellipsis" title={text} style={{ color: "var(--text-2)" }}>
        {text}
      </span>
    </span>
  );
}

export function Shell({ me, children }: { me: { name: string; level: Level }; children: ReactNode }) {
  const pathname = usePathname();
  const current = Object.keys(PAGES).find((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p))) ?? "/";
  const [crumb, title] = PAGES[current];
  const initials = me.name
    .replace(/^\[[^\]]*\]\s*/, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, shouldRetryOnError: false }}>
      <div className="scene">
        <Image src="/logo.png" alt="" aria-hidden="true" width={820} height={820} className="scene-logo" priority />
        <div className="glass window">
          <nav aria-label="Meniu" className="sidebar">
            <div className="brand">
              <Image src="/logo.png" alt="Logo Phoenix" width={46} height={46} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="num brand-name">LSPD</span>
                <span className="brand-sub">PHOENIX · LOS SANTOS</span>
              </div>
            </div>
            <div className="nav">
              {GROUPS.filter((g) => !g.conducere || me.level === "Conducere").map((g) => (
                <div key={g.title} className="nav-group">
                  <span className="nav-title">{g.title}</span>
                  {g.items.map((href) => (
                    <Link key={href} href={href} className="nav-item" aria-current={href === current ? "page" : undefined}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={ICONS[href]} />
                      </svg>
                      <span>{PAGES[href][1]}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <div className="glass usercard">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="num avatar" aria-hidden="true">
                  {initials}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {me.name}
                  </span>
                  <span>
                    <span
                      className="tag"
                      style={
                        me.level === "Conducere"
                          ? { background: "#0A2472", color: "#fff", border: "1px solid rgba(157,184,255,0.5)" }
                          : { background: "#1155CC", color: "#fff" }
                      }
                    >
                      {me.level}
                    </span>
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SyncButton />
                <LastSync />
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="nav-item logout">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
                </svg>
                <span>Deconectare</span>
              </button>
            </form>
          </nav>
          <main className="content">
            <header className="page-head">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="crumb">{crumb}</span>
                <h1 className="num page-title">{title}</h1>
              </div>
              <span className="glass chip" suppressHydrationWarning>
                {dateChip()}
              </span>
            </header>
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </SWRConfig>
  );
}
