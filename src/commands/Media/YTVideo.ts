import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import YT from '../../core/YT.js'
import { ISimplifiedMessage } from '../../typings/index.js'

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
        if (await this.client.mediaMenu.hasPending(jid)) {
            return void M.reply('❌ You have a pending request. Reply with a number or wait.')
        }

        try {
            await this.client.mediaMenu.saveMenuState(jid, {
                step: 'format',
                commandName: 'ytvideo',
                chatJid: M.from,
                mediaInfo: {
                    url: M.urls[0],
                    title: info.title,
                    type: 'video'
                },
                expiresAt: Date.now() + 600000
            })
            
            const menuText = this.client.mediaMenu.getMenuText('ytvideo', info.title)
            return void M.reply(menuText)
        } catch (reason) {
            M.reply(`❌ an error occurred, Reason: ${(reason as Error).message}`)
        }
    }
}