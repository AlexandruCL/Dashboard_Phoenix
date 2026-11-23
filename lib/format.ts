// Grade colours from design §9 (the CORP colours of the Evidenta sheet).
const GRADE_COLORS: [string[], string, string][] = [
  [["CHESTOR-GENERAL", "COMISAR-SEF", "COMISAR", "SUB-COMISAR", "CONDUCERE", "BIROU CONDUCERE"], "#0A2472", "#FFFFFF"],
  [["INSPECTOR"], "#0F35A3", "#FFFFFF"],
  [["AGENT-SEF-PRINCIPAL"], "#1155CC", "#FFFFFF"],
  [["AGENT-PRINCIPAL"], "#2C67D6", "#FFFFFF"],
  [["AGENT"], "#3F7BE0", "#04102E"],
  [["CADET"], "#5A8FE6", "#04102E"],
];

const norm = (g: string) =>
  g
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, "-");

export function gradeColor(grade: string): { bg: string; fg: string } {
  const n = norm(grade);
  const hit = GRADE_COLORS.find(([names]) => names.includes(n));
  return hit ? { bg: hit[1], fg: hit[2] } : { bg: "#2C67D6", fg: "#FFFFFF" };
}

const WEEKDAYS = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sa"];
const WEEKDAYS_LONG = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];

// "YYYY-MM-DD" is a calendar date from the bot (Bucharest); read it as UTC so the weekday never shifts.
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
export const ddmmyyyy = (iso: string) => `${ddmm(iso)}.${iso.slice(0, 4)}`;
export const weekday = (iso: string) => WEEKDAYS[d(iso).getUTCDay()];
export const weekdayLong = (iso: string) => WEEKDAYS_LONG[d(iso).getUTCDay()];

export function addDays(iso: string, n: number): string {
  const x = d(iso);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "acum");

export function duration(min: number): string {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

export const pctText = (n: number | null) => (n === null ? "—" : String(Math.round(n)));

export function unixToRo(sec: number): string {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(sec * 1000));
}

export const todayRo = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());

export const searchMatch = (q: string, ...fields: (string | null | undefined)[]) => {
  const s = q.trim().toLowerCase();
  return !s || fields.some((f) => f?.toLowerCase().includes(s));
};
