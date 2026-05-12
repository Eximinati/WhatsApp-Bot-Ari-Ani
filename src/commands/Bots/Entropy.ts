import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'entropy',
            description: 'Displays the bot info',
            category: 'bots',
            usage: `${client.config.prefix}entropy`,
            baseXp: 100
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        let text = `╭──────────────────────────────╮\n`
        text += `│      👾  ENTROPY              │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 🍀 Multi-Device WhatsApp Bot  │\n`
        text += `│                              │\n`
        text += `│ 🌐 *GitHub:*                  │\n`
        text += `│ github.com/Eximinati/         │\n`
        text += `│ Whatsapp-bot-Ari-Ani          │\n`
        text += `╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
