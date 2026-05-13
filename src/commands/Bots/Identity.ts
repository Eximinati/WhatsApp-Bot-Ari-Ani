import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'identity',
            description: "Mod-only: show or reset stored bot identity data for this chat",
            category: 'bots',
            dm: true,
            usage: `${client.config.prefix}identity show | ${client.config.prefix}identity reset`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (
        M: ISimplifiedMessage,
        { args }: IParsedArgs
    ): Promise<void> => {
        const sub = (args[0] || 'show').toLowerCase()

        const kind =
            M.chat === 'group' ? 'group' : 'user'

        const jid =
            M.chat === 'group'
                ? M.from
                : M.sender.jid

        if (sub === 'reset') {
            await this.client.identity.reset(jid, kind)

            return void M.reply(
                '✅ Identity data has been reset.'
            )
        }

        if (sub === 'show') {
            const delta =
                await this.client.identity.getDelta(
                    jid,
                    kind
                )

            const text =
`🧠 Identity Data (${kind})

📖 Lore:
${delta.lore.length ? delta.lore.map(l => `• ${l}`).join('\n') : '• none'}

🏷 Topics:
${delta.topics.length ? delta.topics.join(', ') : 'none'}

🎨 Style Notes:
${delta.styleChat.length ? delta.styleChat.map(s => `• ${s}`).join('\n') : '• none'}

🔄 Reset:
Use ${this.client.config.prefix}identity reset`

            return void M.reply(text)
        }

        return void M.reply(
            `Usage:\n` +
            `${this.client.config.prefix}identity show\n` +
            `${this.client.config.prefix}identity reset`
        )
    }
}
