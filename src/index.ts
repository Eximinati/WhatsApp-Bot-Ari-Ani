import { config } from 'dotenv'
config()

import mongoose from 'mongoose'
import cron, { ScheduledTask } from 'node-cron'
import MessagePipeline from './pipeline/MessagePipeline.js'
import RuntimeClient from './core/RuntimeClient.js'
import HttpServer from './core/HttpServer.js'
import CallDispatcher from './pipeline/CallDispatcher.js'
import ResourceLoader from './pipeline/ResourceLoader.js'
import GroupDispatcher from './pipeline/GroupDispatcher.js'
import { ShutdownManager } from './runtime/ShutdownManager.js'
import { StartupManager } from './runtime/StartupManager.js'
import { ErrorBoundary, safeAsyncVoid } from './runtime/ErrorBoundary.js'
import { initializeArchitecture, createEventBridge, shutdownArchitecture } from './adapters/ArchitectureInitializer.js'
import type { ParsedArgs } from './core/middleware/types.js'
import { readdir, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

if (!process.env.MONGO_URI) throw new Error('MONGO_URI environment variable is required')

const MEMORY_WARNING_HEAP_PCT = 0.80
const MEMORY_WARNING_RSS_MB = 512
const DIAGNOSTICS_INTERVAL_MS = 5 * 60 * 1000

function getDiagnostics(): Record<string, unknown> {
    const mem = process.memoryUsage()
    const mediaDiag = (client as any).mediaMenu?.getDiagnostics?.() ?? {}
    const menuDiag = (client as any).menus?.getDiagnostics?.() ?? {}
    const timerDiag = ((client as any).timerRegistry?.getDiagnostics?.() ?? null) ?? {}
    const chatAi = (client as any).chatAI
    const archCtx = (client as any).archContext
    const eventBus = archCtx?.eventBus

    return {
        timestamp: Date.now(),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        externalMB: Math.round((mem.external || 0) / 1024 / 1024),
        pendingBuffers: mediaDiag.pendingBuffers ?? 0,
        pendingCache: mediaDiag.pendingCache ?? 0,
        cacheEvictions: mediaDiag.cacheEvictions ?? 0,
        menuSessions: menuDiag.cachedUsers ?? 0,
        chatStates: chatAi?.store?.size ?? 0,
        contacts: client.contacts.size,
        chats: client.chats.size,
        timers: timerDiag.total ?? 0,
        listenerCount: client.listenerCount('new-message'),
        bridgeListeners: archCtx?.bridgeListenerCount ?? 0,
        eventBusSubscribers: eventBus?.getSubscriberCount?.() ?? 0
    }
}

function checkMemoryWarning(): void {
    const mem = process.memoryUsage()
    const heapTotal = mem.heapTotal / 1024 / 1024
    const heapUsed = mem.heapUsed / 1024 / 1024
    const rss = mem.rss / 1024 / 1024

    if (heapUsed / heapTotal > MEMORY_WARNING_HEAP_PCT) {
        console.error(`[MEMORY_WARNING] heapUsedMB=${Math.round(heapUsed)} rssMB=${Math.round(rss)} pct=${Math.round((heapUsed / heapTotal) * 100)}%`)
    } else if (rss > MEMORY_WARNING_RSS_MB) {
        console.warn(`[MEMORY_WARNING] rssMB=${Math.round(rss)} (threshold: ${MEMORY_WARNING_RSS_MB}MB)`)
    }
}

setInterval(checkMemoryWarning, 60_000)

function emitDiagnostics(): void {
    const diag = getDiagnostics()
    console.log(`[MEMORY_DIAGNOSTICS] ${JSON.stringify(diag)}`)

    if (diag.listenerCount as number > 15) {
        console.warn(`[LISTENER_WARNING] new-message has ${diag.listenerCount} listeners — possible duplicate registration`)
    }
}

setInterval(emitDiagnostics, DIAGNOSTICS_INTERVAL_MS)

async function cleanupStaleTempFiles(): Promise<void> {
    const patterns = [/\.webp$/, /\.gif$/, /\.mp4$/, /\.wav$/, /\.in$/]
    const maxAgeMs = 24 * 60 * 60 * 1000
    const seen = new Set<string>()
    let cleaned = 0

    try {
        const files = await readdir(tmpdir())
        const now = Date.now()
        for (const file of files) {
            if (seen.has(file)) continue
            seen.add(file)
            if (!patterns.some(p => p.test(file))) continue
            try {
                const stat = await import('fs/promises').then(m => m.stat(path.join(tmpdir(), file)))
                if (now - stat.mtimeMs > maxAgeMs) {
                    await unlink(path.join(tmpdir(), file))
                    cleaned++
                }
            } catch { /* ignore */ }
        }
        if (cleaned > 0) {
            console.log(`[TEMP_CLEANUP] Removed ${cleaned} stale temp file(s) from tmpdir`)
        }
    } catch { /* ignore */ }
}

const client = new RuntimeClient({
    name: process.env.NAME || 'Ari-Ani',
    session: process.env.SESSION || 'default',
    prefix: process.env.PREFIX || '!',
    mods: (process.env.MODS || '').split(',').filter(Boolean).map((number) => `${number.replace(/\D/g, '')}@s.whatsapp.net`),
    gkey: process.env.GOOGLE_API_KEY || '',
    groqKey: process.env.GROQ_API_KEY || '',
    cerebrasKey: process.env.CEREBRAS_API_KEY || '',
    geminiKey: process.env.GEMINI_KEY || '',
    openrouterKey: process.env.OPENROUTER_API_KEY || '',
    tiktokApiUrl: process.env.TIKTOK_API_URL || '',
    instagramApiUrl: process.env.INSTAGRAM_API_URL || ''
})
client.log('Initializing runtime...')

const messagePipeline = new MessagePipeline(client)
client.pipeline = messagePipeline
const callDispatcher = new CallDispatcher(client)
const resourceLoader = new ResourceLoader(client)
const groupDispatcher = new GroupDispatcher(client)

const shutdownManager = ShutdownManager.getInstance()
const startupManager = StartupManager.getInstance()
const errorBoundary = ErrorBoundary.getInstance()

const archContext = initializeArchitecture(client)
;(client as any).archContext = archContext

shutdownManager.registerOwner({
    client,
    pipeline: messagePipeline,
    groupDispatcher,
    callDispatcher,
    resourceLoader,
    architecture: archContext
})

ShutdownManager.setupSignalHandlers()

new HttpServer(Number(process.env.PORT) || 4040, client)

const start = async (): Promise<void> => {
    await cleanupStaleTempFiles()
    await startupManager.start({
        environment: async () => {
            client.log('Startup: environment validated')
        },
        database: async () => {
            await dropLegacyIndexes()
            await clearStaleMenuStates()
            client.log('Startup: database ready')
        },
        runtime: async () => {
            client.log('Runtime initialized')
        },
        commands: async () => {
            await messagePipeline.loadCommands()
            client.log(`Loaded ${messagePipeline.commands.size} commands`)
            await messagePipeline.loadDisabledCommandsCache()
        },
        assets: async () => {
            resourceLoader.loadAssets()
            client.log('Assets loaded')
        },
        features: async () => {
            messagePipeline.loadFeatures()
            client.log('Features loaded')
        },
        listeners: async () => {
            client.removeAllListeners()
            
            client.on('open', safeAsyncVoid(async () => {
                client.log(`Session established as ${client.user.name || client.user.notify || client.user.jid.split('@')[0]}`)
                if (process.env.CRON) {
                    if (!cron.validate(process.env.CRON))
                        return void client.log(`Invalid cron schedule: ${process.env.CRON}`, true)
                    if (!shutdownManager.isInitialized()) {
                        client.log(`Scheduled task active: ${process.env.CRON}`)
                        const job = cron.schedule(process.env.CRON, safeAsyncVoid(async () => {
                            client.log('Clearing All Chats...')
                            await client.modifyAllChats('clear')
                            client.log('Cleared all Chats!')
                        }, { category: 'handler', severity: 'medium', source: 'cron:clear-chats', phase: 'runtime' }))
                        shutdownManager.registerCronJob(job)
                        shutdownManager.markInitialized()
                    }
                }
            }, { category: 'handler', severity: 'medium', source: 'client.on:open', phase: 'runtime' }))

            client.on('incoming-call', safeAsyncVoid(async (data) => {
                const { id, from } = data as { id: string; from: string }
                const display = client.contacts.get(from)?.notify || from
                client.log(`Incoming call from ${display}`)
                await callDispatcher.rejectCall(from, id)
            }, { category: 'handler', severity: 'high', source: 'client.on:incoming-call', phase: 'runtime' }))

            client.on('new-message', safeAsyncVoid(async (M: unknown) => {
                const msgStart = performance.now()
                const simplified = M as import('./typings/message.js').ISimplifiedMessage
                const rawMessage = simplified?.WAMessage
                const validated = rawMessage ? archContext.legacyAdapter.safeNormalize(rawMessage) : null
                if (!validated) {
                    client.log('Invalid message payload skipped')
                    return
                }

                const normStart = performance.now()
                const normalized = await archContext.serializer.normalize(validated)
                const normEnd = performance.now()
                archContext.serializer.setUserJid(client.user.jid)

                const pipelineStart = performance.now()
                await messagePipeline.handleMessage(M as any)
                const pipelineEnd = performance.now()
                client.log(`[TIMING] Message processed: total=${Math.round(performance.now() - msgStart)}ms, serialization=${Math.round(normEnd - normStart)}ms, legacyPipeline=${Math.round(pipelineEnd - pipelineStart)}ms`)
            }, { category: 'handler', severity: 'high', source: 'client.on:new-message', phase: 'runtime' }))

            client.on('group-participants-update', safeAsyncVoid(async (event: unknown) => {
                await groupDispatcher.handle(event as any)
            }, { category: 'handler', severity: 'medium', source: 'client.on:group-participants-update', phase: 'runtime' }))
            
            client.log('Event listeners bound')

            createEventBridge(client, archContext)
            client.log('EventBus bridge activated')
        },
        socket: async () => {
            await client.connect()
            client.log('Socket connected')
        }
    })
    
    const stages = startupManager.getStages()
    for (const stage of stages) {
        if (stage.status === 'success') {
            client.log(`Startup stage: ${stage.stage} completed in ${stage.duration}ms`)
        } else if (stage.status === 'failed') {
            client.log(`Startup stage: ${stage.stage} FAILED - ${stage.error}`, true)
        }
    }
}

const dropLegacyIndexes = async (): Promise<void> => {
    const stale: Array<{ collection: string; index: string }> = [
        { collection: 'groups', index: 'gid_1' }
    ]
    for (const { collection, index } of stale) {
        try {
            await mongoose.connection.collection(collection).dropIndex(index)
            client.log(`Cleaned legacy index ${collection}.${index}`)
        } catch {
            /* index didn't exist — fine */
        }
    }
}

const clearStaleMenuStates = async (): Promise<void> => {
    try {
        const result = await mongoose.connection.collection('users').updateMany(
            { mediaMenuState: { $exists: true } },
            { $unset: { mediaMenuState: 1 } }
        )
        if (result.modifiedCount > 0) {
            client.log(`Cleared ${result.modifiedCount} stale menu sessions from database`)
        }
    } catch (err) {
        client.log(`Failed to clear stale sessions: ${err}`, true)
    }
}

mongoose
    .connect(process.env.MONGO_URI as string)
    .then(async () => {
        client.log('Database connection established')
        await dropLegacyIndexes()
        start().catch((err) => client.log(String(err), true))
    })
    .catch((err) => {
        client.log(`Database connection failed: ${String(err)}`, true)
        process.exit(1)
    })