import { TitleDefinition, TitleId } from '../types.js'

export const TITLES: Record<TitleId, TitleDefinition> = {
    survivor_of_the_first_night: {
        id: 'survivor_of_the_first_night',
        name: '🌅 Survivor of the First Night',
        description: 'You survived the first night after the System descended. Most didn\'t.',
        rarity: 'common',
        bonuses: {
            statModifiers: { endurance: 1 },
            npcReaction: 'Other survivors respect you.'
        }
    },
    the_one_who_returned: {
        id: 'the_one_who_returned',
        name: '🔄 The One Who Returned',
        description: 'You have regressed—carrying knowledge from a future that no longer exists.',
        rarity: 'mythic',
        bonuses: {
            statModifiers: { intelligence: 5, mana: 5 },
            hiddenStatModifiers: { fate: 20 },
            passiveEffect: 'Access timeline knowledge. NPCs sense something impossible about you.',
            unlockZone: 'tower_of_regression'
        }
    },
    goblin_executioner: {
        id: 'goblin_executioner',
        name: '⚔️ Goblin Executioner',
        description: 'Goblins flee at the mere mention of your name. You\'ve killed hundreds.',
        rarity: 'uncommon',
        bonuses: {
            statModifiers: { strength: 2 },
            passiveEffect: 'Goblins take +25% damage from you.'
        }
    },
    apostle_of_the_black_star: {
        id: 'apostle_of_the_black_star',
        name: '⭐ Apostle of the Black Star',
        description: 'A fallen constellation has chosen you as its vessel.',
        rarity: 'mythic',
        bonuses: {
            statModifiers: { mana: 8, intelligence: 5 },
            hiddenStatModifiers: { corruption: 15, authority: 20 },
            passiveEffect: 'Commands lesser abominations. Attracts constellation events.',
            unlockZone: 'fallen_star_sanctum'
        }
    },
    butcher: {
        id: 'butcher',
        name: '🩸 Butcher',
        description: 'Your path is painted in blood. Friend and foe alike fear you.',
        rarity: 'rare',
        bonuses: {
            statModifiers: { strength: 4 },
            hiddenStatModifiers: { killingIntent: 20, reputation: -30 },
            passiveEffect: 'Intimidates human NPCs. Some merchants refuse to trade.',
            npcReaction: 'NPCs fear you. Some admire your strength.'
        }
    },
    hero: {
        id: 'hero',
        name: '🦸 Hero',
        description: 'People speak your name with hope. A heavy expectation rests on your shoulders.',
        rarity: 'rare',
        bonuses: {
            statModifiers: { endurance: 3, strength: 2 },
            hiddenStatModifiers: { reputation: 40 },
            passiveEffect: 'NPCs offer help freely. Better event outcomes. Attracts attention from bosses.',
            npcReaction: 'Most NPCs respect and trust you.'
        }
    },
    madman: {
        id: 'madman',
        name: '🤪 Madman',
        description: 'Sanity is overrated. You see truths that broke others.',
        rarity: 'uncommon',
        bonuses: {
            statModifiers: { mana: 4 },
            hiddenStatModifiers: { sanity: -20 },
            passiveEffect: 'Unlocks hidden dialogue. Void entities are drawn to you.',
            npcReaction: 'NPCs are unsettled by your presence.'
        }
    },
    shadow_of_death: {
        id: 'shadow_of_death',
        name: '👻 Shadow of Death',
        description: 'Death walks beside you—loyal, patient, hungry.',
        rarity: 'legendary',
        bonuses: {
            statModifiers: { agility: 3, strength: 3 },
            hiddenStatModifiers: { corruption: 10, killingIntent: 25 },
            passiveEffect: 'Killing blows heal 15%. Undead may serve you.',
            unlockZone: 'death_valley'
        }
    },
    dragon_slayer: {
        id: 'dragon_slayer',
        name: '🐉 Dragon Slayer',
        description: 'You killed what was thought unkillable. Dragons remember.',
        rarity: 'legendary',
        bonuses: {
            statModifiers: { strength: 6, endurance: 5 },
            passiveEffect: 'Massive damage vs dragons. Unlocks dragon events.',
            unlockZone: 'dragon_graveyard'
        }
    },
    void_walker: {
        id: 'void_walker',
        name: '🌌 Void Walker',
        description: 'The void is your home now. Reality bends around your footsteps.',
        rarity: 'mythic',
        bonuses: {
            statModifiers: { mana: 10, intelligence: 5 },
            hiddenStatModifiers: { corruption: 30, divinity: 10, authority: 25 },
            passiveEffect: 'Void-exclusive zones. Reality distortion effects.',
            unlockZone: 'void_between_worlds'
        }
    },
    blood_cultist: {
        id: 'blood_cultist',
        name: '🩸 Blood Cultist',
        description: 'The Blood Order has accepted you. Power flows where blood spills.',
        rarity: 'rare',
        bonuses: {
            statModifiers: { mana: 4, strength: 3 },
            hiddenStatModifiers: { corruption: 20 },
            passiveEffect: 'Blood affinity +50% growth. Sacrifice rituals unlock.',
            npcReaction: 'Civilians fear you. Cultists respect you.'
        }
    },
    saint_of_despair: {
        id: 'saint_of_despair',
        name: '😇 Saint of Despair',
        description: 'In darkness, your light burns brightest—and it burns you too.',
        rarity: 'legendary',
        bonuses: {
            statModifiers: { mana: 6, endurance: 4 },
            hiddenStatModifiers: { divinity: 25, reputation: 50, sanity: -15 },
            passiveEffect: 'Holy damage +30%. Self-sacrifice heals allies.',
            npcReaction: 'The desperate flock to you.'
        }
    },
    traitor_of_light: {
        id: 'traitor_of_light',
        name: '💔 Traitor of Light',
        description: 'Chosen by light. You chose darkness instead.',
        rarity: 'legendary',
        bonuses: {
            statModifiers: { strength: 5, mana: 5 },
            hiddenStatModifiers: { corruption: 25, authority: 15 },
            passiveEffect: 'Both Light and Dark skills usable. Neither faction trusts you.',
            npcReaction: 'Both sides regard you with suspicion.'
        }
    },
    tyrant: {
        id: 'tyrant',
        name: '👑 Tyrant',
        description: 'You rule through fear. The System recognizes your dominance.',
        rarity: 'legendary',
        bonuses: {
            statModifiers: { strength: 5, endurance: 4 },
            hiddenStatModifiers: { authority: 30, reputation: -40 },
            passiveEffect: 'Commands NPCs. Guilds fear you. Assassination events increase.',
            npcReaction: 'Most NPCs obey out of fear.'
        }
    }
}