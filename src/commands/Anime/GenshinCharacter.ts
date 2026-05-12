import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import request, { firstOk } from '../../core/request.js'

interface GenshinCharacter {
    name: string
    vision?: string
    weapon?: string
    nation?: string
    affiliation?: string
    constellation?: string
    rarity?: number | string
    birthday?: string
    description?: string
}

const sources = {
    list: [
        'https://genshin.jmp.blue/characters',
        'https://api.genshin.dev/characters'
    ],
    detail: (slug: string) => [
        `https://genshin.jmp.blue/characters/${slug}`,
        `https://api.genshin.dev/characters/${slug}`
    ]
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'genshincharacter',
            description: 'Get details of a Genshin Impact character',
            aliases: ['gchar', 'genshin'],
            category: 'anime',
            usage: `${client.config.prefix}gchar [name]`,
            baseXp: 50
        })
    }

    run = async (
        M: ISimplifiedMessage,
        { joined }: IParsedArgs
    ): Promise<void> => {
        try {
            if (!joined) {
                const list =
                    await firstOk<string[]>(
                        sources.list.map(
                            (u) => () =>
                                request.json<string[]>(u)
                        )
                    )

                if (!list.ok) {
                    return void M.reply(
                        "❌ Couldn't fetch character list."
                    )
                }

                return void M.reply(
                    `📒 Genshin Characters:\n\n${list.value.join(
                        ', '
                    )}`
                )
            }

            const slug = joined
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '-')

            const detail =
                await firstOk<GenshinCharacter>(
                    sources.detail(slug).map(
                        (u) => () =>
                            request.json<GenshinCharacter>(
                                u
                            )
                    )
                )

            if (!detail.ok) {
                return void M.reply(
                    `❌ Character "${joined}" not found.\n\n💡 Tip: Use ${this.client.config.prefix}gchar to view valid names.`
                )
            }

            const r = detail.value

            const text =
`💎 Genshin Character

👤 Name:
➜ ${r.name}

💠 Vision:
➜ ${r.vision || '—'}

⚔ Weapon:
➜ ${r.weapon || '—'}

⛩ Nation:
➜ ${r.nation || '—'}

🏛 Affiliation:
➜ ${r.affiliation || '—'}

✨ Constellation:
➜ ${r.constellation || '—'}

⭐ Rarity:
➜ ${r.rarity ?? '—'} stars

🎂 Birthday:
➜ ${r.birthday || '—'}

📖 Description:
➜ ${r.description || '—'}`

            await M.reply(text)
        } catch (error) {
            console.error(error)

            await M.reply(
                `❌ Error: ${
                    error instanceof Error
                        ? error.message
                        : String(error)
                }`
            )
        }
    }
}
