import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    cats = ['technology', 'science', 'gaming', 'business', 'health', 'entertainment']
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'news', description: 'Get latest news headlines',
            category: 'social', usage: `${client.config.prefix}news [category]`,
            aliases: [], baseXp: 15
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        let cat = joined.trim().toLowerCase()
        if (cat && !this.cats.includes(cat)) return void M.reply(`╭──────────────────────────────╮\n│      📰  NEWS                  │\n├──────────────────────────────┤\n│ ❌ *${cat.padEnd(25).slice(0,25)}│\n│ Available: ${this.cats.join(', ').substring(0,18)}│\n╰──────────────────────────────╯`)
        if (!cat) cat = 'technology'
        try {
            await M.reply('📰 *Fetching...*')
            const res = await fetch(`https://saurav.tech/NewsAPI/top-headlines/category/${cat}/us.json`)
            const data = await res.json() as { articles?: Array<{ title?: string; url?: string; source?: { name?: string } }> }
            const articles = data.articles?.slice(0, 3) || []
            if (!articles.length) return void M.reply(`╭──────────────────────────────╮\n│      📰  NEWS                  │\n├──────────────────────────────┤\n│ 📭 No news for *${cat.padEnd(18).slice(0,18)}│\n╰──────────────────────────────╯`)
            let text = `╭──────────────────────────────╮\n│      📰  TOP HEADLINES          │\n├──────────────────────────────┤\n`
            articles.forEach((a, i) => {
                const t = (a.title || '').substring(0, 24).padEnd(24)
                text += `│ #${i + 1} ${t}│\n`
            })
            text += `╰──────────────────────────────╯`
            return void M.reply(text)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      📰  NEWS                  │\n├──────────────────────────────┤\n│ ❌ Failed to fetch             │\n╰──────────────────────────────╯`)
        }
    }
}
