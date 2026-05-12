import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'deactivate',
            aliases: ['deact'],
            description: 'Deactivate a feature in the group',
            category: 'moderation',
            usage: `${client.config.prefix}deactivate [feature]`,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const type = joined.toLowerCase().trim()
        if (!type) return void M.reply(`🛡️ *Deactivate*\n\nUsage: \`${this.client.config.prefix}deactivate [feature]\`\n\nFeatures: mod, cmd, nsfw, invitelink, events, safe`)
        const data = await this.client.getGroupData(M.from)
        const dataAny = data as any
        if (!dataAny[type]) return void M.reply(`╭──────────────────────────────╮\n│      🟥  DEACTIVATE             │\n├──────────────────────────────┤\n│ ⚠️ *${this.client.util.capitalize(type).padEnd(25).slice(0,25)}│\n│    Already inactive             │\n╰──────────────────────────────╯`)
        dataAny[type] = false
        await dataAny.save()
        return void M.reply(`╭──────────────────────────────╮\n│      🟥  DEACTIVATED            │\n├──────────────────────────────┤\n│ ✅ *${this.client.util.capitalize(type).padEnd(25).slice(0,25)}│\n│    is now inactive              │\n╰──────────────────────────────╯`)
    }
}
