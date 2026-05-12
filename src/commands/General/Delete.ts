import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'delete',
            description: 'Deletes the quoted Message',
            aliases: ['del'],
            category: 'general',
            usage: `${client.config.prefix}delete`,
            adminOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M?.quoted?.message) return void M.reply(`╭──────────────────────────────╮\n│      🗑️  DELETE                │\n├──────────────────────────────┤\n│ ❌ Quote a message to delete  │\n╰──────────────────────────────╯`)
        if (!this.client.isMe(M.quoted.sender))
            return void M.reply(`╭──────────────────────────────╮\n│      🗑️  DELETE                │\n├──────────────────────────────┤\n│ 🔒 Can only delete my msgs    │\n╰──────────────────────────────╯`)
        await this.client.deleteMessage(M.from, {
            id: (M.quoted.message as any).stanzaId,
            remoteJid: M.from,
            fromMe: true
        })
    }
}
