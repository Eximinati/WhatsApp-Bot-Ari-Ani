# KWOI Runtime Production Hardening - TEST GUIDE

## Quick Start

### 1. Run Transport Audit (find legacy bypasses)

```bash
cd D:\Code\Kaoi-main
node test-audit.mjs
```

This analyzes all 77 commands and reports:
- **CRITICAL** (7): Direct `client.sendMessage` usage
- **UNSAFE** (70): `M.reply` usage  
- **SAFE** (0): Transport intent usage

### 2. Run the Bot

```bash
npm run dev
```

### 3. Test Commands in WhatsApp

If bot doesn't reply to `!hi`:
- The RuntimeKernel is returning FAILED
- This is expected - migrated handlers don't send via M.reply anymore
- Commands using `M.reply` (legacy) still work

## Why Bot Might Not Reply

The RuntimeKernel's execution flow has an issue:

1. `hi` command is owned by dispatcher
2. Kernel executes it via ExecutionCoordinator
3. Handler queues intent via `context.transport.queueText()`
4. BUT the intent commit might fail silently
5. Result returns FAILED
6. Code returns early, legacy pipeline skipped
7. **No message sent**

The legacy `hi` command (commands/General/Hi.ts) uses `M.reply()` which bypasses RuntimeKernel.

## Commands That Should Work

All commands using `M.reply` in their source code will work because they bypass the RuntimeKernel:

```bash
!hi
!ping
!mods
!help
!joke
!quote
!play [song]
```

## Commands That Won't Work (need migration)

Commands that need fixing:
- `!broadcast` - uses `client.sendMessage` directly
- `!status` - uses `client.sendMessage` directly
- `!chess` - uses `client.sendMessage` directly
- `!invitelink` - uses `client.sendMessage` directly
- `!play` - uses `client.sendMessage` directly
- `!purge` - uses `client.groupRemove` directly
- `!remove` - uses `client.groupRemove` directly

## To Fix Commands (Migration)

For commands using `M.reply`:
```typescript
// OLD (legacy)
await M.reply("Hello")

// NEW (runtime)
context.transport.queueText(context.message.chatJid, "Hello")
```

For commands using `client.sendMessage`:
```typescript
// OLD (critical - bypasses everything)
await this.client.sendMessage(jid, text)

// NEW (runtime)
context.transport.queueText(jid, text)
```

## Files Created

| File | Purpose |
|------|---------|
| `src/core/runtime/TransportAudit.ts` | Detect transport bypasses |
| `src/core/runtime/CommandMigrationTracker.ts` | Track migration status |
| `src/core/runtime/ShadowModeVerifier.ts` | Kernel vs legacy comparison |
| `src/core/runtime/CrashRecoveryVerifier.ts` | Crash simulation |
| `src/core/runtime/RuntimeHealthDashboard.ts` | Live metrics |
| `src/core/runtime/FinalOperationalCertification.ts` | Overall certification |

## Test Commands to Run

After running `npm run dev`:

### Basic Commands (should work via legacy)
```
!hi
!ping
!mods
!help
```

### Commands with Issues
```
!broadcast [msg]     # Uses direct sendMessage
!status              # Uses direct sendMessage
!chess               # Uses direct sendMessage
```

## Debugging

If `!hi` doesn't reply:
1. Check bot logs for `[kernel] hi -> FAILED`
2. This means RuntimeKernel execution failed
3. Command fell back to legacy pipeline but was skipped due to early return

To use legacy pipeline only, edit index.ts:
```typescript
// Change to LEGACY_ONLY
runtimeKernel.setMode(RuntimeMode.LEGACY_ONLY)
```

Or in ArchitectureInitializer.ts:
```typescript
transferOwnership('hi', 'legacy')  // Instead of 'dispatcher'
```

## Summary

| Finding | Count |
|---------|-------|
| Total Commands | 77 |
| CRITICAL | 7 |
| UNSAFE | 70 |
| SAFE | 0 |
| Migration Progress | 0% |

**NOT SAFE FOR PRODUCTION** - All commands bypass RuntimeKernel.

Next steps:
1. Migrate CRITICAL commands first (broadcast, status, chess, etc.)
2. Migrate UNSAFE commands (replace M.reply with transport intents)
3. Test with Shadow Mode to compare kernel vs legacy behavior
4. Deploy when migration is complete