import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'disable',
            description: 'Disables the given command globally',
            category: 'config',
            dm: true,
            usage: `${client.config.prefix}disable [command] | (reason)`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const [keyPart, ...reasonParts] = joined.split('|')
        const key = keyPart.toLowerCase().trim()
        if (!key) return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  DISABLE               │\n├──────────────────────────────┤\n│ Usage: *${this.client.config.prefix}disable <cmd>*│\n╰──────────────────────────────╯`)
        if (key === 'chatbot') {
            const d = await this.client.getFeatures('chatbot')
            if (!d.state) return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  DISABLE               │\n├──────────────────────────────┤\n│ ⚠️ Chatbot already inactive   │\n╰──────────────────────────────╯`)
            await this.client.DB.feature.updateOne({ feature: 'chatbot' }, { $set: { state: false } })
            this.client.features.set('chatbot', false)
            return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  DISABLE               │\n├──────────────────────────────┤\n│ ✅ Chatbot is now inactive     │\n╰──────────────────────────────╯`)
        }
        const cmd = this.handler.commands.get(key) || this.handler.aliases.get(key)
        if (!cmd) return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  DISABLE               │\n├──────────────────────────────┤\n│ ❌ No command: *${key.padEnd(20).slice(0,20)}│\n╰──────────────────────────────╯`)
        if (await this.client.DB.disabledcommands.findOne({ command: cmd.config.command }))
            return void M.reply(`╭──────────────────────────────╮\n│      ⚙️  DISABLE               │\n├──────────────────────────────┤\n│ ⚠️ Already disabled            │\n╰──────────────────────────────╯`)
        await new this.client.DB.disabledcommands({
            command: cmd.config.command,
            reason: (reasonParts.join('|') || '').trim() || ''
        }).save()
        let text = `╭──────────────────────────────╮\n│      ⚙️  DISABLED               │\n├──────────────────────────────┤\n│ ✅ *${cmd.config.command.padEnd(26).slice(0,26)}│\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
