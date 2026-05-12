import { GroupSettingChange } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            adminOnly: true, command: 'close',
            description: 'Close the group for all participants',
            category: 'moderation',
            usage: `${client.config.prefix}close`, baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.groupMetadata) return void M.reply(`╭──────────────────────────────╮\n│      🔒  CLOSE                 │\n├──────────────────────────────┤\n│ ❌ Groups only                 │\n╰──────────────────────────────╯`)
        if (!this.client.isBotAdmin(M.groupMetadata))
            return void M.reply(`╭──────────────────────────────╮\n│      🔒  CLOSE                 │\n├──────────────────────────────┤\n│ 🔒 I need to be admin         │\n╰──────────────────────────────╯`)
        if (M.groupMetadata.announce) return void M.reply(`╭──────────────────────────────╮\n│      🔒  CLOSE                 │\n├──────────────────────────────┤\n│ ⚠️ Group already closed       │\n╰──────────────────────────────╯`)
        await this.client.groupSettingChange(M.from, GroupSettingChange.messageSend, true)
        return void M.reply(`╭──────────────────────────────╮\n│      🔒  GROUP CLOSED          │\n├──────────────────────────────┤\n│ ✅ Only admins can message now │\n╰──────────────────────────────╯`)
    }
}
