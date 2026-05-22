// ─── ORIGINS ────────────────────────────────────────────
export type OriginId =
    | 'homeless_survivor' | 'failed_athlete' | 'medical_student' | 'ex_soldier'
    | 'cult_escapee' | 'office_worker' | 'prisoner' | 'random'

export interface Origin {
    id: OriginId; name: string; description: string
    startingBonus: Partial<StatBlock>; startingTrait: TraitId
}

// ─── STATS ──────────────────────────────────────────────
export interface StatBlock { strength: number; agility: number; endurance: number; intelligence: number; mana: number }
export interface HiddenStatBlock { fate: number; corruption: number; authority: number; divinity: number; sanity: number; bloodline: number; killingIntent: number; reputation: number }
export interface PsycheState { fear: number; trauma: number; stress: number; hunger: number; confidence: number; madness: number }
export interface GaugeValues { hp: number; maxHp: number; mp: number; maxMp: number; stamina: number; maxStamina: number }

export type TraitId =
    | 'the_returned_one' | 'blessed_by_death' | 'broken_mind' | 'dragon_vessel' | 'cowardly_survivor'
    | 'apostle_of_ruin' | 'predatory_instinct' | 'silver_tongue' | 'iron_will' | 'shadow_walker'
    | 'bloodhound' | 'empty_shell' | 'survivors_guilt' | 'prophets_burden' | 'void_touched'

export interface TraitDefinition { id: TraitId; name: string; description: string; rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic'; visible: boolean; effects: Partial<{ statModifiers: Partial<StatBlock>; combatBonus: number; dialogueUnlocks: string[]; questUnlocks: string[]; npcReactions: Record<string, string>; passiveAbility: string }> }

export type AffinityType =
    | 'sword' | 'fire' | 'necromancy' | 'leadership' | 'fear' | 'blood'
    | 'shadow' | 'light' | 'void' | 'nature' | 'ice' | 'thunder'
    | 'poison' | 'holy' | 'psychic' | 'charisma' | 'deception' | 'survival'
    | 'physical' | 'magical' | 'mental' | 'water'

export interface Affinity { type: AffinityType; level: number; xp: number; maxXp: number }

export type TitleId =
    | 'survivor_of_the_first_night' | 'the_one_who_returned' | 'goblin_executioner' | 'apostle_of_the_black_star'
    | 'butcher' | 'hero' | 'madman' | 'shadow_of_death' | 'dragon_slayer' | 'void_walker'
    | 'blood_cultist' | 'saint_of_despair' | 'traitor_of_light' | 'tyrant'

export interface TitleDefinition { id: TitleId; name: string; description: string; rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic'; bonuses: Partial<{ statModifiers: Partial<StatBlock>; hiddenStatModifiers: Partial<HiddenStatBlock>; npcReaction: string; passiveEffect: string; unlockZone: string }> }

export type EvolutionPath =
    | 'execution_path' | 'cult_leader_path' | 'apostle_path' | 'shadow_path' | 'dragon_path'
    | 'void_path' | 'saint_path' | 'tyrant_path' | 'prophet_path' | 'survivor_path'

export interface Evolution { path: EvolutionPath; name: string; description: string; requirements: Partial<{ minAffinity: Record<string, number>; titles: TitleId[]; traits: TraitId[]; kills: number; karma: number; corruption: number; timelineFragments: number; deaths: number }>; bonuses: { stats: Partial<StatBlock>; hiddenStats: Partial<HiddenStatBlock>; specialAbility: string } }

export type ItemId =
    | 'rusty_sword' | 'survivors_knife' | 'cursed_blade_hunger' | 'shadow_cloak' | 'ring_of_memories'
    | 'mask_of_madness' | 'broken_amulet' | 'phoenix_feather' | 'void_shard' | 'dragons_scale'
    | 'blood_crystal' | 'saints_relic' | 'expired_ration' | 'mana_potion_small' | 'bandage'
    | 'demonic_contract' | 'holy_water' | 'black_market_key' | 'tower_key_fragment' | 'memory_shard'

export type ItemRarity = 'junk' | 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic' | 'cursed'
export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'key_item' | 'material'

export interface ItemDefinition { id: ItemId; name: string; description: string; type: ItemType; rarity: ItemRarity; lore: string; stackable: boolean; corrupt: boolean; corruptRisk: number; evolveable: boolean; evolveTarget?: ItemId; bindOnEquip: boolean; equippable: boolean; slot?: 'weapon' | 'head' | 'body' | 'accessory1' | 'accessory2'; stats?: Partial<StatBlock>; effects?: string[]; value: number }

export interface PlayerProfile {
    jid: string; name: string; origin: OriginId; level: number; xp: number
    stage: 'origin_selection' | 'personality_test' | 'awakening' | 'awakened' | 'evolved'
    personalityTestAnswers: number[]
    stats: StatBlock; hiddenStats: HiddenStatBlock; psyche: PsycheState; gauges: GaugeValues
    traits: TraitId[]; affinities: Affinity[]; titles: TitleId[]; evolutionPath?: EvolutionPath
    karma: number; luck: number; mentalState: string[]
    inventory: Array<{ itemId: ItemId; quantity: number }>
    equipment: Partial<Record<'weapon' | 'head' | 'body' | 'accessory1' | 'accessory2', ItemId>>
    skills: string[]; lastAction: Record<string, number>
    currency: number; blackMarketTokens: number
    questsCompleted: string[]; eventsSeen: string[]; kills: Record<string, number>; deaths: number
    faction?: string; factionRank?: number; factionReputation?: number
    currentZone: ZoneId; discoveredZones: ZoneId[]
    characterImageUrl?: string
    knownProphecies: string[]; timelineFragments: number; isRegressed: boolean; createdAt: number
}

export interface GameEvent { id: string; title: string; narrative: string; isDangerous: boolean; minLevel: number; requiredTraits?: TraitId[]; forbiddenTraits?: TraitId[]; choices: EventChoice[] }
export interface EventChoice { id: string; text: string; type: 'brave' | 'cautious' | 'manipulative' | 'violent' | 'compassionate' | 'selfish' | 'sacrificial'; statRequirements?: Partial<StatBlock>; traitRequirements?: TraitId[]; success: { narrative: string; effects: EventEffect[] }; failure: { narrative: string; effects: EventEffect[] }; hiddenCondition?: { narrative: string; effects: EventEffect[] } }
export interface EventEffect { type: 'stat' | 'hidden_stat' | 'psyche' | 'item' | 'currency' | 'trait' | 'title' | 'affinity' | 'xp' | 'damage' | 'heal' | 'skill' | 'evolution' | 'prophecy' | 'gauge' | 'karma'; target: string; value?: number; itemId?: ItemId; traitId?: TraitId; titleId?: TitleId; affinityType?: AffinityType; skillName?: string; evolutionPath?: EvolutionPath; prophecyText?: string }

export interface Enemy { id: string; name: string; description: string; level: number; stats: StatBlock; gauges: { hp: number; maxHp: number; mp: number; maxMp: number }; abilities: EnemyAbility[]; loot: Array<{ itemId: ItemId; chance: number; quantity: number }>; xpReward: number; currencyReward: number; type: 'beast' | 'undead' | 'demon' | 'human' | 'abomination' | 'spirit' | 'dragon'; weaknesses: AffinityType[]; resistances: AffinityType[]; specialDialogue?: string[]; hiddenConditionReward?: { narrative: string; effects: EventEffect[] } }
export interface EnemyAbility { name: string; description: string; damage: number; type: 'physical' | 'magical' | 'mental' | 'corruption'; statusEffect?: string }
export interface CombatState { playerJid: string; enemy: Enemy; turn: 'player' | 'enemy'; playerGauges: GaugeValues; enemyGauges: GaugeValues; loggedActions: string[]; combatLog: string[]; statusEffects: Array<{ target: 'player' | 'enemy'; effect: string; remaining: number }>; phase: 'waiting_input' | 'resolving' | 'victory' | 'defeat' | 'fled'; analyzing: boolean; analysisCount: number }

export type ZoneId =
    | 'ruined_city' | 'dark_forest' | 'scorched_plains' | 'cathedral_ruins' | 'black_market_district'
    | 'tower_gate' | 'frozen_wastes' | 'void_rift' | 'survivor_camp' | 'abyssal_depths'

export interface Zone { id: ZoneId; name: string; description: string; icon: string; x: number; y: number; connections: ZoneId[]; minLevel: number; requiredTitles?: TitleId[]; requiredTraits?: TraitId[]; requiredEvolution?: EvolutionPath; enemies: string[]; events: string[]; treasureMultiplier: number; dangerLevel: number; lore: string }

export interface WorldState { era: string; day: number; activeEvents: string[]; fallenCities: string[]; bossThreats: Array<{ bossId: string; zone: string; timer: number }>; factionStatuses: Record<string, { power: number; territory: number; atWar: boolean }>; marketMultiplier: number; globalScarcity: Record<string, number>; currentSeason: 'calm' | 'unrest' | 'war' | 'cataclysm' | 'apocalypse' }
export interface Faction { id: string; name: string; description: string; alignment: 'good' | 'neutral' | 'evil' | 'chaotic'; power: number; territory: number; members: string[]; rivals: string[]; allies: string[]; joinRequirement: Partial<{ minLevel: number; minKarma: number; maxCorruption: number; titles: TitleId[]; traits: TraitId[] }> }
export interface RPGAction { type: 'event' | 'combat' | 'status' | 'inventory' | 'skill' | 'profile' | 'market' | 'message'; message: string; imageBuffer?: Buffer; imageCaption?: string; mentions?: string[]; contextInfo?: Record<string, unknown> }