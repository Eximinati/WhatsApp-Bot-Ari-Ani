import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { ZONES } from '../../rpg/data.js'
import { ZoneId } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgmove',
            description: 'Travel to a connected zone',
            category: 'gaming',
            usage: `${client.config.prefix}rpgmove <zone>`,
            aliases: ['travel', 'goto', 'move'],
            baseXp: 2
        })
    }

    run = async (M: ISimplifiedMessage, { args, joined }: IParsedArgs): Promise<void> => {
        const jid = M.sender.jid
        const prefix = this.client.config.prefix
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply(`🚫 You haven't started your journey yet!\n\n📌 Use *${prefix}rpgstart* to begin.`)

        const combat = await RPGDataStore.getCombat(jid)
        if (combat) return void M.reply(`⚔️ You are in combat! Cannot travel.\n\nFinish it with *${prefix}rpghunt* — or use *${prefix}rpghunt flee* to escape.`)

        const search = joined.toLowerCase()
        const currentZone = ZONES[p.currentZone]
        if (!currentZone) return void M.reply('❌ Your current zone data is missing.')

        if (!search) {
            const connList = currentZone.connections.map((z: ZoneId) => {
                const cz = ZONES[z]
                const canGo = p.level >= cz.minLevel &&
                    (!cz.requiredTraits || cz.requiredTraits.some((t: string) => p.traits.includes(t as any))) &&
                    (!cz.requiredTitles || cz.requiredTitles.some((t: string) => p.titles.includes(t as any)))
                return `${cz.icon} ${cz.name} ${canGo ? '✅' : '🔒 Lv. ' + cz.minLevel}`
            }).join('\n')

            return void M.reply(
                `📍 *Current:* ${currentZone.icon} ${currentZone.name}\n\n` +
                `━━━━━ CAN TRAVEL TO ━━━━━\n${connList}\n\n` +
                `🚶 Use *${prefix}rpgmove <zone_name>*`
            )
        }

        // Find matching zone in connections
        const targetId = currentZone.connections.find((z: ZoneId) => {
            const zone = ZONES[z]
            return zone && (z === search || zone.name.toLowerCase().includes(search))
        })

        if (!targetId) {
            return void M.reply(
                `❌ "${search}" is not connected to ${currentZone.name}.\n\n` +
                'Connected zones:\n' +
                currentZone.connections.map((z: ZoneId) => `${ZONES[z].icon} ${ZONES[z].name}`).join('\n')
            )
        }

        const targetZone = ZONES[targetId]

        // Level check
        if (p.level < targetZone.minLevel) {
            return void M.reply(`🔒 Level ${targetZone.minLevel} required to enter ${targetZone.name}.`)
        }

        // Trait check
        if (targetZone.requiredTraits) {
            const hasTrait = targetZone.requiredTraits.some((t: string) => p.traits.includes(t as any))
            if (!hasTrait) {
                return void M.reply(`🔒 You need a special trait to enter ${targetZone.name}.`)
            }
        }

        // Title check
        if (targetZone.requiredTitles) {
            const hasTitle = targetZone.requiredTitles.some((t: string) => p.titles.includes(t as any))
            if (!hasTitle) {
                return void M.reply(`🔒 You need a specific title to enter ${targetZone.name}.`)
            }
        }

        // Evolution check
        if (targetZone.requiredEvolution && p.evolutionPath !== targetZone.requiredEvolution) {
            return void M.reply(`🔒 Only those on the ${targetZone.requiredEvolution} path may enter.`)
        }

        // Move the player
        p.currentZone = targetId
        if (!p.discoveredZones.includes(targetId)) {
            p.discoveredZones.push(targetId)
        }

        // Danger check - chance of ambush
        let ambushMsg = ''
        if (Math.random() * 10 < targetZone.dangerLevel && p.level < targetZone.dangerLevel + 3) {
            ambushMsg = `\n\n⚠️ *AMBUSH!* Something is watching... use *${prefix}rpghunt* to face it.`
        }

        await RPGDataStore.savePlayer(p)

        // Enemies hint
        const enemyHints = targetZone.enemies.length > 0
            ? '\n\n━━━ ENEMIES HERE ━━━\n' + targetZone.enemies.map((e: string) => `• ${e.replace(/_/g, ' ')}`).join('\n')
            : ''

        return void M.reply(
            `🚶 *TRAVELING...*\n\n` +
            `${currentZone.icon} ${currentZone.name} → ${targetZone.icon} *${targetZone.name}*\n\n` +
            `${targetZone.description}\n\n` +
            `⚠️ Danger: ${targetZone.dangerLevel}/10 | 💰 Treasure: x${targetZone.treasureMultiplier}\n` +
            `📜 ${targetZone.lore}` +
            enemyHints +
            ambushMsg
        )
    }
}