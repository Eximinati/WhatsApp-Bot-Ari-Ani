import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { computeRizz, normalizeJid } from '../../core/Ship/index.js'
import { MessageType } from '../../core/types.js'

const tagFor = (jid: string): string => `@${jid.split('@')[0]}`

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'shiprank',
            description: 'Show rizz breakdown for a user',
            aliases: ['rizz'],
            category: 'fun',
            usage: `${client.config.prefix}shiprank [tag/quote user]`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const target =
            normalizeJid(M.quoted?.sender || M.mentioned[0] || M.sender.jid) ||
            M.sender.jid

        const b = await computeRizz(this.client, target)

        const text =
`✨ Rizz Sheet for ${tagFor(target)}

Score: ${b.score}%

Base rizz: ${b.base}
Outsiders: ${b.outsiderCount} (+${b.outsiderTerm})
Bonds: ${b.bondCount} (+${b.bondTerm})`

        return void M.reply(text, MessageType.text, undefined, [target])
    }
}
