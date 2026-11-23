import { NextResponse, type NextRequest } from "next/server";
import { callBot } from "@/lib/bot";
import { sameOrigin } from "@/lib/origin";
import { getSession, type Level } from "@/lib/session";

type Ctx = { params: Promise<{ path: string[] }> };

// Backend-for-frontend: the browser calls /api/bot/<logical path>, we add the actor and forward it encrypted.
async function forward(req: NextRequest, ctx: Ctx, method: "GET" | "POST") {
  const session = await getSession();
  if (!session.discordId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (method === "POST" && !sameOrigin(req)) return NextResponse.json({ error: "csrf" }, { status: 403 });

  const segments = (await ctx.params).path;
  // /login is only for the OAuth callback (it writes the web-login log line).
  if (segments[0] === "login") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const path = "/" + segments.map(encodeURIComponent).join("/") + req.nextUrl.search;

  let body: unknown = null;
  if (method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  const r = await callBot<unknown>(session.discordId, method, path, body);

  // The bot's role cache says this user lost access: end the session so the UI shows the denied screen.
  if (r.status === 403 && (r.body as { error?: string })?.error === "forbidden") {
    session.destroy();
  } else if (path === "/me" && r.status === 200) {
    const me = r.body as { level: Level; can_export: boolean; name: string; callsign: string | null };
    if (me.level !== session.level || me.can_export !== session.canExport) {
      Object.assign(session, { level: me.level, canExport: me.can_export, name: me.name, callsign: me.callsign });
      session.roleCheckedAt = Date.now();
      await session.save();
    }
  }
  return NextResponse.json(r.body, { status: r.status });
}

export const GET = (req: NextRequest, ctx: Ctx) => forward(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Ctx) => forward(req, ctx, "POST");
