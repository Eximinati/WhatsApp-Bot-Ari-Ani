import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { RPGEngine } from '../../rpg/RPGEngine.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { MessageType } from '../../core/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgstatus',
            description: 'View your System Status',
            category: 'gaming',
            usage: `${client.config.prefix}rpgstatus`,
            aliases: ['status'],
            baseXp: 1
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const jid = M.sender.jid
        const prefix = this.client.config.prefix
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply(`🚫 You haven't started your journey yet!\n\n📌 Use *${prefix}rpgstart* to begin.`)

        const statusText = RPGEngine.formatStatus(p)
        const canvasImg = await RPGEngine.generateCharacterImage(p)
        if (canvasImg) {
            return void M.reply(canvasImg, MessageType.image, undefined, undefined, statusText)
        }
        return void M.reply(statusText)
    }
}