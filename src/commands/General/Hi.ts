import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'hi',
            description: 'Check if bot is up and running',
            category: 'general',
            usage: `${client.config.prefix}hi`,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const tag = M.chat === 'dm' ? 'Hello' : 'Hey'
        let text = `╭──────────────────────────────╮\n`
        text += `│      👋  ${tag}!               │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 📋 *Status:* ✅ Online         │\n`
        text += `│ 👤 *User:* ${M.sender.username.padEnd(22).slice(0,22)}│\n`
        text += `│ 💬 *Chat:* ${(M.chat === 'dm' ? 'Private' : 'Group').padEnd(22)}│\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 💡 Use *${this.client.config.prefix}help*         │\n`
        text += `╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
