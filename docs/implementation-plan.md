# Dashboard Phoenix: implementation plan

Companion to [design.md](design.md). Work is split across two repos:
- **BotPontajeProject:** the bot plus the extended API (Python).
- **Dashboard_Phoenix:** the Next.js app (TypeScript).

Each phase ends with something that runs and can be checked.

## Phase 0: Clean-up and security (before any new code)

1. **Rotate the leaked Google service account key.** `credentials.json` is committed in BotPontajeProject.
   - In Google Cloud, delete the key and create a new one.
   - Remove the file from git history (`git filter-repo --path credentials.json --invert-paths`), then force-push.
   - Also delete `backups_db/`, `*.db`, `bot.log`, `logs.txt` and `__pycache__/` from the repo, and add them to `.gitignore`.
2. **Merge PR #5** (`pontaje-sheet-export`), then delete these branches: `pontaje-sheet-export`, `pd-hr-panels-refactor`, `report-without-members-intent`.
3. **Create the private `Dashboard_Phoenix` repo** (with a README) and attach it to the session, so these docs and the code can be pushed.
4. **Create a Discord OAuth2 application.**
   - Redirect URL: `https://<domain>/api/auth/callback`
   - Scopes: `identify`, `guilds.members.read`
5. **Collect the role IDs** for `WEB_HR_ROLE_IDS` and `WEB_CONDUCERE_ROLE_IDS`.

**Done when:** the key is rotated, history is clean, `main` contains the sheet export, and the new repo exists.

## Phase 1: Hosting (Vercel + Tailscale Funnel)

1. **Tailscale on the bot's machine:**
   - install it, log in with a free account, and enable HTTPS certificates and Funnel in the admin console;
   - run `tailscale funnel --bg 3080`;
   - note the URL, `https://<machine>.<tailnet>.ts.net`.
2. **Bot API host:** set `WEB_API_HOST=127.0.0.1` (Funnel forwards to it), and stop exposing `/api/pontaje` on `0.0.0.0`.
3. **Vercel:**
   - import `Dashboard_Phoenix` (framework preset: Next.js);
   - set the environment variables (design §10, `BOT_API_URL` = the Funnel URL);
   - set the Discord OAuth redirect to `https://<project>.vercel.app/api/auth/callback`.
4. **Uptime check:** a free monitor (for example UptimeRobot) on `https://<machine>.<tailnet>.ts.net/health`, so you know when the bot's machine is offline.
5. **Nightly SQLite backup** on the bot's machine: `sqlite3 .backup`, keeping 14 days.

**Done when:**
- the Vercel URL serves a placeholder page;
- `curl https://<machine>.<tailnet>.ts.net/health` answers from anywhere;
- the bot restarts on reboot (systemd, or Task Scheduler on Windows).

*Alternative (design §2): one Oracle A1 VM with Caddy and a domain. Use it only if the bot's current machine can't stay online.*

## Phase 2: Bot API (BotPontajeProject, branch `web-api`)

1. **Extract the service layer** into a new `services.py`. Move each HR action out of its `discord.ui` view into a plain async function that takes an `actor`:
   - `stop_session`
   - `add_minutes`
   - `delete_session`
   - `add_warn` (public post, DM, ping at 3/3)
   - `reset_warns`
   - `push_days_to_sheet`

   The existing views call these functions, so Discord behaviour doesn't change.
2. **Logging:**
   - Add `log_action(actor, action, …, source)`; `log_command` becomes a wrapper around it.
   - Add a `logs` table (`database.py`, index on `ts_utc` and `action`).
   - Add the **Sursă** field to the Discord embed and ` | source=` to the `logs.txt` line.
   - Write a script, `scripts/import_logs.py`, that imports the existing `logs.txt` into the table once.
3. **Role cache (5 min):**
   - Add `access.py` with an in-memory dictionary `{discord_id: (level, checked_at)}`.
   - On an API call, if the entry is missing or older than `ROLE_CACHE_TTL_SECONDS`, call `guild.fetch_member()` once and map its roles to the HR or Conducere level (config lists). If the member is gone or has no allowed role, return 403.
   - Failed calls are never retried in a loop.
4. **Sheet readers with a 5-minute cache** (`sheets.py`):
   - `read_members()`: Evidenta membrii, columns B, C, E, H, I, J, T.
   - `read_concedii()`: reuses `concedii_on` and `parse_sheet_date`.
   - `read_pontaje_week()`: Monitorizare Activitate, columns B–R.
   - `invalidate()`.

   All of them use gspread with `BackOffHTTPClient`, run in `asyncio.to_thread`.
5. **Metric calculations** (`metrics.py`), exactly as in design §4:
   - activity %;
   - grade %;
   - Top 5 from column M;
   - Medie pontaje from column E;
   - unsent days filled from `clock_times.db`.

   Add unit tests with fixed sheet fixtures (pytest).
6. **`/api/web/*` endpoints** (design §8):
   - Every route checks the bearer token. It also checks the HMAC signature and timestamp.
   - `X-Actor-Id` goes through the role cache.
   - Returns JSON errors (`401`, `403`, `409 already_sent`, `422`).
   - Add the background job runner for sheet sends.
7. **Bind host from `WEB_API_HOST`** (127.0.0.1, published through Funnel), and add request size limits and per-IP rate limits.

**Done when:**
- pytest passes;
- `curl` with the token returns real data for every GET;
- each POST behaves exactly like the matching Discord button and writes the same logs (`logs.txt` line + embed + table row).

## Phase 3: Next.js foundation (Dashboard_Phoenix)

1. **Scaffold:** Next.js App Router + TypeScript + ESLint, `output: "standalone"`, pnpm.
2. **Design system:**
   - global CSS tokens from design §9 (colours, glass, fonts via `next/font`: Chakra Petch, Inter);
   - components: `GlassPanel`, `Pill`, `Tag`, `Button` (primary, ghost, danger), `Field`, `Select`, `Tabs`, `Tooltip` (opens on hover and focus), `Ring`, `BarChart`, `ConfirmInline`.
3. **Auth:**
   - Discord OAuth: `/api/auth/login` → Discord → `/api/auth/callback`.
   - Read the roles once (`/users/@me/guilds/{id}/member`), then create an encrypted, httpOnly cookie (`iron-session`) holding `{discordId, name, level, roleCheckedAt}`.
   - `/api/auth/logout`.
   - Log `web-login` / `web-denied` through the bot.
4. **Middleware:** if there's no session, send the user to `/login`; Loguri requires Conducere. If the bot returns 403, destroy the session and show the denied screen.
5. **Bot client** (`lib/bot.ts`), server-only: adds the token, the HMAC header and `X-Actor-Id`, and maps errors to typed results.
6. **Layout:** scene background with the logo, the glass window, the sidebar (groups filtered by level, user card, Deconectare), the Sincronizează button and the responsive stack on phones.

**Done when:** an HR account logs in and sees the empty layout, a non-HR account sees the denied screen, and a Conducere account sees Loguri in the menu.

## Phase 4: Read-only pages

1. **Dashboard:** cards, % rings with hover counts, grade strip, Top 5, grade bar chart (hover = name + %). Refreshes every 30 s with SWR.
2. **Pontaje:** the week grid in the order Du…Sa, live days marked, `CO`, `/` and colour rules, search.
3. **Concedii:** leaves overlapping this week, the Du–Sa bar, status tag.
4. **Evidență membri:** grade groups, Medie pontaje, CONCEDIU tag, search.

**Done when:**
- every number matches the sheets for the current week;
- the hover tooltips work with mouse and keyboard;
- the layout works at 390 px wide.

## Phase 5: Acțiuni HR

1. **Pontaje deschise:** list refreshed every 30 s, Oprește → Sigur? → `POST /sessions/stop`.
2. **Pontaje / zi:** day navigation (the next day is disabled from today on), member filter, sessions.
   - Trimite în Sheet / Trimite Săptămâna only for export users and only in the "Toți" view.
   - The flow: already sent? → "Deja în Sheet" with who and when → Trimite din nou. Otherwise a job, polled until done, then the per-day result (column, rows written, `/`, callsign not found, no callsign in the name).
3. **Adaugă minute:** member picker (from the sheet), date, minutes, before/after preview. Validation the same as the bot.
4. **Șterge pontaj:** last 7 days, or another date → confirm → delete.
5. **Warn:** count /3, add with reason (max 400 characters), reset with a note (Conducere only, greyed out for HR).

After every write, invalidate the SWR keys and show a short toast.

**Done when:** each action works from the web and from Discord on the same data, with identical log entries, and a user without HR rights gets a 403 even when calling the API directly.

## Phase 6: Loguri

- Table from `GET /logs` with cursor pagination ("Încarcă mai multe").
- Filters: Toate, Modificări, Informări, Eșecuri. Search with debounce.
- Colours from design §7. Conducere only.

**Done when:** an action done on Discord and one done on the web both show up, with the right source, within 30 s.

## Phase 7: Release

1. **Deploy:**
   - Vercel deploys every push to `main`; pull requests get preview URLs.
   - The bot is deployed as today (pull + restart the service).
2. **Security pass:**
   - secrets only in environment variables;
   - the bot API only answers signed requests (token + HMAC + timestamp);
   - the Funnel URL serves only `/api/web/*` and `/health`;
   - cookies are `Secure`, `SameSite=Lax`;
   - writes go through POST only, with a CSRF check.
3. **Acceptance test with real accounts:**
   - one HR account and one Conducere account;
   - one account without roles;
   - remove a role and confirm access stops within 5 minutes.
4. **Write a short README:** setup, environment variables, and how to change the access roles.

## Order and rough effort

| Phase | Depends on | Effort |
|---|---|---|
| 0 Clean-up | none | ½ day |
| 1 Hosting | 0 | ½ day |
| 2 Bot API | 0 | 3–4 days |
| 3 Next.js foundation | 0 (can run in parallel with 2) | 2 days |
| 4 Read-only pages | 2, 3 | 2 days |
| 5 Acțiuni HR | 2, 3 | 3 days |
| 6 Loguri | 2, 3 | 1 day |
| 7 Release | all | 1 day |
