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
        const now = Date.now()
        const start = (this.client as any).startTime || now
        const diff = now - start
        const d = Math.floor(diff / 86400000)
        const h = Math.floor((diff % 86400000) / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        const uptime = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`
        const mem = process.memoryUsage()
        const heap = Math.round(mem.heapUsed / 1024 / 1024)
        const total = Math.round(mem.heapTotal / 1024 / 1024)
        let text = `╭──────────────────────────────╮\n│      📊  BOT STATUS             │\n├──────────────────────────────┤\n│ ✅ *Status:* Online             │\n│ ⏰ *Uptime:* ${uptime.padEnd(20).slice(0,20)}│\n│ 💾 *Memory:* ${heap}/${total} MB          │\n│ 👤 *Session:* ${(this.client.user?.name || 'Bot').padEnd(16).slice(0,16)}│\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
