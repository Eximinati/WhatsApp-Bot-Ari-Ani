import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'

// ───── BOARD CONSTANTS ─────────────────────────────────────────────────
// 15×15 grid board, each cell 40px → 600×600 canvas
const GRID = 15, CELL = 40, SIZE = GRID * CELL // 600
const PAD = 4 // token radius padding inside a cell

type Color = 'red' | 'green' | 'yellow' | 'blue'

const TAG = (jid: string): string => `@${jid.split('@')[0]}`

// ───── TRACK COORDINATES (grid col, grid row) ─────────────────────────
// 52 shared track cells going clockwise from Red's entry.
// After position 51, Red enters the Red home column (positions 52–57).
// Green enters at global13, Yellow at global26, Blue at global39.
const TRACK: [number, number][] = [
    [1,6],[2,6],[3,6],[4,6],[5,6],   // 0–4  — bottom of left arm
    [6,5],[6,4],[6,3],[6,2],[6,1],   // 5–9  — right side of left arm going up
    [6,0],                            // 10   — top-left corner
    [7,0],[8,0],                      // 11–12 — top edge
    [8,1],[8,2],[8,3],[8,4],[8,5],   // 13–17 — left side of right arm going down
    [9,6],[10,6],[11,6],[12,6],[13,6], // 18–22 — top of right arm going right
    [14,6],                           // 23   — top-right corner
    [14,7],[14,8],                    // 24–25 — right edge
    [13,8],[12,8],[11,8],[10,8],[9,8], // 26–30 — bottom of right arm going left
    [8,9],[8,10],[8,11],[8,12],[8,13], // 31–35 — left side of right arm going down
    [8,14],                           // 36   — bottom-right corner
    [7,14],[6,14],                    // 37–38 — bottom edge
    [6,13],[6,12],[6,11],[6,10],[6,9], // 39–43 — right side of left arm going up
    [5,8],[4,8],[3,8],[2,8],[1,8],   // 44–48 — top of left arm going left
    [0,8],                            // 49   — bottom-left corner
    [0,7],[0,6]                       // 50–51 — left edge going up
]

// ───── HOME COLUMNS (6 cells each, from track toward center) ──────────
const HOME_COLS: Record<Color, [number, number][]> = {
    red:    [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    green:  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
    blue:   [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]]
}

// Entry point on global track for each color
const ENTRY_IDX: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 }

// Safe spots (global track indices where tokens cannot be captured)
const SAFE_SPOTS = new Set([0, 8, 13, 21, 26, 34, 39, 47])

// ───── TOKEN HOME-BASE POSITIONS (parked, within the 6×6 corner) ──────
const BASE_POS: Record<Color, [number, number][]> = {
    red:    [[1,11],[4,11],[1,13],[4,13]],
    green:  [[1,1],[4,1],[1,3],[4,3]],
    yellow: [[10,1],[13,1],[10,3],[13,3]],
    blue:   [[10,11],[13,11],[10,13],[13,13]]
}

// ───── TIER (player order) ────────────────────────────────────────────
const TIER_COLORS: Color[][] = [
    ['red', 'blue'],                     // 2P
    ['red', 'green', 'blue'],            // 3P
    ['red', 'green', 'yellow', 'blue']   // 4P
]

// ───── PLAYER COLOR PALETTE ───────────────────────────────────────────
const PAL: Record<Color, { fill: string; light: string; emoji: string }> = {
    red:    { fill: '#e53935', light: '#ff8a80', emoji: '🔴' },
    green:  { fill: '#43a047', light: '#a5d6a7', emoji: '🟢' },
    yellow: { fill: '#f9a825', light: '#fff59d', emoji: '🟡' },
    blue:   { fill: '#1e88e5', light: '#82b1ff', emoji: '🔵' }
}

// ───── TOKEN / GAME STATE ─────────────────────────────────────────────
interface Token { pos: number /* -1 = parked */; atHome: boolean }
interface LudoState {
    tokens: Record<Color, Token[]>
    turn: Color
    lastRoll: number
    over: boolean
    winner: Color | null
    players: Color[]  // active colors in this game
    byColor: Record<Color, string> // color → jid
}

// ───── CANVAS RENDERING ───────────────────────────────────────────────
function renderBoard(game: LudoState): Buffer {
    const cv = createCanvas(SIZE, SIZE), ctx = cv.getContext('2d')

    // ─‧ Background ───────────────────────────────────────────────────
    ctx.fillStyle = '#f5f0e1'; ctx.fillRect(0, 0, SIZE, SIZE)

    // ─‧ Draw base zones (colored corners) ────────────────────────────
    const drawBase = (c0: number, r0: number, color: Color) => {
        const { fill } = PAL[color]
        ctx.fillStyle = fill + '18'
        ctx.fillRect(c0 * CELL, r0 * CELL, 6 * CELL, 6 * CELL)
        ctx.strokeStyle = fill; ctx.lineWidth = 2
        ctx.strokeRect(c0 * CELL, r0 * CELL, 6 * CELL, 6 * CELL)

        // Inner circle (decorative)
        ctx.beginPath()
        ctx.arc((c0 + 3) * CELL, (r0 + 3) * CELL, 40, 0, Math.PI * 2)
        ctx.fillStyle = fill + '12'; ctx.fill()
        ctx.strokeStyle = fill + '40'; ctx.lineWidth = 1
        ctx.stroke()

        // Label
        ctx.fillStyle = fill; ctx.font = 'bold 14px "Segoe UI",sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(color.toUpperCase(), (c0 + 3) * CELL, (r0 + 3) * CELL + 5)

        // Parked token slots
        for (const [tc, tr] of BASE_POS[color]) {
            ctx.beginPath()
            ctx.arc(tc * CELL, tr * CELL, CELL / 2 - 3, 0, Math.PI * 2)
            ctx.fillStyle = fill + '30'; ctx.fill()
            ctx.strokeStyle = fill + '60'; ctx.lineWidth = 1
            ctx.stroke()
        }
    }
    drawBase(0, 9, 'red')     // bottom-left
    drawBase(0, 0, 'green')   // top-left
    drawBase(9, 0, 'yellow')  // top-right
    drawBase(9, 9, 'blue')    // bottom-right

    // ─‧ Cross arms (white pathways) ──────────────────────────────────
    const drawArmCell = (c: number, r: number, fillStyle: string, strokeStyle: string) => {
        ctx.fillStyle = fillStyle; ctx.strokeStyle = strokeStyle; ctx.lineWidth = 0.5
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL)
        ctx.strokeRect(c * CELL, r * CELL, CELL, CELL)
    }

    // Horizontal arm rows 6-8, cols 0-14 (excluding base corners)
    for (let r = 6; r <= 8; r++) {
        for (let c = 0; c < 15; c++) {
            // Skip base corners
            if (r >= 6 && r <= 8 && c <= 5 && r <= 5) continue // already drawn as green base top
            if (r >= 6 && r <= 8 && c >= 9 && r <= 5) continue // yellow base
            // Actually just draw all cells in the cross, the bases are underneath
            const inBase =
                (c < 6 && r < 6) ||   // green base
                (c > 8 && r < 6) ||   // yellow base
                (c < 6 && r > 8) ||   // red base
                (c > 8 && r > 8)       // blue base
            if (!inBase) {
                drawArmCell(c, r, '#ffffff', '#ddd8c8')
            }
        }
    }
    // Vertical arm cols 6-8, rows 0-14 (excluding base corners)
    for (let c = 6; c <= 8; c++) {
        for (let r = 0; r < 15; r++) {
            const inBase =
                (c < 6 && r < 6) || (c > 8 && r < 6) || (c < 6 && r > 8) || (c > 8 && r > 8)
            if (!inBase) {
                drawArmCell(c, r, '#ffffff', '#ddd8c8')
            }
        }
    }

    // ─‧ Center finishing area ────────────────────────────────────────
    for (let r = 6; r <= 8; r++) {
        for (let c = 6; c <= 8; c++) {
            ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1
            ctx.fillRect(c * CELL, r * CELL, CELL, CELL)
            ctx.strokeRect(c * CELL, r * CELL, CELL, CELL)
        }
    }
    // Center star
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 28px "Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('⭐', 7.5 * CELL, 7.5 * CELL)

    // ─‧ Track cells (colored) ────────────────────────────────────────
    for (let i = 0; i < TRACK.length; i++) {
        const [c, r] = TRACK[i]
        const cx = c * CELL, cy = r * CELL
        const isSafe = SAFE_SPOTS.has(i)

        // Determine which color's path segment this is
        let segColor: Color = 'red'
        if (i >= 13 && i < 26) segColor = 'green'
        else if (i >= 26 && i < 39) segColor = 'yellow'
        else if (i >= 39) segColor = 'blue'

        ctx.fillStyle = PAL[segColor].fill + (isSafe ? '30' : '15')
        ctx.fillRect(cx, cy, CELL, CELL)
        ctx.strokeStyle = isSafe ? '#ffffff' : '#ddd'; ctx.lineWidth = isSafe ? 2 : 0.5
        ctx.strokeRect(cx, cy, CELL, CELL)

        // Safety star
        if (isSafe) {
            ctx.fillStyle = '#ffd700'; ctx.font = '12px "Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'
            ctx.fillText('★', cx + CELL / 2, cy + CELL / 2 + 4)
        }

        // Starting markers
        if (i === 0) { ctx.fillStyle = PAL.red.fill; ctx.font = 'bold 14px "Segoe UI",sans-serif'; ctx.fillText('S', cx + CELL / 2, cy + CELL / 2 + 5) }
        if (i === 13) { ctx.fillStyle = PAL.green.fill; ctx.font = 'bold 14px "Segoe UI",sans-serif'; ctx.fillText('S', cx + CELL / 2, cy + CELL / 2 + 5) }
        if (i === 26) { ctx.fillStyle = PAL.yellow.fill; ctx.font = 'bold 14px "Segoe UI",sans-serif'; ctx.fillText('S', cx + CELL / 2, cy + CELL / 2 + 5) }
        if (i === 39) { ctx.fillStyle = PAL.blue.fill; ctx.font = 'bold 14px "Segoe UI",sans-serif'; ctx.fillText('S', cx + CELL / 2, cy + CELL / 2 + 5) }
    }

    // ─‧ Home column cells ────────────────────────────────────────────
    for (const [color, cells] of Object.entries(HOME_COLS)) {
        for (const [c, r] of cells) {
            ctx.fillStyle = PAL[color as Color].fill + '25'
            ctx.fillRect(c * CELL, r * CELL, CELL, CELL)
            ctx.strokeStyle = PAL[color as Color].fill; ctx.lineWidth = 1.5
            ctx.strokeRect(c * CELL, r * CELL, CELL, CELL)
        }
        // Arrow/triangle toward center on last cell
        const last = cells[cells.length - 1]
        ctx.fillStyle = PAL[color as Color].fill + '60'
        ctx.beginPath()
        const lx = last[0] * CELL + CELL / 2, ly = last[1] * CELL + CELL / 2
        ctx.arc(lx, ly, CELL / 3, 0, Math.PI * 2); ctx.fill()
    }

    // ─‧ Draw tokens ──────────────────────────────────────────────────
    for (const color of game.players) {
        const tokens = game.tokens[color]
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i]
            let cx: number, cy: number

            if (t.atHome) {
                const [bc, br] = BASE_POS[color][i]
                cx = bc * CELL; cy = br * CELL
            } else if (t.pos >= 52) {
                const hc = HOME_COLS[color]
                const hi = t.pos - 52
                if (hi < hc.length) {
                    const [hcCol, hcRow] = hc[hi]
                    cx = hcCol * CELL; cy = hcRow * CELL
                } else {
                    // Safety: place near center
                    cx = 7 * CELL; cy = 7 * CELL
                }
            } else {
                const [tc, tr] = TRACK[t.pos]
                cx = tc * CELL; cy = tr * CELL
            }

            // Token body
            const r = CELL / 2 - 5
            ctx.beginPath()
            ctx.arc(cx + CELL / 2, cy + CELL / 2, r, 0, Math.PI * 2)
            ctx.fillStyle = PAL[color].fill; ctx.fill()
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2
            ctx.stroke()
            // Highlight
            ctx.beginPath()
            ctx.arc(cx + CELL / 2 - r * 0.35, cy + CELL / 2 - r * 0.35, r * 0.4, 0, Math.PI * 2)
            ctx.fillStyle = PAL[color].light + 'aa'; ctx.fill()
        }
    }

    // ─‧ Header bar ───────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.60)'
    ctx.fillRect(0, 0, SIZE, 28)
    const turnColor = game.turn
    ctx.fillStyle = PAL[turnColor].light; ctx.font = 'bold 15px "Segoe UI",sans-serif'; ctx.textAlign = 'center'
    const turnMention = game.byColor[turnColor] ? TAG(game.byColor[turnColor]) : turnColor
    ctx.fillText(`${PAL[turnColor].emoji} ${turnMention}'s Turn`, SIZE / 2, 20)

    // Dice display
    if (game.lastRoll > 0) {
        const diceMap: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' }
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 32px "Segoe UI Emoji",sans-serif'
        ctx.fillText(`${diceMap[game.lastRoll] || '🎲'}`, SIZE - 50, 50)
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px "Segoe UI",sans-serif'
        ctx.fillText(`${game.lastRoll}`, SIZE - 22, 50)
    }

    // Footer instructions
    ctx.fillStyle = 'rgba(0,0,0,0.40)'; ctx.font = '11px "Segoe UI",sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Ludo • roll | move 1-4', SIZE / 2, SIZE - 6)

    return cv.toBuffer('image/png')
}

// ───── GAME LOGIC HELPERS ─────────────────────────────────────────────
const newTokens = (): Token[] => [
    { pos: -1, atHome: true }, { pos: -1, atHome: true },
    { pos: -1, atHome: true }, { pos: -1, atHome: true }
]

/** Convert a color-local position (0–57) to global TRACK index. */
const localToGlobal = (color: Color, localPos: number): number => {
    const entry = ENTRY_IDX[color]
    return (entry + localPos) % 52
}

const canMove = (t: Token, steps: number): boolean => {
    if (t.atHome) return steps === 6
    const newPos = t.pos + steps
    return newPos <= 57 // can't overshoot home column
}

const moveToken = (game: LudoState, color: Color, idx: number, steps: number): void => {
    const t = game.tokens[color][idx]
    const oppColors = game.players.filter(c => c !== color)

    if (t.atHome) {
        t.atHome = false; t.pos = 0; steps--
        if (steps === 0) { afterMove(game, color, oppColors); return }
    }

    const oldGlobalPos = t.pos < 52 ? localToGlobal(color, t.pos) : -1
    t.pos += steps
    if (t.pos > 57) t.pos = 57 - (t.pos - 57) // bounce back

    afterMove(game, color, oppColors)
}

const afterMove = (game: LudoState, color: Color, oppColors: Color[]): void => {
    // ── Capture check ──
    const tokens = game.tokens[color]
    for (const t of tokens) {
        if (t.atHome || t.pos < 0 || t.pos >= 52) continue
        const global = localToGlobal(color, t.pos)
        if (SAFE_SPOTS.has(global)) continue

        for (const oc of oppColors) {
            for (const ot of game.tokens[oc]) {
                if (ot.atHome || ot.pos < 0 || ot.pos >= 52) continue
                const og = localToGlobal(oc, ot.pos)
                if (og === global) { ot.pos = -1; ot.atHome = true }
            }
        }
    }

    // ── Win check ──
    if (tokens.every(t => !t.atHome && t.pos >= 52)) {
        game.over = true; game.winner = color; return
    }

    // Got a 6? Roll again
    if (game.lastRoll === 6 && !game.over) return

    // Pass turn to next player
    const idx = game.players.indexOf(color)
    game.turn = game.players[(idx + 1) % game.players.length]
    game.lastRoll = 0
}

// ───── COMMAND ────────────────────────────────────────────────────────
export default class Command extends CommandModule {
    private games = new Map<string, LudoState>()

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ludo',
            aliases: ['ludoduel', 'ludo4'],
            description: 'Play Ludo 🎲 2–4 player board game!',
            category: 'gaming',
            usage: `${client.config.prefix}ludo challenge @user1 [@user2] [@user3] | roll | move 1-4 | ff`,
            baseXp: 25
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const chat = M.from
        const sender = M.sender.jid
        const sub = (args[0] || '').toLowerCase().trim()

        // ── Help ──
        const showHelp = () => M.reply(
            `🎲 *Ludo*\n\n` +
            `*${this.client.config.prefix}ludo challenge @user* — 2P game\n` +
            `*${this.client.config.prefix}ludo challenge @a @b* — 3P game\n` +
            `*${this.client.config.prefix}ludo challenge @a @b @c* — 4P game\n` +
            `*${this.client.config.prefix}ludo roll* — Roll dice\n` +
            `*${this.client.config.prefix}ludo move 1* — Move token\n` +
            `*${this.client.config.prefix}ludo ff* — Forfeit\n\n` +
            `🎯 Roll a 6 to enter. Get all 4 tokens home to win!`
        )

        // ── Challenge ──
        if (sub === 'challenge' || sub === 'c') {
            const opps = M.mentioned.filter(j => j !== sender)
            if (opps.length === 0) return void M.reply('❌ Mention at least 1 user to challenge!')

            const totalPlayers = Math.min(opps.length + 1, 4)
            if (totalPlayers < 2) return void M.reply('❌ Need at least 2 players!')

            if (this.games.has(chat) && !this.games.get(chat)!.over) {
                return void M.reply('⚠️ A game is already in progress!')
            }

            const colors = TIER_COLORS[totalPlayers - 2]
            const byColor: Record<Color, string> = {} as Record<Color, string>
            byColor[colors[0]] = sender
            for (let i = 0; i < opps.length && i < 3; i++) {
                byColor[colors[i + 1]] = opps[i]
            }

            const game: LudoState = {
                tokens: { red: newTokens(), green: newTokens(), yellow: newTokens(), blue: newTokens() },
                turn: colors[0],
                lastRoll: 0,
                over: false,
                winner: null,
                players: colors,
                byColor
            }
            this.games.set(chat, game)

            const playerLines = colors.map(c => `${PAL[c].emoji} ${TAG(byColor[c])}`).join('  ')
            const buf = renderBoard(game)
            try {
                const video = await this.client.util.imageToVideoBuffer(buf, 5)
                return void M.reply(video, MessageType.video, Mimetype.gif, [...Object.values(byColor)],
                    `🎲 *Ludo — ${totalPlayers} Players*\n\n${playerLines}\n\n${TAG(sender)} goes first!\nRoll with \`${this.client.config.prefix}ludo roll\``)
            } catch {
                return void M.reply(buf, MessageType.image, Mimetype.png, [...Object.values(byColor)],
                    `🎲 *Ludo — ${totalPlayers} Players*\n\n${playerLines}\n\n${TAG(sender)} goes first!\nRoll with \`${this.client.config.prefix}ludo roll\``)
            }
        }

        // ── Active game ──
        const game = this.games.get(chat)
        if (!game || game.over) return showHelp()

        const playerColor = (Object.entries(game.byColor) as [Color, string][]).find(([, j]) => j === sender)?.[0]
        if (!playerColor) return void M.reply('❌ You are not in this game!')

        // ── Forfeit ──
        if (sub === 'ff') {
            game.over = true
            game.winner = game.players.find(c => c !== playerColor) || null
            if (game.winner) {
                const wJid = game.byColor[game.winner]
                return void M.reply(`🏳️ ${TAG(sender)} forfeited!\n\n${PAL[game.winner].emoji} ${TAG(wJid)} wins!`, MessageType.text, undefined, [wJid])
            }
            this.games.delete(chat)
            return void M.reply('Game ended.')
        }

        // ── Roll ──
        if (sub === 'roll' || sub === 'r') {
            if (game.turn !== playerColor) return void M.reply('⏳ Not your turn!')

            game.lastRoll = Math.floor(Math.random() * 6) + 1
            const tokens = game.tokens[playerColor]

            // Check for any movable token
            const movable = tokens.map((t, i) => ({ t, i })).filter(({ t }) => canMove(t, game.lastRoll))

            if (movable.length === 0) {
                // No moves — auto-pass
                const curIdx = game.players.indexOf(playerColor)
                game.turn = game.players[(curIdx + 1) % game.players.length]
                const buf = renderBoard(game)
                const cap = `🎲 Rolled ${game.lastRoll} — no moves. Turn passes.`
                game.lastRoll = game.lastRoll
                try {
                    const video = await this.client.util.imageToVideoBuffer(buf, 5)
                    return void M.reply(video, MessageType.video, Mimetype.gif, undefined, cap)
                } catch {
                    return void M.reply(buf, MessageType.image, Mimetype.png, undefined, cap)
                }
            }

            if (movable.length === 1) {
                // Auto-move
                moveToken(game, playerColor, movable[0].i, game.lastRoll)
                const buf = renderBoard(game)
                const cap = `🎲 Rolled ${game.lastRoll} → auto-moved token ${movable[0].i + 1}`
                try {
                    const video = await this.client.util.imageToVideoBuffer(buf, 5)
                    return void M.reply(video, MessageType.video, Mimetype.gif, undefined, cap)
                } catch {
                    return void M.reply(buf, MessageType.image, Mimetype.png, undefined, cap)
                }
            }

            const buf = renderBoard(game)
            const tokenList = movable.map(({ i }) => `*${i + 1}*`).join(', ')
            try {
                const video = await this.client.util.imageToVideoBuffer(buf, 5)
                return void M.reply(video, MessageType.video, Mimetype.gif, undefined,
                    `🎲 Rolled *${game.lastRoll}*\n\nChoose token: ${tokenList}\n\`${this.client.config.prefix}ludo move 1-4\``)
            } catch {
                return void M.reply(buf, MessageType.image, Mimetype.png, undefined,
                    `🎲 Rolled *${game.lastRoll}*\n\nChoose token: ${tokenList}\n\`${this.client.config.prefix}ludo move 1-4\``)
            }
        }

        // ── Move ──
        if (sub === 'move' || sub === 'm') {
            const ti = parseInt(args[1] || '')
            if (isNaN(ti) || ti < 1 || ti > 4) return void M.reply('❌ `ludo move 1-4` to choose a token.')
            const idx = ti - 1

            if (game.turn !== playerColor) return void M.reply('⏳ Not your turn!')
            if (game.lastRoll === 0) return void M.reply('🎲 Roll first! `ludo roll`')

            const t = game.tokens[playerColor][idx]
            if (!canMove(t, game.lastRoll)) {
                if (t.atHome) return void M.reply(`❌ Need a *6* to enter!`)
                if (t.pos + game.lastRoll > 57) return void M.reply(`❌ Can't overshoot home!`)
                return void M.reply(`❌ Token ${ti} can't move ${game.lastRoll} steps!`)
            }

            moveToken(game, playerColor, idx, game.lastRoll)
            const buf = renderBoard(game)
            const cap = game.over
                ? `🎉 ${PAL[game.winner!].emoji} ${TAG(game.byColor[game.winner!])} wins!`
                : `✅ Moved token ${ti}`
            try {
                const video = await this.client.util.imageToVideoBuffer(buf, 5)
                return void M.reply(video, MessageType.video, Mimetype.gif, game.winner ? [game.byColor[game.winner!]] : undefined, cap)
            } catch {
                return void M.reply(buf, MessageType.image, Mimetype.png, game.winner ? [game.byColor[game.winner!]] : undefined, cap)
            }
        }

        // ── Show board ──
        const buf = renderBoard(game)
        try {
            const video = await this.client.util.imageToVideoBuffer(buf, 5)
            return void M.reply(video, MessageType.video, Mimetype.gif, undefined,
                `🎲 *Ludo*\n${PAL[game.turn].emoji} ${TAG(game.byColor[game.turn])}'s turn`)
        } catch {
            return void M.reply(buf, MessageType.image, Mimetype.png, undefined,
                `🎲 *Ludo*\n${PAL[game.turn].emoji} ${TAG(game.byColor[game.turn])}'s turn`)
        }
    }
}