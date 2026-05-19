import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { RPGEngine } from '../../rpg/RPGEngine.js'
import { RPGDataStore } from '../../rpg/RPGDataStore.js'
import { ORIGINS } from '../../rpg/data.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpgstart',
            description: 'Begin your System Era journey',
            category: 'gaming',
            usage: `${client.config.prefix}rpgstart`,
            baseXp: 3
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const jid = M.sender.jid
        const name = M.sender.username || jid.split('@')[0]
        let p = await RPGDataStore.getPlayer(jid)

        if (p && p.stage !== 'origin_selection') {
            return void M.reply('You are already on your journey! Use !rpgstatus to see your status.')
        }

        p = await RPGEngine.getOrCreateProfile(jid, name)

        const entries = Object.entries(ORIGINS)
        const originList = entries.map(([id, o]) => {
            const num = id === 'random' ? '8' : String(entries.indexOf([id, o]) + 1)
            const desc = o.description.split('\n')[0].slice(0, 80)
            return `${num}. ${o.name}\n   ${desc}...`
        }).join('\n\n')

        return void M.reply(
            '━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '⚡ *THE SYSTEM HAS AWAKENED* ⚡\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '*[System Notice]*\n\n' +
            'The Tutorial has begun.\n' +
            'Survival Rate: 18%\n\n' +
            'Choose your origin carefully — this shapes everything.\n\n' +
            originList + '\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━\n' +
            'Reply: *!rpgchoose <number>*\n' +
            'Example: *!rpgchoose 3*'
        )
    }
}