# Migration Notes

## Old Runtime To New Runtime

- Entrypoint moved from `heart.js` logic to `src/index.js`
- Globals were removed in favor of injected services
- Lowdb usage was replaced by Mongo-backed settings/state
- `discord-xp` was replaced with the internal XP service
- QR auth now uses `QR_TOKEN` for browser access instead of overloading `SESSION_ID`
- Owners now come from `OWNER_JIDS`, with `MODS` supported only as a deprecated fallback

## Legacy Data Import

`SettingsService.importLegacyData()` imports only the retained settings that still matter in the new architecture:

- banned users
- welcome-enabled groups
- custom welcome templates

Legacy state from removed systems such as plugin/NSFW/economy features is intentionally not migrated.

## Session Compatibility

- Existing Mongo auth session payloads remain readable by the new auth store
- If a session becomes invalid, the bot clears it and requires a fresh QR scan

## Command Compatibility

The old command shape (`start`, `desc`, `alias`, global context) is no longer supported. All retained commands now use:

```js
module.exports = {
  meta: { ... },
  async execute(ctx) { ... }
}
```
