import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import request from '../../core/request.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'jail',
            description: 'Send a user (or yourself) to jail — overlays bars on the avatar',
            category: 'fun',
            usage: `${client.config.prefix}jail [@mention | reply]`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const targetJid =
            M.mentioned[0] || M.quoted?.sender || M.sender.jid

        let avatarUrl: string | undefined
        try {
            avatarUrl = await this.client.getProfilePictureUrl(targetJid)
        } catch {
            avatarUrl = undefined
        }

        if (!avatarUrl) {
            return void M.reply(
                `Can't fetch profile picture for this user.`
            )
        }

        try {
            const buffer = await request.buffer(
                `https://api.popcat.xyz/jail?image=${encodeURIComponent(avatarUrl)}`
            )

            return void M.reply(
                buffer,
                MessageType.image,
                undefined,
                [targetJid],
                '🚓 Jail time'
            )
        } catch {
            return void M.reply('❌ Failed to generate jail image.')
        }
    }
}
