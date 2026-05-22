import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { ITEMS } from '../../rpg/data.js'
import { ItemId } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgequip',
            description: 'Equip a weapon or armor',
            category: 'gaming',
            usage: `${client.config.prefix}rpgequip <item>`,
            baseXp: 1
        })
    }

    run = async (M: ISimplifiedMessage, { args, joined }: IParsedArgs): Promise<void> => {
        const jid = M.sender.jid
        const prefix = this.client.config.prefix
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply(`🚫 You haven't started your journey yet!\n\n📌 Use *${prefix}rpgstart* to begin.`)

        const search = joined.toLowerCase()
        const invEntry = p.inventory.find((i: { itemId: string; quantity: number }) => {
            const item = ITEMS[i.itemId as ItemId]
            return item && (i.itemId === search || item.name.toLowerCase().includes(search))
        })

        if (!invEntry || invEntry.quantity <= 0) return void M.reply(`❌ Item not found.\n\n🎒 Check your inventory with *${prefix}rpginventory*`)

        const item = ITEMS[invEntry.itemId as ItemId]
        if (!item?.equippable || !item.slot) return void M.reply('❌ This item cannot be equipped.')

        const currentEquipped = p.equipment[item.slot]
        if (currentEquipped) {
            const existing = p.inventory.find((i: { itemId: string; quantity: number }) => i.itemId === currentEquipped)
            if (existing) existing.quantity++
            else p.inventory.push({ itemId: currentEquipped, quantity: 1 })
        }

        p.equipment[item.slot] = invEntry.itemId as ItemId
        invEntry.quantity--
        p.inventory = p.inventory.filter((i: { quantity: number }) => i.quantity > 0)
        await RPGDataStore.savePlayer(p)

        return void M.reply(
            '🛡️ *EQUIPMENT UPDATE*\n\n' +
            `✅ Equipped: *${item.name}*\n` +
            `📌 Slot: ${item.slot}\n` +
            (item.stats ? `📊 Stats: ${Object.entries(item.stats).map(([k, v]) => `${k}+${v}`).join(', ')}\n` : '') +
            (item.corrupt ? `⚠️ Corrupted — risk: ${item.corruptRisk}%\n` : '') +
            `\n📜 ${item.lore}`
        )
    }
}