import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { MessageType } from '../../core/types.js'
import { createMapCanvas } from '../../rpg/MapCanvas.js'
import { ZONES } from '../../rpg/data.js'
import { ZoneId } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgmap',
            description: 'View the world map',
            category: 'gaming',
            usage: `${client.config.prefix}rpgmap`,
            aliases: ['map', 'worldmap'],
            baseXp: 1
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const jid = M.sender.jid
        const prefix = this.client.config.prefix
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply(`🚫 You haven't started your journey yet!\n\n📌 Use *${prefix}rpgstart* to begin.`)

        const mapBuf = await createMapCanvas(p)
        if (!mapBuf) return void M.reply('❌ Failed to generate map.')

        const zone = ZONES[p.currentZone]
        const connList = zone.connections.map((z: ZoneId) => {
            const cz = ZONES[z]
            const canGo = p.level >= cz.minLevel &&
                (!cz.requiredTraits || cz.requiredTraits.some((t: string) => p.traits.includes(t as any))) &&
                (!cz.requiredTitles || cz.requiredTitles.some((t: string) => p.titles.includes(t as any)))
            return `${cz.icon} ${cz.name} ${canGo ? '✅' : '🔒 Lv. ' + cz.minLevel}`
        }).join('\n')

        const caption =
            '🗺️ *WORLD MAP*\n\n' +
            `📍 Location: ${zone.icon} ${zone.name}\n` +
            `⚠️ Danger: ${zone.dangerLevel}/10 | 💰 Treasure: x${zone.treasureMultiplier}\n\n` +
            `━━━━━ CONNECTIONS ━━━━━\n${connList}\n\n` +
            `🚶 *${prefix}rpgmove <zone>* to travel`

        return void M.reply(mapBuf, MessageType.image, undefined, undefined, caption)
    }
}