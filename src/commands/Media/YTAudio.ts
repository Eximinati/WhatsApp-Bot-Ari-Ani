import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import YT from '../../core/YT.js'
import { ISimplifiedMessage } from '../../typings/index.js'

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
        if (await this.client.mediaMenu.hasPending(jid)) {
            return void M.reply('❌ You have a pending request. Reply with a number or wait.')
        }

        try {
            let info
            try {
                info = await audio.getInfo()
            } catch (reason) {
                return void M.reply(`❌ Couldn't fetch video info: ${(reason as Error).message}`)
            }
            
            await this.client.mediaMenu.saveMenuState(jid, {
                step: 'format',
                commandName: 'ytaudio',
                chatJid: M.from,
                mediaInfo: {
                    url: M.urls[0],
                    title: info?.title || 'YouTube Audio',
                    type: 'audio'
                },
                expiresAt: Date.now() + 600000
            })
            
            const menuText = this.client.mediaMenu.getMenuText('ytaudio', info?.title || 'YouTube Audio')
            return void M.reply(menuText)
        } catch (reason) {
            M.reply(`❌ an error occurred, Reason: ${(reason as Error).message}`)
        }
    }
}