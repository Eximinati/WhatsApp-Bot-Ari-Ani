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

if (!process.env.MONGO_URI) throw new Error('MONGO_URI environment variable is required')

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
const callDispatcher = new CallDispatcher(client)
const resourceLoader = new ResourceLoader(client)
const groupDispatcher = new GroupDispatcher(client)

const shutdownManager = ShutdownManager.getInstance()
const startupManager = StartupManager.getInstance()
const errorBoundary = ErrorBoundary.getInstance()

const archContext = initializeArchitecture(client)

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
    await startupManager.start({
        environment: async () => {
            client.log('Startup: environment validated')
        },
        database: async () => {
            await dropLegacyIndexes()
            client.log('Startup: database ready')
        },
        runtime: async () => {
            client.log('Runtime initialized')
        },
        commands: async () => {
            await messagePipeline.loadCommands()
            client.log(`Loaded ${messagePipeline.commands.size} commands`)
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
                const simplified = M as import('./typings/message.js').ISimplifiedMessage
                const rawMessage = simplified?.WAMessage
                const validated = rawMessage ? archContext.legacyAdapter.safeNormalize(rawMessage) : null
                if (!validated) {
                    client.log('Invalid message payload skipped')
                    return
                }

                const normalized = await archContext.serializer.normalize(validated)
                archContext.serializer.setUserJid(client.user.jid)

                const mode = archContext.runtimeKernel?.getMode() ?? archContext.runtimeMode

                if (archContext.runtimeKernel && mode !== 'LEGACY_ONLY') {
                    const result = await archContext.runtimeKernel.handleMessage(normalized)
                    if (result && result.success) {
                        client.log(`[kernel] ${normalized.command} -> SUCCESS (${result.durationMs}ms, hash: ${result.finalStateHash})`)
                        return
                    }
                    if (result) {
                        client.log(`[kernel] ${normalized.command} -> FAILED (${result.durationMs}ms) - falling back to legacy`)
                    }
                }

                await messagePipeline.handleMessage(M as any)
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