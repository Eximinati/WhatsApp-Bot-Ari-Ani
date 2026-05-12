import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'profile',
            description: 'Display user profile',
            category: 'general',
            usage: `${client.config.prefix}profile (@tag)`,
            aliases: ['p'],
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            if (M.quoted?.sender) {
                M.mentioned.push(M.quoted.sender)
            }

            const user =
                M.mentioned[0] || M.sender.jid

            let username =
                user === M.sender.jid
                    ? M.sender.username
                    : ''

            if (!username) {
                const contact =
                    this.client.getContact(user)

                username =
                    contact?.notify ||
                    contact?.vname ||
                    contact?.name ||
                    user.split('@')[0]
            }

            const [
                profilePicture,
                userData,
                statusData
            ] = await Promise.all([
                this.client.getProfilePicture(user),
                this.client.getUser(user),
                this.client
                    .getStatus(user)
                    .catch(() => ({
                        status: 'None'
                    }))
            ])

            const isAdmin =
                M.groupMetadata?.admins?.includes(user) ||
                false

            const profileText =
`👤 USER PROFILE

🎋 Username:
➜ ${username}

🎫 Bio:
➜ ${statusData.status || 'None'}

🌟 XP:
➜ ${userData.Xp || 0}

👑 Admin:
➜ ${isAdmin ? 'Yes' : 'No'}

🚫 Banned:
➜ ${userData.ban ? 'Yes' : 'No'}
`

            if (profilePicture) {
                await this.client.sendMessage(
                    M.from,
                    {
                        image: { url: profilePicture },
                        caption: profileText
                    },
                    {
                        quoted: M.message
                    }
                )

                return
            }

            await M.reply(profileText)
        } catch (error) {
            console.error(error)

            await M.reply(
                `❌ Error: ${
                    error instanceof Error
                        ? error.message
                        : String(error)
                }`
            )
        }
    }
}
