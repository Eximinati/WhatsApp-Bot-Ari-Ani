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
            command: 'ytaudio',
            description: 'Downloads given YT Video and sends it as Audio',
            category: 'media',
            aliases: ['yta'],
            usage: `${client.config.prefix}yta [URL]`,
            baseXp: 20,
            since: '2026-05-17'
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.urls.length) return void M.reply('🔎 Provide the URL of the YT video you want to download')
        const audio = new YT(M.urls[0], 'audio')
        if (!audio.validateURL()) return void M.reply(`⚓ Provide a Valid YT URL`)

        const jid = M.sender.jid

        try {
            let info
            try {
                info = await audio.getInfo()
            } catch (reason) {
                return void M.reply(`❌ Couldn't fetch video info: ${(reason as Error).message}`)
            }

            const title = info?.title || 'YouTube Audio'
            const thumbnail = info?.thumbnail
            const duration = info?.duration

            if (thumbnail) {
                const caption = `📀 *Title:* ${title}\n\n⏱️ *Duration:* ${duration || 'Unknown'}`
                try {
                    const thumbBuffer = await request.buffer(thumbnail)
                    await M.reply(thumbBuffer, MessageType.image, undefined, undefined, caption)
                } catch {
                    await M.reply(caption)
                }
            }
            
            // Check for saved preference
            const savedPreference = await this.client.mediaMenu.getPreference(jid, 'ytaudio')
            
            if (savedPreference) {
                // User has a saved preference, send directly without showing menu
                await M.reply(`📥 Using saved preference: sending as ${savedPreference}...`)
                await this.handler.sendMediaFromReply(M, savedPreference, {
                    url: M.urls[0],
                    title: title,
                    type: 'audio'
                })
                return
            }

            // No saved preference, show the format menu
            this.client.menus.set(jid, {
                commandName: 'ytaudio',
                step: 'format',
                chatJid: M.from,
                data: {
                    url: M.urls[0],
                    title: title,
                    type: 'audio'
                }
            })
            
            const menuText = this.client.mediaMenu.getMenuText('ytaudio', title)
            const sent = await M.reply(menuText)
            if (sent?.key?.id) {
                this.client.menus.addId(jid, 'ytaudio', sent.key.id)
            }
        } catch (reason) {
            M.reply(`❌ an error occurred, Reason: ${(reason as Error).message}`)
        }
    }

    handleMenuSelection = async (M: ISimplifiedMessage, session: any, index: number): Promise<void> => {
        return handleFormatSelection(M, session, index, 'ytaudio', this.client.mediaMenu,
            (jid, cmd) => this.client.menus.clear(jid, cmd),
            (M, mode, data) => this.handler.sendMediaFromReply(M, mode, data),
            '⏳ Downloading & sending media...')
    }
}