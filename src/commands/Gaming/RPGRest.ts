import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgrest',
            description: 'Rest to restore HP and MP',
            category: 'gaming',
            usage: `${client.config.prefix}rpgrest`,
            aliases: ['rest'],
            baseXp: 1
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const jid = M.sender.jid
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply('Start first: *!rpgstart*')

        p.gauges.hp = p.gauges.maxHp
        p.gauges.mp = p.gauges.maxMp
        p.gauges.stamina = p.gauges.maxStamina
        await RPGDataStore.savePlayer(p)

        return void M.reply(
            '😴 *You rest...*\n\n' +
            `❤️ HP: ${p.gauges.hp}/${p.gauges.maxHp}\n` +
            `💙 MP: ${p.gauges.mp}/${p.gauges.maxMp}\n` +
            `⚡ Stamina: ${p.gauges.stamina}/${p.gauges.maxStamina}\n\n` +
            'You feel refreshed and ready.'
        )
    }
}