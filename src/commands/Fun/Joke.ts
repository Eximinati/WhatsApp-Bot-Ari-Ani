import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

interface JokeApiResponse {
    category?: string
    type: 'single' | 'twopart'
    joke?: string
    setup?: string
    delivery?: string
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'joke',
            description: 'Sends a random joke for you',
            category: 'fun',
            usage: `${client.config.prefix}joke`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const response = await fetch('https://v2.jokeapi.dev/joke/Any')
            const data = (await response.json()) as JokeApiResponse

            let jokeText = ''

            if (data.type === 'single') {
                jokeText = data.joke || 'No joke found.'
            } else {
                jokeText = `${data.setup || ''}\n\n${data.delivery || ''}`
            }

            const text =
`🎃 Joke (${data.category || 'Random'})

${jokeText}`

            return void M.reply(text)
        } catch {
            return void M.reply('❌ Failed to fetch joke. Try again later.')
        }
    }
}
