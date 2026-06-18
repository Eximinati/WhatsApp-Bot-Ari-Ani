import google from 'googlethis'
import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'imagesearch',
            aliases: ['imgs'],
            category: 'utility',
            description: 'Searches for an image from Google',
            usage: `${client.config.prefix}imagesearch <search term>`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const term = joined.trim()
        if (!term) {
            return void M.reply('🔴 Sorry you did not give any search term!')
        }

        try {
            const groupData = M.groupMetadata ? await this.client.getGroupData(M.from) : null
            const nsfw = groupData?.nsfw ?? false

            const images = await google.image(term, { safe: !nsfw })
            if (!images || !images.length) {
                return void M.reply('❌ Could not find any images for that search term.')
            }

            const buffer = await this.client.getBuffer(images[0].url)

            return void this.client.sendMessage(M.from, buffer, MessageType.image, {
                caption: `🖼️ *${term}*\n\n🔍 Image search by ${this.client.user.name || 'Ari-Ani Bot'}`,
                quoted: M.WAMessage
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Something went wrong.'
            return void M.reply(`❌ ${msg}`)
        }
    }
}
