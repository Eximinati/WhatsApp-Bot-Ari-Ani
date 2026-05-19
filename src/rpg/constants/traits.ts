import { TraitDefinition, TraitId } from '../types.js'

export const TRAITS: Record<TraitId, TraitDefinition> = {
    the_returned_one: {
        id: 'the_returned_one',
        name: '🔄 The Returned One',
        description: "You've walked this path before. Fragments of another timeline haunt your dreams.",
        rarity: 'mythic',
        visible: false,
        effects: {
            combatBonus: 15,
            dialogueUnlocks: ['remember_future_event', 'recognize_hidden_boss'],
            passiveAbility: 'Chance to predict enemy attacks. Unlocks hidden dialogue options.'
        }
    },
    blessed_by_death: {
        id: 'blessed_by_death',
        name: '💀 Blessed by Death',
        description: 'Death has refused you. Multiple times. It has left its mark.',
        rarity: 'legendary',
        visible: true,
        effects: {
            combatBonus: 10,
            passiveAbility: 'Survive a fatal blow once per day. Death-element skills deal +20% damage.'
        }
    },
    broken_mind: {
        id: 'broken_mind',
        name: '🌀 Broken Mind',
        description: 'Your sanity cracked before the apocalypse. Now the cracks let things through.',
        rarity: 'rare',
        visible: false,
        effects: {
            statModifiers: { mana: 5 },
            dialogueUnlocks: ['hear_whispers', 'understand_void_language'],
            passiveAbility: 'Mana +5. Sanity drain +30%. Hear things others cannot.'
        }
    },
    dragon_vessel: {
        id: 'dragon_vessel',
        name: '🐉 Dragon Vessel',
        description: 'Ancient dragon blood flows through your veins — dormant power waiting to awaken.',
        rarity: 'legendary',
        visible: false,
        effects: {
            statModifiers: { strength: 3, endurance: 3 },
            passiveAbility: 'STR/END +3. Dragon enemies may hesitate. Unlocks Dragon Evolution.'
        }
    },
    cowardly_survivor: {
        id: 'cowardly_survivor',
        name: '🏃 Cowardly Survivor',
        description: 'You ran when others fought. You are alive. They are not. That counts for something.',
        rarity: 'common',
        visible: true,
        effects: {
            statModifiers: { agility: 3 },
            passiveAbility: 'Agility +3. Retreat options always succeed.'
        }
    },
    apostle_of_ruin: {
        id: 'apostle_of_ruin',
        name: '💥 Apostle of Ruin',
        description: 'The thing that ends worlds has taken notice of you.',
        rarity: 'mythic',
        visible: false,
        effects: {
            statModifiers: { strength: 5, mana: 5 },
            dialogueUnlocks: ['command_lesser_demons', 'open_void_gate'],
            passiveAbility: 'STR/MANA +5. Corruption gain +50%. Demons may serve or hunt you.'
        }
    },
    predatory_instinct: {
        id: 'predatory_instinct',
        name: '🐺 Predatory Instinct',
        description: 'You see weakness. You exploit it. The System has refined your nature.',
        rarity: 'uncommon',
        visible: true,
        effects: {
            combatBonus: 10,
            passiveAbility: '+10 combat damage. Sense injured enemies. Killing Intent rises faster.'
        }
    },
    silver_tongue: {
        id: 'silver_tongue',
        name: '👅 Silver Tongue',
        description: 'Words are your weapon. You have talked your way out of death more than once.',
        rarity: 'uncommon',
        visible: true,
        effects: {
            dialogueUnlocks: ['persuade_npc', 'lie_to_system', 'negotiate_price'],
            passiveAbility: 'Better trade prices. NPCs more likely to reveal secrets.'
        }
    },
    iron_will: {
        id: 'iron_will',
        name: '🛡️ Iron Will',
        description: 'Your mind is a fortress. Fear, madness — they break against you like waves on stone.',
        rarity: 'rare',
        visible: true,
        effects: {
            statModifiers: { endurance: 4 },
            passiveAbility: 'Endurance +4. Sanity loss reduced 50%. Fear effects weaker.'
        }
    },
    shadow_walker: {
        id: 'shadow_walker',
        name: '🌑 Shadow Walker',
        description: 'Shadows recognize you as kin. They bend to your will.',
        rarity: 'rare',
        visible: true,
        effects: {
            statModifiers: { agility: 4 },
            passiveAbility: 'Agility +4. Chance to avoid combat. Shadow affinity rises faster.'
        }
    },
    bloodhound: {
        id: 'bloodhound',
        name: '🔍 Bloodhound',
        description: 'You can track anything. Smell fear, follow blood trails, sense hidden things.',
        rarity: 'uncommon',
        visible: true,
        effects: {
            dialogueUnlocks: ['track_enemy', 'find_hidden_items'],
            passiveAbility: 'Better loot from hunts. Discover hidden enemies and zones.'
        }
    },
    empty_shell: {
        id: 'empty_shell',
        name: '🏺 Empty Shell',
        description: 'Something hollow lives inside you. It yearns to be filled.',
        rarity: 'uncommon',
        visible: false,
        effects: {
            dialogueUnlocks: ['absorb_essence'],
            passiveAbility: 'Can absorb traits from fallen enemies. Unpredictable evolution.'
        }
    },
    survivors_guilt: {
        id: 'survivors_guilt',
        name: '😔 Survivor\'s Guilt',
        description: 'They died. You lived. The weight never leaves you.',
        rarity: 'common',
        visible: true,
        effects: {
            dialogueUnlocks: ['inspire_survivors'],
            passiveAbility: 'Bonus damage vs enemies that killed allies. Stress rises faster.'
        }
    },
    prophets_burden: {
        id: 'prophets_burden',
        name: '🔮 Prophet\'s Burden',
        description: 'You see what is coming. The knowledge is a curse as much as a gift.',
        rarity: 'legendary',
        visible: false,
        effects: {
            statModifiers: { mana: 5, intelligence: 3 },
            dialogueUnlocks: ['predict_outcome', 'see_hidden_path'],
            passiveAbility: 'INT+3, MANA+5. Receive prophecies. Sanity drains faster.'
        }
    },
    void_touched: {
        id: 'void_touched',
        name: '🌌 Void Touched',
        description: 'The void between worlds left its mark on your soul.',
        rarity: 'rare',
        visible: false,
        effects: {
            statModifiers: { mana: 5 },
            dialogueUnlocks: ['commune_with_void', 'resist_corruption'],
            passiveAbility: 'Mana +5. Void/Corruption damage reduced. NPCs feel uneasy.'
        }
    }
}