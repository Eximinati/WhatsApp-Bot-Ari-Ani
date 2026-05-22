import type RuntimeClient from '../core/RuntimeClient.js'
import type MessagePipeline from '../pipeline/MessagePipeline.js'
import type GroupDispatcher from '../pipeline/GroupDispatcher.js'
import type CallDispatcher from '../pipeline/CallDispatcher.js'
import type ResourceLoader from '../pipeline/ResourceLoader.js'
import { TimerRegistry } from './TimerRegistry.js'

interface LifecycleOwner {
    client?: RuntimeClient
    pipeline?: MessagePipeline
    groupDispatcher?: GroupDispatcher
    callDispatcher?: CallDispatcher
    resourceLoader?: ResourceLoader
}

interface CronJob {
    stop: () => void
}

export class ShutdownManager {
    private static instance: ShutdownManager
    private initialized = false
    private owners: LifecycleOwner = {}
    private cronJobs: CronJob[] = []
    private isShuttingDown = false

    private constructor() {}

    static getInstance(): ShutdownManager {
        if (!ShutdownManager.instance) {
            ShutdownManager.instance = new ShutdownManager()
        }
        return ShutdownManager.instance
    }

    registerOwner(owners: LifecycleOwner): void {
        this.owners = { ...this.owners, ...owners }
    }

    registerCronJob(job: CronJob): void {
        this.cronJobs.push(job)
    }

    isInitialized(): boolean {
        return this.initialized
    }

    markInitialized(): void {
        this.initialized = true
    }

    getIsShuttingDown(): boolean {
        return this.isShuttingDown
    }

    async gracefulShutdown(signal: string): Promise<void> {
        if (this.isShuttingDown) {
            return
        }
        this.isShuttingDown = true

        const log = (msg: string) => {
            const ts = new Date().toLocaleString('en-GB')
            console.log(`${ts} [SHUTDOWN] ${msg}`)
        }

        log(`Received ${signal}, initiating graceful shutdown...`)

        try {
            if (this.owners.client) {
                log('Cleaning up client listeners...')
                this.owners.client.removeAllListeners()
                const listenerCount = this.owners.client.listenerCount('new-message')
                log(`Client listeners cleared (new-message count before clear: ${listenerCount})`)
            }

            if (this.owners.client?.mediaMenu?.dispose) {
                this.owners.client.mediaMenu.dispose()
                log('MediaMenu resources disposed')
            }

            if (this.owners.client?.chatAI?.dispose) {
                this.owners.client.chatAI.dispose()
                log('ChatAI GC timer cleared')
            }

            log(`Clearing ${this.cronJobs.length} cron job(s)...`)
            for (const job of this.cronJobs) {
                try {
                    job.stop()
                } catch (e) {
                    // ignore
                }
            }
            this.cronJobs = []

            log('Clearing timers...')
            const timerRegistry = TimerRegistry.getInstance()
            const cleared = timerRegistry.clearAll()
            log(`Cleared ${cleared} timer(s)`)

            log('Shutdown complete')
        } catch (err) {
            log(`Shutdown error: ${err}`)
        }

        process.exit(0)
    }

    static setupSignalHandlers(): void {
        const manager = ShutdownManager.getInstance()

        process.on('SIGINT', () => {
            manager.gracefulShutdown('SIGINT')
        })

        process.on('SIGTERM', () => {
            manager.gracefulShutdown('SIGTERM')
        })

        process.on('uncaughtException', (err) => {
            console.error('Uncaught exception:', err)
            manager.gracefulShutdown('uncaughtException')
        })

        process.on('unhandledRejection', (reason) => {
            console.error('Unhandled rejection:', reason)
        })
    }
}