import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import request from '../../core/request.js'
import Spotify from '../../core/Spotify.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'spotify',
            description: 'Downloads given spotify track and sends it as Audio',
            category: 'media',
            usage: `${client.config.prefix}spotify [URL]`,
            baseXp: 20,
            aliases: ['sp'],
            since: '2026-05-17'
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.urls.length) return void M.reply(`🔎 Provide the Spotify Track URL that you want to download`)
        const url = M.urls[0]
        const track = new Spotify(url)
        let info: Awaited<ReturnType<Spotify['getInfo']>>
        try {
            info = await track.getInfo()
        } catch {
            return void M.reply(`⚓ Error fetching: ${url}. Check if the URL is valid.`)
        }
        if (info.error) return void M.reply(`⚓ Error Fetching: ${url}. Check if the url is valid and try again`)

        const jid = M.sender.jid
        if (await this.client.mediaMenu.hasPending(jid)) {
            return void M.reply('❌ You have a pending request. Reply with a number or wait.')
        }

        const caption = `🎧 *Title:* ${info.name || ''}\n🎤 *Artists:* ${(info.artists || []).join(',')}\n💽 *Album:* ${
            info.album_name
        }\n📆 *Release Date:* ${info.release_date || ''}`

        if (info.cover_url) {
            try {
                const coverBuffer = await request.buffer(info.cover_url)
                await M.reply(coverBuffer, MessageType.image, undefined, undefined, caption)
            } catch (err) {
                await M.reply(`⚠ Couldn't fetch cover image: ${(err as Error).message}`)
            }
        } else {
            await M.reply(caption)
        }

        try {
            await this.client.mediaMenu.saveMenuState(jid, {
                step: 'format',
                commandName: 'spotify',
                chatJid: M.from,
                mediaInfo: {
                    url: url,
                    title: info.name || 'Spotify Track',
                    type: 'audio'
                },
                expiresAt: Date.now() + 600000
            })
            
            const menuText = this.client.mediaMenu.getMenuText('spotify', info.name || 'Spotify Track')
            return void M.reply(menuText)
        } catch (err) {
            await M.reply(`❌ Error: ${(err as Error).message}`)
        }
    }
}