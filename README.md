# Dashboard Phoenix

Web app for the LSPD Phoenix HR and Birou conducere: grades, members, the current week's pontaje and concedii, the HR panel actions and the logs.

- Design: [docs/design.md](docs/design.md)
- Implementation plan: [docs/implementation-plan.md](docs/implementation-plan.md)

Backend: the API of [BotPontajeProject](https://github.com/AlexandruCL/BotPontajeProject).

## Run locally

```sh
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev                     # http://localhost:3000
pnpm test                    # envelope + format unit tests
```

The app needs the bot's web API (branch `web-api` of BotPontajeProject) running with the same `WEB_API_KEY`.

## Environment variables

| Name | What it is |
|---|---|
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord OAuth2 app. Redirect URL: `<APP_URL>/api/auth/callback`. Scopes: `identify guilds.members.read`. |
| `DISCORD_GUILD_ID` | The LSPD server ID. Used to read the user's server nickname at login. |
| `SESSION_SECRET` | At least 32 random characters. Seals the session cookie. Changing it signs everyone out. |
| `BOT_API_URL` | `http://<HostMyBot IP>:<port>`. Plain HTTP; every request is encrypted with `WEB_API_KEY`. |
| `WEB_API_KEY` | 32 bytes, base64. Same value as in the bot's `.env`. Generate: `python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"` |
| `APP_URL` | Public URL of the app, no trailing slash. Also used for the CSRF check on writes. |

## Access roles

The bot decides who gets in, so the role lists live in the bot's `.env`, not here:

- `WEB_HR_ROLE_IDS`: comma-separated role IDs with HR access.
- `WEB_CONDUCERE_ROLE_IDS`: comma-separated role IDs with Conducere access (HR + Loguri + warn reset). Conducere wins if someone has both.
- `SHEET_EXPORT_USER_IDS`: user IDs that see Trimite în Sheet / Trimite Săptămâna.

Restart the bot after changing them. A removed role stops working within 5 minutes (`ROLE_CACHE_TTL_SECONDS`); the user is signed out on their next request.
