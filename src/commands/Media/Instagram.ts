import axios from 'axios'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { handleFormatSelection } from '../../utils/media.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'instagram',
            aliases: ['ig', 'insta'],
            description: 'Download Instagram posts, reels, and videos',
            category: 'media',
            usage: `${client.config.prefix}instagram <url>`,
            baseXp: 15,
            since: '2026-05-17'
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.urls.length) return void M.reply('❌ Please provide an Instagram URL')
        
        const url = M.urls[0]
        if (!url.includes('instagram.com/')) {
            return void M.reply('❌ Invalid Instagram URL')
        }

        const jid = M.sender.jid

        try {
            const apiUrl = this.client.config.instagramApiUrl
            if (!apiUrl) {
                return void M.reply('❌ Instagram API not configured. Set INSTAGRAM_API_URL in .env')
            }
            
            const response = await axios.get<any>(
                `${apiUrl}?url=${encodeURIComponent(url)}`,
                { timeout: 20000 }
            )
            const data = response.data

            if (!data || (!data.status && !data.result)) {
                return void M.reply('❌ No media found or unsupported post.')
            }

            let mediaList = []
            if (Array.isArray(data.result?.media)) {
                mediaList = data.result.media
            } else if (data.result?.media) {
                mediaList = [data.result.media]
            } else if (Array.isArray(data.media)) {
                mediaList = data.media
            } else if (data.media) {
                mediaList = [data.media]
            }

            if (!mediaList.length && data.result) {
                const found = ['downloadUrl', 'url', 'video', 'videoUrl', 'mediaUrl', 'src']
                    .map((key) => data.result[key])
                    .find(Boolean)

                if (found) {
                    mediaList = [{
                        type: found.includes('.mp4') ? 'video' : 'image',
                        downloadUrl: found
                    }]
                }
            }

            if (!mediaList.length) {
                return void M.reply('❌ No media found in this post.')
            }

            // For simplicity, handle only first item - could be expanded for carousels
            const media = mediaList[0]
            const downloadUrl = media?.downloadUrl || media?.url || media?.videoUrl
            
            if (!downloadUrl) {
                return void M.reply('❌ Invalid media URL')
            }

            // If it's an image, send directly
            if (!media?.type?.includes('video') && !downloadUrl.includes('.mp4')) {
                return void M.reply('❌ Image detected. Use --all flag for multiple media.')
            }

            // For videos, show the format menu
            const title = data.result?.title || data.result?.description || 'Instagram Video'

            this.client.menus.set(jid, {
                commandName: 'instagram',
                step: 'format',
                chatJid: M.from,
                data: {
                    url: downloadUrl,
                    title: title,
                    type: 'video'
                }
            })

            const menuText = this.client.mediaMenu.getMenuText('instagram', title)
            const sent = await M.reply(menuText)
            if (sent?.key?.id) {
                this.client.menus.addId(jid, 'instagram', sent.key.id)
            }
        } catch (error: any) {
            console.error('Instagram Error:', error?.message || error)
            return void M.reply('❌ Failed to fetch Instagram content.')
        }
    }

    handleMenuSelection = async (M: ISimplifiedMessage, session: any, index: number): Promise<void> => {
        return handleFormatSelection(M, session, index, 'instagram', this.client.mediaMenu,
            (jid, cmd) => this.client.menus.clear(jid, cmd),
            (M, mode, data) => this.handler.sendMediaFromReply(M, mode, data),
            '⏳ Downloading & sending media...')
    }
}