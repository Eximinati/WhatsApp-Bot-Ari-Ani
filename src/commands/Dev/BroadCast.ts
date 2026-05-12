import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

const sleep = (ms: number) =>
    new Promise<void>((r) => setTimeout(r, ms))

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'broadcast',
            description: 'Send a message to all group chats',
            aliases: ['bc', 'announcement'],
            category: 'dev',
            usage: `${client.config.prefix}broadcast <message>`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (
        M: ISimplifiedMessage,
        { joined }: IParsedArgs
    ): Promise<void> => {
        const message = joined.trim()

        if (!message) {
            return void M.reply(
                `❌ Usage:\n${this.client.config.prefix}broadcast <message>`
            )
        }

        const groups = Array.from(this.client.chats).filter(
            (jid) => jid.endsWith('@g.us')
        )

        if (!groups.length) {
            return void M.reply(
                '❌ No group chats found.'
            )
        }

        const text =
`📢 BROADCAST MESSAGE

${message}

— ${M.pushName || M.sender.username}`

        let sent = 0
        let failed = 0

        for (const jid of groups) {
            try {
                await this.client.sendMessage(
                    jid,
                    { text }
                )

                sent++
            } catch {
                failed++
            }

            await sleep(1500)
        }

        await M.reply(
            `📡 Broadcast complete\n\nSent: ${sent}\nFailed: ${failed}`
        )
    }
}
