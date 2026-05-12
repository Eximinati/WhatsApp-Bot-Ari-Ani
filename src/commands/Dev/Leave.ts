import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'leave',
            description: 'Leave the current group',
            category: 'dev',
            usage: `${client.config.prefix}leave`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.groupMetadata) return void M.reply(`╭──────────────────────────────╮\n│      📤  LEAVE                 │\n├──────────────────────────────┤\n│ ❌ Groups only                 │\n╰──────────────────────────────╯`)
        await M.reply(`╭──────────────────────────────╮\n│      👋  GOODBYE!              │\n├──────────────────────────────┤\n│ Leaving *${(M.groupMetadata.subject || '').substring(0,22).padEnd(22)}│\n╰──────────────────────────────╯`)
        await this.client.groupLeave(M.from)
    }
}
