import { GameEvent } from '../types.js'

export const EVENTS: GameEvent[] = [
    {
        id: 'first_awakening',
        title: '⚡ First Awakening',
        narrative: 'The System pulses in your mind. Reality bends—for a moment, you can see the truth.\n\n*[A voice speaks directly into your soul]*\n\n"Your potential has been recognized."\n\nChoose carefully. This will shape everything.',
        isDangerous: false,
        minLevel: 1,
        choices: [
            {
                id: 'path_fighter',
                text: '⚔️ [Fighter] Strength is the only truth.',
                type: 'brave',
                success: {
                    narrative: 'Power floods your body. Your muscles tighten, bones harden.\n\n**[Sword Affinity awakened!]**',
                    effects: [
                        { type: 'affinity', target: 'affinity', affinityType: 'sword', value: 1 },
                        { type: 'stat', target: 'strength', value: 3 }
                    ]
                },
                failure: {
                    narrative: 'The power is overwhelming. Your body struggles.',
                    effects: [{ type: 'damage', target: 'hp', value: 10 }]
                }
            },
            {
                id: 'path_rogue',
                text: '🗡️ [Rogue] Speed and cunning. Strike unseen.',
                type: 'cautious',
                success: {
                    narrative: 'The world slows. You see openings everywhere.\n\n**[Shadow Affinity awakened!]**',
                    effects: [
                        { type: 'affinity', target: 'affinity', affinityType: 'shadow', value: 1 },
                        { type: 'stat', target: 'agility', value: 3 }
                    ]
                },
                failure: {
                    narrative: 'You second-guess yourself.',
                    effects: [{ type: 'psyche', target: 'confidence', value: -5 }]
                }
            },
            {
                id: 'path_mystic',
                text: '🔮 [Mystic] There is more to this world than flesh and steel.',
                type: 'compassionate',
                success: {
                    narrative: 'You feel mana flowing through everything.\n\n**[Void Affinity awakened!]**',
                    effects: [
                        { type: 'affinity', target: 'affinity', affinityType: 'void', value: 1 },
                        { type: 'stat', target: 'mana', value: 3 }
                    ]
                },
                failure: {
                    narrative: 'The mana burns through you.',
                    effects: [{ type: 'damage', target: 'mp', value: 15 }]
                }
            }
        ]
    },
    {
        id: 'starving_child',
        title: '🍞 Starving Child',
        narrative: 'A child—maybe eight—stares with hollow eyes. She points at your rations.\n\n"Please... I haven\'t eaten in three days."\n\nHer ribs show through rags. But your supplies are limited.',
        isDangerous: false,
        minLevel: 1,
        choices: [
            {
                id: 'beat_child',
                text: '👊 Beat the child. Weakness deserves no mercy.',
                type: 'violent',
                success: {
                    narrative: 'She crumples without sound. No tears—she has seen worse.\n\n**[Karma -15. Killing Intent +10.]**',
                    effects: [
                        { type: 'karma', target: 'karma', value: -15 },
                        { type: 'hidden_stat', target: 'killingIntent', value: 10 },
                        { type: 'trait', target: 'trait', traitId: 'predatory_instinct' }
                    ]
                },
                failure: {
                    narrative: 'She dodges—too fast for a starving child—and vanishes. You feel watched.',
                    effects: [
                        { type: 'psyche', target: 'fear', value: 10 },
                        { type: 'hidden_stat', target: 'reputation', value: -10 }
                    ]
                }
            },
            {
                id: 'ignore_child',
                text: '🚶 Ignore her. You have your own problems.',
                type: 'selfish',
                success: {
                    narrative: 'You walk away. She calls: "I hope you survive too." The words follow.',
                    effects: [
                        { type: 'psyche', target: 'stress', value: 5 },
                        { type: 'hidden_stat', target: 'fate', value: -2 }
                    ]
                },
                failure: {
                    narrative: 'You cannot stop thinking about her eyes.',
                    effects: [
                        { type: 'psyche', target: 'trauma', value: 10 },
                        { type: 'psyche', target: 'stress', value: 15 }
                    ]
                }
            },
            {
                id: 'share_food',
                text: '🍞 Share your food. No one deserves to starve.',
                type: 'compassionate',
                success: {
                    narrative: 'She devours it. Then she looks at you—really looks.\n\n"The Cathedral will fall. The bells will ring three times. When they do—run north."\n\n**[Karma +10. Hidden prophecy received!]**',
                    effects: [
                        { type: 'karma', target: 'karma', value: 10 },
                        { type: 'prophecy', target: 'prophecy', prophecyText: 'When Cathedral bells ring three times, run north.' },
                        { type: 'hidden_stat', target: 'fate', value: 5 },
                        { type: 'item', target: 'item', itemId: 'expired_ration', value: -1 }
                    ]
                },
                failure: {
                    narrative: 'The food is spoiled. You made things worse.',
                    effects: [
                        { type: 'karma', target: 'karma', value: -5 },
                        { type: 'psyche', target: 'trauma', value: 10 }
                    ]
                }
            },
            {
                id: 'manipulate_child',
                text: '👄 "Tell me what you\'ve seen, and I\'ll give you food."',
                type: 'manipulative',
                success: {
                    narrative: 'She tells you about patrols, supply caches, a survivor camp. She smiles, but her eyes are cold.\n\n**[INT +1. Deception affinity. Information gained.]**',
                    effects: [
                        { type: 'stat', target: 'intelligence', value: 1 },
                        { type: 'affinity', target: 'affinity', affinityType: 'deception', value: 1 },
                        { type: 'item', target: 'item', itemId: 'bandage', value: 2 }
                    ]
                },
                failure: {
                    narrative: '"You think I\'m stupid?" She spits at your feet and runs.',
                    effects: [
                        { type: 'hidden_stat', target: 'reputation', value: -10 },
                        { type: 'psyche', target: 'confidence', value: -5 }
                    ]
                }
            }
        ]
    },
    {
        id: 'burning_building',
        title: '🔥 Burning Building',
        narrative: 'Smoke fills the sky. An apartment building is on fire—and you hear screaming.\n\nSomeone shouts: "My daughter is still in there!"',
        isDangerous: true,
        minLevel: 2,
        choices: [
            {
                id: 'rush_in',
                text: '🏃 Rush in to save her.',
                type: 'brave',
                success: {
                    narrative: 'You crash through the door. Smoke chokes you—but you find the girl and drag her out as the ceiling collapses.\n\n**[Hero title! Karma +20. Minor burns.]**',
                    effects: [
                        { type: 'title', target: 'title', titleId: 'hero' },
                        { type: 'karma', target: 'karma', value: 20 },
                        { type: 'damage', target: 'hp', value: 20 },
                        { type: 'hidden_stat', target: 'reputation', value: 25 }
                    ]
                },
                failure: {
                    narrative: 'The floor gives way. You barely escape—without the girl.\n\n**[HP -40. Trauma +20.]**',
                    effects: [
                        { type: 'damage', target: 'hp', value: 40 },
                        { type: 'psyche', target: 'trauma', value: 20 },
                        { type: 'psyche', target: 'stress', value: 30 }
                    ]
                }
            },
            {
                id: 'stay_safe',
                text: '🛡️ Stay back. It is too dangerous.',
                type: 'cautious',
                success: {
                    narrative: 'Someone else rushes in and saves the girl. The crowd cheers for them.\n\n**[Safety maintained. But at what cost?]**',
                    effects: [
                        { type: 'psyche', target: 'confidence', value: -5 },
                        { type: 'hidden_stat', target: 'reputation', value: 5 }
                    ]
                },
                failure: {
                    narrative: 'Nobody tries. The screaming stops. The silence is worse.',
                    effects: [
                        { type: 'psyche', target: 'trauma', value: 10 },
                        { type: 'hidden_stat', target: 'sanity', value: -5 }
                    ]
                }
            },
            {
                id: 'loot_first',
                text: '💰 The building next door has a shop. Loot it while everyone is distracted.',
                type: 'selfish',
                success: {
                    narrative: 'You slip away and loot the shop—medical supplies, food, cash. The building collapses behind you.\n\n**[Loot obtained. Reputation -15.]**',
                    effects: [
                        { type: 'item', target: 'item', itemId: 'bandage', value: 3 },
                        { type: 'item', target: 'item', itemId: 'expired_ration', value: 4 },
                        { type: 'item', target: 'item', itemId: 'mana_potion_small', value: 2 },
                        { type: 'currency', target: 'currency', value: 50 },
                        { type: 'hidden_stat', target: 'reputation', value: -15 },
                        { type: 'karma', target: 'karma', value: -10 }
                    ]
                },
                failure: {
                    narrative: 'The shop is already empty. Someone saw you sneaking.',
                    effects: [
                        { type: 'hidden_stat', target: 'reputation', value: -20 },
                        { type: 'karma', target: 'karma', value: -10 }
                    ]
                }
            }
        ]
    },
    {
        id: 'strange_merchant',
        title: '🎪 The Strange Merchant',
        narrative: 'A cloaked figure at a stall. Their wares are... unusual.\n\nItems that glow. Potions that whisper. A sword that breathes.\n\nThe merchant smiles with too many teeth.\n\n"Looking for something... special?"',
        isDangerous: false,
        minLevel: 1,
        choices: [
            {
                id: 'buy_item',
                text: '🛒 Examine the wares.',
                type: 'cautious',
                success: {
                    narrative: 'Rare and cursed items—each with a story and a price beyond gold.\n\n**[Black Market Key obtained!]**',
                    effects: [{ type: 'item', target: 'item', itemId: 'black_market_key', value: 1 }]
                },
                failure: {
                    narrative: '"You can\'t afford anything here. Come back when you\'re... interesting."',
                    effects: [{ type: 'psyche', target: 'confidence', value: -5 }]
                }
            },
            {
                id: 'talk_merchant',
                text: '💬 "Who are you, really?"',
                type: 'brave',
                success: {
                    narrative: '"I trade in what others throw away—memories, destinies, forgotten things. Take this. An investment."\n\n**[Memory Shard obtained. Void affinity.]**',
                    effects: [
                        { type: 'item', target: 'item', itemId: 'memory_shard', value: 1 },
                        { type: 'affinity', target: 'affinity', affinityType: 'void', value: 1 }
                    ]
                },
                failure: {
                    narrative: 'The merchant vanishes. The stall was never there.',
                    effects: [
                        { type: 'psyche', target: 'fear', value: 15 },
                        { type: 'psyche', target: 'stress', value: 10 }
                    ]
                }
            },
            {
                id: 'steal_merchant',
                text: '🖐️ Try to steal something.',
                type: 'violent',
                success: {
                    narrative: 'Your hand closes around a vial—but the merchant grabs your wrist.\n\n"Keep it. But you owe me now. The Void collects all debts."\n\n**[Blood Crystal. Debt incurred.]**',
                    effects: [
                        { type: 'item', target: 'item', itemId: 'blood_crystal', value: 1 },
                        { type: 'hidden_stat', target: 'corruption', value: 10 }
                    ]
                },
                failure: {
                    narrative: 'The merchant catches you. Their eyes turn black.\n\n"Try that again and I\'ll trade your soul."',
                    effects: [
                        { type: 'psyche', target: 'fear', value: 20 },
                        { type: 'psyche', target: 'trauma', value: 5 }
                    ]
                }
            }
        ]
    },
    {
        id: 'survivor_camp_attack',
        title: '🏕️ Camp Under Siege',
        narrative: 'You stumble upon a survivor camp under attack. Corrupted goblins pour from the treeline.\n\nDefenders are falling. Children are screaming.\n\nYou could help... or use the chaos.',
        isDangerous: true,
        minLevel: 2,
        choices: [
            {
                id: 'fight_alongside',
                text: '⚔️ Join the fight! Protect the survivors!',
                type: 'brave',
                success: {
                    narrative: 'You charge in. The defenders rally. Together you push the horde back.\n\n"You saved us. We won\'t forget."\n\n**[Karma +15. Reputation +20. Leadership affinity.]**',
                    effects: [
                        { type: 'karma', target: 'karma', value: 15 },
                        { type: 'hidden_stat', target: 'reputation', value: 20 },
                        { type: 'xp', target: 'xp', value: 50 },
                        { type: 'affinity', target: 'affinity', affinityType: 'leadership', value: 2 }
                    ]
                },
                failure: {
                    narrative: 'Too many goblins. You take a deep wound and barely escape.',
                    effects: [
                        { type: 'damage', target: 'hp', value: 40 },
                        { type: 'psyche', target: 'trauma', value: 15 }
                    ]
                }
            },
            {
                id: 'sneak_loot',
                text: '🕵️ Slip into the camp and take what you can.',
                type: 'selfish',
                success: {
                    narrative: 'No one notices you in the chaos. The supply tent is yours.\n\n**[Loot obtained. Reputation -25.]**',
                    effects: [
                        { type: 'item', target: 'item', itemId: 'bandage', value: 5 },
                        { type: 'item', target: 'item', itemId: 'mana_potion_small', value: 3 },
                        { type: 'item', target: 'item', itemId: 'expired_ration', value: 5 },
                        { type: 'currency', target: 'currency', value: 100 },
                        { type: 'hidden_stat', target: 'reputation', value: -25 },
                        { type: 'karma', target: 'karma', value: -20 }
                    ]
                },
                failure: {
                    narrative: 'A defender spots you. "THIEF!" You barely escape.',
                    effects: [
                        { type: 'damage', target: 'hp', value: 25 },
                        { type: 'hidden_stat', target: 'reputation', value: -40 },
                        { type: 'karma', target: 'karma', value: -15 }
                    ]
                }
            },
            {
                id: 'negotiate',
                text: '🗣️ "I\'ll help—but what\'s in it for me?"',
                type: 'manipulative',
                success: {
                    narrative: 'The leader looks at you with disgust, then desperation. "Fine."\n\nYou fight. You win. You collect.\n\n**[Reward received. Grudging respect.]**',
                    effects: [
                        { type: 'item', target: 'item', itemId: 'mana_potion_small', value: 5 },
                        { type: 'currency', target: 'currency', value: 60 },
                        { type: 'affinity', target: 'affinity', affinityType: 'charisma', value: 1 },
                        { type: 'hidden_stat', target: 'reputation', value: 5 }
                    ]
                },
                failure: {
                    narrative: '"We don\'t negotiate with mercenaries." The camp falls.',
                    effects: [
                        { type: 'psyche', target: 'trauma', value: 10 },
                        { type: 'hidden_stat', target: 'reputation', value: -10 }
                    ]
                }
            }
        ]
    }
]