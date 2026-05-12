# LEGACY ERADICATION AUDIT REPORT

Generated: 2026-05-12

---

## SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| Total Commands | 77 | - |
| CRITICAL (client.sendMessage) | 7 | MUST MIGRATE |
| UNSAFE (M.reply) | 70 | NEEDS MIGRATION |
| SAFE (transport intents) | 0 | 0% |
| Migrated Commands (handlers) | 3 | ping, help, hi |

---

## PART 1: RUNTIME COMPONENT ANALYSIS

### Active Components

| Component | Type | Status | Notes |
|-----------|------|--------|-------|
| RuntimeKernel | Core | ACTIVE | HYBRID mode, sole authority target |
| ExecutionCoordinator | Core | ACTIVE | Handles phase transitions |
| MessageDispatcher | Core | ACTIVE | Routes commands to handlers |
| MessageSerializer | Core | ACTIVE | Normalizes messages |
| TransportCommitCoordinator | Core | ACTIVE | Commits intents |
| EventBus | Core | ACTIVE | Event subscription system |
| MiddlewareChain | Core | ACTIVE | Phase-based middleware |
| StateManager | Core | ACTIVE | Snapshot management |
| CircuitBreaker | Core | ACTIVE | Per-chat rate limiting |

### Legacy Components

| Component | Type | Status | Delete Safety |
|-----------|------|--------|---------------|
| MessagePipeline | Legacy | ACTIVE | UNSAFE (used for fallback) |
| LegacyRuntimeAdapter | Legacy | ACTIVE | SAFE (needed for normalization) |
| CommandModule | Legacy | ACTIVE | UNSAFE (base class for commands) |
| RuntimeClient (partial) | Hybrid | ACTIVE | UNSAFE (socket access needed) |

---

## PART 2: EXECUTION FLOW ANALYSIS

### Current Flow

```
Message Received (Baileys)
    ↓
RuntimeClient.emit('new-message')
    ↓
index.ts handler (safeAsyncVoid)
    ↓
┌─────────────────────────────────┐
│ Kernel Check (mode !== LEGACY)  │
│   ↓                             │
│ RuntimeKernel.handleMessage()  │
│   ↓                             │
│ Dispatcher resolution           │
│   ↓                             │
│ Handler execution               │
│   ↓                             │
│ Transport intent creation       │
│   ↓                             │
│ Commit (if LIVE mode)           │
└─────────────────────────────────┘
    ↓ (if kernel fails)
Legacy Pipeline (MessagePipeline)
    ↓
Command execution (M.reply)
    ↓
Response sent
```

### Hybrid Execution Paths

| Path | Authority | Fallback | Status |
|------|-----------|----------|--------|
| Kernel → Success | RuntimeKernel | None | WORKING |
| Kernel → Failed | MessagePipeline | Yes | WORKING |
| LEGACY_ONLY mode | MessagePipeline | N/A | WORKING |

---

## PART 3: TRANSPORT USAGE AUDIT

### CRITICAL Commands (Direct Socket Access)

These commands use `client.sendMessage` - bypassing all transport layer governance:

| Command | File | Risk |
|---------|------|------|
| broadcast | commands/Dev/BroadCast.ts | HIGH |
| status | commands/Dev/Status.ts | HIGH |
| chess | commands/Games/Chess.ts | HIGH |
| invitelink | commands/General/InviteLink.ts | HIGH |
| play | commands/Media/Play.ts | HIGH |
| purge | commands/Moderation/Purge.ts | HIGH |
| remove | commands/Moderation/Remove.ts | HIGH |

### UNSAFE Commands (M.reply)

All 70 remaining commands use `M.reply()` - legacy transport:

- All Anime commands (7)
- All Bots commands (8)
- All Config commands (2)
- All Dev commands (8 - minus CRITICAL)
- All Educative commands (7)
- All Fun commands (13)
- All General commands (8 - minus CRITICAL)
- All Media commands (15 - minus CRITICAL)
- All Moderation commands (9 - minus CRITICAL)

---

## PART 4: SAFE-TO-DELETE FILES

### Verification Complete - Safe to Delete

| File | Reason | Risk |
|------|--------|------|
| src/runtime/stress-test.ts | Test file, not imported | ZERO |
| src/runtime/verify-test.ts | Test file, not imported | ZERO |
| src/runtime/verify.ts | Test file, not imported | ZERO |
| test-audit.mjs | Test file, standalone | ZERO |
| test-runtime-suite.mjs | Test file, standalone | ZERO |

### Dead Code Detected

| File | Status | Notes |
|------|--------|-------|
| src/core/state/LegacyStateAdapter.ts | UNUSED | No imports found |
| src/core/dispatcher/Dispatcher.ts | UNUSED | MessageDispatcher used instead |
| src/core/transport/CommitRegistry.ts | DUPLICATE | AuthoritativeCommitRegistry exists |

---

## PART 5: UNSAFE-TO-DELETE FILES

### Required for Operation

| File | Reason | Blockers |
|------|--------|----------|
| src/pipeline/MessagePipeline.ts | Fallback path needed | Kernel returns FAILED |
| src/pipeline/*.ts (all) | Group/Call handling | Event handlers use these |
| src/adapters/legacy/LegacyRuntimeAdapter.ts | Normalization required | Serializer depends on it |
| src/core/CommandModule.ts | Command base class | All commands inherit from it |
| src/core/RuntimeClient.ts | Socket access | All transport goes through it |

---

## PART 6: RUNTIME OWNERSHIP

### Dispatcher-Owned Commands (3)

| Command | Handler | Transport |
|---------|---------|----------|
| ping | PingHandler | Intent-based |
| help | HelpHandler | Intent-based |
| hi | HiHandler | Intent-based |

### Legacy-Owned Commands (74)

All commands using CommandModule + M.reply pattern.

---

## PART 7: BLOCKERS PREVENTING FULL DELETION

1. **Kernel Fails for All Commands**: ExecutionCoordinator returns FAILED in non-LIVE mode
2. **No Transport Commit**: canSendTransport() returns false unless LIVE mode
3. **77 Commands Unmigrated**: All use M.reply or client.sendMessage
4. **MessagePipeline Required**: Fallback path needed when kernel fails

---

## RECOMMENDATIONS

### Immediate Actions

1. **Keep MessagePipeline** - Required for fallback until all commands migrated
2. **Keep LegacyRuntimeAdapter** - Required for message normalization
3. **Keep CommandModule** - All commands depend on it
4. **Delete test files** - No production value

### Long-term Actions

1. Migrate CRITICAL commands to handlers
2. Migrate UNSAFE commands to handlers
3. Set mode to DISPATCHER_ONLY when 100% migrated
4. Delete MessagePipeline when no fallback needed

---

## CONCLUSION

**RuntimeKernel**: Ready to be sole authority
**Fallback**: Required until migration complete
**Legacy Cleanup**: Can delete test files only
**Migration**: 0% complete (3/77 commands)

### Deployment Status

- Runtime kernel: OPERATIONAL
- Transport layer: OPERATIONAL
- Fallback pipeline: OPERATIONAL
- Migration progress: BLOCKED