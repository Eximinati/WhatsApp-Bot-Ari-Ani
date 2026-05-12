import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'wiki', description: 'Search Wikipedia',
            category: 'social', usage: `${client.config.prefix}wiki <search>`,
            aliases: ['wikipedia', 'w'], baseXp: 15
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const q = joined.trim()
        if (!q) return void M.reply(`╭──────────────────────────────╮\n│      📖  WIKIPEDIA             │\n├──────────────────────────────┤\n│ Usage: *${this.client.config.prefix}wiki <term>*│\n╰──────────────────────────────╯`)
        try {
            await M.reply('🔍 *Searching...*')
            const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`)
            if (res.status === 404) return void M.reply(`╭──────────────────────────────╮\n│      📖  WIKIPEDIA             │\n├──────────────────────────────┤\n│ ❌ No results for *${q.substring(0,20).padEnd(20)}│\n╰──────────────────────────────╯`)
            const data = await res.json() as { title?: string; extract?: string; thumbnail?: { source: string }; content_urls?: { desktop: { page: string } } }
            let text = `╭──────────────────────────────╮\n│      📖  WIKIPEDIA             │\n├──────────────────────────────┤\n│ 📌 *${(data.title || '').substring(0,24).padEnd(24)}│\n│ ${(data.extract || '').substring(0,26).padEnd(26)}│\n╰──────────────────────────────╯`
            if (data.thumbnail?.source) {
                try { const buf = await this.client.getBuffer(data.thumbnail.source); return void await M.reply(buf, undefined, undefined, text as any) } catch { }
            }
            return void M.reply(text)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      📖  WIKIPEDIA             │\n├──────────────────────────────┤\n│ ❌ Search failed               │\n╰──────────────────────────────╯`)
        }
    }
}
