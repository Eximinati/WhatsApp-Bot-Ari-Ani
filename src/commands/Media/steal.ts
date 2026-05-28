import { MessageType } from '../../core/types.js'
import { Sticker, StickerTypes, Categories } from 'wa-sticker-formatter'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'steal',
            aliases: ['take'],
            description: 'Steal a sticker from a quoted message',
            category: 'media',
            usage: `${client.config.prefix}steal [quote sticker] <pack|author>`,
            baseXp: 20,
            since: '2026-05-17'
        })
    }

    run = async (M: ISimplifiedMessage, { joined: arg }: IParsedArgs): Promise<void> => {
        try {
            if (!M.quoted) {
                return void M.reply('⚠️ Please quote a message containing a sticker to steal.')
            }

            // Check if quoted message contains a sticker
            const content = JSON.stringify(M.quoted)
            const isQuotedSticker = M.quoted.message?.message?.stickerMessage || content.includes('stickerMessage')

            if (!isQuotedSticker) {
                return void M.reply('⚠️ Quoted message does not contain a sticker.')
            }

            // Split pack and author info
            const [packName, authorName] = arg ? arg.split('|').map((s: string) => s?.trim()) : []

            // Download the sticker media
            let buffer: Buffer | undefined
            try {
                if (!M.quoted.message) {
                    return void M.reply('❌ Could not access quoted message.')
                }
                buffer = await this.client.downloadMediaMessage(M.quoted.message)
            } catch (downloadError) {
                console.error('Download error:', downloadError)
                return void M.reply('❌ Failed to download the sticker media.')
            }

            if (!buffer) {
                return void M.reply('❌ Failed to download the sticker media.')
            }

            const sticker = new Sticker(buffer, {
                pack: packName || '_Deryl_',
                author: authorName || '💚',
                type: StickerTypes.FULL,
                categories: ['🤩', '🎉'] as Categories[],
                quality: 70
            })

            const stickerBuffer = await sticker.toBuffer()

            await this.client.sendMessage(M.from, stickerBuffer, MessageType.sticker, {
                quoted: M.WAMessage
            })
        } catch (err) {
            console.error('STEAL COMMAND ERROR:', err)
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            await M.reply(`❌ Something went wrong while stealing the sticker: ${errorMessage}`)
        }
    }
}