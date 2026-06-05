import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

interface GuessGame {
    target: number
    min: number
    max: number
    attempts: number
    over: boolean
    hint: string
}

export default class Command extends CommandModule {
    private games = new Map<string, GuessGame>()

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'guessnumber',
            aliases: ['gnumber', 'guessnum'],
            description: 'Guess the number — closest wins! 🔢',
            category: 'gaming',
            usage: `${client.config.prefix}guessnumber [1-100|easy|medium|hard|hint|ff]`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const chat = M.from
        const sub = (args[0] || '').toLowerCase().trim()

        const newGame = (max: number): GuessGame => {
            const target = Math.floor(Math.random() * max) + 1
            const g: GuessGame = { target, min: 1, max, attempts: 0, over: false, hint: 'none' }
            this.games.set(chat, g)
            return g
        }

        // ── Start / reset / forfeit ──
        if (sub === 'ff' || sub === 'new' || !this.games.has(chat) || this.games.get(chat)!.over) {
            if (sub === 'ff') {
                const g = this.games.get(chat)
                if (g && !g.over) {
                    g.over = true
                    return void M.reply(`🏳️ Forfeited! The number was: *${g.target}*\nAttempts: ${g.attempts}`)
                }
            }
            let max = 100
            if (sub === 'easy') max = 20
            else if (sub === 'medium') max = 50
            else if (sub === 'hard') max = 200
            else if (/^\d+$/.test(sub)) {
                const n = parseInt(sub)
                if (n >= 10 && n <= 1000) max = n
            }

            const g = newGame(max)
            return void M.reply(
                `🔢 *Guess the Number!*\n\n` +
                `I'm thinking of a number between *1* and *${max}*.\n` +
                `Reply with your guess!\n\n` +
                `💡 Tip: \`${this.client.config.prefix}gnumber hint\` for a clue` +
                (max > 100 ? `\n⚡ Hard mode — range is 1–${max}` : '')
            )
        }

        const game = this.games.get(chat)!

        // ── Hint ──
        if (sub === 'hint') {
            const t = game.target
            const hint4 = `The number is ${t % 2 === 0 ? 'even' : 'odd'}, and ` +
                `it's ${t % 3 === 0 ? '' : 'not '}divisible by 3.`
            const hint3 = `It's ${t % 2 === 0 ? 'even' : 'odd'} and between ${Math.max(1, t - 15)} and ${Math.min(game.max, t + 15)}.`
            const hint2 = `It's between ${Math.max(1, t - 8)} and ${Math.min(game.max, t + 8)}.`
            const hint1 = `Very close! It's between ${Math.max(1, t - 3)} and ${Math.min(game.max, t + 3)}.`

            let hint: string
            if (game.attempts <= 2) hint = hint4
            else if (game.attempts <= 5) hint = hint3
            else if (game.attempts <= 8) hint = hint2
            else hint = hint1

            game.hint = hint
            return void M.reply(`💡 *Hint:* ${hint}\nAttempts: ${game.attempts}`)
        }

        // ── Guess ──
        const guess = parseInt(sub)
        if (isNaN(guess) || guess < 1 || guess > game.max) {
            return void M.reply(`❌ Enter a number between *1* and *${game.max}*!`)
        }

        game.attempts++

        if (guess === game.target) {
            game.over = true
            const rating = game.attempts <= 3 ? '🏆 *LEGENDARY!*' :
                game.attempts <= 6 ? '⭐ *Amazing!*' :
                    game.attempts <= 10 ? '👍 *Well done!*' :
                        game.attempts <= 15 ? '🙂 *Got it!*' : '😅 *Finally!*'

            return void M.reply(
                `🎉 *CORRECT!* 🎉\n\n` +
                `The number was: *${game.target}*\n` +
                `Attempts: *${game.attempts}*\n\n` +
                `${rating}\n\n` +
                `Use \`${this.client.config.prefix}gnumber new\` to play again!`
            )
        }

        const diff = Math.abs(guess - game.target)
        let feedback: string
        if (diff > 50) feedback = '❄️ Ice cold!'
        else if (diff > 30) feedback = '🧊 Very cold'
        else if (diff > 15) feedback = '🌡️ Cold'
        else if (diff > 8) feedback = '🔥 Warming up'
        else if (diff > 4) feedback = '☀️ Hot!'
        else if (diff > 1) feedback = '🌋 Very hot!!'
        else feedback = '⚡ EXTREMELY close!!!'

        const direction = guess > game.target ? '📉 Too high!' : '📈 Too low!'

        // Team board: show range narrowing
        const progressBar = () => {
            const range = game.max - 1
            const pos = Math.round(((game.target - 1) / range) * 20)
            let bar = ''
            for (let i = 0; i < 20; i++) {
                bar += i === pos ? '🎯' : '▬'
            }
            return `[${bar}] 1–${game.max}`
        }

        if (game.attempts >= 8) {
            // Show progress bar after some attempts
            return void M.reply(
                `${feedback} ${direction}\n\nGuess #${game.attempts}\n` +
                `Range: 1–${game.max}\n` +
                `${progressBar()}\n` +
                `💡 \`${this.client.config.prefix}gnumber hint\` for a clue`
            )
        }

        return void M.reply(
            `${feedback} ${direction}\n\nGuess #${game.attempts}\n` +
            `💡 \`${this.client.config.prefix}gnumber hint\` for a clue`
        )
    }
}