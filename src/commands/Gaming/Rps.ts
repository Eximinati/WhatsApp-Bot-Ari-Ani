import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    private c = {
        rock: { beats: 'scissors', emoji: '🪨' },
        paper: { beats: 'rock', emoji: '📄' },
        scissors: { beats: 'paper', emoji: '✂️' }
    }

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'rps',
            description: 'Play rock paper scissors',
            category: 'gaming',
            usage: `${client.config.prefix}rps <rock|paper|scissors>`,
            aliases: ['rockpaperscissors'],
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const p = joined.trim().toLowerCase() as keyof typeof this.c

        if (!p || !this.c[p]) {
            return void M.reply(
                `🎮 Rock Paper Scissors\n\n` +
                `Usage: rock | paper | scissors`
            )
        }

        const options = Object.keys(this.c) as (keyof typeof this.c)[]
        const bot = options[Math.floor(Math.random() * options.length)]

        const pEmoji = this.c[p].emoji
        const bEmoji = this.c[bot].emoji

        const draw = p === bot
        const win = this.c[p].beats === bot

        const result = draw
            ? '🤝 Draw'
            : win
                ? '🎉 You win'
                : '😢 You lose'

        return void M.reply(
            `🎮 Rock Paper Scissors\n\n` +
            `You: ${pEmoji} ${p}\n` +
            `Bot: ${bEmoji} ${bot}\n\n` +
            `${result}`
        )
    }
}
