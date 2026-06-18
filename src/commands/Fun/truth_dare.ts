import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import TD from 'better-tord'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'truth_dare',
            aliases: ['td'],
            category: 'fun',
            description: 'Gives you a truth or dare question',
            usage: `${client.config.prefix}truth_dare <truth|dare>`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const arg = joined.trim().toLowerCase()

        if (!arg) {
            return void M.reply(
                `🔴 Sorry you did not give any search term! e.g use *${this.client.config.prefix}truth_dare truth*`
            )
        }

        const Available = ['truth', 'dare']
        if (!Available.includes(arg)) {
            return void M.reply(
                `🔴 Please provide a valid term\n\n*Available:* \n${Available.join('\n')}`
            )
        }

        try {
            const result = arg === 'truth' ? await TD.get_truth() : await TD.get_dare()
            return void M.reply(result)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Something went wrong.'
            return void M.reply(`❌ ${msg}`)
        }
    }
}
