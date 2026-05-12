import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'why',
            description: 'Ask why and get an answer',
            category: 'fun',
            usage: `${client.config.prefix}why`,
            baseXp: 20
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const response = await fetch('https://nekos.life/api/v2/why')
            const data = await response.json() as { why?: string }

            const text =
                `❓ WHY?\n\n` +
                `${data.why || 'Why not?'}`

            return void M.reply(text)
        } catch {
            return void M.reply(`❓ Why? Because... I don't know. Try again later!`)
        }
    }
}
