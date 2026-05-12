import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'activate',
            aliases: ['act'],
            description: 'Activate a feature in the group',
            category: 'moderation',
            usage: `${client.config.prefix}activate [feature]`,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const type = joined.toLowerCase().trim()
        if (!type) return void M.reply(`🛡️ *Activate*\n\nUsage: \`${this.client.config.prefix}activate [feature]\`\n\nFeatures: mod, cmd, nsfw, invitelink, events, safe`)
        const data = await this.client.getGroupData(M.from)
        const dataAny = data as any
        if (dataAny[type]) return void M.reply(`╭──────────────────────────────╮\n│      🟩  ACTIVATE               │\n├──────────────────────────────┤\n│ ⚠️ *${this.client.util.capitalize(type).padEnd(25).slice(0,25)}│\n│    Already active               │\n╰──────────────────────────────╯`)
        dataAny[type] = true
        await dataAny.save()
        return void M.reply(`╭──────────────────────────────╮\n│      🟩  ACTIVATED              │\n├──────────────────────────────┤\n│ ✅ *${this.client.util.capitalize(type).padEnd(25).slice(0,25)}│\n│    is now active                │\n╰──────────────────────────────╯`)
    }
}
