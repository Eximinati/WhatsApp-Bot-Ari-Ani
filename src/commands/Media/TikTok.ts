import { youtubeDl, type Payload } from 'youtube-dl-exec'
import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import request from '../../core/request.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { handleFormatSelection } from '../../utils/media.js'

const tiktokFlags = {
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true
}

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'tiktok',
            aliases: ['tt', 'tiktokdl'],
            description: 'Download TikTok videos',
            category: 'media',
            usage: `${client.config.prefix}tiktok <url>`,
            baseXp: 15,
            since: '2026-05-17'
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.urls.length) return void M.reply('❌ Please provide a valid TikTok link.')
        
        const tiktokUrl = M.urls[0]
        if (!/tiktok\.com\/|vt\.tiktok\.com\//i.test(tiktokUrl)) {
            return void M.reply('❌ Invalid TikTok link.')
        }

        const jid = M.sender.jid

        try {
            await M.reply('⏳ Fetching your TikTok video...')

            const info = await youtubeDl(tiktokUrl, {
                ...tiktokFlags,
                dumpSingleJson: true
            } as Parameters<typeof youtubeDl>[1]) as Payload

            const videoUrl = info.formats?.[0]?.url
            if (!videoUrl) {
                return void M.reply('❌ No downloadable video found.')
            }

            const title = info.title || 'TikTok Video'
            const thumbnail = info.thumbnail
            const duration = info.duration ? formatDuration(info.duration) : null

            if (thumbnail) {
                const caption = `🎵 *Title:* ${title}${duration ? `\n\n⏱️ *Duration:* ${duration}` : ''}`
                try {
                    const thumbBuffer = await request.buffer(thumbnail)
                    await M.reply(thumbBuffer, MessageType.image, undefined, undefined, caption)
                } catch {
                    await M.reply(caption)
                }
            }

            this.client.menus.set(jid, {
                commandName: 'tiktok',
                step: 'format',
                chatJid: M.from,
                data: {
                    url: videoUrl,
                    title: title,
                    type: 'video'
                }
            })

            const menuText = this.client.mediaMenu.getMenuText('tiktok', title)
            const sent = await M.reply(menuText)
            if (sent?.key?.id) {
                this.client.menus.addId(jid, 'tiktok', sent.key.id)
            }
        } catch (error: any) {
            console.error('TikTok Error:', error?.message || error)
            return void M.reply(`❌ Failed to download TikTok video: ${error?.message || 'Unknown error'}`)
        }
    }

    handleMenuSelection = async (M: ISimplifiedMessage, session: any, index: number): Promise<void> => {
        return handleFormatSelection(M, session, index, 'tiktok', this.client.mediaMenu,
            (jid, cmd) => this.client.menus.clear(jid, cmd),
            (M, mode, data) => this.handler.sendMediaFromReply(M, mode, data),
            '⏳ Downloading & sending media...')
    }
}