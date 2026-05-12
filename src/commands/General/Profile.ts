import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'profile',
            description: 'Displays user-profile',
            category: 'general',
            usage: `${client.config.prefix}profile (@tag)`,
            aliases: ['p'],
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (M.quoted?.sender) M.mentioned.push(M.quoted.sender)
        const user = M.mentioned[0] || M.sender.jid
        let username = user === M.sender.jid ? M.sender.username : ''
        if (!username) {
            const c = this.client.getContact(user)
            username = c.notify || c.vname || c.name || user.split('@')[0]
        }
        const [pfp, data, st] = await Promise.all([
            this.client.getProfilePicture(user),
            this.client.getUser(user),
            this.client.getStatus(user).catch(() => ({ status: 'None' }))
        ])
        const isAdmin = M.groupMetadata?.admins?.includes(user) || false
        const profile = `╭──────────────────────────────╮\n│      👤  USER PROFILE          │\n├──────────────────────────────┤\n│ 🎋 *${username.padEnd(27).slice(0,27)}│\n│ 🎫 ${(st.status || 'None').substring(0,26).padEnd(27)}│\n│ 🌟 *XP:* ${String(data.Xp || 0).padEnd(23)}│\n│ 👑 *Admin:* ${(isAdmin ? 'Yes' : 'No').padEnd(20)}│\n│ ❌ *Ban:* ${(data.ban ? 'Yes' : 'No').padEnd(21)}│\n╰──────────────────────────────╯`
        if (pfp) await M.reply(pfp, undefined, undefined, profile as any)
        else await M.reply(profile)
    }
}
