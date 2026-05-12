import { GroupSettingChange } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            adminOnly: true, command: 'open',
            description: 'Opens the group for all participants',
            category: 'moderation',
            usage: `${client.config.prefix}open`, baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.groupMetadata) return void M.reply(`╭──────────────────────────────╮\n│      🔓  OPEN                  │\n├──────────────────────────────┤\n│ ❌ Groups only                 │\n╰──────────────────────────────╯`)
        if (!this.client.isBotAdmin(M.groupMetadata))
            return void M.reply(`╭──────────────────────────────╮\n│      🔓  OPEN                  │\n├──────────────────────────────┤\n│ 🔒 I need to be admin         │\n╰──────────────────────────────╯`)
        if (!M.groupMetadata.announce) return void M.reply(`╭──────────────────────────────╮\n│      🔓  OPEN                  │\n├──────────────────────────────┤\n│ ⚠️ Group already open         │\n╰──────────────────────────────╯`)
        await this.client.groupSettingChange(M.from, GroupSettingChange.messageSend, false)
        return void M.reply(`╭──────────────────────────────╮\n│      🔓  GROUP OPENED          │\n├──────────────────────────────┤\n│ ✅ All members can message now │\n╰──────────────────────────────╯`)
    }
}
