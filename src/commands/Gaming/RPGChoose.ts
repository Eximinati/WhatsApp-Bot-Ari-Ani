import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { RPGEngine } from '../../rpg/RPGEngine.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { ORIGINS, TRAITS } from '../../rpg/data.js'
import { OriginId, TraitId } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgchoose',
            description: 'Choose your origin',
            category: 'gaming',
            usage: `${client.config.prefix}rpgchoose <1-8>`,
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const jid = M.sender.jid
        const prefix = this.client.config.prefix
        let p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply(`🚫 No profile found.\n\n📌 Use *${prefix}rpgstart* first!`)
        if (p.stage !== 'origin_selection') return void M.reply('⚡ Origin already chosen. Continue with *rpgquest*!')

        const choice = parseInt(args[0] || '0', 10)
        if (isNaN(choice) || choice < 1 || choice > 8) return void M.reply('Choose 1-8.')

        const keys = Object.keys(ORIGINS) as OriginId[]
        const originId = keys[choice - 1]
        p = RPGEngine.setOrigin(p, originId)
        await RPGDataStore.savePlayer(p)

        const origin = ORIGINS[p.origin]
        const ti = p.traits.map((t) => TRAITS[t as TraitId]?.name).filter(Boolean).join(', ')

        return void M.reply(
            '━━━━━━━━━━━━━━━━━━━━━\n💠 *ORIGIN SELECTED* 💠\n━━━━━━━━━━━━━━━━━━━━━\n\n' +
            `You are: *${origin.name}*\n\n${origin.description}\n\n` +
            `*Stats:* 🏋🏽STR:${p.stats.strength}\n🧘🏽AGI:${p.stats.agility}\n🏃🏽END:${p.stats.endurance}\n🧠INT:${p.stats.intelligence}\n🪬MANA:${p.stats.mana}\n\n` +
            `🔮*Trait:* ${ti}\n\n💡Use ${prefix}*rpgquest* for your first trial!`
        )
    }
}