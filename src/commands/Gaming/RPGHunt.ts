import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { RPGEngine } from '../../rpg/RPGEngine.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { ENEMIES, ZONES } from '../../rpg/data.js'
import { findEnemyByNameOrId } from '../../rpg/constants/enemies.js'
import { Enemy, ZoneId } from '../../rpg/types.js'

const HUNT_COOLDOWN_MS = 5 * 60 * 60 * 1000 // 5 hours in milliseconds

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
        const prefix = this.client.config.prefix
        const isMod = this.client.isMod(jid)
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply(`🚫 You haven't started your journey yet!\n\n📌 Use *${prefix}rpgstart* to begin.`)

        const combatActive = await RPGDataStore.getCombat(jid)

        // ═══ SHOW ENEMIES IN ZONE ═══
        if (!combatActive) {
            // ─── COOLDOWN CHECK (non-mods only) ───
            if (!isMod) {
                const lastHunt = p.lastAction['lastHunt'] || 0
                const now = Date.now()
                const remaining = HUNT_COOLDOWN_MS - (now - lastHunt)
                if (remaining > 0) {
                    const hours = Math.floor(remaining / 3600000)
                    const mins = Math.floor((remaining % 3600000) / 60000)
                    return void M.reply(
                        '⏳ *HUNT COOLDOWN ACTIVE*\n\n' +
                        `You must rest before hunting again.\n` +
                        `⏰ Time remaining: *${hours}h ${mins}m*\n\n` +
                        `💡 Try *${prefix}rpgquest* or *${prefix}rpgrest* in the meantime.\n` +
                        `🛡️ Mods have no hunt cooldown.`
                    )
                }
            }

            if (!args[0]) {
                const zone = ZONES[p.currentZone]
                const zoneEnemyIds = zone.enemies

                // Filter by zone enemies, level range, AND exclude already-killed enemies
                const available = ENEMIES.filter((e: Enemy) =>
                    zoneEnemyIds.includes(e.id) &&
                    p.level >= e.level - 2 &&
                    !(p.kills[e.id] && p.kills[e.id] > 0) // ← BLACKLIST defeated enemies
                )

                // Check if zone is fully cleared
                if (available.length === 0) {
                    // Check if there are ANY enemies left in zone at all
                    const allZoneDead = ENEMIES.every((e: Enemy) =>
                        !zoneEnemyIds.includes(e.id) || (p.kills[e.id] && p.kills[e.id] > 0)
                    )

                    if (allZoneDead) {
                        // Zone fully conquered — check if player can level up
                        const oldLevel = p.level
                        // Grant bonus completion XP
                        const zoneBonusXp = zone.dangerLevel * 25
                        RPGEngine.addXp(p, zoneBonusXp)
                        await RPGDataStore.savePlayer(p)

                        let levelUpMsg = ''
                        if (p.level > oldLevel) {
                            levelUpMsg = `\n\n🎉 *LEVEL UP!* You are now *Level ${p.level}*!\nYour stats have increased. New zones await.`
                        }

                        return void M.reply(
                            `🏆 *ZONE CLEARED!* 🏆\n\n` +
                            `📍 ${zone.icon} *${zone.name}* — all threats eliminated!\n` +
                            `✨ Bonus XP: +${zoneBonusXp}\n` +
                            `⭐ Current XP: ${p.xp}/${RPGEngine.xpForLevel(p.level)}` +
                            levelUpMsg +
                            `\n\n🗺️ Move to the next zone with *${prefix}rpgmap* and *${prefix}rpgmove*`
                        )
                    }

                    return void M.reply(
                        `📍 *${zone.icon} ${zone.name}*\n\n` +
                        '✅ You have defeated all prey at your level here.\n' +
                        `🗺️ Travel to another zone with *${prefix}rpgmap* and *${prefix}rpgmove*`
                    )
                }

                // Build the prey list with kill status
                const list = available.map((e: Enemy) => {
                    const killed = p.kills[e.id] || 0
                    const killTag = killed > 0 ? ` ⚠️ Killed ${killed}x` : ''
                    return `- ${e.name} (Lv.${e.level}) — ${e.description.slice(0, 60)}${killTag}`
                }).join('\n')
                const ids = available.map((e: Enemy) => e.id).join(', ')

                return void M.reply(
                    `⚔️ *HUNT — ${zone.icon} ${zone.name}*\n\n` +
                    `🎯 Available prey:\n${list}\n\n` +
                    `⚡ Start: *${prefix}rpghunt <name>*\n` +
                    `🆔 IDs: ${ids}\n\n` +
                    `💡 Tip: You can type names like "starving wolf" or "starving_wolf"`
                )
            }

            // Search by name or ID (supports spaces)
            const enemy = findEnemyByNameOrId(args[0]) ||
                findEnemyByNameOrId(joined.replace(/\s+/g, '_'))

            if (!enemy) {
                return void M.reply(
                    '❌ Enemy not found.\n\n' +
                    `🔍 Use *${prefix}rpghunt* to see available prey in your zone.\n` +
                    '💡 Tip: Type the full name like "starving wolf"'
                )
            }

            // Check if enemy is already defeated
            if (p.kills[enemy.id] && p.kills[enemy.id] > 0) {
                return void M.reply(
                    `💀 You have already slain *${enemy.name}*!\n\n` +
                    `🎯 Check remaining prey with *${prefix}rpghunt*\n` +
                    `🗺️ Or travel to a new zone with *${prefix}rpgmap* → *${prefix}rpgmove*`
                )
            }

            // Check if enemy is in current zone
            const zone = ZONES[p.currentZone]
            if (!zone.enemies.includes(enemy.id)) {
                return void M.reply(
                    `❌ ${enemy.name} is not found in ${zone.name}.\n\n` +
                    `📍 This zone has: ${zone.enemies.join(', ')}\n\n` +
                    `🗺️ Travel to find different enemies with *${prefix}rpgmap*`
                )
            }

            const result = RPGEngine.initCombat(p, enemy.id)
            if (result.error) return void M.reply(result.error)

            // Set cooldown timestamp when initiating combat (non-mods)
            if (!isMod) {
                p.lastAction['lastHunt'] = Date.now()
            }

            await RPGDataStore.saveCombat(result.combat)
            await RPGDataStore.savePlayer(p)
            const en = result.combat.enemy

            return void M.reply(
                `⚔️ *COMBAT STARTED!*\n\n` +
                `${en.name} (Lv.${en.level})\n` +
                `${en.description}\n\n` +
                '━━━━━ YOUR ACTIONS ━━━━━\n' +
                `⚔️ *${prefix}rpghunt attack* — Strike\n` +
                `🔮 *${prefix}rpghunt skill* — Magic (15 MP)\n` +
                `🔍 *${prefix}rpghunt analyze* — Intel\n` +
                `🏃 *${prefix}rpghunt flee* — Escape\n` +
                `🖤 *${prefix}rpghunt forbidden* — Dark power`
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

            // Show remaining prey (excluding killed enemies)
            const zone = ZONES[p.currentZone]
            const zoneEnemyIds = zone.enemies
            const available = ENEMIES.filter((e: Enemy) =>
                zoneEnemyIds.includes(e.id) &&
                p.level >= e.level - 2 &&
                !(p.kills[e.id] && p.kills[e.id] > 0) // ← filter by kills, not just last enemy
            )

            let preyList = ''
            if (available.length > 0) {
                const list = available.map((e: Enemy) => `- ${e.name} (Lv.${e.level}) — ${e.description.slice(0, 60)}`).join('\n')
                preyList = `\n\n⚔️ *Remaining prey in ${zone.icon} ${zone.name}:*\n${list}\n\n🎯 Hunt next: *${prefix}rpghunt <name>*`
            } else {
                // All enemies at this level defeated
                const allZoneDead = ENEMIES.every((e: Enemy) =>
                    !zoneEnemyIds.includes(e.id) || (p.kills[e.id] && p.kills[e.id] > 0)
                )
                if (allZoneDead) {
                    const oldLevel = p.level
                    const zoneBonusXp = zone.dangerLevel * 25
                    RPGEngine.addXp(p, zoneBonusXp)
                    await RPGDataStore.savePlayer(p)

                    let levelUpMsg = ''
                    if (p.level > oldLevel) {
                        levelUpMsg = `\n\n🎉 *LEVEL UP!* You are now *Level ${p.level}*!\nYour stats have increased. New zones await.`
                    }

                    preyList = `\n\n🏆 *ZONE CLEARED!*\n📍 ${zone.icon} *${zone.name}* conquered!\n✨ Bonus XP: +${zoneBonusXp}\n⭐ XP: ${p.xp}/${RPGEngine.xpForLevel(p.level)}` +
                        levelUpMsg +
                        `\n\n🗺️ Travel: *${prefix}rpgmap* → *${prefix}rpgmove*`
                } else {
                    preyList = `\n\n✅ No more prey at your level in ${zone.name}.\n🗺️ Travel with *${prefix}rpgmap* and *${prefix}rpgmove*`
                }
            }

            return void M.reply(result.narrative + preyList)
        }

        await RPGDataStore.saveCombat(result.combat)
        await RPGDataStore.savePlayer(p)
        return void M.reply(
            result.narrative + '\n\n' +
            `⚡ Next action: *${prefix}rpghunt <attack|skill|analyze|flee|forbidden>*`
        )
    }
}