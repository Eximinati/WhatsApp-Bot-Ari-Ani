## Goal
Complete all approved maintainability refactors (R1–R3) across the WhatsApp bot codebase while preserving runtime behavior exactly.

## Constraints
- NO architecture redesign, runtime rewrites, DI containers, plugin systems, or new abstractions
- NO rewriting RuntimeClient, MessagePipeline, EconomyService, or changing runtime/command/menu/reconnect/async behavior
- Every change must be reversible and focused on readability, local reasoning, and extraction

## Progress
### Done
- R1.1 — Remove dead code: unused `firstOk` in `request.ts`; duplicate `dropLegacyIndexes()` in `index.ts`
- R1.2 — Rename `ECO`/`ECONOMY` → `economy`: 27 economy command files
- R1.3 — Shared `rr()` helper: created `src/utils/canvas.ts`; removed local `rr`/`roundRect` from 27 economy files (Slot kept custom)
- R1.4 — `simplifyMessage` cleanup: extracted `extractContent`, `extractQuoted`, `buildReplyFn` as private static/instance methods in RuntimeClient
- R1.5 — `connect()` cleanup: extracted 6 event handlers into private methods (`handleMessagesUpsert`, `handleContactsUpsert`, `handleContactsUpdate`, `handleGroupsUpdate`, `handleGroupParticipantsUpdate`, `handleCall`)
- R1.6 — Playlist helper: created `src/utils/playlist.ts`; updated `MessagePipeline.sendPlaylistFromReply`; removed dead `splitBatches`
- R1.7 — Shared media menu selection: created `src/utils/media.ts` with `handleFormatSelection`; 5 commands (Play, YTVideo, YTAudio, TikTok, Instagram) now delegate to it
- R1.8 — Group NodeCache declarations: replaced 5 separate `new NodeCache(...)` with shared `nc()` factory
- R2A — GroupService extraction: created `src/services/GroupService.ts`; 16 group/socket delegation methods moved from RuntimeClient
- R2B — UserDataService extraction: created `src/services/UserDataService.ts`; 8 user/group DB methods moved from RuntimeClient
- R3A — ICommandContext enforcement: CommandModule takes `ICommandContext`; added 6 leaked properties (`mediaMenu`, `menus`, `util`, `DB`, `chatAI`, `identity`) to interface; updated ICommand + Ship files
- R3B — MediaMenu + MenuManager audit: distinct responsibilities; no extraction justified
- R3C — RuntimeClient internal regioning: added 11 section comment headers (`STATE`, `IDENTITY & AUTH`, `CONNECTION LIFECYCLE`, `EVENT HANDLERS`, `SERVICES`, `MESSAGING`, `GROUP OPERATIONS`, `CONTACTS & PROFILES`, `CHAT OPERATIONS`, `JID UTILITIES`, `MESSAGE PARSING`, `USER/GROUP DATA`, `FEATURES & COMMAND TOGGLES`, `DIAGNOSTICS`)

### Done (Phase Final-1)
- R3D — Extracted `safeUnlink` + `fireAndForget` in `src/utils/async.ts`; updated 6 callers (Toolkit, steal, YT, RuntimeClient, CallDispatcher, MessagePipeline)
- firstOk typing fix: changed signature from `(urls: string[]) => Promise<T>` to `(providers: Array<() => Promise<T>>) => Promise<{ ok: true; value: T } | { ok: false }>` — fixes 27+ TS errors in Anime/Fun/Reddit
- Full compile audit: **zero TypeScript errors**

## Key Decisions
- Slot.ts `roundRect` kept as-is (unique rendering, not worth replacing)
- GroupService receives `groupMetadataCache` at construction (preserves shared cache behavior)
- UserDataService follows QuotaService pattern: `new UserDataService(this.DB)`, no lifecycle coupling
- R3A added 6 leaked properties to ICommandContext rather than breaking commands or using `as any`
- R3B no extraction: MediaMenu (format UI + pending buffers) vs MenuManager (session stack + routing); different backends, cleanup strategies, cancellation words
- Region headers use `// ======` style with lowercase section names (e.g., `// ====== STATE ======`)

## Critical Context
- RuntimeClient: 1092 → 1031 lines (R2A + R2B extracted ~60 lines, region headers added ~62 lines)
- All 5 services follow same pattern: constructor receives dep, methods are arrow-functions, RuntimeClient delegates via thin one-liners
- Pre-existing `firstOk` type errors in Anime/Fun/Reddit remain (not caused by refactors)
- ICommandContext is the primary command-facing contract — commands type `this.client` as `ICommandContext`

## Relevant Files
- `src/services/GroupService.ts` — 16 group delegation methods
- `src/services/UserDataService.ts` — 8 user/group DB persistence methods
- `src/utils/canvas.ts` — shared `rr()` rounded-rect helper
- `src/utils/playlist.ts` — `buildTrackListText` playlist helper
- `src/utils/media.ts` — `handleFormatSelection` media menu helper
- `src/core/CommandModule.ts` — constructor accepts `ICommandContext`
- `src/typings/context.d.ts` — ICommandContext includes mediaMenu, menus, util, DB, chatAI, identity
- `src/typings/command.d.ts` — ICommand.client typed as ICommandContext
- `src/core/RuntimeClient.ts` — 11 region headers; extracted methods → thin delegates; services as fields
- `src/core/Ship/index.ts`, `src/core/Ship/migrate.ts` — params changed to ICommandContext
