import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rpg',
            description: '🎮 The System Era RPG — Survive. Evolve. Dominate.',
            category: 'gaming',
            usage: `${client.config.prefix}rpg`,
            aliases: ['rpghelp'],
            baseXp: 1
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const pf = this.client.config.prefix
        return void M.reply(
            '🎮 *SYSTEM ERA RPG* 🎮\n\n' +
            '━━━ COMMANDS ━━━\n\n' +
            `🆕 *${pf}rpgstart* — Begin your journey\n` +
            `📊 *${pf}rpgstatus* — View stats & character card\n` +
            `📜 *${pf}rpgquest* — Encounter narrative events\n` +
            `⚔️ *${pf}rpghunt* — Combat with enemies\n` +
            `🎒 *${pf}rpginventory* — View items & equipment\n` +
            `💉 *${pf}rpguse <item>* — Use consumables\n` +
            `🛡️ *${pf}rpgequip <item>* — Equip gear\n` +
            `📜 *${pf}rpgskills* — Affinities & traits\n` +
            `😴 *${pf}rpgrest* — Restore HP/MP\n` +
            `👤 *${pf}rpgprofile* — Character portrait\n\n` +
            '━━━ FLOW ━━━\n' +
            'rpgstart → rpgchoose → rpgquest → rpgpick → rpghunt → rpgrest\n\n' +
            '*Every choice matters. The System is watching.*'
        )
    }
}