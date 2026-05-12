import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'calc', description: 'Calculate mathematical expressions',
            category: 'utility', usage: `${client.config.prefix}calc <expr>`,
            aliases: ['math', 'calculate'], baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const expr = joined.trim()
        if (!expr) return void M.reply(`╭──────────────────────────────╮\n│      🧮  CALCULATOR            │\n├──────────────────────────────┤\n│ Usage: *${this.client.config.prefix}calc 2+2*  │\n╰──────────────────────────────╯`)
        try {
            const sanitized = expr.replace(/[^0-9+\-*/().%^]/g, '').trim()
            if (!sanitized) throw new Error()
            const result = Function(`"use strict"; return (${sanitized})`)()
            if (!isFinite(result)) throw new Error()
            const formatted = Number.isInteger(result) ? result : parseFloat(result.toFixed(6))
            let text = `╭──────────────────────────────╮\n│      🧮  CALCULATOR            │\n├──────────────────────────────┤\n│ 📐 ${expr.substring(0,26).padEnd(26)}│\n│ ✨ = ${String(formatted).padEnd(25).slice(0,25)}│\n╰──────────────────────────────╯`
            return void M.reply(text)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      🧮  CALCULATOR            │\n├──────────────────────────────┤\n│ ❌ Invalid expression          │\n╰──────────────────────────────╯`)
        }
    }
}
