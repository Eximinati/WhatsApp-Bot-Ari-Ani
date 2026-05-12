interface TimerEntry {
    id: string
    type: 'timeout' | 'interval'
    owner: string
    createdAt: number
    callback: () => void
    ref: NodeJS.Timeout | ReturnType<typeof setInterval>
}

export class TimerRegistry {
    private static instance: TimerRegistry
    private timers: Map<string, TimerEntry> = new Map()
    private idCounter = 0

    private constructor() {}

    static getInstance(): TimerRegistry {
        if (!TimerRegistry.instance) {
            TimerRegistry.instance = new TimerRegistry()
        }
        return TimerRegistry.instance
    }

    registerTimeout(
        owner: string,
        callback: () => void,
        ms: number,
        name?: string
    ): NodeJS.Timeout {
        const id = name || `timeout_${this.idCounter++}_${owner}`
        const ref = setTimeout(callback, ms)
        
        this.timers.set(id, {
            id,
            type: 'timeout',
            owner,
            createdAt: Date.now(),
            callback,
            ref
        })
        
        return ref
    }

    registerInterval(
        owner: string,
        callback: () => void,
        ms: number,
        name?: string
    ): ReturnType<typeof setInterval> {
        const id = name || `interval_${this.idCounter++}_${owner}`
        const ref = setInterval(callback, ms)
        
        this.timers.set(id, {
            id,
            type: 'interval',
            owner,
            createdAt: Date.now(),
            callback,
            ref
        })
        
        return ref
    }

    clear(id: string): boolean {
        const entry = this.timers.get(id)
        if (!entry) return false

        try {
            if (entry.type === 'timeout') {
                clearTimeout(entry.ref)
            } else {
                clearInterval(entry.ref)
            }
        } catch {
            // ignore
        }

        this.timers.delete(id)
        return true
    }

    clearByOwner(owner: string): number {
        let count = 0
        for (const [id, entry] of this.timers) {
            if (entry.owner === owner) {
                if (this.clear(id)) count++
            }
        }
        return count
    }

    getAll(): TimerEntry[] {
        return Array.from(this.timers.values())
    }

    getCount(): number {
        return this.timers.size
    }

    getDiagnostics(): {
        total: number
        timeouts: number
        intervals: number
        byOwner: Record<string, number>
    } {
        const byOwner: Record<string, number> = {}
        let timeouts = 0
        let intervals = 0

        for (const entry of this.timers.values()) {
            byOwner[entry.owner] = (byOwner[entry.owner] || 0) + 1
            if (entry.type === 'timeout') timeouts++
            else intervals++
        }

        return {
            total: this.timers.size,
            timeouts,
            intervals,
            byOwner
        }
    }

    clearAll(): number {
        const count = this.timers.size
        for (const id of this.timers.keys()) {
            this.clear(id)
        }
        return count
    }
}