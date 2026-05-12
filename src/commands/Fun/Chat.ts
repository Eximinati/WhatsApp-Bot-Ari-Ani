import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'chat',
            description: 'Chat with the bot. Mods: !chat start / !chat stop to enable in this chat.',
            aliases: ['bot'],
            category: 'fun',
            dm: true,
            usage: `${client.config.prefix}chat (text) | ${client.config.prefix}chat start | ${client.config.prefix}chat stop`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage, { args, joined }: IParsedArgs): Promise<void> => {
        const sub = (args[0] || '').toLowerCase()

        if (sub === 'start' || sub === 'stop') {
            if (!this.client.isMod(M.sender.jid))
                return void M.reply(`🔒 *Permission Denied*\n\nOnly mods can ${sub} chat in this chat.`)
            const enable = sub === 'start'
            if (M.chat === 'group') {
                await this.client.setChatEnabled(M.from, enable, 'group')
            } else {
                await this.client.setChatEnabled(M.sender.jid, enable, 'user')
                if (!enable) this.client.chatAI.forget(M.from)
            }
            return void M.reply(`╭──────────────────────────────╮\n│      💬  CHAT ${enable ? 'ON' : 'OFF'}               │\n├──────────────────────────────┤\n│ ✅ ${enable ? 'Chat is active!' : 'Chat disabled.'}      │\n╰──────────────────────────────╯`)
        }

        const text = joined.trim()
        if (!text)
            return void M.reply(`💬 *Chat Usage*\n\n\`${this.client.config.prefix}chat <message>\`\n\nMods: \`${this.client.config.prefix}chat start\` | \`${this.client.config.prefix}chat stop\``)

        if (M.chat === 'group') {
            const group = await this.client.getGroupData(M.from)
            if (!group.chatEnabled)
                return void M.reply(`❌ Chat isn't enabled here. A mod must run \`${this.client.config.prefix}chat start\` first.`)
        }

        const quota = await this.client.consumeChatQuota(M.sender.jid)
        if (!quota.allowed)
            return void M.reply(`📊 *Quota Exceeded*\n\nYou've used your ${quota.limit} chat messages for today. A mod can extend with \`${this.client.config.prefix}quota extend\`.`)

        const result = await this.client.chatAI.chat({
            jid: M.from,
            kind: M.chat === 'group' ? 'group' : 'user',
            senderName: M.sender.username,
            text
        })
        if (!result.ok) return void M.reply(`╭──────────────────────────────╮\n│      💬  CHAT ERROR             │\n├──────────────────────────────┤\n│ 🤖 ${(result.error || '').substring(0,28).padEnd(28)}│\n╰──────────────────────────────╯`)
        let text2 = `╭──────────────────────────────╮\n│      💬  AI RESPONSE            │\n├──────────────────────────────┤\n│ ${(result.reply || '').substring(0,28).padEnd(28)}│\n╰──────────────────────────────╯`
        return void M.reply(text2)
    }
}
