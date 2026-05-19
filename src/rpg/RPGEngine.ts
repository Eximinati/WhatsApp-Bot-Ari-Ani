/* eslint-disable @typescript-eslint/no-explicit-any */
import { RPGDataStore } from './RPGDataStore.js'
import { ORIGINS, TRAITS, TITLES, ITEMS, ENEMIES, EVENTS, EVOLUTIONS } from './data.js'
import * as types from './types.js'
import { createCharacterCanvas } from './CharacterCanvas.js'

type Profile = types.PlayerProfile

export class RPGEngine {
    static clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)) }
    static rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }
    static chance(pct: number): boolean { return Math.random() * 100 < pct }

    static async getOrCreateProfile(jid: string, name: string): Promise<Profile> {
        let p = await RPGDataStore.getPlayer(jid)
        if (!p) p = await RPGDataStore.createPlayer(jid, name)
        return p
    }

    static calcCombatPower(p: Profile): number {
        const s = p.stats
        let power = s.strength * 3 + s.agility * 2 + s.endurance * 2 + s.intelligence + s.mana * 1.5
            for (const tId of p.traits) {
            const t = TRAITS[tId as keyof typeof TRAITS]
            if (t?.effects?.combatBonus) power += t.effects.combatBonus
            if (t?.effects?.statModifiers) {
                const sm = t.effects.statModifiers
                power += (sm.strength || 0) * 3 + (sm.agility || 0) * 2 + (sm.endurance || 0) * 2 + (sm.intelligence || 0) + (sm.mana || 0) * 1.5
            }
        }
        for (const tId of p.titles) {
            const t = TITLES[tId as keyof typeof TITLES]
            if (t?.bonuses?.statModifiers) {
                const sm = t.bonuses.statModifiers
                power += (sm.strength || 0) * 3 + (sm.agility || 0) * 2 + (sm.endurance || 0) * 2 + (sm.intelligence || 0) + (sm.mana || 0) * 1.5
            }
        }
        return Math.floor(power)
    }

    static xpForLevel(level: number): number { return Math.floor(50 * Math.pow(level, 1.4)) }

    static addXp(p: Profile, amount: number): Profile {
        p.xp += amount
        let leveled = false
        while (p.xp >= this.xpForLevel(p.level)) {
            p.xp -= this.xpForLevel(p.level)
            leveled = true
            p.stats.strength += 1; p.stats.agility += 1; p.stats.endurance += 1; p.stats.intelligence += 1; p.stats.mana += 1
            p.gauges.maxHp += 10; p.gauges.maxMp += 5
            p.gauges.hp = p.gauges.maxHp; p.gauges.mp = p.gauges.maxMp
            p.gauges.maxStamina += 5; p.gauges.stamina = p.gauges.maxStamina
        }
        return p
    }

    static addAffinityXp(p: Profile, type: types.AffinityType, xp: number): Profile {
        let aff = p.affinities.find(a => a.type === type)
        if (!aff) { aff = { type, level: 0, xp: 0, maxXp: 10 }; p.affinities.push(aff) }
        aff.xp += xp
        while (aff.xp >= aff.maxXp) {
            aff.xp -= aff.maxXp; aff.level++
            aff.maxXp = Math.floor(10 * Math.pow(1.5, aff.level))
        }
        this.checkEvolution(p)
        return p
    }

    static checkEvolution(p: Profile): void {
        if (p.stage === 'evolved' && p.evolutionPath) return
        const entries = Object.entries(EVOLUTIONS) as [types.EvolutionPath, types.Evolution][]
        for (const [pathKey, evo] of entries) {
            const req = evo.requirements; let met = true
            if (req.minAffinity) {
                for (const [atype, minLvl] of Object.entries(req.minAffinity)) {
                    const aff = p.affinities.find(a => a.type === atype)
                    if (!aff || aff.level < (minLvl as number)) { met = false; break }
                }
            }
            if (met && req.titles) { for (const t of req.titles) { if (!p.titles.includes(t as any)) { met = false; break } } }
            if (met && req.traits) { for (const t of req.traits) { if (!p.traits.includes(t as any)) { met = false; break } } }
            if (met && req.kills && Object.values(p.kills).reduce((a: number, b: number) => a + b, 0) < req.kills) met = false
            if (met && req.karma !== undefined) {
                if (req.karma > 0 && p.karma < req.karma) met = false
                if (req.karma < 0 && p.karma > req.karma) met = false
            }
            if (met && req.corruption !== undefined && p.hiddenStats.corruption < req.corruption) met = false
            if (met && req.timelineFragments !== undefined && p.timelineFragments < req.timelineFragments) met = false
            if (met && req.deaths !== undefined && p.deaths < req.deaths) met = false
            if (met) {
                p.evolutionPath = pathKey; p.stage = 'evolved'
                p.stats.strength += evo.bonuses.stats.strength || 0
                p.stats.agility += evo.bonuses.stats.agility || 0
                p.stats.endurance += evo.bonuses.stats.endurance || 0
                p.stats.intelligence += evo.bonuses.stats.intelligence || 0
                p.stats.mana += evo.bonuses.stats.mana || 0
                p.hiddenStats.fate += evo.bonuses.hiddenStats.fate || 0
                p.hiddenStats.corruption += evo.bonuses.hiddenStats.corruption || 0
                p.hiddenStats.authority += evo.bonuses.hiddenStats.authority || 0
                p.hiddenStats.divinity += evo.bonuses.hiddenStats.divinity || 0
                p.hiddenStats.sanity += evo.bonuses.hiddenStats.sanity || 0
                p.hiddenStats.bloodline += evo.bonuses.hiddenStats.bloodline || 0
                p.hiddenStats.killingIntent += evo.bonuses.hiddenStats.killingIntent || 0
                p.hiddenStats.reputation += evo.bonuses.hiddenStats.reputation || 0
                return
            }
        }
    }

    static setOrigin(p: Profile, originId: types.OriginId): Profile {
        const origin = ORIGINS[originId]
        if (!origin) {
            const keys = Object.keys(ORIGINS).filter(k => k !== 'random') as types.OriginId[]
            return this.setOrigin(p, keys[Math.floor(Math.random() * keys.length)])
        }
        p.origin = originId
        const bonus = origin.startingBonus
        if (bonus.strength) p.stats.strength += bonus.strength
        if (bonus.agility) p.stats.agility += bonus.agility
        if (bonus.endurance) p.stats.endurance += bonus.endurance
        if (bonus.intelligence) p.stats.intelligence += bonus.intelligence
        if (bonus.mana) p.stats.mana += bonus.mana
        if (origin.startingTrait && !p.traits.includes(origin.startingTrait)) p.traits.push(origin.startingTrait)
        p.gauges.maxHp = 100 + p.stats.endurance * 10; p.gauges.maxMp = 50 + p.stats.mana * 10
        p.gauges.hp = p.gauges.maxHp; p.gauges.mp = p.gauges.maxMp
        p.gauges.maxStamina = 100 + p.stats.endurance * 5; p.gauges.stamina = p.gauges.maxStamina
        p.stage = 'personality_test'
        return p
    }

    static detectTraitsFromChoiceType(p: Profile, choiceType: string): Profile {
        if (choiceType === 'violent' && !p.traits.includes('predatory_instinct')) {
            p.hiddenStats.killingIntent += 3
            if (p.hiddenStats.killingIntent >= 15) p.traits.push('predatory_instinct')
        }
        if (choiceType === 'manipulative' && !p.traits.includes('silver_tongue') && p.stats.intelligence >= 5) p.traits.push('silver_tongue')
        if (choiceType === 'brave' && p.psyche.confidence > 60 && !p.traits.includes('iron_will')) p.traits.push('iron_will')
        if (choiceType === 'compassionate' && p.karma > 30 && !p.traits.includes('survivors_guilt')) p.traits.push('survivors_guilt')
        return p
    }

    static resolveEvent(p: Profile, eventId: string, choiceId: string): { narrative: string; p: Profile; unlockedSecrets: string[] } {
        const event = EVENTS.find((e: types.GameEvent) => e.id === eventId)
        if (!event) return { narrative: 'Event not found.', p, unlockedSecrets: [] }
        const choice = event.choices.find((c: types.EventChoice) => c.id === choiceId)
        if (!choice) return { narrative: 'Invalid choice.', p, unlockedSecrets: [] }
        p.eventsSeen.push(eventId)

        const hasReturned = p.traits.includes('the_returned_one')
        const hasBroken = p.traits.includes('broken_mind')
        const hasProphet = p.traits.includes('prophets_burden')
        let useHidden = false
        if (choice.hiddenCondition) {
            if (hasReturned && this.chance(30)) useHidden = true
            else if (hasProphet && this.chance(40)) useHidden = true
            else if (hasBroken && this.chance(25)) useHidden = true
            else if (p.isRegressed && this.chance(50)) useHidden = true
        }
        if (useHidden && choice.hiddenCondition) {
            this.applyEffects(p, choice.hiddenCondition.effects)
            this.detectTraitsFromChoiceType(p, choice.type)
            return { narrative: choice.hiddenCondition.narrative, p, unlockedSecrets: ['Hidden condition triggered!'] }
        }

        const luckMod = (p.luck / 10) * 30
        let successChance = 50 + luckMod
        if (choice.statRequirements) {
            const req = choice.statRequirements
            const score = p.stats.strength + p.stats.agility + p.stats.endurance + p.stats.intelligence + p.stats.mana
            const reqScore = (req.strength || 0) + (req.agility || 0) + (req.endurance || 0) + (req.intelligence || 0) + (req.mana || 0)
            if (score >= reqScore) successChance += 25; else successChance -= 15
        }
        if (choice.type === 'brave' && p.traits.includes('iron_will')) successChance += 15
        if (choice.type === 'cautious' && p.traits.includes('cowardly_survivor')) successChance += 20

        const success = this.chance(this.clamp(successChance, 10, 90))
        const effectSet = success ? choice.success : choice.failure
        this.applyEffects(p, effectSet.effects)
        this.detectTraitsFromChoiceType(p, choice.type)

        if (choice.type === 'brave') this.addAffinityXp(p, 'sword', 1)
        if (choice.type === 'cautious') this.addAffinityXp(p, 'shadow', 1)
        if (choice.type === 'manipulative') this.addAffinityXp(p, 'deception', 1)
        if (choice.type === 'compassionate') this.addAffinityXp(p, 'leadership', 1)
        if (choice.type === 'violent') this.addAffinityXp(p, 'blood', 1)
        if (choice.type === 'sacrificial') this.addAffinityXp(p, 'holy', 1)
        if (choice.type === 'selfish') this.addAffinityXp(p, 'survival', 1)
        return { narrative: effectSet.narrative, p, unlockedSecrets: [] }
    }

    static applyEffects(p: Profile, effects: types.EventEffect[]): void {
        for (const ef of effects) {
            switch (ef.type) {
                case 'stat': { const key = ef.target as keyof types.StatBlock; if (key in p.stats) (p.stats as any)[key] = this.clamp((p.stats as any)[key] + (ef.value || 0), 1, 999); break }
                case 'hidden_stat': { const key = ef.target as keyof types.HiddenStatBlock; if (key in p.hiddenStats) (p.hiddenStats as any)[key] = this.clamp((p.hiddenStats as any)[key] + (ef.value || 0), -100, 100); break }
                case 'psyche': { const key = ef.target as keyof types.PsycheState; if (key in p.psyche) (p.psyche as any)[key] = this.clamp((p.psyche as any)[key] + (ef.value || 0), 0, 100); break }
                case 'item': if (ef.itemId && ef.value !== undefined) { const inv = p.inventory.find(i => i.itemId === ef.itemId); if (inv) inv.quantity = Math.max(0, inv.quantity + ef.value); else if (ef.value > 0) p.inventory.push({ itemId: ef.itemId, quantity: ef.value }); } break
                case 'currency': p.currency = Math.max(0, p.currency + (ef.value || 0)); break
                case 'trait': if (ef.traitId && !p.traits.includes(ef.traitId)) p.traits.push(ef.traitId); break
                case 'title': if (ef.titleId && !p.titles.includes(ef.titleId)) p.titles.push(ef.titleId); break
                case 'affinity': if (ef.affinityType) this.addAffinityXp(p, ef.affinityType, ef.value || 1); break
                case 'xp': this.addXp(p, ef.value || 0); break
                case 'damage': if (ef.target === 'hp') p.gauges.hp = Math.max(0, p.gauges.hp - (ef.value || 0)); else if (ef.target === 'mp') p.gauges.mp = Math.max(0, p.gauges.mp - (ef.value || 0)); break
                case 'heal': if (ef.target === 'hp') p.gauges.hp = Math.min(p.gauges.maxHp, p.gauges.hp + (ef.value || 0)); else if (ef.target === 'mp') p.gauges.mp = Math.min(p.gauges.maxMp, p.gauges.mp + (ef.value || 0)); break
                case 'karma': p.karma = this.clamp(p.karma + (ef.value || 0), -100, 100); break
                case 'prophecy': if (ef.prophecyText) p.knownProphecies.push(ef.prophecyText); break
                case 'evolution': if (ef.evolutionPath) { p.evolutionPath = ef.evolutionPath; p.stage = 'evolved' } break
                case 'gauge': if (ef.target === 'stamina') p.gauges.stamina = this.clamp(p.gauges.stamina + (ef.value || 0), 0, p.gauges.maxStamina); break
            }
        }
        for (const slot of Object.values(p.equipment)) { if (!slot) continue; const item = ITEMS[slot as keyof typeof ITEMS]; if (item?.corrupt && this.chance(item.corruptRisk)) p.hiddenStats.corruption = this.clamp(p.hiddenStats.corruption + 2, 0, 100) }
        if (p.psyche.madness > 50 && !p.mentalState.includes('unstable')) p.mentalState.push('unstable')
        if (p.psyche.confidence <= 10 && !p.mentalState.includes('broken')) p.mentalState.push('broken')
        if (p.psyche.trauma > 60 && !p.mentalState.includes('traumatized')) p.mentalState.push('traumatized')
    }

    // ═══════════════════════════════════════════════════════
    // COMBAT — HIDDEN ENEMY SYSTEM
    // Players see descriptive text, NOT enemy HP/abilities/weaknesses
    // Only the analyze command reveals partial info
    // ═══════════════════════════════════════════════════════

    static initCombat(p: Profile, enemyId: string): { combat: types.CombatState; error?: string } {
        const enemy = ENEMIES.find((e: types.Enemy) => e.id === enemyId)
        if (!enemy) return { combat: null as any, error: 'That enemy does not exist in this world.' }
        if (p.level < enemy.level - 3 && !p.isRegressed) {
            return { combat: null as any, error: 'You sense overwhelming danger from this foe. Survival chance is near zero. You may still try, but death is likely.' }
        }
        const combat: types.CombatState = {
            playerJid: p.jid,
            enemy: JSON.parse(JSON.stringify(enemy)),
            turn: 'player',
            playerGauges: { ...p.gauges },
            enemyGauges: { hp: enemy.gauges.hp, maxHp: enemy.gauges.maxHp, mp: enemy.gauges.mp, maxMp: enemy.gauges.maxMp, stamina: 0, maxStamina: 0 },
            loggedActions: [],
            combatLog: [],
            statusEffects: [],
            phase: 'waiting_input',
            analyzing: false,
            analysisCount: 0
        }
        return { combat }
    }

    static combatAction(combat: types.CombatState, action: string, p: Profile): { combat: types.CombatState; narrative: string; p: Profile; victory?: boolean; defeat?: boolean; fled?: boolean } {
        if (combat.phase !== 'waiting_input') return { combat, narrative: 'The battle has ended.', p }

        const enemy = combat.enemy
        const playerG = combat.playerGauges
        const enemyG = combat.enemyGauges
        const lines: string[] = []

        combat.turn = 'player'

        // Descriptive combat text arrays
        const strikeWords = ['strike', 'slash', 'lunge', 'thrust', 'swing', 'cut', 'pierce']
        const enemyReactions = ['reels from', 'stumbles under', 'grunts at', 'snarls against', 'wavers from']
        const magicWords = ['unleash a bolt of mana', 'channel arcane energy', 'release a crackling spell', 'hurl a pulse of magic']
        const enemyMagicReact = ['convulses under', 'shrieks against', 'flickers from', 'buckles under']

        switch (action) {
            case 'attack': {
                const physDmg = Math.max(1, (p.stats.strength * 2 + p.stats.agility) - enemy.stats.endurance)
                const isWeak = enemy.weaknesses.some((w: string) => p.affinities.find(a => a.type === w && a.level >= 2))
                const finalDmg = isWeak ? Math.floor(physDmg * 1.5) : physDmg
                const predatorBonus = p.traits.includes('predatory_instinct') ? 10 : 0
                const critChance = p.stats.agility + (p.luck * 2)
                const isCrit = this.chance(this.clamp(critChance, 1, 40))
                const dmg = (finalDmg + predatorBonus) * (isCrit ? 2 : 1)
                enemyG.hp = Math.max(0, enemyG.hp - dmg)

                const move = strikeWords[Math.floor(Math.random() * strikeWords.length)]
                const react = enemyReactions[Math.floor(Math.random() * enemyReactions.length)]
                const dmgDesc = dmg > 20 ? 'a devastating' : dmg > 10 ? 'a solid' : dmg > 5 ? 'a glancing' : 'a light'

                if (isCrit) {
                    lines.push(`💥 *CRITICAL STRIKE!* You find an opening and deliver ${dmgDesc} blow. The ${enemy.name.toLowerCase()} ${react} the impact hard!`)
                } else {
                    lines.push(`⚔️ You ${move} at the ${enemy.name.toLowerCase()}. ${dmgDesc} hit. The enemy ${react} your attack.`)
                }
                if (isWeak) lines.push(`⚡ Your elemental affinity resonates — you feel the attack struck something vulnerable!`)
                break
            }
            case 'skill': {
                const manaCost = 15
                if (playerG.mp < manaCost) { lines.push('❌ Your mana reserves are too depleted for magic.'); break }
                playerG.mp -= manaCost
                const magDmg = Math.max(5, p.stats.mana * 3 - enemy.stats.intelligence)
                enemyG.hp = Math.max(0, enemyG.hp - magDmg)
                const cast = magicWords[Math.floor(Math.random() * magicWords.length)]
                const react = enemyMagicReact[Math.floor(Math.random() * enemyMagicReact.length)]
                const dmgDesc = magDmg > 25 ? 'violently' : magDmg > 15 ? 'strongly' : 'noticeably'
                lines.push(`🔮 You ${cast}! The ${enemy.name.toLowerCase()} ${react} the energy, ${dmgDesc} harmed.`)
                lines.push(`💙 Mana used: ${manaCost}`)
                break
            }
            case 'analyze': {
                combat.analysisCount++
                combat.analyzing = true
                const revealed: string[] = []
                // Only reveal general feel, not exact numbers
                const hpPct = enemyG.hp / enemy.gauges.maxHp
                if (combat.analysisCount >= 1) {
                    if (hpPct > 0.7) revealed.push('The enemy appears barely wounded.')
                    else if (hpPct > 0.4) revealed.push('The enemy is showing signs of damage.')
                    else if (hpPct > 0.15) revealed.push('The enemy is badly wounded — close to death.')
                    else revealed.push('The enemy is barely standing. A few more hits should finish it.')
                }
                if (combat.analysisCount >= 2) {
                    if (enemy.weaknesses.length > 0) revealed.push('You sense a vulnerability to certain elemental energies.')
                    if (enemy.resistances.length > 0) revealed.push('It seems resistant to some types of damage.')
                }
                if (combat.analysisCount >= 3 && enemy.weaknesses.length > 0) {
                    revealed.push(`It fears: ${enemy.weaknesses.join(', ')}`)
                }
                if (combat.analysisCount >= 4 && enemy.resistances.length > 0) {
                    revealed.push(`It resists: ${enemy.resistances.join(', ')}`)
                }
                lines.push(`🔍 *Analysis (${combat.analysisCount}):*\n${revealed.join('\n')}`)
                break
            }
            case 'flee': {
                const fleeChance = 40 + p.stats.agility * 3 + (p.traits.includes('cowardly_survivor') ? 30 : 0)
                if (this.chance(fleeChance)) {
                    lines.push('🏃 You break away from combat and escape into the shadows. The enemy does not pursue.')
                    combat.phase = 'fled'
                    return { combat, narrative: lines.join('\n'), p, fled: true }
                }
                lines.push('❌ You try to flee but the enemy blocks your path! It attacks as you stumble.')
                break
            }
            case 'forbidden_skill': {
                if (!p.traits.includes('apostle_of_ruin') && !p.traits.includes('void_touched')) {
                    lines.push('🚫 Dark power surges within you — but you lack the connection to control it.')
                    break
                }
                const sacHp = Math.floor(playerG.hp * 0.3)
                playerG.hp = Math.max(1, playerG.hp - sacHp)
                const forbDmg = (p.stats.mana * 5 - enemy.stats.endurance) + sacHp
                enemyG.hp = Math.max(0, enemyG.hp - Math.floor(forbDmg))
                p.hiddenStats.corruption = this.clamp(p.hiddenStats.corruption + 8, 0, 100)
                lines.push(`🖤 *FORBIDDEN POWER!* You sacrifice a portion of your life force. Black energy erupts from your hands! The ${enemy.name.toLowerCase()} writhes in agony.`)
                lines.push(`⚠️ The darkness whispers — Corruption grows within you.`)
                break
            }
            default: { lines.push('⚔️ Available actions: *attack* | *skill* | *analyze* | *flee* | *forbidden_skill*'); break }
        }

        // Check enemy defeat
        if (enemyG.hp <= 0) {
            enemyG.hp = 0
            const xpGain = enemy.xpReward
            const currGain = enemy.currencyReward
            this.addXp(p, xpGain)
            p.currency += currGain
            p.kills[enemy.id] = (p.kills[enemy.id] || 0) + 1

            if (enemy.type === 'beast') this.addAffinityXp(p, 'survival', 2)
            if (enemy.type === 'undead') this.addAffinityXp(p, 'holy', 2)
            if (enemy.type === 'demon' || enemy.type === 'abomination') this.addAffinityXp(p, 'void', 2)
            if (enemy.type === 'human') this.addAffinityXp(p, 'sword', 2)
            if (enemy.type === 'dragon') { this.addAffinityXp(p, 'fire', 3); this.addAffinityXp(p, 'blood', 2) }
            if ((p.kills['corrupted_goblin'] || 0) >= 10 && !p.titles.includes('goblin_executioner')) p.titles.push('goblin_executioner')
            if ((p.kills['young_drake'] || 0) >= 1 && !p.titles.includes('dragon_slayer')) p.titles.push('dragon_slayer')

            for (const loot of enemy.loot) {
                if (this.chance(loot.chance * 100)) {
                    const inv = p.inventory.find(i => i.itemId === loot.itemId)
                    if (inv) inv.quantity += loot.quantity
                    else p.inventory.push({ itemId: loot.itemId, quantity: loot.quantity })
                    const itm = ITEMS[loot.itemId as keyof typeof ITEMS]
                    if (itm) lines.push(`📦 *Loot found:* ${itm.name} x${loot.quantity}`)
                }
            }

            lines.push(`\n🎉 *VICTORY!* The ${enemy.name.toLowerCase()} lies defeated at your feet.`)
            lines.push(`✨ Gained ${xpGain} XP and ${currGain} coins.`)
            combat.phase = 'victory'
            return { combat, narrative: lines.join('\n'), p, victory: true }
        }

        // Enemy turn — narrative attack
        combat.turn = 'enemy'
        const ability = enemy.abilities[Math.floor(Math.random() * enemy.abilities.length)]
        if (ability) {
            let enemyDmg = Math.max(1, ability.damage + enemy.stats.strength - p.stats.endurance)
            if (p.traits.includes('iron_will') && ability.type === 'mental') enemyDmg = Math.floor(enemyDmg * 0.5)
            if (p.traits.includes('void_touched') && ability.type === 'corruption') enemyDmg = Math.floor(enemyDmg * 0.7)
            playerG.hp = Math.max(0, playerG.hp - enemyDmg)

            const dmgDesc = enemyDmg > 20 ? 'heavily' : enemyDmg > 10 ? 'solidly' : 'lightly'
            lines.push(`\n🔻 The ${enemy.name.toLowerCase()} *${ability.name.toLowerCase()}s* — it connects ${dmgDesc}!`)
            if (ability.statusEffect) {
                combat.statusEffects.push({ target: 'player', effect: ability.statusEffect, remaining: 2 })
                lines.push(`⚠️ You feel *${ability.statusEffect}* settling in...`)
            }
        }

        // Player death check
        if (playerG.hp <= 0) {
            playerG.hp = 0
            const bdbUsed = p.lastAction['blessed_by_death_used']
            if (p.traits.includes('blessed_by_death') && (!bdbUsed || bdbUsed < Date.now() - 86400000)) {
                playerG.hp = Math.floor(p.gauges.maxHp * 0.3)
                p.lastAction['blessed_by_death_used'] = Date.now()
                lines.push('\n💀 Everything goes black... but a cold hand pulls you back. *Death has rejected you.* You wake gasping, a fraction of your strength returned.')
            } else {
                p.deaths++
                p.psyche.trauma = this.clamp(p.psyche.trauma + 25, 0, 100)
                p.gauges.hp = playerG.hp; p.gauges.mp = playerG.mp
                combat.phase = 'defeat'
                lines.push(`\n💀 *DEFEATED!* You fall to the ${enemy.name.toLowerCase()}...\n\nEverything fades to black.\n\nYou awaken later, wounded and traumatized. Some of your progress is lost.`)
                return { combat, narrative: lines.join('\n'), p, defeat: true }
            }
        }

        // Show gauges as narrative
        const hpPct = Math.round((playerG.hp / playerG.maxHp) * 100)
        const mpPct = Math.round((playerG.mp / playerG.maxMp) * 100)
        let hpDesc = hpPct > 70 ? 'You feel strong.' : hpPct > 40 ? 'You are wounded but fighting.' : hpPct > 15 ? 'You are badly hurt.' : 'You are barely standing!'
        let mpDesc = mpPct > 50 ? 'Mana flows well.' : mpPct > 20 ? 'Mana is running low.' : 'Mana is nearly depleted!'

        lines.push(`\n━━━ STATUS ━━━`)
        lines.push(`❤️ ${hpDesc}`)
        lines.push(`💙 ${mpDesc}`)
        lines.push(`The enemy ${enemyG.hp > enemy.gauges.maxHp * 0.5 ? 'still looks dangerous' : 'appears weakened'}.`)

        combat.turn = 'player'
        combat.playerGauges = playerG
        combat.enemyGauges = enemyG
        return { combat, narrative: lines.join('\n'), p }
    }

    static formatStatus(p: Profile): string {
        const s = p.stats; const g = p.gauges
        const visibleTraits = p.traits.filter((t) => TRAITS[t as keyof typeof TRAITS]?.visible).map((t) => TRAITS[t as keyof typeof TRAITS].name).join(', ') || 'None'
        const titleNames = p.titles.map((t) => TITLES[t as keyof typeof TITLES]?.name || t).join(', ')
        const affStr = p.affinities.filter((a: types.Affinity) => a.level > 0).map((a: types.Affinity) => `${a.type.toUpperCase()} Lv.${a.level}`).join(' | ') || 'None'
        const power = this.calcCombatPower(p)
        const origin = ORIGINS[p.origin]?.name || 'Unknown'
        const zone = p.currentZone || 'unknown'

        return `━━━━━━━━━━━━━━━━━━━
📊 *SYSTEM STATUS*
━━━━━━━━━━━━━━━━━━━

👤 *${p.name}*
🎖️ Level: ${p.level} | ⚔️ Power: ${power}
💠 ${origin}
📍 Zone: ${zone}
⭐ XP: ${p.xp}/${this.xpForLevel(p.level)}
${p.evolutionPath ? `🌀 Evolution: ${EVOLUTIONS[p.evolutionPath]?.name || p.evolutionPath}\n` : ''}
━━━ STATS ━━━
💪 STR: ${s.strength} | 🏃 AGI: ${s.agility} | 🛡️ END: ${s.endurance}
🧠 INT: ${s.intelligence} | 🔮 MANA: ${s.mana}

━━━ GAUGES ━━━
❤️ HP: ${g.hp}/${g.maxHp} | 💙 MP: ${g.mp}/${g.maxMp} | ⚡ STA: ${g.stamina}/${g.maxStamina}

━━━ TITLES ━━━
${titleNames}

━━━ AFFINITIES ━━━
${affStr}

━━━ TRAITS ━━━
${visibleTraits}

⚖️ Karma: ${p.karma} | 🍀 Luck: ${p.luck}/10
🧠 Mental: ${p.mentalState.length > 0 ? p.mentalState.join(', ') : 'Stable'}
💰 Coins: ${p.currency} | 🏴 BM: ${p.blackMarketTokens}
💀 Deaths: ${p.deaths}

📜 Prophecies:
${p.knownProphecies.length > 0 ? p.knownProphecies.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n') : 'None'}`
    }

    static async generateCharacterImage(p: Profile): Promise<Buffer | null> {
        try { return await createCharacterCanvas(p) } catch { return null }
    }
}