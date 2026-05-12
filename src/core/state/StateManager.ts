import type { NormalizedMessage } from '../serializer/types.js'
import { ExecutionClock, ExecutionMode } from '../execution/ExecutionClock.js'

export interface StateSnapshot {
    readonly id: string
    readonly executionId: string
    readonly tick: number
    readonly revision: number
    readonly userState: Readonly<UserState>
    readonly groupState: Readonly<GroupState>
    readonly runtimeState: Readonly<RuntimeState>
}

export interface UserState {
    readonly jid: string
    readonly xp: number
    readonly level: number
    readonly isBanned: boolean
    readonly isMod: boolean
    readonly lastSeen: number
}

export interface GroupState {
    readonly jid: string
    readonly isActive: boolean
    readonly participants: readonly string[]
    readonly settings: Readonly<GroupSettings>
}

export interface GroupSettings {
    readonly prefix: string
    readonly nsfw: boolean
    readonly events: boolean
}

export interface RuntimeState {
    readonly disabledCommands: ReadonlySet<string>
    readonly activeCommands: ReadonlySet<string>
    readonly features: ReadonlyMap<string, boolean>
}

export interface StateManagerConfig {
    readonly snapshotRetention: number
    readonly clock?: ExecutionClock
}

export class StateManager {
    private readonly config: StateManagerConfig
    private readonly snapshots: Map<string, StateSnapshot> = new Map()
    private revisionCounter = 0
    private snapshotKeys: string[] = []
    private maxSnapshots: number

    constructor(config: StateManagerConfig) {
        this.config = config
        this.maxSnapshots = config.snapshotRetention ?? 100
    }

    reset(): void {
        this.revisionCounter = 0
        this.snapshots.clear()
        this.snapshotKeys = []
    }

    private getNextRevision(): number {
        return ++this.revisionCounter
    }

    private getDeterministicTick(): number {
        return this.config.clock?.getTick() ?? 0
    }

    private getDeterministicId(prefix: string): string {
        const tick = this.getDeterministicTick()
        const executionId = this.config.clock?.getTickSequence() ?? 'default'
        return `${prefix}-${executionId}-r${this.getNextRevision()}`
    }

    private cleanupOldSnapshots(): void {
        const maxToRetain = Math.max(10, this.maxSnapshots)
        while (this.snapshotKeys.length > maxToRetain) {
            const oldestKey = this.snapshotKeys.shift()
            if (oldestKey) {
                this.snapshots.delete(oldestKey)
            }
        }
    }

    createInitialSnapshot(executionId: string): StateSnapshot {
        const snapshot: StateSnapshot = {
            id: this.getDeterministicId('snap'),
            executionId,
            tick: this.getDeterministicTick(),
            revision: this.getNextRevision(),
            userState: Object.freeze({
                jid: '',
                xp: 0,
                level: 0,
                isBanned: false,
                isMod: false,
                lastSeen: 0
            }),
            groupState: Object.freeze({
                jid: '',
                isActive: true,
                participants: [],
                settings: Object.freeze({
                    prefix: '!',
                    nsfw: false,
                    events: true
                })
            }),
            runtimeState: Object.freeze({
                disabledCommands: Object.freeze(new Set<string>()) as unknown as ReadonlySet<string>,
                activeCommands: Object.freeze(new Set<string>()) as unknown as ReadonlySet<string>,
                features: Object.freeze(new Map<string, boolean>()) as unknown as ReadonlyMap<string, boolean>
            })
        }
        this.snapshots.set(snapshot.id, snapshot)
        this.snapshotKeys.push(snapshot.id)
        this.cleanupOldSnapshots()
        return snapshot
    }

    evolveSnapshot(snapshot: StateSnapshot, updates: Partial<StateSnapshot>): StateSnapshot {
        const evolved: StateSnapshot = Object.freeze({
            ...snapshot,
            ...updates,
            id: this.getDeterministicId('snap'),
            tick: this.getDeterministicTick(),
            revision: this.getNextRevision()
        })
        this.snapshots.set(evolved.id, evolved)
        this.snapshotKeys.push(evolved.id)
        this.cleanupOldSnapshots()
        return evolved
    }

    getSnapshot(id: string): StateSnapshot | undefined {
        return this.snapshots.get(id)
    }

    computeStateSnapshotHash(snapshot: StateSnapshot): string {
        const data = JSON.stringify({
            id: snapshot.id,
            executionId: snapshot.executionId,
            revision: snapshot.revision,
            tick: snapshot.tick,
            userJid: snapshot.userState.jid,
            groupJid: snapshot.groupState.jid,
            groupParticipants: snapshot.groupState.participants.length,
            groupActive: snapshot.groupState.isActive
        })
        let hash = 0
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        return Math.abs(hash).toString(36)
    }

    verifyDeterministicReplay(originalHash: string, replaySnapshot: StateSnapshot): boolean {
        const replayHash = this.computeStateSnapshotHash(replaySnapshot)
        return originalHash === replayHash
    }
}