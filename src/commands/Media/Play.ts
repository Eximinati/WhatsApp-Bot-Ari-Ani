import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import request from '../../core/request.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import yts from 'yt-search'
import { handleFormatSelection } from '../../utils/media.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'play',
            description: '🎵 play a song with just search term!',
            category: 'media',
            aliases: ['music'],
            usage: `${client.config.prefix}play [term]`,
            baseXp: 30,
            since: '2026-05-17'
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        if (!joined) return void M.reply('🔎 Provide a search term')
        const term = joined.trim()
        
        const { videos } = await yts(term)
        if (!videos || videos.length <= 0) return void M.reply(`⚓ No Matching videos found for the term : *${term}*`)
        
        const video = videos[0]
        const jid = M.sender.jid
        
        try {
            const caption = `📀 *Title:* ${video.title}\n\n👤 *Artist:* ${video.author.name}\n\n⏱️ *Duration:* ${video.duration.timestamp}`

            if (video.thumbnail) {
                try {
                    const thumbBuffer = await request.buffer(video.thumbnail)
                    await M.reply(thumbBuffer, MessageType.image, undefined, undefined, caption)
                } catch {
                    await M.reply(caption)
                }
            } else {
                await M.reply(caption)
            }

            // Check for saved preference
            const savedPreference = await this.client.mediaMenu.getPreference(jid, 'play')
            
            if (savedPreference) {
                // User has a saved preference, send directly without showing menu
                await M.reply(`📥 Using saved preference: sending as ${savedPreference}...`)
                await this.handler.sendMediaFromReply(M, savedPreference, {
                    url: video.url,
                    title: video.title,
                    type: 'audio'
                })
                return
            }

            // No saved preference, show the format menu
            this.client.menus.set(jid, {
                commandName: 'play',
                step: 'format',
                chatJid: M.from,
                data: {
                    url: video.url,
                    title: video.title,
                    type: 'audio'
                }
            })
            
            const menuText = this.client.mediaMenu.getMenuText('play', video.title)
            const sent = await M.reply(menuText)
            if (sent?.key?.id) {
                this.client.menus.addId(jid, 'play', sent.key.id)
            }
        } catch (reason) {
            M.reply(`❌ an error occurred, Reason: ${(reason as Error).message}`)
        }
    }

    handleMenuSelection = async (M: ISimplifiedMessage, session: any, index: number): Promise<void> => {
        return handleFormatSelection(M, session, index, 'play', this.client.mediaMenu,
            (jid, cmd) => this.client.menus.clear(jid, cmd),
            (M, mode, data) => this.handler.sendMediaFromReply(M, mode, data))
    }
}
