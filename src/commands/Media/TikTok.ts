import axios from 'axios'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

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
        if (await this.client.mediaMenu.hasPending(jid)) {
            return void M.reply('❌ You have a pending request. Reply with a number or wait.')
        }

try {
            await M.reply('⏳ Fetching your TikTok video...')

            const apiUrl = this.client.config.tiktokApiUrl
            if (!apiUrl) {
                return void M.reply('❌ TikTok API not configured. Set TIKTOK_API_URL in .env')
            }

            const response = await axios.post<any>(
                apiUrl,
                { url: tiktokUrl },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                }
            )

            const data = response.data
            const videoUrl = Array.isArray(data?.videos) && data.videos.length
                ? data.videos[0].url
                : ''

            if (!videoUrl) {
                return void M.reply('❌ No downloadable video found.')
            }

            const title = data.title || data.description || 'TikTok Video'

            await this.client.mediaMenu.saveMenuState(jid, {
                step: 'format',
                commandName: 'tiktok',
                chatJid: M.from,
                mediaInfo: {
                    url: videoUrl,
                    title: title,
                    type: 'video'
                },
                expiresAt: Date.now() + 600000
            })

            const menuText = this.client.mediaMenu.getMenuText('tiktok', title)
            return void M.reply(menuText)
        } catch (error: any) {
            console.error('TikTok Error:', error?.message || error)
            return void M.reply('❌ Failed to download TikTok video.')
        }
    }
}