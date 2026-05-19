import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { EVENTS } from '../../rpg/data.js'
import { GameEvent, EventChoice } from '../../rpg/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgquest',
            description: 'Encounter a System Event',
            category: 'gaming',
            usage: `${client.config.prefix}rpgquest`,
            aliases: ['quest'],
            baseXp: 2
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const jid = M.sender.jid
        const p = await RPGDataStore.getPlayer(jid)
        if (!p) return void M.reply('Start first: *!rpgstart*')

        const combat = await RPGDataStore.getCombat(jid)
        if (combat) return void M.reply('You are in combat! Finish with !rpghunt.')

        if (p.stage === 'origin_selection') return void M.reply('Choose your origin first: *!rpgchoose <number>*')

        if (p.stage === 'personality_test') {
            const evts = ['first_awakening', 'starving_child']
            for (const eid of evts) {
                if (!p.eventsSeen.includes(eid)) {
                    const evt = EVENTS.find((e: GameEvent) => e.id === eid)
                    if (!evt) continue
                    await RPGDataStore.savePlayer(p)
                    const choices = evt.choices.map((c: EventChoice, i: number) => `${i + 1}. ${c.text}`).join('\n\n')
                    return void M.reply(
                        `━━━━━━━━━━━━━━━━━━━━━━━\n*${evt.title}*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n${evt.narrative}\n\n━━━ CHOICES ━━━\n\n${choices}\n\nReply: *!rpgpick <number>*`
                    )
                }
            }
            p.stage = 'awakening'
            await RPGDataStore.savePlayer(p)
            return void M.reply('*The Tutorial Ends...*\n\nYou are now AWAKE.\n\nUse *!rpgstatus* | *!rpgquest* | *!rpghunt*')
        }

        const available = EVENTS.filter((e: GameEvent) =>
            !p.eventsSeen.includes(e.id) && e.minLevel <= p.level &&
            (!e.requiredTraits || e.requiredTraits.some((t: string) => p.traits.includes(t as any))) &&
            (!e.forbiddenTraits || !e.forbiddenTraits.some((t: string) => p.traits.includes(t as any)))
        )

        if (available.length === 0) {
            p.stage = 'awakened'
            await RPGDataStore.savePlayer(p)
            return void M.reply('No new events here. Try *!rpghunt* to grow stronger. Higher levels unlock more events.')
        }

        available.sort((a: GameEvent, b: GameEvent) => (a.isDangerous ? 1 : 0) - (b.isDangerous ? 1 : 0))
        const event = available[Math.floor(Math.random() * Math.min(3, available.length))]
        await RPGDataStore.savePlayer(p)
        const choices = event.choices.map((c: EventChoice, i: number) => `${i + 1}. ${c.text}`).join('\n\n')

        return void M.reply(
            `━━━━━━━━━━━━━━━━━━━━━━━\n${event.isDangerous ? '⚠️' : '📜'} *${event.title}*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n${event.narrative}\n\n━━━ CHOICES ━━━\n\n${choices}\n\nReply: *!rpgpick <number>*`
        )
    }
}