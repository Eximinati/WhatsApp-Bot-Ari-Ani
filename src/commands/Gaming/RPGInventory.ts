import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { ITEMS } from '../../rpg/data.js'
import { ItemId, ItemDefinition } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpginventory',
            description: 'View your inventory',
            category: 'gaming',
            usage: `${client.config.prefix}rpginventory`,
            aliases: ['inventory', 'rpgbag', 'bag'],
            baseXp: 1
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const jid = M.sender.jid
        const prefix = this.client.config.prefix
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply(`🚫 You haven't started your journey yet!\n\n📌 Use *${prefix}rpgstart* to begin.`)

        if (p.inventory.length === 0) return void M.reply('🎒 *Inventory*\n\n📭 Empty. Go hunt some enemies!')

        const items = p.inventory.map(inv => {
            const item: ItemDefinition | undefined = ITEMS[inv.itemId]
            return `- ${item?.name || inv.itemId} x${inv.quantity}`
        }).join('\n')

        const equipStr = Object.entries(p.equipment)
            .filter(([, v]) => v)
            .map(([slot, itemId]) => {
                const item = ITEMS[itemId!]
                return `🛡️ ${slot}: ${item?.name || itemId}`
            }).join('\n') || 'Nothing'

        return void M.reply(
            '🎒 *INVENTORY*\n\n' +
            `💰 Coins: ${p.currency}\n\n` +
            '━━━━━ EQUIPMENT ━━━━━\n' + equipStr + '\n\n' +
            '━━━━━ ITEMS ━━━━━\n' + items + '\n\n' +
            `💉 *${prefix}rpguse <item>* | 🛡️ *${prefix}rpgequip <item>*`
        )
    }
}