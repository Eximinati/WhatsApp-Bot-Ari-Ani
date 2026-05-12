import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'enable',
            description: 'Enables the given command globally',
            category: 'config',
            dm: true,
            usage: `${client.config.prefix}enable [command]`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const key = joined.toLowerCase().trim()
        if (!key) return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  ENABLE                │\n├──────────────────────────────┤\n│ Usage: *${this.client.config.prefix}enable <cmd>*│\n╰──────────────────────────────╯`)
        if (key === 'chatbot') {
            const d = await this.client.getFeatures('chatbot')
            if (d.state) return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  ENABLE                │\n├──────────────────────────────┤\n│ ⚠️ Chatbot already active     │\n╰──────────────────────────────╯`)
            await this.client.DB.feature.updateOne({ feature: 'chatbot' }, { $set: { state: true } })
            this.client.features.set('chatbot', true)
            return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  ENABLE                │\n├──────────────────────────────┤\n│ ✅ Chatbot is now active       │\n╰──────────────────────────────╯`)
        }
        const cmd = this.handler.commands.get(key) || this.handler.aliases.get(key)
        if (!cmd) return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  ENABLE                │\n├──────────────────────────────┤\n│ ❌ No command: *${key.padEnd(20).slice(0,20)}│\n╰──────────────────────────────╯`)
        if (!(await this.client.DB.disabledcommands.findOne({ command: cmd.config.command })))
            return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  ENABLE                │\n├──────────────────────────────┤\n│ ✅ Already enabled             │\n╰──────────────────────────────╯`)
        await this.client.DB.disabledcommands.deleteOne({ command: cmd.config.command })
        let text = `╭──────────────────────────────╮\n│      ⚙️  ENABLED                │\n├──────────────────────────────┤\n│ ✅ *${cmd.config.command.padEnd(26).slice(0,26)}│\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
