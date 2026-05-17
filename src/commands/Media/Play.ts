import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import request from '../../core/request.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import yts from 'yt-search'

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
        
        if (await this.client.mediaMenu.hasPending(jid)) {
            return void M.reply('❌ You have a pending request. Reply with a number or wait.')
        }

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

            await this.client.mediaMenu.saveMenuState(jid, {
                step: 'format',
                commandName: 'play',
                chatJid: M.from,
                mediaInfo: {
                    url: video.url,
                    title: video.title,
                    type: 'audio'
                },
                expiresAt: Date.now() + 600000
            })
            
            const menuText = this.client.mediaMenu.getMenuText('play', video.title)
            return void M.reply(menuText)
        } catch (reason) {
            M.reply(`❌ an error occurred, Reason: ${(reason as Error).message}`)
        }
    }
}