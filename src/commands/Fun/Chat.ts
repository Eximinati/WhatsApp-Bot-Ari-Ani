import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'chat',
            description: 'Chat with the bot. Mods can enable/disable chat.',
            aliases: ['bot'],
            category: 'fun',
            dm: true,
            usage: `${client.config.prefix}chat <text> | ${client.config.prefix}chat start | ${client.config.prefix}chat stop`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage, { args, joined }: IParsedArgs): Promise<void> => {
        const sub = (args[0] || '').toLowerCase()

    
        if (sub === 'start' || sub === 'stop') {
            if (!this.client.isMod(M.sender.jid)) {
                return void M.reply(`Only mods can ${sub} chat here.`)
            }

            const enable = sub === 'start'

            if (M.chat === 'group') {
                await this.client.setChatEnabled(M.from, enable, 'group')
            } else {
                await this.client.setChatEnabled(M.sender.jid, enable, 'user')
                if (!enable) this.client.chatAI.forget(M.from)
            }

            return void M.reply(
                enable
                    ? 'Chat is now enabled.'
                    : 'Chat has been disabled.'
            )
        }

        const text = joined.trim()

        if (!text) {
            return void M.reply(
                `Usage:\n${this.client.config.prefix}chat <message>\n\n` +
                `Mods:\n${this.client.config.prefix}chat start\n${this.client.config.prefix}chat stop`
            )
        }

        
        if (M.chat === 'group') {
            const group = await this.client.getGroupData(M.from)
            if (!group.chatEnabled) {
                return void M.reply('Chat is not enabled in this group.')
            }
        }


        const quota = await this.client.consumeChatQuota(M.sender.jid)
        if (!quota.allowed) {
            return void M.reply(
                `You reached your daily limit (${quota.limit}). Ask a mod to extend it.`
            )
        }

        
        const result = await this.client.chatAI.chat({
            jid: M.from,
            kind: M.chat === 'group' ? 'group' : 'user',
            senderName: M.sender.username,
            text
        })

        if (!result.ok) {
            return void M.reply(`Error: ${result.error || 'Unknown error'}`)
        }

        return void M.reply(result.reply || 'No response')
    }
}
