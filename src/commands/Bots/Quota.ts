import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

const EXTEND_BY = 20

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'quota',
            description: "Mod-only: set or extend a user's daily chat quota",
            category: 'bots', dm: true,
            usage: `${client.config.prefix}quota @user 50 | ${client.config.prefix}quota extend [@user]`,
            modsOnly: true, baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const first = (args[0] || '').toLowerCase()
        const p = this.client.config.prefix

        if (first === 'extend') {
            const target = this.resolveTarget(M)
            if (!target) return void M.reply(`╭──────────────────────────────╮\n│      📊  QUOTA                 │\n├──────────────────────────────┤\n│ Usage: *${p}quota extend @user*│\n╰──────────────────────────────╯`)
            await this.client.extendChatQuota(target, EXTEND_BY)
            let text = `╭──────────────────────────────╮\n│      📊  QUOTA EXTENDED         │\n├──────────────────────────────┤\n│ ✅ +${EXTEND_BY} msgs for @${target.split('@')[0].padEnd(18).slice(0,18)}│\n╰──────────────────────────────╯`
            return void M.reply(text, undefined, undefined, [target])
        }

        const target = M.chat === 'group' ? M.mentioned[0] : M.sender.jid
        if (M.chat === 'group' && !target)
            return void M.reply(`╭──────────────────────────────╮\n│      📊  QUOTA                 │\n├──────────────────────────────┤\n│ Usage: *${p}quota @user 50*     │\n╰──────────────────────────────╯`)
        const n = this.parseLimit(args)
        if (n === null)
            return void M.reply(`╭──────────────────────────────╮\n│      📊  QUOTA                 │\n├──────────────────────────────┤\n│ Usage: *${p}quota <number>*     │\n╰──────────────────────────────╯`)
        await this.client.setChatQuotaLimit(target, n)
        let text = `╭──────────────────────────────╮\n│      📊  QUOTA SET              │\n├──────────────────────────────┤\n│ ✅ Set to ${String(n).padEnd(22)}│\n╰──────────────────────────────╯`
        return void M.reply(text, undefined, undefined, target ? [target] : undefined)
    }

    private resolveTarget = (M: ISimplifiedMessage): string | null => {
        if (M.mentioned.length) return M.mentioned[0]
        if (M.chat === 'dm') return M.sender.jid
        return null
    }
    private parseLimit = (args: string[]): number | null => {
        for (const a of args) {
            const n = Number(a)
            if (Number.isFinite(n) && n >= 0) return Math.floor(n)
        }
        return null
    }
}
