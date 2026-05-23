import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'uptime', description: 'Show bot uptime and status',
            category: 'utility', usage: `${client.config.prefix}uptime`,
            aliases: ['status', 'stats'], baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, _parsedArgs: IParsedArgs): Promise<void> => {
        const uptimeSeconds = Math.floor(process.uptime())
        const d = Math.floor(uptimeSeconds / 86400)
        const h = Math.floor((uptimeSeconds % 86400) / 3600)
        const m = Math.floor((uptimeSeconds % 3600) / 60)
        const s = uptimeSeconds % 60
        const uptime = d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`
        const mem = process.memoryUsage()
        const heap = Math.round(mem.heapUsed / 1024 / 1024)
        const total = Math.round(mem.heapTotal / 1024 / 1024)
        const rss = Math.round(mem.rss / 1024 / 1024)
        let text = `📊  BOT STATUS\n\n✅ *Status:* Online\n⏰ *Uptime:* ${uptime.padEnd(20).slice(0,20)}\n💾 *Heap:* ${heap}/${total} MB\n🧠 *RSS:* ${rss} MB                  │\n│ 👤 *Session:* ${(this.client.user?.name || 'Bot').padEnd(16).slice(0,16)}│\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
