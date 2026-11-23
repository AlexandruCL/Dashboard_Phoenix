import "server-only";
import { randomUUID } from "node:crypto";
import { open, seal } from "./envelope.ts";

export type BotError = { error: string; message?: string };
export type BotResult<T> = { status: number; body: T | BotError };

function key(): Buffer {
  const k = Buffer.from(process.env.WEB_API_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("WEB_API_KEY must be 32 bytes, base64");
  return k;
}

// Every call is one POST /api/web/rpc with the encrypted envelope; status and body come back inside it.
export async function callBot<T>(
  actorId: string,
  method: "GET" | "POST",
  path: string,
  body: unknown = null,
): Promise<BotResult<T>> {
  const k = key();
  const reqId = randomUUID();
  const envelope = seal(k, {
    v: 1,
    ts: Math.floor(Date.now() / 1000),
    req_id: reqId,
    actor_id: actorId,
    method,
    path,
    body,
  });

  let res: Response;
  try {
    res = await fetch(`${process.env.BOT_API_URL}/api/web/rpc`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: envelope,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { status: 502, body: { error: "bot_offline", message: "Botul nu răspunde." } };
  }
  // A bare 400 means the bot refused the envelope (clock skew, key mismatch); it never says more.
  if (!res.ok) return { status: 502, body: { error: "bot_rejected", message: `Botul a refuzat cererea (${res.status}).` } };

  try {
    const out = open<{ req_id: string; status: number; body: T | BotError }>(k, await res.text());
    if (out.req_id !== reqId) throw new Error("req_id mismatch");
    return { status: out.status, body: out.body };
  } catch {
    return { status: 502, body: { error: "bad_envelope", message: "Răspuns invalid de la bot." } };
  }
}
