import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export function GET() {
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    redirect_uri: `${process.env.APP_URL}/api/auth/callback`,
    response_type: "code",
    scope: "identify guilds.members.read",
    state,
    prompt: "none",
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set("dp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return res;
}
