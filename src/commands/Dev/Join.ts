import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'join',
            description: 'Join a group using invite link',
            category: 'dev',
            dm: true,
            usage: `${client.config.prefix}join <invite_link>`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        if (!joined.trim()) return void M.reply(`╭──────────────────────────────╮\n│      📥  JOIN GROUP            │\n├──────────────────────────────┤\n│ Usage: *${this.client.config.prefix}join <link>*│\n╰──────────────────────────────╯`)
        try {
            await this.client.groupAcceptInvite(joined.trim())
            return void M.reply(`╭──────────────────────────────╮\n│      📥  JOINED GROUP          │\n├──────────────────────────────┤\n│ ✅ Successfully joined!        │\n╰──────────────────────────────╯`)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      📥  JOIN GROUP            │\n├──────────────────────────────┤\n│ ❌ Invalid link or expired     │\n╰──────────────────────────────╯`)
        }
    }
}
