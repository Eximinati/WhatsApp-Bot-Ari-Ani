import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { RPGEngine } from '../../rpg/RPGEngine.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { ITEMS } from '../../rpg/data.js'
import { ItemId } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpguse',
            description: 'Use a consumable item',
            category: 'gaming',
            usage: `${client.config.prefix}rpguse <item>`,
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

        if (!invEntry || invEntry.quantity <= 0) return void M.reply(`❌ Item not found.\n\n🎒 Use *${prefix}rpginventory* to check.`)

        const item = ITEMS[invEntry.itemId as ItemId]
        if (!item || item.type !== 'consumable') return void M.reply(`❌ Not consumable.\n\n🛡️ Use *${prefix}rpgequip <item>* for gear.`)

        if (item.id === 'expired_ration') {
            if (Math.random() < 0.2) {
                p.gauges.hp = Math.max(0, p.gauges.hp - 5)
                invEntry.quantity--
                await RPGDataStore.savePlayer(p)
                return void M.reply('🤢 ROTTEN! -5 HP.')
            }
            p.gauges.hp = Math.min(p.gauges.maxHp, p.gauges.hp + 15)
        } else if (item.id === 'bandage') {
            p.gauges.hp = Math.min(p.gauges.maxHp, p.gauges.hp + 25)
        } else if (item.id === 'mana_potion_small') {
            p.gauges.mp = Math.min(p.gauges.maxMp, p.gauges.mp + 30)
        } else if (item.id === 'holy_water') {
            p.gauges.hp = Math.min(p.gauges.maxHp, p.gauges.hp + 20)
            p.hiddenStats.corruption = Math.max(0, p.hiddenStats.corruption - 5)
        } else if (item.id === 'memory_shard') {
            const xpGain = RPGEngine.rand(20, 80)
            RPGEngine.addXp(p, xpGain)
            if (Math.random() < 0.15) p.timelineFragments++
        }

        invEntry.quantity--
        p.inventory = p.inventory.filter((i: { quantity: number }) => i.quantity > 0)
        await RPGDataStore.savePlayer(p)

        return void M.reply(
            '💉 *ITEM USED*\n\n' +
            `✅ Used: ${item.name}\n` +
            `❤️ HP: ${p.gauges.hp}/${p.gauges.maxHp} | 💙 MP: ${p.gauges.mp}/${p.gauges.maxMp}\n` +
            `📦 Remaining: ${invEntry.quantity}`
        )
    }
}