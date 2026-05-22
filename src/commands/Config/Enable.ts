import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'enable',
            description: 'Enable a command or feature globally',
            category: 'config',
            dm: true,
            usage: `${client.config.prefix}enable <command>`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (
        M: ISimplifiedMessage,
        { joined }: IParsedArgs
    ): Promise<void> => {
        const key =
            joined.toLowerCase().trim()

        if (!key) {
            return void M.reply(
                `❌ Usage:\n${this.client.config.prefix}enable <command>`
            )
        }

        // CHATBOT ENABLE
        if (key === 'chatbot') {
            const feature =
                await this.client.getFeatures(
                    'chatbot'
                )

            if (feature.state) {
                return void M.reply(
                    '⚠️ Chatbot is already enabled.'
                )
            }

            await this.client.toggleFeature('chatbot', true)

            return void M.reply(
                '✅ Chatbot has been enabled.'
            )
        }

        // COMMAND ENABLE
        const cmd =
            this.handler.commands.get(key) ||
            this.handler.aliases.get(key)

        if (!cmd) {
            return void M.reply(
                `❌ Command not found: ${key}`
            )
        }

        if (!(await this.client.isCommandDisabled(cmd.config.command))) {
            return void M.reply(
                '⚠️ This command is already enabled.'
            )
        }

        await this.client.enableCommand(cmd.config.command)

        this.handler.invalidateDisabledCommandCache(cmd.config.command)

        const text =
`⚙️ COMMAND ENABLED

✅ Command:
${cmd.config.command}`

        return void M.reply(text)
    }
}
