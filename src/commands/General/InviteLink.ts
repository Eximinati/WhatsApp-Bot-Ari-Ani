import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'invitelink',
            aliases: ['invite', 'linkgc'],
            description: 'Get the group invite link',
            category: 'general',
            usage: `${client.config.prefix}invite`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.groupMetadata) return void M.reply("❌ Groups only")
        if (!this.client.isBotAdmin(M.groupMetadata))
            return void M.reply("🔒 I'm not an admin here")
        const gData = await this.client.getGroupData(M.from)
        if (!gData.invitelink)
            return void M.reply(`❌ Use *${this.client.config.prefix}act invitelink* first`)
        const code = await this.client.groupInviteCode(M.from).catch(() => '')
        if (!code) return void M.reply(`╭──────────────────────────────╮\n│      🔗  INVITE LINK           │\n├──────────────────────────────┤\n│ ❌ Could not get link          │\n╰──────────────────────────────╯`)
        let text = `╭──────────────────────────────╮\n│      🔗  INVITE LINK           │\n├──────────────────────────────┤\n│ 🔗 chat.whatsapp.com/${code.padEnd(16).slice(0,16)}│\n├──────────────────────────────┤\n│ ✅ Sent to your DM!            │\n╰──────────────────────────────╯`
        await this.client.sendMessage(M.sender.jid, text, MessageType.text)
        return void M.reply("✅ *Check your DM* for the link")
    }
}
