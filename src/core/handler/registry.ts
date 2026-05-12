import type { DispatcherHandler } from './types.js'
import { PingHandler, HelpHandler, HiHandler } from './index.js'

export function createHandlerRegistry(): Map<string, DispatcherHandler> {
    const handlers = new Map<string, DispatcherHandler>()

    const ping = new PingHandler()
    handlers.set(ping.name, ping)

    const help = new HelpHandler()
    handlers.set(help.name, help)

    const hi = new HiHandler()
    handlers.set(hi.name, hi)

    return handlers
}