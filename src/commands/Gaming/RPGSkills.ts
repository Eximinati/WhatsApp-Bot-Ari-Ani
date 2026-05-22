import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { TRAITS, EVOLUTIONS } from '../../rpg/data.js'
import { TraitId } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgskills',
            description: 'View your affinities, traits & evolution',
            category: 'gaming',
            usage: `${client.config.prefix}rpgskills`,
            aliases: ['skills'],
            baseXp: 1
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const jid = M.sender.jid
        const prefix = this.client.config.prefix
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply(`🚫 You haven't started your journey yet!\n\n📌 Use *${prefix}rpgstart* to begin.`)

        const affStr = p.affinities
            .filter((a: { level: number }) => a.level > 0)
            .map((a: { type: string; level: number; xp: number; maxXp: number }) =>
                `🔹 ${a.type.toUpperCase()} Lv.${a.level} (${a.xp}/${a.maxXp})`)
            .join('\n') || 'None'

        const traitStr = p.traits
            .map((t: string) => `🔸 ${TRAITS[t as TraitId]?.name || t}: ${TRAITS[t as TraitId]?.description || ''}`)
            .join('\n')

        return void M.reply(
            '📜 *SKILLS & AFFINITIES* 📜\n\n' +
            '━━━━━ AFFINITIES ━━━━━\n' + affStr + '\n\n' +
            '━━━━━ TRAITS ━━━━━\n' + traitStr + '\n\n' +
            (p.evolutionPath ? `━━━━━ EVOLUTION ━━━━━\n🌀 ${EVOLUTIONS[p.evolutionPath]?.name}\n✨ ${EVOLUTIONS[p.evolutionPath]?.bonuses.specialAbility}\n` : '') +
            '\n💠 Your actions shape your path.'
        )
    }
}