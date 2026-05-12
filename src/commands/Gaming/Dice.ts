import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'dice', description: 'Roll dice (default 1d6)',
            category: 'gaming', usage: `${client.config.prefix}dice [sides] [count]`,
            aliases: ['roll'], baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const parts = joined.trim().split(/\s+/).filter(Boolean)
        let sides = 6, count = 1
        if (parts[0]) { const n = parseInt(parts[0]); if (!isNaN(n) && n >= 2 && n <= 100) sides = n }
        if (parts[1]) { const n = parseInt(parts[1]); if (!isNaN(n) && n >= 1 && n <= 10) count = n }
        const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
        const sum = rolls.reduce((a, b) => a + b, 0)
        const diceEmoji: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' }
        let text = `╭──────────────────────────────╮\n│      🎲  DICE ROLL              │\n├──────────────────────────────┤\n│ 🎯 *${count}d${sides}*`
        if (count <= 6) {
            rolls.forEach(r => { text += `\n│ ${diceEmoji[r] || '🎲'} ${String(r).padEnd(25).slice(0,25)}│` })
        } else {
            rolls.forEach((r, i) => { text += `\n│ #${i + 1}: ${String(r).padEnd(22).slice(0,22)}│` })
        }
        if (count > 1) text += `\n│ 📊 Total: ${String(sum).padEnd(22)}│`
        text += `\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
