import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'everyone',
            description: 'Tags all users in group chat',
            aliases: ['all', 'tagall'], category: 'general',
            usage: `${client.config.prefix}everyone`, adminOnly: true, baseXp: 20
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.groupMetadata) return void M.reply(`╭──────────────────────────────╮\n│      📢  EVERYONE              │\n├──────────────────────────────┤\n│ ❌ Groups only                 │\n╰──────────────────────────────╯`)
        const participants = M.groupMetadata.participants.map(String)
        let text = `╭──────────────────────────────╮\n│      📢  EVERYONE!             │\n├──────────────────────────────┤\n│ 🔔 *${(M.groupMetadata.subject || 'Group').substring(0,24).padEnd(24)}│\n│ 👥 ${String(participants.length).padEnd(27)}│\n╰──────────────────────────────╯`
        return void M.reply(text, undefined, undefined, participants)
            .catch((r: any) => M.reply(`❌ Error: ${r}`))
    }
}
