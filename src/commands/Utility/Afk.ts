import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'afk', description: 'Set your AFK status',
            category: 'utility', usage: `${client.config.prefix}afk [reason]`,
            aliases: ['away', 'busy'], baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const reason = joined.trim() || 'Away from keyboard'
        const map = (this.client as any).afkUsers as Map<string, { reason: string; time: number }> | undefined
        if (map?.has(M.sender.jid)) return void M.reply(`╭──────────────────────────────╮\n│      📴  ALREADY AFK           │\n├──────────────────────────────┤\n│ 📝 ${(map.get(M.sender.jid)?.reason || '').substring(0,26).padEnd(26)}│\n│ 💡 Use *${this.client.config.prefix}back*     │\n╰──────────────────────────────╯`)
        if (!map) (this.client as any).afkUsers = new Map()
        ;(this.client as any).afkUsers.set(M.sender.jid, { reason, time: Date.now() })
        let text = `╭──────────────────────────────╮\n│      📴  AFK SET               │\n├──────────────────────────────┤\n│ 👤 ${M.sender.username.padEnd(26).slice(0,26)}│\n│ 📝 ${reason.substring(0,26).padEnd(26)}│\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
