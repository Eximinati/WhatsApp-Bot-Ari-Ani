import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'

const WORDS = [
    'elephant', 'giraffe', 'kangaroo', 'dolphin', 'penguin',
    'basketball', 'football', 'volleyball', 'swimming', 'cycling',
    'chocolate', 'strawberry', 'pineapple', 'coconut', 'vanilla',
    'mountain', 'volcano', 'tsunami', 'glacier', 'rainbow',
    'detective', 'adventure', 'treasure', 'mystery', 'phantom',
    'javascript', 'python', 'programming', 'algorithm', 'database',
    'whatsapp', 'internet', 'galaxy', 'rocket', 'planet',
    'umbrella', 'sandwich', 'calendar', 'journal', 'whisper'
]

const W = 480, H = 360

function drawHangman(word: string, guessed: Set<string>, wrong: number): Buffer {
    const cv = createCanvas(W, H), ctx = cv.getContext('2d')

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#0d001a'); grad.addColorStop(1, '#1a0030')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

    // Title
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e040fb'; ctx.font = 'bold 28px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif'
    ctx.fillText('🎯 HANGMAN 🎯', W / 2, 45)

    // ── Gallows (left side) ──
    const gx = 60, gy = 320
    ctx.strokeStyle = '#8888aa'; ctx.lineWidth = 4; ctx.lineCap = 'round'
    // Base
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 80, gy); ctx.stroke()
    // Vertical pole
    ctx.beginPath(); ctx.moveTo(gx + 40, gy); ctx.lineTo(gx + 40, gy - 240); ctx.stroke()
    // Top beam
    ctx.beginPath(); ctx.moveTo(gx + 40, gy - 240); ctx.lineTo(gx + 140, gy - 240); ctx.stroke()
    // Rope
    ctx.beginPath(); ctx.moveTo(gx + 140, gy - 240); ctx.lineTo(gx + 140, gy - 200); ctx.stroke()

    const cx = gx + 140, cy = gy - 200
    ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3

    // Head (1 wrong)
    if (wrong >= 1) { ctx.beginPath(); ctx.arc(cx, cy + 20, 20, 0, Math.PI * 2); ctx.stroke() }
    // Body (2)
    if (wrong >= 2) { ctx.beginPath(); ctx.moveTo(cx, cy + 40); ctx.lineTo(cx, cy + 110); ctx.stroke() }
    // Left arm (3)
    if (wrong >= 3) { ctx.beginPath(); ctx.moveTo(cx, cy + 55); ctx.lineTo(cx - 30, cy + 85); ctx.stroke() }
    // Right arm (4)
    if (wrong >= 4) { ctx.beginPath(); ctx.moveTo(cx, cy + 55); ctx.lineTo(cx + 30, cy + 85); ctx.stroke() }
    // Left leg (5)
    if (wrong >= 5) { ctx.beginPath(); ctx.moveTo(cx, cy + 110); ctx.lineTo(cx - 25, cy + 160); ctx.stroke() }
    // Right leg (6)
    if (wrong >= 6) { ctx.beginPath(); ctx.moveTo(cx, cy + 110); ctx.lineTo(cx + 25, cy + 160); ctx.stroke() }
    // Dead eyes (6)
    if (wrong >= 6) {
        ctx.fillStyle = '#ff0000'
        ctx.beginPath(); ctx.arc(cx - 7, cy + 14, 3, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(cx + 7, cy + 14, 3, 0, Math.PI * 2); ctx.fill()
    }

    // ── Word display ──
    const letters: string[] = []
    for (const ch of word) {
        letters.push(guessed.has(ch) ? ch : '_')
    }
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 36px "Segoe UI",monospace'; ctx.textAlign = 'center'
    ctx.fillText(letters.join(' '), W / 2 + 30, 230)

    // ── Wrong guesses ──
    const wrongLetters = [...guessed].filter(ch => !word.includes(ch))
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 18px "Segoe UI",sans-serif'
    ctx.fillText(wrongLetters.length > 0 ? `Wrong: ${wrongLetters.join(' ')}` : '', W / 2 + 30, 270)

    // ── Lives ──
    const lives = 6 - wrong
    ctx.fillStyle = lives <= 2 ? '#ff6b6b' : '#4fc3f7'; ctx.font = 'bold 16px "Segoe UI",sans-serif'
    ctx.fillText(`❤️ Lives: ${'❤️'.repeat(lives)}${'🖤'.repeat(wrong)}`, W / 2 + 30, 300)

    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '11px "Segoe UI",sans-serif'
    ctx.fillText('Hangman • Reply with a single letter', W / 2, H - 14)

    return cv.toBuffer('image/png')
}

export default class Command extends CommandModule {
    private games = new Map<string, { word: string; guessed: Set<string>; wrong: number; over: boolean }>()

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'hangman',
            aliases: ['hm'],
            description: 'Play Hangman — guess the word! 🔤',
            category: 'gaming',
            usage: `${client.config.prefix}hangman [letter|new|ff]`,
            baseXp: 12
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const chat = M.from

        const newGame = () => {
            const word = WORDS[Math.floor(Math.random() * WORDS.length)]
            this.games.set(chat, { word, guessed: new Set(), wrong: 0, over: false })
            return word
        }

        const sub = (args[0] || '').toLowerCase().trim()

        // New game or no active game → start fresh
        if (sub === 'new' || sub === 'ff' || !this.games.has(chat)) {
            if (sub === 'ff') {
                const g = this.games.get(chat)
                if (g && !g.over) {
                    return void M.reply(`🏳️ Forfeited! The word was: *${g.word}*`)
                }
            }
            const word = newGame()
            const buf = drawHangman(word, new Set(), 0)
            try {
                const video = await this.client.util.imageToVideoBuffer(buf, 3)
                return void M.reply(video, MessageType.video, Mimetype.gif, undefined, '🎯 *Hangman*\n\nGuess a letter! You have 6 lives ❤️')
            } catch {
                return void M.reply(buf, MessageType.image, Mimetype.png, undefined, '🎯 *Hangman*\n\nGuess a letter! You have 6 lives ❤️')
            }
        }

        const game = this.games.get(chat)!
        if (game.over) {
            const word = newGame()
            const buf = drawHangman(word, new Set(), 0)
            try {
                const video = await this.client.util.imageToVideoBuffer(buf, 3)
                return void M.reply(video, MessageType.video, Mimetype.gif, undefined, '🎯 *Hangman*\n\nNew game! Guess a letter...')
            } catch {
                return void M.reply(buf, MessageType.image, Mimetype.png, undefined, '🎯 *Hangman*\n\nNew game! Guess a letter...')
            }
        }

        if (sub.length !== 1 || !/[a-z]/.test(sub)) {
            return void M.reply('❌ Reply with a *single letter* (a-z)!')
        }

        const letter = sub

        if (game.guessed.has(letter)) {
            return void M.reply(`⚠️ Letter *${letter}* already guessed!`)
        }

        game.guessed.add(letter)

        if (!game.word.includes(letter)) {
            game.wrong++
        }

        // Check win
        const won = [...game.word].every(ch => game.guessed.has(ch))

        if (won) {
            game.over = true
            const buf = drawHangman(game.word, game.guessed, game.wrong)
            const cap = `🎉 *YOU WIN!*\n\nThe word was: *${game.word}*`
            try {
                const video = await this.client.util.imageToVideoBuffer(buf, 3)
                return void M.reply(video, MessageType.video, Mimetype.gif, undefined, cap)
            } catch {
                return void M.reply(buf, MessageType.image, Mimetype.png, undefined, cap)
            }
        }

        if (game.wrong >= 6) {
            game.over = true
            const buf = drawHangman(game.word, game.guessed, game.wrong)
            const cap = `💀 *GAME OVER*\n\nThe word was: *${game.word}*`
            try {
                const video = await this.client.util.imageToVideoBuffer(buf, 3)
                return void M.reply(video, MessageType.video, Mimetype.gif, undefined, cap)
            } catch {
                return void M.reply(buf, MessageType.image, Mimetype.png, undefined, cap)
            }
        }

        // Ongoing
        const buf = drawHangman(game.word, game.guessed, game.wrong)
        const lives = 6 - game.wrong
        try {
            const video = await this.client.util.imageToVideoBuffer(buf, 3)
            return void M.reply(video, MessageType.video, Mimetype.gif, undefined,
                `🎯 *Hangman*\n❤️ ${lives} lives left\n\nGuess a letter!`)
        } catch {
            return void M.reply(buf, MessageType.image, Mimetype.png, undefined,
                `🎯 *Hangman*\n❤️ ${lives} lives left\n\nGuess a letter!`)
        }
    }
}