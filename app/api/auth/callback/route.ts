import { NextResponse, type NextRequest } from "next/server";
import { callBot } from "@/lib/bot";
import { getSession, type Level } from "@/lib/session";

type Me = { id: string; name: string; callsign: string | null; level: Level; can_export: boolean };

const DISCORD = "https://discord.com/api/v10";

function toLogin(params: Record<string, string>) {
  const res = NextResponse.redirect(`${process.env.APP_URL}/login?${new URLSearchParams(params)}`);
  res.cookies.delete({ name: "dp_oauth_state", path: "/api/auth" });
  return res;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("dp_oauth_state")?.value) {
    return toLogin({ error: "state" });
  }

  const tokenRes = await fetch(`${DISCORD}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID ?? "",
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.APP_URL}/api/auth/callback`,
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) return toLogin({ error: "discord" });
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const auth = { authorization: `Bearer ${access_token}` };

  const userRes = await fetch(`${DISCORD}/users/@me`, { headers: auth, cache: "no-store" });
  if (!userRes.ok) return toLogin({ error: "discord" });
  const user = (await userRes.json()) as { id: string; username: string; global_name: string | null };

  // Server nickname ("[CS] Nume") for the denied screen and the log; a 404 means the user isn't on the server.
  const memberRes = await fetch(`${DISCORD}/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`, {
    headers: auth,
    cache: "no-store",
  });
  const member = memberRes.ok ? ((await memberRes.json()) as { nick: string | null }) : null;
  const displayName = member?.nick || user.global_name || user.username;

  // The bot owns the role lists: it checks the roles, logs web-login / web-denied and returns the level.
  const r = await callBot<Me>(user.id, "POST", "/login", { name: displayName });
  if (r.status === 403) return toLogin({ denied: displayName });
  if (r.status !== 200) return toLogin({ error: "bot" });

  const me = r.body as Me;
  const session = await getSession();
  session.discordId = me.id;
  session.name = me.name;
  session.callsign = me.callsign;
  session.level = me.level;
  session.canExport = me.can_export;
  session.roleCheckedAt = Date.now();
  await session.save();

  const res = NextResponse.redirect(`${process.env.APP_URL}/`);
  res.cookies.delete({ name: "dp_oauth_state", path: "/api/auth" });
  return res;
}
