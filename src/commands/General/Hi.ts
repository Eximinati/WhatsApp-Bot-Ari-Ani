import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'hi',
            description: 'Check if the bot is online',
            category: 'general',
            usage: `${client.config.prefix}hi`,
            aliases: ['hello', 'ping'],
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const greeting =
            M.chat === 'dm'
                ? 'Hello'
                : 'Hey'

        const username =
            M.pushName ||
            M.sender?.username ||
            M.sender?.split('@')[0] ||
            'User'

        const chatType =
            M.chat === 'dm'
                ? 'Private Chat'
                : 'Group Chat'

        const text =
`👋 ${greeting} ${username}

📋 Status: ✅ Online
💬 Chat Type: ${chatType}

💡 Use ${this.client.config.prefix}help to view commands.`

        await M.reply(text)
    }
}
