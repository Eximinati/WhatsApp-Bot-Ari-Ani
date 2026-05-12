import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    private sym = ['🍒', '🍋', '🍇', '🍉', '⭐', '🎰', '7️⃣', '💎']
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'slot', description: 'Play slot machine',
            category: 'gaming', usage: `${client.config.prefix}slot`,
            aliases: ['slots'], baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, _parsedArgs: IParsedArgs): Promise<void> => {
        await M.reply('🎰 *Spinning...*')
        await new Promise(r => setTimeout(r, 1500))
        const r = Array.from({ length: 3 }, () => this.sym[Math.floor(Math.random() * this.sym.length)])
        const isJackpot = r[0] === r[1] && r[1] === r[2]
        const isTwo = r[0] === r[1] || r[1] === r[2] || r[0] === r[2]
        let text = `╭──────────────────────────────╮\n│      🎰  SLOT MACHINE           │\n├──────────────────────────────┤\n│        ${r[0]}  │  ${r[1]}  │  ${r[2]}           │\n├──────────────────────────────┤\n`
        if (isJackpot) text += `│ 🎉 *JACKPOT!* 🎉              │\n│ 🪙 Won: 1000 coins            │`
        else if (isTwo) text += `│ 🍀 Almost! Two matching       │\n│ 🪙 Won: 2 coins               │`
        else text += `│ 😢 No win this time          │\n│ 💡 3 matching = jackpot!      │`
        text += `\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
