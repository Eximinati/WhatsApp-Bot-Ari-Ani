import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'shorten', description: 'Shorten a URL',
            category: 'social', usage: `${client.config.prefix}shorten <url>`,
            aliases: ['short', 'url'], baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        let url = joined.trim()
        if (!url) return void M.reply(`╭──────────────────────────────╮\n│      🔗  SHORTEN               │\n├──────────────────────────────┤\n│ Usage: *${this.client.config.prefix}shorten <url>*│\n╰──────────────────────────────╯`)
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url
        try {
            await M.reply('🔗 *Shortening...*')
            const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`)
            const s = (await res.text()).trim()
            if (!s.startsWith('https://is.gd/')) throw new Error()
            let text = `╭──────────────────────────────╮\n│      🔗  SHORTENED             │\n├──────────────────────────────┤\n│ 📎 ${url.substring(0,26).padEnd(26)}│\n│ ✨ ${s.substring(0,26).padEnd(26)}│\n╰──────────────────────────────╯`
            return void M.reply(text)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      🔗  SHORTEN               │\n├──────────────────────────────┤\n│ ❌ Failed to shorten           │\n╰──────────────────────────────╯`)
        }
    }
}
