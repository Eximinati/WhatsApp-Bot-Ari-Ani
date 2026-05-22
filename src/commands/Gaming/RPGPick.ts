import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { RPGEngine } from '../../rpg/RPGEngine.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { EVENTS, EVOLUTIONS } from '../../rpg/data.js'
import { GameEvent } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgpick',
            description: 'Pick an event choice',
            category: 'gaming',
            usage: `${client.config.prefix}rpgpick <number>`,
            baseXp: 3
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const jid = M.sender.jid
        const prefix = this.client.config.prefix
        let p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply(`🚫 You haven't started your journey yet!\n\n📌 Use *${prefix}rpgstart* to begin.`)

        const currentEvent = EVENTS.find((e: GameEvent) => !p!.eventsSeen.includes(e.id))
        if (!currentEvent) return void M.reply(`📜 No active event.\n\nUse *${prefix}rpgquest* to find one.`)

        const choiceNum = parseInt(args[0] || '0', 10)
        if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > currentEvent.choices.length) {
            return void M.reply(`❌ Pick 1-${currentEvent.choices.length}.`)
        }

        const choice = currentEvent.choices[choiceNum - 1]
        const result = RPGEngine.resolveEvent(p, currentEvent.id, choice.id)
        p = result.p
        await RPGDataStore.savePlayer(p)

        if (p.evolutionPath && p.stage === 'evolved') {
            const evo = EVOLUTIONS[p.evolutionPath]
            result.narrative += '\n\n🌀 *EVOLUTION UNLOCKED!*\n' + (evo?.name || '') + '\n✨ ' + (evo?.bonuses.specialAbility || '')
        }
        if (result.unlockedSecrets.length > 0) {
            result.narrative += '\n\n🔮 *SECRET DISCOVERED!*\n' + result.unlockedSecrets.join('\n')
        }

        return void M.reply(
            '━━━━━━━━━━━━━━━━━━━━━\n' +
            result.narrative +
            `\n━━━━━━━━━━━━━━━━━━━━━\n\n💡 Use *${prefix}rpgquest* for more events.`
        )
    }
}