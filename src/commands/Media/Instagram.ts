import axios from 'axios'
import { MessageType } from '../../core/types.js'
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

            const title = data.result?.title || data.result?.description || 'Instagram'

            // Separate images and videos
            const images = mediaList.filter((m: any) => {
                const url = m?.downloadUrl || m?.url || m?.videoUrl || ''
                return !m?.type?.includes('video') && !url.includes('.mp4') && url
            })
            const videos = mediaList.filter((m: any) => {
                const url = m?.downloadUrl || m?.url || m?.videoUrl || ''
                return (m?.type?.includes('video') || url.includes('.mp4')) && url
            })

            const hasImages = images.length > 0
            const hasVideos = videos.length > 0

            if (!hasImages && !hasVideos) {
                return void M.reply('❌ No downloadable media found in this post.')
            }

            // Download and send all images
            if (hasImages) {
                const count = images.length
                await M.reply(`📥 Found ${count} image${count > 1 ? 's' : ''}. Downloading...`)
                
                for (let i = 0; i < count; i++) {
                    const img = images[i]
                    const downloadUrl = img?.downloadUrl || img?.url || img?.videoUrl
                    
                    if (!downloadUrl) continue

                    try {
                        const imgResponse = await axios.get(downloadUrl, {
                            responseType: 'arraybuffer',
                            timeout: 30000
                        })
                        const buffer = Buffer.from(imgResponse.data)
                        
                        const caption = count > 1 
                            ? `${title} (${i + 1}/${count})`
                            : title
                        
                        await this.client.sendMessage(M.from, buffer, MessageType.image, {
                            caption: caption,
                            quoted: M.WAMessage
                        })
                    } catch (downloadError: any) {
                        console.error(`Image ${i + 1} download error:`, downloadError?.message)
                        await M.reply(`❌ Failed to download image ${i + 1}/${count}.`)
                    }
                }
            }

            // For videos, handle only the first one with format menu
            if (hasVideos) {
                const video = videos[0]
                const downloadUrl = video?.downloadUrl || video?.url || video?.videoUrl
                
                if (!downloadUrl) return

                const videoTitle = `${title}${hasImages ? ` (Video)` : ''}`

                // Check for saved preference first
                const savedPreference = await this.client.mediaMenu.getPreference(jid, 'instagram')
                
                if (savedPreference) {
                    await M.reply(`📥 Using saved preference: sending video as ${savedPreference}...`)
                    await this.handler.sendMediaFromReply(M, savedPreference, {
                        url: downloadUrl,
                        title: videoTitle,
                        type: 'video'
                    })
                    return
                }

                // No saved preference, show the format menu
                this.client.menus.set(jid, {
                    commandName: 'instagram',
                    step: 'format',
                    chatJid: M.from,
                    data: {
                        url: downloadUrl,
                        title: videoTitle,
                        type: 'video'
                    }
                })

                const menuText = this.client.mediaMenu.getMenuText('instagram', videoTitle)
                const sent = await M.reply(menuText)
                if (sent?.key?.id) {
                    this.client.menus.addId(jid, 'instagram', sent.key.id)
                }
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