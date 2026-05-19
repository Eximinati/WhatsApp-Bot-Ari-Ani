import { Origin, OriginId } from '../types.js'

export const ORIGINS: Record<OriginId, Origin> = {
    homeless_survivor: {
        id: 'homeless_survivor',
        name: '🏚️ Homeless Survivor',
        description: 'You lived on the streets long before the System arrived. Hunger, cold, and betrayal were your teachers.\n\n*"The weak die first. I learned that when I was seven."*',
        startingBonus: { endurance: 3, agility: 2 },
        startingTrait: 'cowardly_survivor'
    },
    failed_athlete: {
        id: 'failed_athlete',
        name: '🏃 Failed Athlete',
        description: 'An injury ended your career before it began. Your body remembers what it was trained to do.\n\n*"They said I\'d never run again. Let\'s prove them wrong."*',
        startingBonus: { strength: 3, endurance: 3 },
        startingTrait: 'iron_will'
    },
    medical_student: {
        id: 'medical_student',
        name: '🏥 Medical Student',
        description: 'You understand the human body better than most — its weaknesses, its breaking points.\n\n*"The difference between poison and medicine is dosage."*',
        startingBonus: { intelligence: 4, mana: 2 },
        startingTrait: 'empty_shell'
    },
    ex_soldier: {
        id: 'ex_soldier',
        name: '🎖️ Ex-Soldier',
        description: 'Discharged after an incident you don\'t talk about. The System feels... familiar.\n\n*"I\'ve seen hell. This is just a different battlefield."*',
        startingBonus: { strength: 4, agility: 2 },
        startingTrait: 'survivors_guilt'
    },
    cult_escapee: {
        id: 'cult_escapee',
        name: '🕯️ Cult Escapee',
        description: 'You escaped the prophecy cult that raised you. But some things can\'t be unlearned.\n\n*"They said the stars would fall. They were right."*',
        startingBonus: { mana: 4, intelligence: 3 },
        startingTrait: 'void_touched'
    },
    office_worker: {
        id: 'office_worker',
        name: '💼 Office Worker',
        description: 'A lifetime of corporate politics taught you things no university could.\n\n*"Power is perception. Always has been."*',
        startingBonus: { intelligence: 3, mana: 2 },
        startingTrait: 'silver_tongue'
    },
    prisoner: {
        id: 'prisoner',
        name: '🔗 Prisoner',
        description: 'You were serving a life sentence when the world ended. Freedom came with a price.\n\n*"I already died once. This is my second chance."*',
        startingBonus: { strength: 3, endurance: 2 },
        startingTrait: 'bloodhound'
    },
    random: {
        id: 'random',
        name: '🎲 Random Awakening',
        description: 'The System chooses for you. Fate is a fickle thing.\n\n*"Let the dice fall where they may."*',
        startingBonus: {},
        startingTrait: 'empty_shell'
    }
}