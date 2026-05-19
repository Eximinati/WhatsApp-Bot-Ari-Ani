import { Evolution, EvolutionPath } from '../types.js'

export const EVOLUTIONS: Record<EvolutionPath, Evolution> = {
    execution_path: {
        path: 'execution_path',
        name: '⚔️ Execution Path',
        description: 'You have become an instrument of death. Every swing is a sentence carried out.',
        requirements: { minAffinity: { sword: 5 }, kills: 50 },
        bonuses: {
            stats: { strength: 10, agility: 5 },
            hiddenStats: { killingIntent: 30 },
            specialAbility: "Executioner's Verdict: Instantly kill enemies below 20% HP."
        }
    },
    cult_leader_path: {
        path: 'cult_leader_path',
        name: '🕯️ Cult Leader Path',
        description: 'Followers flock to your words. Your influence spreads like beautiful poison.',
        requirements: { minAffinity: { charisma: 5, deception: 3 }, karma: -30 },
        bonuses: {
            stats: { intelligence: 8, mana: 6 },
            hiddenStats: { authority: 25, reputation: 20 },
            specialAbility: 'Mass Conversion: Recruit NPCs who gather resources and fight for you.'
        }
    },
    apostle_path: {
        path: 'apostle_path',
        name: '⭐ Apostle Path',
        description: 'A constellation has accepted you as its vessel. Cosmic power flows through you.',
        requirements: {
            minAffinity: { void: 5, light: 3 },
            traits: ['void_touched'],
            corruption: 40
        },
        bonuses: {
            stats: { mana: 15, intelligence: 8 },
            hiddenStats: { divinity: 30, corruption: 20, authority: 30 },
            specialAbility: "Constellation's Blessing: Once per battle, call down cosmic annihilation."
        }
    },
    shadow_path: {
        path: 'shadow_path',
        name: '🌑 Shadow Path',
        description: 'You have become one with darkness. The shadows are your domain.',
        requirements: { minAffinity: { shadow: 5, fear: 3 }, traits: ['shadow_walker'] },
        bonuses: {
            stats: { agility: 12, intelligence: 5 },
            hiddenStats: { reputation: -20 },
            specialAbility: 'Shadow Realm: Phase into shadows, untargetable for 2 turns.'
        }
    },
    dragon_path: {
        path: 'dragon_path',
        name: '🐉 Dragon Path',
        description: 'The dragon blood has awakened. You are more than human now.',
        requirements: {
            minAffinity: { fire: 4, blood: 3 },
            traits: ['dragon_vessel'],
            kills: 100
        },
        bonuses: {
            stats: { strength: 12, endurance: 10, mana: 8 },
            hiddenStats: { bloodline: 40, authority: 20 },
            specialAbility: "Dragon's Breath: Devastating breath attack that ignores resistances."
        }
    },
    void_path: {
        path: 'void_path',
        name: '🌌 Void Path',
        description: 'The void claims you. Reality breaks around your existence.',
        requirements: { minAffinity: { void: 6 }, corruption: 60 },
        bonuses: {
            stats: { mana: 20, intelligence: 10 },
            hiddenStats: { corruption: 40, sanity: -30 },
            specialAbility: 'Void Eater: Consume enemy abilities, gaining their power permanently.'
        }
    },
    saint_path: {
        path: 'saint_path',
        name: '😇 Saint Path',
        description: 'You walk a path of light in darkness. Your faith moves mountains.',
        requirements: { minAffinity: { holy: 5, light: 4 }, karma: 50, titles: ['hero'] },
        bonuses: {
            stats: { endurance: 8, mana: 12 },
            hiddenStats: { divinity: 40, reputation: 60 },
            specialAbility: 'Divine Intervention: Once per day, negate a death.'
        }
    },
    tyrant_path: {
        path: 'tyrant_path',
        name: '👑 Tyrant Path',
        description: 'Power is its own justification. You rule because you are strong enough.',
        requirements: {
            minAffinity: { leadership: 5, fear: 4 },
            karma: -50,
            titles: ['butcher']
        },
        bonuses: {
            stats: { strength: 10, intelligence: 6 },
            hiddenStats: { authority: 50, reputation: -50 },
            specialAbility: 'Iron Fist: Commands in faction wars succeed automatically.'
        }
    },
    prophet_path: {
        path: 'prophet_path',
        name: '🔮 Prophet Path',
        description: 'You see the threads of fate. The future is a book you have learned to read.',
        requirements: {
            minAffinity: { psychic: 5 },
            traits: ['prophets_burden'],
            timelineFragments: 10
        },
        bonuses: {
            stats: { intelligence: 15, mana: 8 },
            hiddenStats: { fate: 50, sanity: -20 },
            specialAbility: 'Fate Weaver: Reroll any event outcome once per day.'
        }
    },
    survivor_path: {
        path: 'survivor_path',
        name: '🏃 Survivor Path',
        description: 'Not the strongest. Not the smartest. But you are still here.',
        requirements: { minAffinity: { survival: 5 }, deaths: 3 },
        bonuses: {
            stats: { endurance: 8, agility: 8 },
            hiddenStats: { fate: 20 },
            specialAbility: 'Adaptive Survival: After near-death, gain permanent random stat boost.'
        }
    }
}