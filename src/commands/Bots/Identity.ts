import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'identity',
            description:
                "Mod-only: show or reset what this chat has accumulated about the bot's identity (lore/topics/style).",
            category: 'system',
            dm: true,
            usage: `${client.config.prefix}identity show | ${client.config.prefix}identity reset`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const sub = (args[0] || 'show').toLowerCase()
        const kind = M.chat === 'group' ? 'group' : 'user'
        const jid = M.chat === 'group' ? M.from : M.sender.jid

        if (sub === 'reset') {
            await this.client.identity.reset(jid, kind)
            return void M.reply('Persona reset to defaults.')
        }

        if (sub === 'show') {
            const delta = await this.client.identity.getDelta(jid, kind)
            const lines: string[] = []
            lines.push(`*Accumulated identity for this ${kind}*`)
            lines.push('')
            lines.push(`Lore (${delta.lore.length}):`)
            if (delta.lore.length) for (const l of delta.lore) lines.push(`• ${l}`)
            else lines.push('  (none)')
            lines.push('')
            lines.push(
                `Topics (${delta.topics.length}): ${delta.topics.length ? delta.topics.join(', ') : '(none)'}`
            )
            lines.push('')
            lines.push(`Style notes (${delta.styleChat.length}):`)
            if (delta.styleChat.length) for (const s of delta.styleChat) lines.push(`• ${s}`)
            else lines.push('  (none)')
            lines.push('')
            lines.push(`Reset with ${this.client.config.prefix}identity reset.`)
            return void M.reply(lines.join('\n'))
        }

        return void M.reply(
            `Usage:\n${this.client.config.prefix}identity show — view what this chat has accumulated\n${this.client.config.prefix}identity reset — wipe accumulated lore/topics/style`
        )
    }
}
