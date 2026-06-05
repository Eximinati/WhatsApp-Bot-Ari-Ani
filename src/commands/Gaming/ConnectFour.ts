import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'

const ROWS = 6, COLS = 7
const CELL = 72, PAD = 40, RAD = 30
const W = COLS * CELL + PAD * 2, H = ROWS * CELL + PAD * 2 + 50

const tag = (jid: string): string => `@${jid.split('@')[0]}`

interface C4Game {
    board: number[][]        // 0=empty, 1=P1, 2=P2
    p1: string               // jid
    p2: string
    turn: 1 | 2
    over: boolean
    winner: string | null    // jid or null for draw
}

const newBoard = (): number[][] =>
    Array.from({ length: ROWS }, () => Array(COLS).fill(0))

const dropPiece = (board: number[][], col: number, player: 1 | 2): number | null => {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) {
            board[r][col] = player
            return r
        }
    }
    return null
}

const checkWin = (board: number[][], row: number, col: number, player: 1 | 2): boolean => {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]]
    for (const [dr, dc] of dirs) {
        let count = 1
        for (const sign of [-1, 1]) {
            let r = row + dr * sign, c = col + dc * sign
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
                count++
                r += dr * sign
                c += dc * sign
            }
        }
        if (count >= 4) return true
    }
    return false
}

const isFull = (board: number[][]): boolean => board.every(r => r.every(c => c !== 0))

// ── Canvas rendering ──────────────────────────────────────────────────
function renderBoard(board: number[][], pct: number, activeColor: string): Buffer {
    const cv = createCanvas(W, H), ctx = cv.getContext('2d')

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#0f0c29'); grad.addColorStop(0.5, '#302b63'); grad.addColorStop(1, '#24243e')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

    // Board background
    ctx.fillStyle = '#1a237e'
    const bx = PAD - 8, by = PAD - 8, bw = COLS * CELL + 16, bh = ROWS * CELL + 16
    const rr = (x: number, y: number, w2: number, h2: number, r2: number) => {
        ctx.beginPath(); ctx.moveTo(x + r2, y); ctx.lineTo(x + w2 - r2, y)
        ctx.arcTo(x + w2, y, x + w2, y + r2, r2); ctx.lineTo(x + w2, y + h2 - r2)
        ctx.arcTo(x + w2, y + h2, x + w2 - r2, y + h2, r2); ctx.lineTo(x + r2, y + h2)
        ctx.arcTo(x, y + h2, x, y + h2 - r2, r2); ctx.lineTo(x, y + r2)
        ctx.arcTo(x, y, x + r2, y, r2); ctx.closePath()
    }
    rr(bx, by, bw, bh, 12); ctx.fill()

    // Holes
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cx = PAD + c * CELL + CELL / 2, cy = PAD + r * CELL + CELL / 2
            ctx.beginPath(); ctx.arc(cx, cy, RAD, 0, Math.PI * 2)
            ctx.fillStyle = '#0d0d3a'; ctx.fill()
        }
    }

    // Pieces
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === 0) continue
            const cx = PAD + c * CELL + CELL / 2, cy = PAD + r * CELL + CELL / 2
            ctx.beginPath(); ctx.arc(cx, cy, RAD - 3, 0, Math.PI * 2)
            if (board[r][c] === 1) {
                const g = ctx.createRadialGradient(cx - 8, cy - 8, 3, cx, cy, RAD)
                g.addColorStop(0, '#ff6b6b'); g.addColorStop(1, '#c0392b')
                ctx.fillStyle = g
            } else {
                const g = ctx.createRadialGradient(cx - 8, cy - 8, 3, cx, cy, RAD)
                g.addColorStop(0, '#ffd93d'); g.addColorStop(1, '#e67e22')
                ctx.fillStyle = g
            }
            ctx.fill()
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5
            ctx.stroke()
        }
    }

    // Active player indicator
    ctx.fillStyle = activeColor; ctx.font = 'bold 20px "Segoe UI",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Turn: ${activeColor === '#ff6b6b' ? '🔴 Player 1' : '🟡 Player 2'}`, W / 2, H - 12)

    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '11px "Segoe UI",sans-serif'
    ctx.fillText('Connect 4 • Reply with column 1–7', W / 2, H - 36)

    return cv.toBuffer('image/png')
}

export default class Command extends CommandModule {
    private games = new Map<string, C4Game>()

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'connect4',
            aliases: ['c4', 'connectfour'],
            description: 'Play Connect 4 with a friend 🔴🟡',
            category: 'gaming',
            usage: `${client.config.prefix}connect4 [@user|challenge|accept|ff]`,
            baseXp: 15
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const chat = M.from
        const sender = M.sender.jid

        const showHelp = () => M.reply(
            `🔴🟡 *Connect 4*\n\n` +
            `*${this.client.config.prefix}c4 challenge @user* — start a match\n` +
            `*${this.client.config.prefix}c4 accept* — accept a challenge\n` +
            `*${this.client.config.prefix}c4 1-7* — drop a piece in that column\n` +
            `*${this.client.config.prefix}c4 ff* — forfeit`
        )

        const sub = (args[0] || '').toLowerCase()
        const game = this.games.get(chat)

        // ── Send board image for ongoing game ──
        if (game && !game.over) {
            const colNum = parseInt(sub)
            if (!isNaN(colNum) && colNum >= 1 && colNum <= 7) {
                const col = colNum - 1
                if (game.board[0][col] !== 0)
                    return void M.reply('❌ Column full! Pick another.')

                const player = (sender === game.p1 ? 1 : sender === game.p2 ? 2 : 0) as 1 | 2 | 0
                if (player !== game.turn) return void M.reply("⏳ Not your turn!")

                const row = dropPiece(game.board, col, game.turn)
                if (row === null) return void M.reply('❌ Column full!')

                if (checkWin(game.board, row, col, game.turn)) {
                    game.over = true
                    game.winner = sender
                    const buf = renderBoard(game.board, 50, game.turn === 1 ? '#ff6b6b' : '#ffd93d')
                    const cap = `🔴🟡 *Connect 4*\n\n${tag(sender)} wins! 🎉`
                    try {
                        const video = await this.client.util.imageToVideoBuffer(buf, 3)
                        return void M.reply(video, MessageType.video, Mimetype.gif, [sender], cap)
                    } catch {
                        return void M.reply(buf, MessageType.image, Mimetype.png, [sender], cap)
                    }
                }

                if (isFull(game.board)) {
                    game.over = true
                    const buf = renderBoard(game.board, 50, '#aaa')
                    const cap = `🔴🟡 *Connect 4*\n\nIt's a draw! 🤝`
                    try {
                        const video = await this.client.util.imageToVideoBuffer(buf, 3)
                        return void M.reply(video, MessageType.video, Mimetype.gif, undefined, cap)
                    } catch {
                        return void M.reply(buf, MessageType.image, Mimetype.png, undefined, cap)
                    }
                }

                game.turn = (game.turn === 1 ? 2 : 1) as 1 | 2
                const buf = renderBoard(game.board, 50, game.turn === 1 ? '#ff6b6b' : '#ffd93d')
                try {
                    const video = await this.client.util.imageToVideoBuffer(buf, 3)
                    return void M.reply(video, MessageType.video, Mimetype.gif, [game.turn === 1 ? game.p1 : game.p2],
                        `🔴🟡 *Connect 4*\n\n${tag(game.turn === 1 ? game.p1 : game.p2)}'s turn\n\nReply with column 1-7`)
                } catch {
                    return void M.reply(buf, MessageType.image, Mimetype.png, [game.turn === 1 ? game.p1 : game.p2],
                        `🔴🟡 *Connect 4*\n\n${tag(game.turn === 1 ? game.p1 : game.p2)}'s turn\n\nReply with column 1-7`)
                }
            }
            if (sub === 'ff') {
                const loser = sender
                const winner = loser === game.p1 ? game.p2 : game.p1
                game.over = true
                game.winner = winner
                return void M.reply(`🏳️ ${tag(loser)} forfeited!\n\n${tag(winner)} wins!`, MessageType.text, undefined, [winner])
            }
        }

        switch (sub) {
            case 'c':
            case 'challenge':
                if (game && !game.over) return void M.reply('⚠️ A game is already in progress!')
                const opp = M.mentioned[0] || M.quoted?.sender || null
                if (!opp || opp === sender) return void M.reply('❌ Mention or quote a user to challenge!')
                this.games.set(chat, {
                    board: newBoard(), p1: sender, p2: opp, turn: 1, over: false, winner: null
                })
                const b = renderBoard(newBoard(), 50, '#ff6b6b')
                try {
                    const v = await this.client.util.imageToVideoBuffer(b, 3)
                    return void M.reply(v, MessageType.video, Mimetype.gif, [sender, opp],
                        `🔴🟡 *Connect 4*\n\n${tag(sender)} (🔴) vs ${tag(opp)} (🟡)\n\n${tag(sender)} goes first! Reply with column 1-7`)
                } catch {
                    return void M.reply(b, MessageType.image, Mimetype.png, [sender, opp],
                        `🔴🟡 *Connect 4*\n\n${tag(sender)} (🔴) vs ${tag(opp)} (🟡)\n\n${tag(sender)} goes first! Reply with column 1-7`)
                }
            case 'a':
            case 'accept':
                if (!game) return void M.reply('❌ No pending challenge!')
                return void M.reply('✅ Game already started! Reply with column 1-7 to play.')
            default:
                return showHelp()
        }
    }
}