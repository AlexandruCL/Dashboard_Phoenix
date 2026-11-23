"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body: unknown,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  bot_offline: "Botul nu răspunde. Încearcă din nou în câteva secunde.",
  discord_unavailable: "Discord nu răspunde, nu am putut verifica rolurile.",
  member_not_found: "Membrul nu mai este pe server.",
  session_not_found: "Sesiunea nu mai există (a fost deja oprită sau ștearsă).",
  warn_limit: "Membrul are deja 3/3 warn-uri.",
  csrf: "Cerere respinsă. Reîncarcă pagina.",
};

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  // Session gone or roles revoked: the server already cleared the cookie.
  if (res.status === 401 || (res.status === 403 && body?.error === "forbidden")) {
    window.location.href = res.status === 403 ? "/login?denied=1" : "/login";
    throw new ApiError(res.status, body?.error ?? "auth", "Sesiune expirată", body);
  }
  if (!res.ok) {
    const code = body?.error ?? "error";
    throw new ApiError(res.status, code, body?.message ?? MESSAGES[code] ?? `Eroare (${res.status})`, body);
  }
  return body as T;
}

export const fetcher = <T>(path: string) => fetch(`/api/bot${path}`, { cache: "no-store" }).then(handle<T>);

export const post = <T>(path: string, body: unknown = {}) =>
  fetch(`/api/bot${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(handle<T>);
