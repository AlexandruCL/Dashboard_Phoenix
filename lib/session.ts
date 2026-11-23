import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export type Level = "HR" | "Conducere";

export type SessionData = {
  discordId?: string;
  name?: string;
  callsign?: string | null;
  level?: Level;
  canExport?: boolean;
  roleCheckedAt?: number;
};

export const sessionOptions: SessionOptions = {
  cookieName: "dp_session",
  password: process.env.SESSION_SECRET as string,
  ttl: 60 * 60 * 24 * 7,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
