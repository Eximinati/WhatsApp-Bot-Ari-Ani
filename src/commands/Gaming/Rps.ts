import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    private c = { rock: { beats: 'scissors', emoji: '🪨' }, paper: { beats: 'rock', emoji: '📄' }, scissors: { beats: 'paper', emoji: '✂️' } }
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rps', description: 'Play rock paper scissors',
            category: 'gaming', usage: `${client.config.prefix}rps <rock|paper|scissors>`,
            aliases: ['rockpaperscissors'], baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const p = joined.trim().toLowerCase()
        if (!p || !this.c[p as keyof typeof this.c]) return void M.reply(`╭──────────────────────────────╮\n│      🎮  RPS                   │\n├──────────────────────────────┤\n│ Choices: rock 🪨 | paper 📄    │\n│          scissors ✂️           │\n╰──────────────────────────────╯`)
        const bot = Object.keys(this.c)[Math.floor(Math.random() * 3)] as keyof typeof this.c
        const pEmoji = this.c[p as keyof typeof this.c].emoji
        const bEmoji = this.c[bot].emoji
        const win = this.c[p as keyof typeof this.c].beats === bot
        const draw = p === bot
        const result = draw ? "Draw! 🤝" : win ? "You win! 🎉" : "You lose! 😢"
        let text = `╭──────────────────────────────╮\n│      🎮  RPS                   │\n├──────────────────────────────┤\n│ 👤 You: ${pEmoji} ${p.padEnd(14).slice(0,14)}│\n│ 🤖 Bot: ${bEmoji} ${bot.padEnd(14).slice(0,14)}│\n│ ${result.padEnd(27)}│\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
