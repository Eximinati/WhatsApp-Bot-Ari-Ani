import { MessageType, Mimetype } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import yts from 'yt-search'
import YT from '../../core/YT.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'play',
            description: '🎵 play a song with just search term!',
            category: 'media',
            aliases: ['music'],
            usage: `${client.config.prefix}play [term]`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        if (!joined) return void M.reply('🔎 Provide a search term')
        const term = joined.trim()
        const { videos } = await yts(term)
        if (!videos || videos.length <= 0) return void M.reply(`⚓ No Matching videos found for the term : *${term}*`)
        const audio = new YT(videos[0].url, 'audio')
        if (!audio.url) return
        M.reply('👾 Sending...')
        try {
            const buffer = await audio.getBuffer()
            await this.client.sendMessage(M.from, buffer, MessageType.audio, {
                mimetype: Mimetype.m4a,
                quoted: M.WAMessage,
                contextInfo: {
                    externalAdReply: {
                        title: videos[0].title.substr(0, 30),
                        body: `Author: ${videos[0].author.name.substr(0, 20)}`,
                        mediaType: 2,
                        thumbnailUrl: `https://i.ytimg.com/vi/${audio.id}/hqdefault.jpg`,
                        mediaUrl: audio.url
                    }
                }
            })
        } catch (reason) {
            M.reply(`❌ an error occurred, Reason: ${(reason as Error).message}`)
        }
    }
}
