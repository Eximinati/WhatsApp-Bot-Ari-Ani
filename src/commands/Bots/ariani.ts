import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ariani',
            description: 'Displays the Ari-Ani bot info',
            category: 'bots',
            usage: `${client.config.prefix}ariani`,
            baseXp: 100
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        let text = `╭──────────────────────────────╮\n`
        text += `│      ☁️  ARI-ANI              │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 🍀 Multi-Purpose Bot          │\n`
        text += `│    Biggest User Base          │\n`
        text += `│                              │\n`
        text += `│ 🌐 *GitHub:*                  │\n`
        text += `│ github.com/Eximinati/         │\n`
        text += `│ Whatsapp-bot-Ari-Ani          │\n`
        text += `╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
