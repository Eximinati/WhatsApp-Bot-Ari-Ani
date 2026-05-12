import express, { NextFunction, Request, Response } from 'express'
import { EventEmitter } from 'events'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import RuntimeClient from './RuntimeClient.js'

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
        this.app.listen(PORT, () => this.client.log(`HTTP Server started on port ${PORT}`))
    }

    auth = (req: Request, res: Response, next: NextFunction): void => {
        const { session } = req.query
        if (!session) return void res.json({ message: `Session Query not provided` })
        if (session !== this.client.config.session) return void res.json({ message: `Invalid Session ID` })
        next()
    }
}