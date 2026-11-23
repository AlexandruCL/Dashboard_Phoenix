import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const sealed = req.cookies.get(sessionOptions.cookieName)?.value;
  const session = sealed
    ? await unsealData<SessionData>(sealed, { password: sessionOptions.password, ttl: sessionOptions.ttl }).catch(
        () => ({}) as SessionData,
      )
    : ({} as SessionData);

  if (!session.discordId) return NextResponse.redirect(new URL("/login", req.url));
  if (req.nextUrl.pathname.startsWith("/loguri") && session.level !== "Conducere") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes check the session themselves, login is public.
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|logo.png).*)"],
};
