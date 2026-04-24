# Ari-Ani

Production-ready WhatsApp bot runtime built on `@whiskeysockets/baileys` `6.17.16`, with Mongo-backed auth/settings, modular handlers, and a reduced command surface focused on reliability.

## Highlights

- Node.js `20+`
- CommonJS runtime with modular architecture
- Mongo-backed session persistence and bot state
- Mongo-backed reminders and VU account persistence
- Active-instance lease to prevent the same WhatsApp session from running in two places at once
- QR authentication in terminal and browser
- Unified command contract: `module.exports = { meta, execute }`
- Welcome/anti-link group settings
- Internal XP/level service

## Current Structure

```text
src/
  index.js
  config/
  core/
    whatsapp/
  handlers/
  commands/
    general/
    group/
    mods/
    utils/
  models/
  services/
    external/
  utils/
tests/
docs/
```

## Retained Command Set

The old bot was intentionally pruned to a reliable subset. Current retained commands:

- `general`: `help`, `hi`, `mods`, `profile`, `rank`, `ariani`
- `group`: `add`, `delete`, `demote`, `disable`, `enable`, `group`, `groupinfo`, `invite`, `ping`, `promote`, `remove`, `revoke`, `setcustom`
- `mods`: `ban`, `broadcast`, `eval`, `join`, `leave`, `unban`
- `utils`: `google`, `shorturl`, `sticker`, `toimg`, `weather`

Removed areas were legacy plugin systems, NSFW commands, fragile scraper-heavy features, and commands that could not be made production-safe within the new architecture.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example env:

```bash
copy .env.example .env
```

3. Fill in `.env`:

```env
MONGO_URI=...
SESSION_ID=kaori-main
QR_TOKEN=kaori-qr-secret
PREFIX=/
PORT=3000
OWNER_JIDS=923265825610
NAME=Kaori Miyazono
PACKNAME=Kaori Miyazono
APP_ENCRYPTION_KEY=<32-byte-hex-key>
APP_BASE_URL=https://your-service.up.railway.app
```

4. Start the bot:

```bash
npm start
```

## Testing

Run the automated test suite:

```bash
npm test
```

Manual QR/auth testing:

1. Start the bot with `npm start`
2. Scan the QR shown in terminal, or open:

```text
http://localhost:3000/qr?token=<QR_TOKEN>
```

3. Verify health:

```text
http://localhost:1234/health
```

4. Test commands such as `/help`, `/hi`, `/profile`, `/groupinfo`

## Runtime Notes

- `OWNER_JIDS` is the preferred owner config.
- `MODS` is still accepted as a deprecated fallback.
- If the session is already paired, QR will not be generated again.
- If you want a fresh QR, change `SESSION_ID` or remove the corresponding session document from Mongo.
- To keep the same WhatsApp session, VU login, reminders, and bot state across local, Railway, and Koyeb:
  - keep the same `MONGO_URI`
  - keep the same `SESSION_ID`
  - keep the same `APP_ENCRYPTION_KEY`
- The bot uses a Mongo-backed active-instance lease. Only one running process may own a given `SESSION_ID` at a time. Stop the old host before starting the same session on a new host.
- During Railway redeploys, the new container now waits for the old deployment to release the same `SESSION_ID` instead of failing immediately.

## Deploying

### Railway or Koyeb

These are good fits because the bot needs:

- a long-running Node.js process
- a persistent WebSocket connection to WhatsApp
- a background scheduler for reminders and VU alerts

Use:

- start command: `npm start`
- a single replica only
- the same `MONGO_URI`, `SESSION_ID`, and `APP_ENCRYPTION_KEY` when moving hosts
- `APP_BASE_URL` set to your public app URL so the QR link in logs is usable
- optional best-effort free-tier keepalive:
  - `KEEPALIVE_ENABLED=true`
  - `KEEPALIVE_INTERVAL_MS=240000`
  - `KEEPALIVE_URL=https://your-service.up.railway.app/health`

This repo also includes a `Dockerfile` for container-based deploys.

### Railway Free workaround

If you stay on Railway Free, there is no guaranteed 24/7 mode. The best in-app workaround is to enable the built-in keepalive loop so the bot sends outbound traffic before Railway marks the service inactive.

Recommended env values for that:

```env
KEEPALIVE_ENABLED=true
KEEPALIVE_INTERVAL_MS=240000
KEEPALIVE_URL=https://your-service.up.railway.app/health
KEEPALIVE_PING_MONGO=true
KEEPALIVE_PING_SELF=true
```

This can reduce sleeping while your free usage still has credit, but it does not bypass free-plan limits, exhausted credit, or Railway restart policy limits.

### Vercel

Vercel is not a good host for this bot.

The bot depends on a continuously running process, live WhatsApp socket, and timer-based scheduler. Vercel is designed around serverless/request-driven execution, so reminders and socket continuity will not be reliable there. Use Railway, Koyeb, Render, a VPS, or another long-running container host instead.

## Docs

- [Folder Structure](docs/FOLDER_STRUCTURE.md)
- [Migration Notes](docs/MIGRATION.md)
- [Refactor Summary](docs/REFRACTOR_SUMMARY.md)
