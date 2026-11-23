import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/origin";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  (await getSession()).destroy();
  return NextResponse.redirect(`${process.env.APP_URL}/login`, 303);
}
