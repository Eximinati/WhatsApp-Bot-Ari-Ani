import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'mods',
            description: "Display moderators' contact info",
            category: 'core',
            usage: `${client.config.prefix}mods`,
            aliases: ['moderators', 'mod', 'owner'],
            baseXp: 40
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const mods =
                this.client.config.mods || []

            if (!mods.length) {
                return void M.reply(
                    '❌ No moderators have been configured.'
                )
            }

            let text =
`🛡️ BOT MODERATORS

`

            mods.forEach((jid, index) => {
                const info =
                    this.client.getContact(jid)

                const name =
                    info?.notify ||
                    info?.vname ||
                    info?.name ||
                    jid.split('@')[0]

                const number =
                    jid.split('@')[0]

                text +=
`👤 Moderator ${index + 1}
➜ ${name}
📞 https://wa.me/${number}

`
            })

            text +=
`⚡ Contact moderators only when necessary.`

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
