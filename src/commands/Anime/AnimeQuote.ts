import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import request, { firstOk } from '../../core/request.js'

interface AnimechanV1 {
    status: string
    data: {
        content: string
        anime: { name: string }
        character: { name: string }
    }
}

interface YurippeQuote {
    quote: string
    show: string
    character: string
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'animequote',
            description: 'Get a random anime quote',
            aliases: ['aq'],
            category: 'anime',
            usage: `${client.config.prefix}animequote`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const result =
            await firstOk<{
                anime: string
                character: string
                quote: string
            }>([
                async () => {
                    const r =
                        await request.json<AnimechanV1>(
                            'https://api.animechan.io/v1/quotes/random'
                        )

                    return {
                        anime:
                            r.data.anime?.name ||
                            'Unknown',
                        character:
                            r.data.character?.name ||
                            'Unknown',
                        quote: r.data.content
                    }
                },
                async () => {
                    const arr =
                        await request.json<
                            YurippeQuote[]
                        >(
                            'https://yurippe.vercel.app/api/quotes?random=1'
                        )

                    const q = arr[0]

                    return {
                        anime: q.show,
                        character: q.character,
                        quote: q.quote
                    }
                }
            ])

        if (!result.ok) {
            return void M.reply(
                "🔍 Couldn't fetch an anime quote right now."
            )
        }

        const { anime, character, quote } =
            result.value

        const text =
`⛩ Anime Quote

🎌 Anime:
➜ ${anime}

🎎 Character:
➜ ${character}

✏ Quote:
➜ ${quote}`

        await M.reply(text)
    }
}
