# Ari-Ani

Production-ready WhatsApp bot runtime built on `@whiskeysockets/baileys` `6.17.16`, with Mongo-backed auth/settings, modular handlers, and a reduced command surface focused on reliability.

## Highlights

- Node.js `20+`
- CommonJS runtime with modular architecture
- Mongo-backed session persistence and bot state
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
PORT=1234
OWNER_JIDS=923265825610
NAME=Kaori Miyazono
PACKNAME=Kaori Miyazono
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
http://localhost:1234/qr?token=<QR_TOKEN>
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

## Docs

- [Folder Structure](docs/FOLDER_STRUCTURE.md)
- [Migration Notes](docs/MIGRATION.md)
- [Refactor Summary](docs/REFRACTOR_SUMMARY.md)
