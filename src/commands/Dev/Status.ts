import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'status',
            description: 'Post WhatsApp status (text, image, or video)',
            category: 'dev',
            dm: true,
            usage: `${client.config.prefix}status <text>`,
            modsOnly: true,
            baseXp: 30
        })
    }

    run = async (
        M: ISimplifiedMessage,
        parsedArgs: IParsedArgs
    ): Promise<void> => {
        const text = parsedArgs.joined?.trim()

        const quoted = M.quoted?.message
        const media = M.WAMessage?.message

        try {
            
            if (quoted?.message?.imageMessage || media?.imageMessage) {
                const msg = quoted || M.WAMessage
                const buffer = await this.client.downloadMediaMessage(msg)

                await this.client.sendMessage(
                    'status@broadcast',
                    {
                        image: buffer,
                        caption: text || ''
                    }
                )

                return void M.reply('📸 Image status posted')
            }

        
            if (quoted?.message?.videoMessage || media?.videoMessage) {
                const msg = quoted || M.WAMessage
                const buffer = await this.client.downloadMediaMessage(msg)

                await this.client.sendMessage(
                    'status@broadcast',
                    {
                        video: buffer,
                        caption: text || ''
                    }
                )

                return void M.reply('🎥 Video status posted')
            }

            
            if (text) {
                await this.client.sendMessage('status@broadcast', {
                    text
                })

                return void M.reply('📝 Text status posted')
            }

            return void M.reply(
                '❌ Reply to an image/video or provide text.'
            )
        } catch (err) {
            return void M.reply(
                `❌ Failed to post status: ${String(err)}`
            )
        }
    }
}
