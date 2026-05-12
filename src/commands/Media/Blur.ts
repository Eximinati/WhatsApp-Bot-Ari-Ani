import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { Jimp } from 'jimp'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'blur',
            description: 'Blurs the given image or pfp',
            category: 'media',
            usage: `${client.config.prefix}blur [(as caption | quote)[image] | @mention]`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const image = await (M.WAMessage?.message?.imageMessage
            ? this.client.downloadMediaMessage(M.WAMessage)
            : M.quoted?.message?.message?.imageMessage
              ? this.client.downloadMediaMessage(M.quoted.message)
              : M.mentioned[0]
                ? this.client.getProfilePicture(M.mentioned[0])
                : this.client.getProfilePicture(M.quoted?.sender || M.sender.jid))
        if (!image) return void M.reply(`Couldn't fetch the required Image`)
        const level = joined.trim() || '5'
        try {
            const img = await Jimp.read(image)
            img.blur(isNaN(level as unknown as number) ? 5 : parseInt(level))
            const buffer = await img.getBuffer('image/png')
            await M.reply(buffer, MessageType.image)
        } catch (err) {
            await M.reply(err instanceof Error ? err.message : `Couldn't blur the image`)
        }
    }
}
