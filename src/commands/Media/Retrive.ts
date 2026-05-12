import { extractMessageContent } from 'baileys'
import { MessageType } from '../../core/types.js'
import type { WAMessage } from '../../typings/index.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'retrieve',
            description: 'retrieve a quoted (view-once or regular) image / video',
            category: 'media',
            usage: `${client.config.prefix}retrieve [Tag the message]`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.quoted?.message) return void (await M.reply(`Quote the message you want to retrieve`))

        // 1. First: was this message proactively captured at receipt time?
        // The bot snapshots every view-once media on arrival because WhatsApp's
        // CDN deletes view-once content quickly — this is the only path that
        // actually works for OLD view-once messages.
        const quotedKeyId = M.quoted.message.key?.id
        const captured = await this.client.getCapturedViewOnce(quotedKeyId)
        if (captured) {
            const type = captured.type === 'image' ? MessageType.image : MessageType.video
            return void M.reply(
                captured.buffer,
                type,
                undefined,
                undefined,
                'Retrieved from local snapshot 📦'
            )
        }

        // 2. Fall back to live download (only works while WhatsApp's CDN still
        // hosts the encrypted blob — typically minutes to hours for view-once).
        const inner = extractMessageContent(M.quoted.message.message) || M.quoted.message.message
        if (!inner || (!inner.imageMessage && !inner.videoMessage)) {
            return void M.reply('The quoted message has no image or video to retrieve')
        }

        const downloadable = {
            key: M.quoted.message.key,
            message: inner
        } as WAMessage
        const buffer = await this.client.downloadMediaMessage(downloadable).catch(() => null)
        if (!buffer) {
            return void M.reply(
                `Couldn't retrieve this media. View-once media expires on WhatsApp's servers within minutes — only messages received *after* the bot was running can be retrieved later. Run !retrieve on view-once messages while the bot is online to snapshot them for later.`
            )
        }

        const type = inner.imageMessage ? MessageType.image : MessageType.video
        return void M.reply(
            buffer,
            type,
            undefined,
            undefined,
            'Hippity Hoppity, this message is now public property...'
        )
    }
}
