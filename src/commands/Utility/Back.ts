import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'back', description: 'Remove your AFK status',
            category: 'utility', usage: `${client.config.prefix}back`,
            aliases: [], baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage, _parsedArgs: IParsedArgs): Promise<void> => {
        const map = (this.client as any).afkUsers as Map<string, { reason: string; time: number }> | undefined
        if (!map || !map.has(M.sender.jid)) return void M.reply(`╭──────────────────────────────╮\n│      ❌  NOT AFK               │\n├──────────────────────────────┤\n│ 💡 Use *${this.client.config.prefix}afk <reason>*│\n╰──────────────────────────────╯`)
        const entry = map.get(M.sender.jid)!
        const dur = Math.floor((Date.now() - entry.time) / 60000)
        map.delete(M.sender.jid)
        let text = `╭──────────────────────────────╮\n│      ✅  WELCOME BACK           │\n├──────────────────────────────┤\n│ 👤 ${M.sender.username.padEnd(26).slice(0,26)}│\n│ 📴 Was away: ${String(dur).padEnd(18)} mins│\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
