import { MessageType } from '../../core/types.js'
import { Sticker, StickerTypes, Categories } from 'wa-sticker-formatter'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'sticker',
            aliases: ['s'],
            description: 'Converts an image or video into a sticker',
            category: 'media',
            usage: `${client.config.prefix}sticker <pack>|<author>`,
            baseXp: 30,
            since: '2026-05-17'
        })
    }

    run = async (M: ISimplifiedMessage, { joined: arg }: IParsedArgs): Promise<void> => {
        try {
            const isMedia = M.type === 'imageMessage' || M.type === 'videoMessage'

            // Check if it's a reply to media by examining the quoted message structure
            let isQuotedMedia = false
            if (M.quoted?.message) {
                const quotedMsg = M.quoted.message
                // Check if quoted message contains image or video
                if (quotedMsg.message?.imageMessage || quotedMsg.message?.videoMessage) {
                    isQuotedMedia = true
                }
            }

            if (!isMedia && !isQuotedMedia) {
                return void M.reply('📸 Please reply to or send an image/video to make a sticker.')
            }

            const [packName, authorName] = arg ? arg.split('|').map((a: string) => a?.trim()) : []

            // Download media - need to handle both cases
            let media: Buffer | undefined
            try {
                if (isQuotedMedia && M.quoted?.message) {
                    // For quoted media, download from the quoted message
                    media = await this.client.downloadMediaMessage(M.quoted.message)
                } else if (isMedia) {
                    // For direct media, download from the current message
                    media = await this.client.downloadMediaMessage(M.WAMessage)
                }
            } catch (downloadError) {
                console.error('Download error:', downloadError)
                return void M.reply('⚠️ Failed to download media. Please try again.')
            }

            if (!media) {
                return void M.reply('⚠️ Failed to download media. Please try again.')
            }

            await M.reply('🛠️ Making your sticker...')

            // Sticker style selection
            const style = arg?.includes('--crop')
                ? StickerTypes.CROPPED
                : arg?.includes('--circle')
                ? StickerTypes.CIRCLE
                : StickerTypes.FULL

            const sticker = new Sticker(media, {
                pack: packName || 'Deryl',
                author: authorName || '💚',
                type: style,
                categories: ['✨', '🔥'] as Categories[],
                quality: 80
            })

            const stickerBuffer = await sticker.toBuffer()

            await this.client.sendMessage(M.from, stickerBuffer, MessageType.sticker, {
                quoted: M.WAMessage
            })
        } catch (err) {
            console.error('Sticker error:', err)
            await M.reply('⚠️ Oops! Something went wrong while creating your sticker.')
        }
    }
}