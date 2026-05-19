// ─── Aggregated game data exports ──────────────────────────
import { ORIGINS } from './constants/origins.js'
import { TRAITS } from './constants/traits.js'
import { TITLES } from './constants/titles.js'
import { ITEMS } from './constants/items.js'
import { ENEMIES } from './constants/enemies.js'
import { EVENTS } from './constants/events.js'
import { EVOLUTIONS } from './constants/evolutions.js'
import { FACTIONS } from './constants/factions.js'
import { ZONES } from './constants/zones.js'

export {
    ORIGINS,
    TRAITS,
    TITLES,
    ITEMS,
    ENEMIES,
    EVENTS,
    EVOLUTIONS,
    FACTIONS,
    ZONES
}

export const AFFINITY_TYPES = [
    'sword', 'fire', 'necromancy', 'leadership', 'fear', 'blood',
    'shadow', 'light', 'void', 'nature', 'ice', 'thunder', 'poison',
    'holy', 'psychic', 'charisma', 'deception', 'survival'
] as const