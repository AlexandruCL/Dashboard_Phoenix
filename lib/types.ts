// Response shapes of the bot's /api/web/* endpoints (contract agreed with the bot, design §8).
export type Level = "HR" | "Conducere";

export type Me = { id: string; name: string; callsign: string | null; level: Level; can_export: boolean };

export type Dashboard = {
  conducere: { count: number; by_grade: { grade: string; count: number }[] };
  efectiv: { total: number; on_leave: number };
  grades: { grade: string; count: number }[];
  active_yesterday: { pct: number | null; active: number; eligible: number };
  active_week: { pct: number | null; avg_active: number; avg_eligible: number; days: number };
  top5: { callsign: string; name: string; grade: string; total: number }[];
  grade_activity: { grade: string; pct: number | null }[];
};

export type Member = {
  discord_id: string | null;
  callsign: string;
  name: string;
  grade: string;
  hired: string | null;
  avg: string | null;
  on_leave: boolean;
};
export type Members = { groups: { grade: string; members: Member[] }[] };

export type Cell = { value: number | "CO" | "/" | null; live: boolean };
export type Pontaje = {
  week_start: string;
  days: string[];
  daily_target: number;
  rows: { callsign: string; name: string; grade: string; cells: Cell[]; total: number | null }[];
};

export type Concedii = {
  week_start: string;
  rows: {
    callsign: string;
    name: string;
    grade?: string;
    start: string;
    end: string;
    status: "ongoing" | "ended" | "scheduled";
    days: boolean[];
  }[];
};

export type OpenSessions = {
  rows: { uid: string; name: string; callsign: string | null; grade: string | null; date: string; clock_in: string; minutes: number }[];
};

export type Session = { clock_in: string; clock_out: string | null; minutes: number };
export type DayReport = {
  date: string;
  today: string;
  rows: { uid: string; name: string; callsign: string | null; total: number; sessions: Session[] }[];
  sheet?: { column: string; sent: SentDay | null };
};

export type MinutesPreview = { before: { day: number; week: number }; after: { day: number; week: number } };
export type SessionList = { rows: (Session & { date: string })[] };
export type Warns = { count: number; max: number };

export type SentDay = { date: string; by: string; by_id: string; at: number };
export type JobResult = {
  date: string;
  column: string;
  rows_written: number;
  slash: string[];
  not_found: string[];
  no_callsign: string[];
  error?: string;
};
export type Job = { status: "running" | "done" | "error"; results: JobResult[]; error?: string };

export type LogRow = {
  id: number;
  ts_utc: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  target_id: string | null;
  target_name: string | null;
  extra: string | null;
  changed: boolean;
  success: boolean;
  source: "Discord" | "Web";
};
export type Logs = { rows: LogRow[]; next_cursor: string | null };
