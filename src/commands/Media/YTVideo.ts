import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import request from '../../core/request.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import YT from '../../core/YT.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { handleFormatSelection } from '../../utils/media.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ytvideo',
            description: 'Downloads given YT Video',
            category: 'media',
            aliases: ['ytv'],
            usage: `${client.config.prefix}ytv [URL]`,
            baseXp: 10,
            since: '2026-05-17'
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.urls.length) return void M.reply('🔎 Provide the URL of the YT video you want to download')
        const video = new YT(M.urls[0], 'video')
        if (!video.validateURL()) return void M.reply(`Provide a Valid YT URL`)
        
        let info
        try {
            info = await video.getInfo()
        } catch (reason) {
            return void M.reply(`❌ Couldn't fetch video info: ${(reason as Error).message}`)
        }
        
        if (Number(info.duration) > 1800) return void M.reply('⚓ Cannot download videos longer than 30 minutes')

        const jid = M.sender.jid

        try {
            const title = info.title
            const thumbnail = info.thumbnail
            const duration = info.duration

            if (thumbnail) {
                const caption = `🎬 *Title:* ${title}\n\n⏱️ *Duration:* ${duration || 'Unknown'}`
                try {
                    const thumbBuffer = await request.buffer(thumbnail)
                    await M.reply(thumbBuffer, MessageType.image, undefined, undefined, caption)
                } catch {
                    await M.reply(caption)
                }
            }

            // Check for saved preference
            const savedPreference = await this.client.mediaMenu.getPreference(jid, 'ytvideo')
            
            if (savedPreference) {
                // User has a saved preference, send directly without showing menu
                await M.reply(`📥 Using saved preference: sending as ${savedPreference}...`)
                await this.handler.sendMediaFromReply(M, savedPreference, {
                    url: M.urls[0],
                    title: title,
                    type: 'video'
                })
                return
            }

            // No saved preference, show the format menu
            this.client.menus.set(jid, {
                commandName: 'ytvideo',
                step: 'format',
                chatJid: M.from,
                data: {
                    url: M.urls[0],
                    title: title,
                    type: 'video'
                }
            })
            
            const menuText = this.client.mediaMenu.getMenuText('ytvideo', title)
            const sent = await M.reply(menuText)
            if (sent?.key?.id) {
                this.client.menus.addId(jid, 'ytvideo', sent.key.id)
            }
        } catch (reason) {
            M.reply(`❌ an error occurred, Reason: ${(reason as Error).message}`)
        }
    }

    handleMenuSelection = async (M: ISimplifiedMessage, session: any, index: number): Promise<void> => {
        return handleFormatSelection(M, session, index, 'ytvideo', this.client.mediaMenu,
            (jid, cmd) => this.client.menus.clear(jid, cmd),
            (M, mode, data) => this.handler.sendMediaFromReply(M, mode, data),
            '⏳ Downloading & sending media...')
    }
}