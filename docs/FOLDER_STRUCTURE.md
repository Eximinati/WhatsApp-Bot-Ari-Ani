# Folder Structure

```text
.
|-- .env.example
|-- README.md
|-- docs/
|   |-- FOLDER_STRUCTURE.md
|   |-- MIGRATION.md
|   `-- REFRACTOR_SUMMARY.md
|-- src/
|   |-- index.js
|   |-- commands/
|   |   |-- general/
|   |   |-- group/
|   |   |-- mods/
|   |   `-- utils/
|   |-- config/
|   |-- core/
|   |   `-- whatsapp/
|   |-- handlers/
|   |-- models/
|   |-- services/
|   |   `-- external/
|   `-- utils/
`-- tests/
```

## Notes

- `src/core` owns runtime bootstrapping, database setup, HTTP routes, and WhatsApp connection lifecycle.
- `src/handlers` owns event wiring and message dispatch boundaries.
- `src/commands` contains only retained, production-safe commands using the unified `{ meta, execute }` contract.
- `src/services` contains domain logic and external API adapters so commands stay thin.
- `src/models` contains Mongo collections owned by the bot runtime.
- `tests` includes unit, integration-style, and runtime smoke coverage for the refactored bot.
