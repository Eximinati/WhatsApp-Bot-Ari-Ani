# Refactor Summary

## What Changed

- Rebuilt the bot into `config/core/handlers/services/commands/utils`
- Added Mongo-backed session, user, group, and XP persistence
- Added a centralized command dispatcher with permission and cooldown checks
- Added HTTP endpoints for `/health` and `/qr`
- Added terminal QR rendering and reconnect handling
- Reduced the command set to reliable, maintainable features

## Why

- remove tight coupling and global state
- avoid circular boot/runtime dependencies
- make session persistence and reconnects production-safe
- make commands testable and maintainable
- reduce breakage from brittle third-party scraping features

## Delivery Artifacts

- updated folder structure
- updated README and env example
- migration notes for old to new runtime
- expanded unit/integration test coverage
