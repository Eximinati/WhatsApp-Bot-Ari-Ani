import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'meme',
            description: 'Get a random meme from Reddit',
            category: 'social', usage: `${client.config.prefix}meme [subreddit]`,
            aliases: [], baseXp: 15
        })
    }

    run = async (M: ISimplifiedMessage, parsedArgs: IParsedArgs): Promise<void> => {
        const subs = ['memes', 'dankmemes', 'me_irl', 'wholesomememes']
        const q = parsedArgs.joined.trim().replace(/r\//g, '').trim() || subs[Math.floor(Math.random() * subs.length)]
        try {
            await M.reply('🎲 *Fetching...*')
            const res = await fetch(`https://meme-api.com/gimme/${q}/1`)
            if (!res.ok) throw new Error()
            const data = await res.json() as { memes?: Array<{ title?: string; url?: string; postLink?: string; subreddit?: string }> }
            const m = data.memes?.[0]
            if (!m) return void M.reply(`╭──────────────────────────────╮\n│      🎭  MEME                  │\n├──────────────────────────────┤\n│ ❌ No memes found              │\n╰──────────────────────────────╯`)
            const cap = `╭──────────────────────────────╮\n│      🎭  MEME                  │\n├──────────────────────────────┤\n│ 📰 ${(m.title || '').substring(0,26).padEnd(26)}│\n│ 📂 r/${(m.subreddit || '?').padEnd(23).slice(0,23)}│\n╰──────────────────────────────╯`
            if (m.url && /\.(jpg|jpeg|png|gif|webp)/i.test(m.url)) {
                const buf = await this.client.getBuffer(m.url)
                return void await M.reply(buf, undefined, undefined, cap as any)
            }
            return void M.reply(`${cap}\n\n🔗 ${m.url || ''}`)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      🎭  MEME                  │\n├──────────────────────────────┤\n│ ❌ Failed to fetch             │\n╰──────────────────────────────╯`)
        }
    }
}
