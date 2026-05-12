# Ari-Ani WhatsApp Bot Framework

A professional WhatsApp bot framework built with TypeScript.

## Features

- Fully Modular Design
- Object Oriented Architecture
- Written in TypeScript (ESM, Node 20+)
- Self-Restoring Auth (file-based, stored under `sessions/<SESSION>/`)
- Built with Baileys v7

## Quick Start

```bash
npm install
npm run build
cp .env.example .env
# Edit .env with your configuration
npm run start
```

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|---------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `SESSION` | Session name for auth |
| `PREFIX` | Command prefix (default: `!`) |
| `MODS` | Comma-separated moderator numbers |
| `PORT` | HTTP server port |

## License

AGPL-3.0