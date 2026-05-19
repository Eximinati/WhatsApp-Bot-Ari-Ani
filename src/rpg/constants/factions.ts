import { Faction } from '../types.js'

export const FACTIONS: Faction[] = [
    {
        id: 'survivors_alliance',
        name: '🏘️ Survivors Alliance',
        description: 'A loose coalition of survivor camps. Divided but united by desperation.',
        alignment: 'good',
        power: 40,
        territory: 25,
        members: [],
        rivals: ['blood_order', 'shadow_guild'],
        allies: ['saints_remnants'],
        joinRequirement: { minKarma: 0, minLevel: 2 }
    },
    {
        id: 'blood_order',
        name: '🩸 The Blood Order',
        description: 'A cult that worships power in blood. Great power for great sacrifice.',
        alignment: 'evil',
        power: 60,
        territory: 30,
        members: [],
        rivals: ['saints_remnants', 'survivors_alliance'],
        allies: ['black_star_apostles'],
        joinRequirement: { maxCorruption: 80, minLevel: 5 }
    },
    {
        id: 'shadow_guild',
        name: '🌑 Shadow Guild',
        description: 'Information brokers and assassins. Knowledge is the deadliest weapon.',
        alignment: 'chaotic',
        power: 50,
        territory: 20,
        members: [],
        rivals: ['saints_remnants'],
        allies: [],
        joinRequirement: { minLevel: 3, traits: ['shadow_walker'] }
    },
    {
        id: 'saints_remnants',
        name: "✝️ Saint's Remnants",
        description: 'The last priests and paladins. Their god may be dead but faith remains.',
        alignment: 'good',
        power: 35,
        territory: 15,
        members: [],
        rivals: ['blood_order', 'black_star_apostles'],
        allies: ['survivors_alliance'],
        joinRequirement: { minKarma: 30, maxCorruption: 20 }
    },
    {
        id: 'black_star_apostles',
        name: '⭐ Black Star Apostles',
        description: 'Worshippers of fallen constellations. They see beauty in annihilation.',
        alignment: 'evil',
        power: 75,
        territory: 35,
        members: [],
        rivals: ['saints_remnants'],
        allies: ['blood_order'],
        joinRequirement: { minLevel: 8, titles: ['apostle_of_the_black_star'] }
    },
    {
        id: 'tower_climbers',
        name: '🗼 Tower Climbers',
        description: 'Elite mercenaries who challenge the Towers. Death rate is 90%. Worth it.',
        alignment: 'neutral',
        power: 70,
        territory: 10,
        members: [],
        rivals: [],
        allies: [],
        joinRequirement: { minLevel: 10 }
    }
]