import express, { NextFunction, Request, Response } from 'express'
import { EventEmitter } from 'events'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import RuntimeClient from './RuntimeClient.js'
import mongoose from 'mongoose'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default class HttpServer extends EventEmitter {
    app = express()
    apiRouter = express.Router()

    constructor(public PORT: number, public client: RuntimeClient) {
        super()
        this.app.use(express.static(join(__dirname, '..', '..', 'public')))
        this.app.use('/wa', this.apiRouter)
        this.apiRouter.use(this.auth)
        this.apiRouter.get('/qr', (req, res) => {
            if (!this.client.QR)
                return void res.json({
                    message:
                        this.client.state === 'open' ? "You're already authenticated" : 'QR is not generated yet'
                })
            res.contentType('image/png')
            return void res.send(this.client.QR)
        })

        this.app.get('/health', (_req, res) => {
            const mem = process.memoryUsage()
            const mongoState = mongoose.connection.readyState
            const uptime = process.uptime()

            const runtimeDiag = this.client.getRuntimeDiagnostics()
            const mediaDiag = this.client.mediaMenu?.getDiagnostics?.() ?? null
            const menuDiag = this.client.menus?.getDiagnostics?.() ?? null
            const isHealthy = this.client.state === 'open' && mongoState === 1

            res.json({
                status: isHealthy ? 'healthy' : 'degraded',
                uptime: Math.round(uptime),
                heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
                rssMB: Math.round(mem.rss / 1024 / 1024),
                mongoConnected: mongoState === 1,
                connectionState: this.client.state,
                reconnectState: `attempt=${runtimeDiag.reconnectAttempts} delay=${runtimeDiag.reconnectDelay}ms active=${runtimeDiag.reconnectActive}`,
                reconnectAttempts: runtimeDiag.reconnectAttempts,
                pid: process.pid,
                diagnostics: {
                    pendingBuffers: mediaDiag?.pendingBuffers ?? 0,
                    pendingCache: mediaDiag?.pendingCache ?? 0,
                    cacheEvictions: mediaDiag?.cacheEvictions ?? 0,
                    menuSessions: menuDiag?.cachedUsers ?? 0,
                    contacts: this.client.contacts.size,
                    chats: this.client.chats.size,
                    timers: {
                        total: runtimeDiag.timers.total,
                        timeouts: runtimeDiag.timers.timeouts,
                        intervals: runtimeDiag.timers.intervals
                    },
                    listenerCount: this.client.listenerCount('new-message')
                }
            })
        })

        this.app.listen(PORT, () => this.client.log(`HTTP Server started on port ${PORT}`))
    }

    auth = (req: Request, res: Response, next: NextFunction): void => {
        const { session } = req.query
        if (!session) return void res.json({ message: `Session Query not provided` })
        if (session !== this.client.config.session) return void res.json({ message: `Invalid Session ID` })
        next()
    }
}