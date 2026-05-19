import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { RPGEngine } from '../../rpg/RPGEngine.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { ENEMIES, ZONES } from '../../rpg/data.js'
import { findEnemyByNameOrId } from '../../rpg/constants/enemies.js'
import { Enemy, ZoneId } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpghunt',
            description: 'Hunt enemies in your current zone',
            category: 'gaming',
            usage: `${client.config.prefix}rpghunt [enemy_name] [action]`,
            aliases: ['hunt'],
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage, { args, joined }: IParsedArgs): Promise<void> => {
        const jid = M.sender.jid
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply('Start first: *!rpgstart*')

        const combatActive = await RPGDataStore.getCombat(jid)

        // ═══ SHOW ENEMIES IN ZONE ═══
        if (!combatActive) {
            if (!args[0]) {
                const zone = ZONES[p.currentZone]
                const zoneEnemyIds = zone.enemies
                const available = ENEMIES.filter((e: Enemy) =>
                    zoneEnemyIds.includes(e.id) && p.level >= e.level - 2
                )
                if (available.length === 0) {
                    return void M.reply(
                        `📍 *${zone.icon} ${zone.name}*\n\n` +
                        'No enemies match your level here.\n' +
                        'Travel to another zone with *!rpgmap* and *!rpgmove*'
                    )
                }
                const list = available.map((e: Enemy) => `- ${e.name} (Lv.${e.level}) — ${e.description.slice(0, 60)}`).join('\n')
                const ids = available.map((e: Enemy) => e.id).join(', ')
                return void M.reply(
                    `⚔️ *HUNT — ${zone.icon} ${zone.name}*\n\n` +
                    `Available prey:\n${list}\n\n` +
                    `Start: *!rpghunt <name>*\n` +
                    `IDs: ${ids}\n\n` +
                    `Tip: You can type names like "starving wolf" or "starving_wolf"`
                )
            }

            // Search by name or ID (supports spaces)
            const enemy = findEnemyByNameOrId(args[0]) ||
                findEnemyByNameOrId(joined.replace(/\s+/g, '_'))

            if (!enemy) {
                return void M.reply(
                    '❌ Enemy not found.\n\n' +
                    'Use *!rpghunt* to see available prey in your zone.\n' +
                    'Tip: Type the full name like "starving wolf"'
                )
            }

            // Check if enemy is in current zone
            const zone = ZONES[p.currentZone]
            if (!zone.enemies.includes(enemy.id)) {
                return void M.reply(
                    `❌ ${enemy.name} is not found in ${zone.name}.\n\n` +
                    `This zone has: ${zone.enemies.join(', ')}\n\n` +
                    'Travel to find different enemies with *!rpgmap*'
                )
            }

            const result = RPGEngine.initCombat(p, enemy.id)
            if (result.error) return void M.reply(result.error)

            await RPGDataStore.saveCombat(result.combat)
            await RPGDataStore.savePlayer(p)
            const en = result.combat.enemy

            return void M.reply(
                `⚔️ *COMBAT STARTED!*\n\n` +
                `${en.name} (Lv.${en.level})\n` +
                `${en.description}\n\n` +
                '━━━ YOUR ACTIONS ━━━\n' +
                '*!rpghunt attack* — Strike\n' +
                '*!rpghunt skill* — Magic (15 MP)\n' +
                '*!rpghunt analyze* — Intel\n' +
                '*!rpghunt flee* — Escape\n' +
                '*!rpghunt forbidden* — Dark power'
            )
        }

        // ═══ COMBAT IN PROGRESS ═══
        const action = (args[0] || 'attack').toLowerCase()
        const result = RPGEngine.combatAction(combatActive, action, p)

        if (result.fled) {
            await RPGDataStore.deleteCombat(jid)
            await RPGDataStore.savePlayer(p)
            return void M.reply(result.narrative)
        }
        if (result.victory || result.defeat) {
            const defeatedEnemyId = combatActive.enemy.id
            await RPGDataStore.deleteCombat(jid)
            if (result.defeat) {
                p.xp = Math.floor(p.xp * 0.7)
                p.gauges.hp = Math.floor(p.gauges.maxHp * 0.3)
                p.gauges.mp = Math.floor(p.gauges.maxMp * 0.3)
            }
            await RPGDataStore.savePlayer(p)
            
            // Show remaining prey in zone after battle ends
            const zone = ZONES[p.currentZone]
            const zoneEnemyIds = zone.enemies
            const available = ENEMIES.filter((e: Enemy) =>
                zoneEnemyIds.includes(e.id) &&
                p.level >= e.level - 2 &&
                e.id !== defeatedEnemyId  // Exclude the enemy just fought
            )
            
            let preyList = ''
            if (available.length > 0) {
                const list = available.map((e: Enemy) => `- ${e.name} (Lv.${e.level}) — ${e.description.slice(0, 60)}`).join('\n')
                preyList = `\n\n⚔️ *Remaining prey in ${zone.icon} ${zone.name}:*\n${list}\n\nHunt next: *!rpghunt <name>*`
            } else {
                preyList = `\n\n✅ No more prey at your level in ${zone.name}.\nTravel with *!rpgmap* and *!rpgmove*`
            }
            
            return void M.reply(result.narrative + preyList)
        }

        await RPGDataStore.saveCombat(result.combat)
        await RPGDataStore.savePlayer(p)
        return void M.reply(
            result.narrative + '\n\n' +
            'Next action: *!rpghunt <attack|skill|analyze|flee|forbidden>*'
        )
    }
}