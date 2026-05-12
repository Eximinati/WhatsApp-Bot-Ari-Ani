export type StartupStage = 
    | 'environment'
    | 'database' 
    | 'runtime'
    | 'commands'
    | 'assets'
    | 'features'
    | 'listeners'
    | 'socket'
    | 'ready'

export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export interface StageResult {
    stage: StartupStage
    status: StageStatus
    duration?: number
    error?: string
}

interface StartupStages {
    environment?: () => Promise<void>
    database?: () => Promise<void>
    runtime?: () => Promise<void>
    commands?: () => Promise<void>
    assets?: () => Promise<void>
    features?: () => Promise<void>
    listeners?: () => Promise<void>
    socket?: () => Promise<void>
}

export class StartupManager {
    private static instance: StartupManager
    private stages: Map<StartupStage, StageResult> = new Map()
    private startTime: number | null = null
    private isRunning = false
    private failedStage: StartupStage | null = null
    private timeoutMs = 60000

    private constructor() {}

    static getInstance(): StartupManager {
        if (!StartupManager.instance) {
            StartupManager.instance = new StartupManager()
        }
        return StartupManager.instance
    }

    getStages(): StageResult[] {
        return Array.from(this.stages.values())
    }

    getCurrentStage(): StartupStage | null {
        for (const [stage, result] of this.stages) {
            if (result.status === 'running') return stage
        }
        return null
    }

    isComplete(): boolean {
        return this.stages.get('ready')?.status === 'success'
    }

    isFailed(): boolean {
        return this.failedStage !== null
    }

    getFailedStage(): StartupStage | null {
        return this.failedStage
    }

    getTotalDuration(): number | null {
        if (!this.startTime) return null
        const ready = this.stages.get('ready')
        if (!ready?.duration) return null
        return ready.duration
    }

    private setStage(stage: StartupStage, status: StageStatus, error?: string): void {
        const existing = this.stages.get(stage)
        const duration = existing?.duration 
        
        this.stages.set(stage, {
            stage,
            status,
            duration,
            error
        })

        if (status === 'failed') {
            this.failedStage = stage
            this.isRunning = false
        }
    }

    async runStage<T>(
        stage: StartupStage,
        fn: () => Promise<T>,
        timeoutMs?: number
    ): Promise<T> {
        if (this.isRunning && this.failedStage) {
            throw new Error(`Startup already failed at stage: ${this.failedStage}`)
        }

        this.isRunning = true
        this.setStage(stage, 'running')
        
        const stageStartTime = Date.now()
        
        try {
            const timeout = timeoutMs || this.timeoutMs
            let result: T
            
            if (timeout > 0) {
                result = await Promise.race([
                    fn(),
                    new Promise<T>((_, reject) => 
                        setTimeout(() => reject(new Error(`Stage ${stage} timed out after ${timeout}ms`)), timeout)
                    )
                ])
            } else {
                result = await fn()
            }

            const duration = Date.now() - stageStartTime
            this.setStage(stage, 'success', undefined)
            this.stages.get(stage)!.duration = duration
            
            return result
        } catch (error) {
            const duration = Date.now() - stageStartTime
            const errorMsg = error instanceof Error ? error.message : String(error)
            this.setStage(stage, 'failed', errorMsg)
            this.stages.get(stage)!.duration = duration
            this.failedStage = stage
            this.isRunning = false
            throw error
        }
    }

    async start(stages: StartupStages): Promise<void> {
        this.startTime = Date.now()
        this.stages.clear()
        this.failedStage = null
        this.isRunning = true

        if (stages.environment) {
            await this.runStage('environment', stages.environment)
        }

        if (stages.database) {
            await this.runStage('database', stages.database)
        }

        if (stages.runtime) {
            await this.runStage('runtime', stages.runtime)
        }

        if (stages.commands) {
            await this.runStage('commands', stages.commands)
        }

        if (stages.assets) {
            await this.runStage('assets', stages.assets)
        }

        if (stages.features) {
            await this.runStage('features', stages.features)
        }

        if (stages.listeners) {
            await this.runStage('listeners', stages.listeners)
        }

        if (stages.socket) {
            await this.runStage('socket', stages.socket)
        }

        const totalDuration = Date.now() - (this.startTime || Date.now())
        this.setStage('ready', 'success')
        this.stages.get('ready')!.duration = totalDuration
        this.isRunning = false
    }

    reset(): void {
        this.stages.clear()
        this.startTime = null
        this.isRunning = false
        this.failedStage = null
    }
}