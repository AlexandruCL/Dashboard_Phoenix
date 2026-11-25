# Dashboard Phoenix: design

Web app for the LSPD Phoenix **HR** and **Birou conducere**. It shows grades, members, the current week's pontaje and concedii, and it moves every action of the Discord HR panel to the web. The Discord bot (BotPontajeProject) stays the only process that talks to Discord, the SQLite databases and Google Sheets. The web app is a client of the bot's API.

Visual reference (canvas): https://claude.ai/artifact/XHWQ8Q72EpcFr8zkbD67NX

## 1. Scope

**In scope**
- Discord login, access only for the configured HR and Conducere roles.
- Pages: Dashboard, Pontaje, Concedii, Evidență membri, Acțiuni HR, Loguri (Conducere only).
- Every HR panel action: Pontaje deschise (stop), Pontaje / zi (+ Trimite în Sheet / Trimite Săptămâna), Adaugă minute, Șterge pontaj, Warn (add / reset).
- The same logs as today (`logs.txt` and the Discord log channels), plus a database copy that the Loguri page reads.

**Out of scope**
- Access for regular PD members, and the clock-in panel (it stays on Discord).
- SAS (not in the bot anymore).
- Archive of previous weeks (a function inside the pontaje sheet clears it).
- Warn history (only the current count, as in `punishments.db`).
- Desktop or mobile apps (the web app is responsive and works on phones).

## 2. Architecture

```
Browser ──HTTPS──► Next.js on Vercel
                      │  server-side only
                      ▼  http://<hostmybot-IP>:<port>/api/web/*  (HostMyBot port allocation)
                      │  body encrypted + authenticated with AES-256-GCM (shared key, timestamp, actor inside)
                                                  Bot (discord.py + aiohttp API)
                                                    ├─ Discord (one client, built-in rate limiter, no privileged intents)
                                                    ├─ SQLite: clock_times.db, punishments.db (+ new tables)
                                                    └─ Google Sheets (gspread, BackOffHTTPClient, 5 min cache)
```

- **The browser never calls the bot or Discord directly.** Next.js Route Handlers and Server Actions act as the backend-for-frontend.
- **Next.js holds the session** (an encrypted, httpOnly cookie). It puts the signed-in user's Discord ID (`actor_id`) inside the encrypted envelope (§2.1), so the bot can trust it.
- **Long jobs:** Trimite Săptămâna makes about 40 Google requests. The bot runs it as a background job (`202 {job_id}`), and the app polls `GET /api/web/jobs/{id}`. This also keeps every Vercel function call short.

### Deployment (chosen: Vercel + bot on HostMyBot)

- **Next.js on Vercel (Hobby, free):**
  - HTTPS on `dashboard-phoenix.vercel.app` (a custom domain can be added later);
  - a deploy on every push to `main`;
  - environment variables set in the Vercel dashboard.

  The Hobby plan is for personal, non-commercial use.
- **The bot stays on HostMyBot** (shared panel, 2 GB RAM, 1–2 port allocations, no SSH, no HTTPS or reverse proxy).
  - The web API listens on the allocated port: `WEB_API_HOST=0.0.0.0`, `WEB_API_PORT=<allocation>`.
  - The server can only serve plain HTTP, so the traffic is protected at the application level (§2.1) instead of with TLS.
- **The old public `/api/pontaje`** on `0.0.0.0:3080` is moved behind the same envelope, or switched off if nothing outside uses it.

### 2.1 Encrypted envelope (instead of HTTPS)

- **Every request** from Next.js to the bot is `POST /api/web/rpc` with an opaque body:
  - `base64(nonce[12] ‖ AES-256-GCM(key, nonce, plaintext, aad = "dp1"))`;
  - plaintext = JSON `{v: 1, ts, req_id, actor_id, method, path, body}`.
- **Every response** uses the same envelope, built from a fresh random nonce, with plaintext `{req_id, status, body}`.
- **Key:** `WEB_API_KEY`, 32 random bytes, stored on both sides and never sent over the network.
- **The bot rejects:**
  - envelopes that fail decryption or authentication (wrong key, tampered data);
  - a `ts` older or newer than 60 s;
  - a `req_id` already seen in the last 120 s (replay cache).
- **Error handling:** errors that happen before decryption get a plain `400` with no details; real errors are only returned inside the encrypted response.
- **What this protects:**
  - observers on the network can't read members, minutes, warn reasons or the actor's identity;
  - they can't forge, change or replay a request.

  They can still see that traffic exists, its size and its timing.
- **What it doesn't replace:**
  - per-IP rate limits on the port;
  - key rotation: two accepted keys at once (`WEB_API_KEY`, `WEB_API_KEY_OLD`), so the key can change without downtime.
- **Libraries:** `cryptography.hazmat.primitives.ciphers.aead.AESGCM` in the bot, `node:crypto` (`aes-256-gcm`) in Next.js. No other dependencies.

**Alternative if standard TLS is wanted later:** move the bot to a free Oracle AMD micro VM (1 GB), where Tailscale Funnel (or Caddy and a domain) gives a real HTTPS address. The API stays the same; only the transport changes.

## 3. Data sources

| Data | Source | Read by | Notes |
|---|---|---|---|
| Members, grades, corp, status, hire date, Discord ID | PD spreadsheet `13gYEV…` › **Evidenta membrii** (B callsign, C name, E grade, H corp, I status, J data angajare, T Discord ID) | bot, cached 5 min | Members = rows with a name and status `ACTIV` or `CONCEDIU`. Same grouping and order as the sheet. |
| Concedii | PD spreadsheet › **Concedii** (D callsign, E start, F end) | bot, cached 5 min | Reuses `parse_sheet_date` and `concedii_on` from the bot. Rows without a callsign are ignored. |
| Pontaje (week) | Pontaje Phoenix `1ihxJ…` › **Monitorizare Activitate** (B callsign, C name, D rank, E TOTAL/ZI, F–L Lu…Du, M TOTAL, N–R averages 1–5 weeks ago) | bot, cached 5 min | Values: minutes, `CO` (leave), `/` (hired that day, under target), empty (not sent yet). |
| Today / days not sent yet | `clock_times.db` | bot, live | The sheet only gets finished days (via Trimite în Sheet), so unsent days are filled from the DB and marked "live". |
| Open sessions, day report, sessions to delete | `clock_times.db` | bot, live | Same queries as the HR panel. |
| Warn count | `punishments.db` | bot, live | Unchanged. |
| Sent days | `sheet_exports` table | bot | From the `pontaje-sheet-export` branch (PR #5). |
| Logs | new `logs` table + `logs.txt` + Discord channels | bot | See §7. |

**Week:** Sunday–Saturday (as in the bot). In the sheet, Sunday is column **L** (the last one), so the app shows columns in the order Du (L), Lu (F), Ma (G), Mi (H), Jo (I), Vi (J), Sa (K).

**Cache:** the bot caches every sheet read for 5 minutes. The **Sincronizează** button (`POST /api/web/sync`) clears the cache and reloads. Writes made by the app (minutes, deletes, sheet sends) clear the affected cache entries right away.

## 4. Metric definitions

| Metric | Definition |
|---|---|
| Birou conducere | Members whose corp is `CONDUCERE` (Chestor-general, Comisar-șef, Comisar, Sub-comisar). Currently 7. |
| Efectiv total | All members (`ACTIV` + `CONCEDIU`). Also shows how many are on leave. |
| Grade counts (strip) | Members per grade outside conducere: Inspector, Agent-șef-principal, Agent-principal, Agent, Cadet. |
| Active (one member, one day) | At least 1 minute that day. |
| Activi · ziua precedentă (%) | Members outside conducere who were active yesterday ÷ members outside conducere who were not on leave yesterday. Hover shows the count ("35 din 44 polițiști activi"). |
| Activi · săptămâna curentă (%) | Average of the daily % over the elapsed days of the week (Sunday … yesterday). Hover shows the average count per day. |
| Cele mai active grade (%) | Per grade: active member-days ÷ member-days not on leave, over the elapsed days. Hover shows the grade name and %. |
| Top 10 pontaje | Highest **M TOTAL** this week, **including conducere**. |
| Medie pontaje (Evidență membri) | Sheet column **E (TOTAL / ZI)**: total ÷ elapsed days, leave days excluded. If the cell says "Se calculează…" or `/`, show "—". |

## 5. Access control

- **Login:** Discord OAuth2 with the `identify` and `guilds.members.read` scopes. After login, Next.js calls `GET /users/@me/guilds/{GUILD_ID}/member` once with the user's token to read their roles. No bot intents are involved.
- **Role configuration** (bot `.env`, the user sets them):
  - `WEB_HR_ROLE_IDS`: comma-separated role IDs → access level **HR**.
  - `WEB_CONDUCERE_ROLE_IDS`: comma-separated role IDs → access level **Conducere** (includes everything HR has). If someone has roles from both lists, Conducere wins.
  - Anyone else sees the "Nu ai acces la acest panou" screen, and a `web-denied` entry is logged.
- **Re-check every 5 minutes, not on every action:**
  - The bot keeps a role cache per user: `{level, checked_at}`.
  - Every API call uses the cache for its `actor_id`. Only if `checked_at` is older than 5 minutes does the bot do one `guild.fetch_member(id)` (a REST call, no members intent needed) and update it.
  - If the member left (404) or lost the roles, the call returns 403, and Next.js signs the user out with the denied screen.
  - All Discord calls go through the bot's discord.py client, which respects rate limits. Failed calls are never retried in a loop, so Discord/Cloudflare won't ban the IP for invalid requests.
- **Per-feature rules, same as the bot:**
  - **Loguri:** Conducere only.
  - **Warn reset:** Conducere only (same check as `WarnResetModal`, `CONDUCERE_ROLE_ID`).
  - **Trimite în Sheet / Trimite Săptămâna:** only the users in `SHEET_EXPORT_USER_IDS`, and only in the "Toți" view.
  - All other HR actions: HR or Conducere.

## 6. Pages and behaviour

Layout: a glass window, smaller than the screen, over the Phoenix logo. Sidebar menu grouped as General / HR / Birou conducere, filtered by access level, with the user card (avatar, `[CS] Nume`, role badge, Deconectare). On phones the menu stacks above the content. The dashboard and open sessions refresh every **30 s** (SWR `refreshInterval`). Other pages refresh on focus and after writes.

| Page | Content |
|---|---|
| Dashboard | Cards: Birou conducere (7 + grade breakdown), Activi ieri (% ring, hover = count), Activi săptămâna (% ring, hover = average count), Efectiv total. Grade strip. Top 10 pontaje (CS, name, grade, total min, bar vs. 700). "Cele mai active grade" bar chart (hover = grade + %). |
| Pontaje | Current week only: Callsign, Nume, Du…Sa, Total. `CO` cells in blue, under-target cells in orange, zero in red, live (unsent) days marked. Search. Note: "Se resetează la final de săptămână". |
| Concedii | Leaves that overlap the current week: Callsign, Nume, start, end, a Du–Sa bar of the leave days, status (În desfășurare / Încheiat / Programat). |
| Evidență membri | Groups per grade (collapsible) as in the sheet: Callsign, Nume, Grad, Data intrare, Medie pontaje, CONCEDIU tag. Search. |
| Acțiuni HR | Tabs: **Pontaje deschise** (today's open sessions; Oprește → Sigur? → deletes the session, 0 min), **Pontaje / zi** (day arrows, the next day is disabled from today on, member filter, sessions per member; Trimite în Sheet / Trimite Săptămâna with the "Deja în Sheet → Trimite din nou" check and the per-day result), **Adaugă minute** (member, date, minutes; preview of the day and week totals), **Șterge pontaj** (sessions from the last 7 days or another date → confirm), **Warn** (count /3, add with reason, reset with an optional note). |
| Loguri | Conducere only. Columns: time, action, executor, target, details, type (Modificare / Informare), status (Succes / Eșec), source (Discord / Web). Filters: Toate, Modificări, Informări, Eșecuri. Search. Cursor pagination. |
| Login / denied | Discord login button, a list of what each role can open, and the access-denied message. |

The member pickers use the members list from the sheet (callsign + name → Discord ID from column T), so the bot doesn't need to list the Discord server.

## 7. Logging

- **One code path:**
  - `log_command(interaction, …)` becomes a wrapper around a new `log_action(actor, action, *, target, extra, changed, success, source)`.
  - Discord views call it with `source="Discord"`; API handlers call it with `source="Web"`.
- **Outputs (all kept):**
  - The `logs.txt` line, in the current format plus ` | source=Web` for web actions.
  - The Discord embed in `LOGS_CHANNEL_ID` and `EXTRA_LOG_CHANNELS`, with a new **Sursă** field.
  - **New:** a row in the `logs` table: `id, ts_utc, action, actor_id, actor_name, target_id, target_name, extra, changed, success, source`.
- **Action names stay the same:** `ongoing-stop-button`, `day-report-all`, `day-report-user`, `day-report-sheet`, `adaugaminute-button`, `stergepontaj`, `warn-add-ui`, `warn-reset-ui`, and so on. New ones: `web-login`, `web-denied`, `web-sync`.
- **One-time import:** a script parses the existing `logs.txt` into the table (source = Discord), so the Loguri page has history from day one.
- **Colours in the app** (no green anywhere): Modificare = blue `#3D7BFF`, Informare = slate blue `#8B93C9`, Eșec = red `#FF4D3D`.

## 8. Bot API (new endpoints)

On the wire, every call is a single `POST /api/web/rpc` carrying the encrypted envelope (§2.1). Inside, `method` and `path` select one of the logical endpoints below. The actor comes from the envelope, and the roles in the "Level" column are checked via the role cache (§5).

| Method & path | Level | Purpose |
|---|---|---|
| `GET /me` | HR | Access level, name, callsign, whether the user can export to the sheet. |
| `GET /dashboard` | HR | All dashboard numbers (§4). |
| `GET /members` | HR | Members grouped by grade, with Medie pontaje. |
| `GET /pontaje` | HR | Current week grid (sheet + live days). |
| `GET /concedii` | HR | Leaves that overlap the current week. |
| `GET /sessions/open` | HR | Today's open sessions. |
| `POST /sessions/stop` `{uid, date, clock_in}` | HR | Same as `OngoingStopView._confirm`. |
| `GET /day-report?date=&uid=` | HR | Same data as `build_day_report`. |
| `POST /minutes` `{uid, date, minutes}` | HR | Same as `AddMinutesModal.on_submit`. |
| `GET /sessions?uid=&date=` | HR | Last 7 days, or one date (`recent_sessions`). |
| `POST /sessions/delete` `{uid, date, clock_in}` | HR | Same as `RemovePontajView._confirm`. |
| `GET /warns/{uid}` · `POST /warns/{uid}/add {reason}` · `POST /warns/{uid}/reset {note}` | HR / reset: Conducere | Same as `WarnReasonModal` and `WarnResetModal` (public post, DM, ping at 3/3). |
| `POST /sheet/days` `{dates[], force}` | `SHEET_EXPORT_USER_IDS` | Same as `_ask_then_push` / `_push_to_sheet`. Returns `already_sent` if `force` is false, otherwise `202 {job_id}`. |
| `GET /jobs/{id}` | HR | Status and per-day result of a sheet send. |
| `GET /logs?type=&q=&cursor=` | Conducere | Paged rows from the `logs` table. |
| `POST /sync` | HR | Clears the sheet cache. |

**Shared logic:** each HR action is extracted from its `discord.ui` view into a plain async service function (`stop_session`, `add_minutes`, `delete_session`, `add_warn`, `reset_warns`, `push_days_to_sheet`). The Discord views and the API both call the same function, so the behaviour and logs stay identical.

## 9. Visual design

- **Look:** glass panels (`rgba(255,255,255,.055)` + 16 px backdrop blur + 1 px white/13% border) over a dark navy scene (`#070920`) with blue, red and violet glows. The Phoenix logo sits behind the window.
- **Fonts:** Chakra Petch for headings and numbers, Inter for body text.
- **Grade colours** (dark blues, no green):

| Grade | Colour |
|---|---|
| Conducere | `#0A2472` |
| Inspector | `#0F35A3` |
| Agent-șef-principal | `#1155CC` |
| Agent-principal | `#2C67D6` |
| Agent | `#3F7BE0` |
| Cadet | `#5A8FE6` |

- **Accents:**
  - Primary button: gradient `#1155CC → #3D7BFF`.
  - Destructive actions: red `#B3192A → #FF4D3D`.
  - Warnings and "Deja în Sheet": orange `#FF8A3D`.
  - Leave tag: blue `#2B3BFF`.
- **Accessibility:** real buttons and labels, visible focus rings, tooltips also open on keyboard focus, text contrast ≥ 4.5:1.

## 10. Configuration (new)

Bot `.env`:
- `WEB_API_HOST=0.0.0.0`, `WEB_API_PORT=<HostMyBot allocation>`
- `WEB_API_KEY` (32 bytes, base64), optional `WEB_API_KEY_OLD`
- `WEB_HR_ROLE_IDS`
- `WEB_CONDUCERE_ROLE_IDS`
- `ROLE_CACHE_TTL_SECONDS=300`
- `SHEET_CACHE_TTL_SECONDS=300`
- existing: `SHEET_EXPORT_USER_IDS`, `PONTAJE_SHEET_ID`, `PD_SPREADSHEET_ID`, `GOOGLE_SHEETS_CREDENTIALS_FILE`

Next.js `.env`:
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_GUILD_ID`
- `SESSION_SECRET`
- `BOT_API_URL=http://<hostmybot-IP>:<port>`
- `WEB_API_KEY` (same value as the bot)
- `APP_URL=https://<domain>`
