"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Bone, ConfirmInline, Empty, ErrorState, Loading, Pill, Select, toast, type Option } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { addDays, ddmm, ddmmyyyy, duration, hhmm, todayRo, unixToRo, weekday, weekdayLong } from "@/lib/format";
import type { DayReport, Job, JobResult, Me, Members, MinutesPreview, OpenSessions, SentDay, SessionList, Warns } from "@/lib/types";

const TABS = [
  ["open", "Pontaje deschise"],
  ["day", "Pontaje / zi"],
  ["add", "Adaugă minute"],
  ["del", "Șterge pontaj"],
  ["warn", "Warn"],
] as const;
type Tab = (typeof TABS)[number][0];

// After any write: refetch everything on screen (open sessions, day report, preview, warns, dashboard).
function useRefreshAll() {
  const { mutate } = useSWRConfig();
  return () => mutate(() => true);
}

export default function ActiuniHrPage() {
  const [tab, setTab] = useState<Tab>("open");
  return (
    <div className="fit">
      <div className="glass tabs" role="tablist" aria-label="Acțiuni HR">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className="tab"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="fit-scroll">
        {tab === "open" && <OpenTab />}
        {tab === "day" && <DayTab />}
        {tab === "add" && <AddTab />}
        {tab === "del" && <DeleteTab />}
        {tab === "warn" && <WarnTab />}
      </div>
    </div>
  );
}

function MemberSelect({ value, onChange, all }: { value: string; onChange: (uid: string) => void; all?: boolean }) {
  const { data, error } = useSWR<Members>("/members");
  const members = data?.groups.flatMap((g) => g.members).filter((m) => m.discord_id) ?? [];
  const options: Option[] = [
    ...(all ? [{ value: "", label: "Toți membrii" }] : []),
    ...members.map((m) => ({
      value: m.discord_id!,
      label: m.name,
      hint: m.grade,
      search: `${m.callsign} ${m.name}`,
      lead: <Pill callsign={m.callsign} grade={m.grade} />,
    })),
  ];
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      loading={!data && !error}
      placeholder={error ? "Nu am putut încărca membrii" : "Alege membrul"}
      searchPlaceholder="Caută după callsign, nume sau grad"
    />
  );
}

/* ---------- Pontaje deschise ---------- */

function OpenTab() {
  const { data, error, isLoading, mutate } = useSWR<OpenSessions>("/sessions/open", { refreshInterval: 30_000 });
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState<string | null>(null);
  const cols = "74px minmax(0,1.6fr) 100px 100px 250px";

  async function stop(r: OpenSessions["rows"][number]) {
    setBusy(r.uid + r.clock_in);
    try {
      await post("/sessions/stop", { uid: r.uid, date: r.date, clock_in: r.clock_in });
      toast(`Sesiunea lui ${r.name} a fost oprită (0 minute).`);
      await refresh();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="glass panel">
      <div className="panel-head">
        <h2 className="num panel-title">Sesiuni deschise azi · {weekday(todayRo())} {ddmm(todayRo())}</h2>
        <span className="hint">Oprirea șterge sesiunea (0 minute)</span>
      </div>
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : isLoading || !data ? (
        <Loading />
      ) : data.rows.length === 0 ? (
        <Empty>Nimeni nu este pontat acum.</Empty>
      ) : (
        <div className="scroll-x">
          <div style={{ minWidth: 640 }}>
            <div className="th" style={{ display: "grid", gridTemplateColumns: cols, gap: 10, padding: 8 }}>
              <span>Callsign</span>
              <span>Nume</span>
              <span>Început</span>
              <span>Durată</span>
              <span style={{ textAlign: "right" }}>Acțiune</span>
            </div>
            {data.rows.map((r) => (
              <div key={r.uid + r.clock_in} className="row" style={{ display: "grid", gridTemplateColumns: cols, gap: 10, padding: 8, fontSize: 14, alignItems: "center" }}>
                <span>
                  <Pill callsign={r.callsign} grade={r.grade ?? ""} />
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span className="ellipsis">{r.name}</span>
                  {r.grade && <span className="sub">{r.grade}</span>}
                </span>
                <span className="num" style={{ fontWeight: 600 }}>
                  {hhmm(r.clock_in)}
                </span>
                <span className="num" style={{ fontWeight: 600, color: "var(--blue-soft)" }}>
                  {duration(r.minutes)}
                </span>
                <span style={{ display: "flex", justifyContent: "flex-end" }}>
                  <ConfirmInline label="Oprește" busy={busy === r.uid + r.clock_in} onConfirm={() => stop(r)} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Pontaje / zi + Trimite în Sheet ---------- */

type SheetState =
  | { mode: "confirm"; dates: string[]; sent: SentDay[] }
  | { mode: "running"; dates: string[] }
  | { mode: "result"; job: Job }
  | null;

function DayTab() {
  const today = todayRo();
  const [date, setDate] = useState(today);
  const [uid, setUid] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const { data: me } = useSWR<Me>("/me");
  const { data, error, isLoading, mutate } = useSWR<DayReport>(`/day-report?date=${date}${uid ? `&uid=${uid}` : ""}`);
  const refresh = useRefreshAll();

  const weekStart = addDays(date, -["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sa"].indexOf(weekday(date)));
  // Whole week = Sunday up to yesterday (days still running are never sent in a batch).
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => d < today);

  function go(n: number) {
    setDate(addDays(date, n));
    setSheet(null);
  }

  async function send(dates: string[], force: boolean) {
    try {
      const { job_id } = await post<{ job_id: string }>("/sheet/days", { dates, force });
      setSheet({ mode: "running", dates });
      const job = await pollJob(job_id);
      setSheet({ mode: "result", job });
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_sent") {
        setSheet({ mode: "confirm", dates, sent: (e.body as { sent: SentDay[] }).sent });
      } else {
        setSheet(null);
        toast((e as Error).message, true);
      }
    }
  }

  const total = data?.rows.reduce((a, r) => a + r.total, 0) ?? 0;
  const cols = "minmax(0,1.3fr) minmax(0,1.6fr) 90px";

  return (
    <section className="glass panel">
      <div className="toolbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(-1)} aria-label="Ziua anterioară">
          ◀
        </button>
        <span className="num" style={{ fontSize: 15, fontWeight: 600, minWidth: 170, textAlign: "center" }} aria-live="polite">
          {weekdayLong(date)}, {ddmmyyyy(date)}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(1)} disabled={date >= today} aria-label="Ziua următoare">
          ▶
        </button>
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", flex: "1 1 240px", maxWidth: 320 }}>
          Membru
          <MemberSelect
            all
            value={uid}
            onChange={(v) => {
              setUid(v);
              setSheet(null);
            }}
          />
        </label>
      </div>

      {me?.can_export && !uid && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Monitorizare Activitate{data?.sheet && <> · coloana <strong className="num" style={{ color: "var(--text)" }}>{data.sheet.column}</strong></>}
          </span>
          {!data && !error && <Bone w={150} h={18} />}
          {data?.sheet && (
            <span className="tag" style={data.sheet.sent ? { background: "rgba(61,123,255,0.22)", color: "#CFE0FF" } : { background: "rgba(255,138,61,0.2)", color: "#FFD2B3" }}>
              {data.sheet.sent ? `Trimisă de ${data.sheet.sent.by} · ${unixToRo(data.sheet.sent.at)}` : "Netrimisă"}
            </span>
          )}
          <span style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="btn btn-sm" disabled={sheet?.mode === "running"} onClick={() => send([date], false)}>
              Trimite în Sheet
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={sheet?.mode === "running" || weekDates.length === 0} onClick={() => send(weekDates, false)}>
              Trimite Săptămâna
            </button>
          </span>
        </div>
      )}

      {sheet?.mode === "confirm" && (
        <div role="alertdialog" aria-labelledby="already-title" className="alert-warn">
          <strong id="already-title" className="num" style={{ fontSize: 16, color: "#FFD2B3" }}>
            Deja în Sheet
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3, fontSize: 13.5 }}>
            {sheet.sent.map((s) => (
              <li key={s.date}>
                <span className="num" style={{ fontWeight: 600 }}>
                  {weekday(s.date)} {ddmmyyyy(s.date)}
                </span>
                : trimisă de {s.by} pe {unixToRo(s.at)}
              </li>
            ))}
          </ul>
          <span style={{ fontSize: 12.5, color: "#E6D3C6" }}>
            Apasă <strong>Trimite din nou</strong> doar dacă vrei să rescrii aceste zile (de ex. după o corectură).
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => send(sheet.dates, true)}>
              Trimite din nou
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSheet(null)}>
              Anulează
            </button>
          </span>
        </div>
      )}
      {sheet?.mode === "running" && (
        <div role="status" className="alert-info">
          Se trimite în Sheet ({sheet.dates.length} {sheet.dates.length === 1 ? "zi" : "zile"})…
        </div>
      )}
      {sheet?.mode === "result" && <SheetResult job={sheet.job} onClose={() => setSheet(null)} />}

      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : isLoading || !data ? (
        <Loading />
      ) : data.rows.length === 0 ? (
        <Empty>Niciun pontaj în această zi.</Empty>
      ) : (
        <>
          <div className="scroll-x">
            <div style={{ minWidth: 520 }}>
              <div className="th" style={{ display: "grid", gridTemplateColumns: cols, gap: 10, padding: 8 }}>
                <span>Nume</span>
                <span>Sesiuni</span>
                <span style={{ textAlign: "right" }}>Total min</span>
              </div>
              {data.rows.map((r) => (
                <div key={r.uid} className="row" style={{ display: "grid", gridTemplateColumns: cols, gap: 10, padding: 8, fontSize: 14, alignItems: "center" }}>
                  <span>{r.name}</span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {r.sessions.map((s) => (
                      <span key={s.clock_in} className="num" style={{ fontSize: 12.5, padding: "3px 8px", borderRadius: 7, background: "rgba(61,123,255,0.16)", border: "1px solid rgba(61,123,255,0.35)" }}>
                        {hhmm(s.clock_in)} – {hhmm(s.clock_out)}
                      </span>
                    ))}
                  </span>
                  <span className="num" style={{ textAlign: "right", fontWeight: 700 }}>
                    {r.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <span className="hint">
            {data.rows.length} membri pontați · {total} minute în total
          </span>
        </>
      )}
    </section>
  );
}

async function pollJob(id: string): Promise<Job> {
  // ~40 Google requests for a full week; poll every 2 s, give up after 3 minutes.
  for (let i = 0; i < 90; i++) {
    const res = await fetch(`/api/bot/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
    const job = (await res.json()) as Job;
    if (!res.ok) throw new Error((job as unknown as { message?: string }).message ?? "Nu am putut citi starea trimiterii.");
    if (job.status !== "running") return job;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Trimiterea durează prea mult. Verifică Sheet-ul și logurile.");
}

function SheetResult({ job, onClose }: { job: Job; onClose: () => void }) {
  const notes = (r: JobResult) => [
    r.error && `Eroare: ${r.error}`,
    r.slash.length > 0 && `Au primit „/” (angajați în ziua respectivă): ${r.slash.join(", ")}`,
    r.not_found.length > 0 && `Callsign negăsit în sheet: ${r.not_found.join(", ")}`,
    r.no_callsign.length > 0 && `Fără callsign în nume: ${r.no_callsign.join(", ")}`,
  ];
  return (
    <div role="status" className={job.status === "error" ? "alert-warn" : "alert-info"}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong className="num" style={{ fontSize: 16, color: "#CFE0FF" }}>
          {job.status === "error" ? "Trimiterea a eșuat" : "Trimis în Sheet"}
        </strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Închide
        </button>
      </span>
      {job.error && <span style={{ fontSize: 13.5 }}>{job.error}</span>}
      {job.results.map((r) => (
        <div key={r.date} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13.5 }}>
          <span>
            <strong className="num">
              {weekday(r.date)} {ddmmyyyy(r.date)}
            </strong>{" "}
            (coloana {r.column}): {r.rows_written} pontaje scrise, restul membrilor din sheet au primit 0.
          </span>
          {notes(r)
            .filter(Boolean)
            .map((n) => (
              <span key={n as string} style={{ fontSize: 12.5, color: "#FFD2B3" }}>
                {n}
              </span>
            ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- Adaugă minute ---------- */

function AddTab() {
  const today = todayRo();
  const [uid, setUid] = useState("");
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const refresh = useRefreshAll();
  // Same rule as the bot: 1..1440, comma decimals allowed.
  const n = Number(minutes.trim().replace(",", "."));
  const valid = minutes.trim() !== "" && Number.isFinite(n) && n >= 1 && n <= 1440;
  const { data: preview, error } = useSWR<MinutesPreview>(uid && date ? `/minutes/preview?uid=${uid}&date=${date}&minutes=${valid ? n : 0}` : null);
  const { data: members } = useSWR<Members>("/members");
  const member = members?.groups.flatMap((g) => g.members).find((m) => m.discord_id === uid);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return setFieldError("Alege membrul.");
    if (!valid) return setFieldError("Minutele trebuie să fie un număr între 1 și 1440.");
    if (date > today) return setFieldError("Nu poți adăuga minute în viitor.");
    setFieldError("");
    setBusy(true);
    try {
      await post("/minutes", { uid, date, minutes: n });
      toast(`Am adăugat ${n} minute pentru ${member ? `[${member.callsign}] ${member.name}` : "membru"}.`);
      setMinutes("");
      await refresh();
    } catch (err) {
      setFieldError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2-sm">
      <form className="glass panel" onSubmit={submit} noValidate>
        <h2 className="num panel-title">Adaugă minute</h2>
        <label className="label">
          Membru
          <MemberSelect value={uid} onChange={setUid} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <label className="label">
            Data
            <input className="field" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="label">
            Minute de adăugat
            <input className="field" type="text" inputMode="decimal" placeholder="Ex: 45" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
        </div>
        {fieldError && (
          <span role="alert" style={{ fontSize: 13, color: "#FFC2BC" }}>
            {fieldError}
          </span>
        )}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Se adaugă…" : "Adaugă minute"}
        </button>
      </form>
      <section className="glass panel" aria-live="polite">
        {!uid ? (
          <Empty>Alege un membru ca să vezi minutele din ziua aleasă și din săptămână.</Empty>
        ) : error ? (
          <ErrorState error={error} />
        ) : !preview ? (
          <div role="status" aria-label="Se încarcă" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Bone w="45%" h={16} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
              <Bone h={64} r={12} />
              <Bone h={64} r={12} />
            </div>
            <Bone h={6} />
          </div>
        ) : (
          <>
            {member && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
                [{member.callsign}] {member.name}
                <span className="sub">{member.grade}</span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
              <div style={{ borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 12, color: "var(--muted-2)" }}>
                  {weekday(date)} {ddmm(date)}
                </span>
                <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
                  {preview.before.day} <span style={{ fontSize: 13, color: "var(--muted-2)" }}>min</span>
                </div>
              </div>
              <div style={{ borderRadius: 12, padding: 12, background: "rgba(61,123,255,0.14)", border: "1px solid rgba(61,123,255,0.35)" }}>
                <span style={{ fontSize: 12, color: "#BFD0FF" }}>După adăugare</span>
                <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
                  {preview.after.day} <span style={{ fontSize: 13, color: "var(--muted-2)" }}>min</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
                <span>Săptămâna zilei alese</span>
                <span className="num" style={{ fontWeight: 600, color: "var(--text)" }}>
                  {preview.before.week} → {preview.after.week} / 700
                </span>
              </span>
              <span style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${Math.min(100, preview.after.week / 7)}%`, background: "var(--primary)" }} />
              </span>
            </div>
            <span className="hint">Minutele se salvează ca o sesiune nouă în ziua aleasă, la fel ca în bot.</span>
          </>
        )}
      </section>
    </div>
  );
}

/* ---------- Șterge pontaj ---------- */

function DeleteTab() {
  const [uid, setUid] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = useRefreshAll();
  const { data, error, isLoading, mutate } = useSWR<SessionList>(uid ? `/sessions?uid=${uid}${date ? `&date=${date}` : ""}` : null);

  async function del(s: SessionList["rows"][number]) {
    setBusy(s.date + s.clock_in);
    try {
      await post("/sessions/delete", { uid, date: s.date, clock_in: s.clock_in });
      toast(`Pontajul din ${ddmm(s.date)}, ${hhmm(s.clock_in)} a fost șters.`);
      await refresh();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="glass panel">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label className="label" style={{ flex: "1 1 260px" }}>
          Membru
          <MemberSelect value={uid} onChange={setUid} />
        </label>
        <label className="label" style={{ flex: "0 1 190px" }}>
          Altă dată (opțional)
          <input className="field" type="date" value={date} max={todayRo()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {date && (
          <button type="button" className="btn btn-ghost" onClick={() => setDate("")}>
            Ultimele 7 zile
          </button>
        )}
      </div>
      <span className="th">{date ? `Sesiuni din ${ddmmyyyy(date)}` : "Sesiuni din ultimele 7 zile"}</span>
      {!uid ? (
        <Empty>Alege un membru ca să vezi sesiunile lui.</Empty>
      ) : error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : isLoading || !data ? (
        <Loading rows={3} />
      ) : data.rows.length === 0 ? (
        <Empty>{date ? "Nicio sesiune în această zi." : "Nicio sesiune în ultimele 7 zile."}</Empty>
      ) : (
        <div className="scroll-x">
          <div style={{ minWidth: 520, display: "flex", flexDirection: "column", gap: 4 }}>
            {data.rows.map((s) => (
              <div key={s.date + s.clock_in} className="row" style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 90px 250px", gap: 10, padding: "9px 8px", fontSize: 14, alignItems: "center", background: "rgba(255,255,255,0.03)" }}>
                <span className="num" style={{ fontWeight: 600 }}>
                  {weekday(s.date)} {ddmm(s.date)}
                </span>
                <span className="num">
                  {hhmm(s.clock_in)} – {hhmm(s.clock_out)}
                </span>
                <span className="num" style={{ textAlign: "right", color: "var(--blue-soft)", fontWeight: 600 }}>
                  {s.minutes} min
                </span>
                <span style={{ display: "flex", justifyContent: "flex-end" }}>
                  <ConfirmInline label="Șterge" busy={busy === s.date + s.clock_in} onConfirm={() => del(s)} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Warn ---------- */

function WarnTab() {
  const [uid, setUid] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: me } = useSWR<Me>("/me");
  const { data: w, error, mutate } = useSWR<Warns>(uid ? `/warns/${uid}` : null);
  const refresh = useRefreshAll();
  const isConducere = me?.level === "Conducere";
  const count = w?.count ?? 0;

  async function act(kind: "add" | "reset") {
    setBusy(true);
    try {
      const r = await post<Warns>(`/warns/${uid}/${kind}`, kind === "add" ? { reason: reason.trim() } : { note: note.trim() });
      toast(kind === "add" ? `Warn adăugat (${r.count}/3).` : "Warn-urile au fost resetate.");
      if (kind === "add") setReason("");
      else setNote("");
      await refresh();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2-sm">
      <section className="glass panel">
        <label className="label">
          Membru
          <MemberSelect value={uid} onChange={setUid} />
        </label>
        {!uid ? (
          <Empty>Alege un membru ca să vezi warn-urile lui.</Empty>
        ) : error ? (
          <ErrorState error={error} retry={() => mutate()} />
        ) : !w ? (
          <div role="status" aria-label="Se încarcă" style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Bone w={76} h={52} r={10} />
            <span style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <Bone w={114} h={10} r={5} />
              <Bone w="60%" h={12} />
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span className="num" style={{ fontSize: 52, fontWeight: 700, lineHeight: 1 }}>
              {count}
              <span style={{ fontSize: 24, color: "var(--muted-2)" }}>/{w.max}</span>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ display: "flex", gap: 6 }} aria-hidden="true">
                {Array.from({ length: w.max }, (_, i) => (
                  <span key={i} style={{ width: 34, height: 10, borderRadius: 5, background: i < count ? "var(--danger)" : "rgba(255,255,255,0.12)" }} />
                ))}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {count >= w.max ? "Limită atinsă: Conducerea și HR au fost notificați" : count === 0 ? "Fără warn-uri active" : `${w.max - count} până la limită`}
              </span>
            </div>
          </div>
        )}
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted-2)" }}>
          <li>Warn-ul se postează public în canalul de sancțiuni</li>
          <li>Membrul primește DM cu motivul</li>
          <li>La 3/3 sunt notificați Conducerea și HR</li>
        </ul>
      </section>
      <section className="glass panel">
        <label className="label">
          Motiv
          <textarea className="field" maxLength={400} placeholder="Descrie motivul warn-ului" value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="hint" style={{ alignSelf: "flex-end" }}>
            {reason.length}/400
          </span>
        </label>
        <button type="button" className="btn btn-danger" disabled={busy || !w || count >= (w?.max ?? 3) || !reason.trim()} onClick={() => act("add")}>
          Adaugă warn
        </button>
        <span style={{ height: 1, background: "var(--line)" }} />
        <label className="label">
          Notă reset (opțional)
          <input className="field" maxLength={300} placeholder="Ex: comportament corectat" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="button" className="btn btn-ghost" disabled={busy || !isConducere || !w || count === 0} onClick={() => act("reset")}>
          Reset warn-uri
        </button>
        {!isConducere && <span className="hint">Doar Conducere poate reseta.</span>}
      </section>
    </div>
  );
}
