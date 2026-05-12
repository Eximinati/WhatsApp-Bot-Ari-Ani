import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

interface AdviceResponse {
    slip?: {
        advice?: string
    }
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'advice',
            description: 'Get a random piece of advice',
            category: 'fun',
            usage: `${client.config.prefix}advice`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const res = await fetch('https://api.adviceslip.com/advice')
            const data = (await res.json()) as AdviceResponse

            const advice = data.slip?.advice ?? 'No advice found.'

            const text = [
                '💡 Advice',
                '',
                advice
            ].join('\n')

            return void M.reply(text)
        } catch {
            return void M.reply('❌ Failed to fetch advice. Try again later.')
        }
    }
}
