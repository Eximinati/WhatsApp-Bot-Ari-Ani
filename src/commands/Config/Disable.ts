import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'disable',
            description: 'Disable a command or feature globally',
            category: 'config',
            dm: true,
            usage: `${client.config.prefix}disable <command> | <reason>`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (
        M: ISimplifiedMessage,
        { joined }: IParsedArgs
    ): Promise<void> => {
        const [keyPart, ...reasonParts] =
            joined.split('|')

        const key =
            keyPart?.toLowerCase().trim()

        if (!key) {
            return void M.reply(
                `❌ Usage:\n${this.client.config.prefix}disable <command>`
            )
        }

        // CHATBOT TOGGLE
        if (key === 'chatbot') {
            const feature =
                await this.client.getFeatures(
                    'chatbot'
                )

            if (!feature.state) {
                return void M.reply(
                    '⚠️ Chatbot is already disabled.'
                )
            }

            await this.client.DB.feature.updateOne(
                { feature: 'chatbot' },
                { $set: { state: false } }
            )

            this.client.features.set(
                'chatbot',
                false
            )

            return void M.reply(
                '✅ Chatbot has been disabled.'
            )
        }

        // COMMAND DISABLE
        const cmd =
            this.handler.commands.get(key) ||
            this.handler.aliases.get(key)

        if (!cmd) {
            return void M.reply(
                `❌ Command not found: ${key}`
            )
        }

        const exists =
            await this.client.DB.disabledcommands.findOne(
                { command: cmd.config.command }
            )

        if (exists) {
            return void M.reply(
                '⚠️ This command is already disabled.'
            )
        }

        await new this.client.DB.disabledcommands({
            command: cmd.config.command,
            reason:
                reasonParts.join('|').trim() || ''
        }).save()

        this.handler.invalidateDisabledCommandCache(cmd.config.command)

        const text =
`⚙️ COMMAND DISABLED

🚫 Command:
${cmd.config.command}

📝 Reason:
${reasonParts.join('|').trim() || 'none'}`

        return void M.reply(text)
    }
}
