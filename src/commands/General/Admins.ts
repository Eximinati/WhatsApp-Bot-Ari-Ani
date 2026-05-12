import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'admins',
            description: 'Tags all Admins',
            category: 'general',
            usage: `${client.config.prefix}admins (Message)`,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const text = `╭──────────────────────────────╮\n│      👑  GROUP ADMINS          │\n├──────────────────────────────┤\n│ 📢 *ADMINS! NOTICE*            │\n├──────────────────────────────┤\n│ 🔔 Tags hidden - you're pinged│\n╰──────────────────────────────╯`
        return void M.reply(text, undefined, undefined, M.groupMetadata?.admins)
            .catch((r: any) => M.reply(`❌ Error: ${r}`))
    }
}
