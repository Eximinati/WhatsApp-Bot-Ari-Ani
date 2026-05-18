import { createCanvas, loadImage } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, parseAmountInput } from '../../core/economy/utils.js'

const W = 800, H = 640
const BOX = 150, GAP = 8
const GRID_X = (W - 3 * BOX) / 2, GRID_Y = 150
const R = 20

// Casino symbols drawn as styled text (no emoji — rock-solid canvas rendering)
// Each symbol has a display character, value, weight, and color
interface Sym {
    id: string
    char: string
    label: string
    points: number
    weight: number
    mainColor: string
    glowColor: string
}

const SYMS: Sym[] = [
    { id: 'a', char: '🍒',  label: 'Cherry',  points: 2,  weight: 40, mainColor: '#ff1744', glowColor: '#ff5252' },
    { id: 'b', char: '🔔',  label: 'Bell',    points: 4,  weight: 25, mainColor: '#ffd740', glowColor: '#ffe57f' },
    { id: 'c', char: '💎',  label: 'Diamond', points: 6,  weight: 15, mainColor: '#00e5ff', glowColor: '#84ffff' },
    { id: 'd', char: '★',   label: 'Star',    points: 5,  weight: 12, mainColor: '#ffd700', glowColor: '#ffe082' },
    { id: 'e', char: '7',   label: 'Seven',   points: 10, weight: 5,  mainColor: '#e040fb', glowColor: '#ea80fc' },
    { id: 'f', char: '♛',   label: 'Crown',   points: 8,  weight: 8,  mainColor: '#ff6d00', glowColor: '#ffab40' },
    { id: 'g', char: 'BAR', label: 'Bar',      points: 3,  weight: 20, mainColor: '#69f0ae', glowColor: '#b9f6ca' },
]

const BG_URL = 'https://i.ibb.co/Kx1Z4PMP/well.jpg'
const ECO = new EconomyService()

function wPick(): Sym {
    const sum = SYMS.reduce((a, s) => a + s.weight, 0)
    const r = Math.random() * sum
    let a = 0
    for (const s of SYMS) { a += s.weight; if (r < a) return s }
    return SYMS[SYMS.length - 1]
}

function roundRect(
    ctx: import('@napi-rs/canvas').SKRSContext2D,
    x: number, y: number, w: number, h: number, r: number,
) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

function drawGradientBg(ctx: import('@napi-rs/canvas').SKRSContext2D) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#0a0014')
    g.addColorStop(0.3, '#1a0030')
    g.addColorStop(0.7, '#0d001a')
    g.addColorStop(1, '#050010')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

    const glow = ctx.createRadialGradient(W / 2, GRID_Y + 225, 80, W / 2, GRID_Y + 225, 350)
    glow.addColorStop(0, 'rgba(180,100,255,0.08)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(255,215,0,0.06)'
    for (let i = 0; i < 20; i++) {
        ctx.beginPath(); ctx.arc(40 + i * 38, 20, 3 + (i % 3), 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(40 + i * 38, H - 20, 3 + (i % 3), 0, Math.PI * 2); ctx.fill()
    }
}

function drawSymbol(
    ctx: import('@napi-rs/canvas').SKRSContext2D,
    sym: Sym, cx: number, cy: number, size: number, isWin: boolean,
) {
    // Glow circle behind
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = isWin ? sym.glowColor : 'rgba(255,255,255,0.05)'
    ctx.fill()

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2)
    ctx.strokeStyle = sym.mainColor
    ctx.lineWidth = 3
    ctx.stroke()

    // Symbol text
    ctx.fillStyle = sym.mainColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (sym.char === 'BAR') {
        // BAR is 3 horizontal bars
        const barW = size * 0.5, barH = size * 0.12, barGap = size * 0.14
        ctx.fillStyle = sym.mainColor
        ctx.fillRect(cx - barW / 2, cy - barH / 2 - barGap, barW, barH)
        ctx.fillRect(cx - barW / 2, cy - barH / 2, barW, barH)
        ctx.fillRect(cx - barW / 2, cy - barH / 2 + barGap, barW, barH)
    } else {
        ctx.font = `bold ${size * 0.56}px "Segoe UI", "Arial", sans-serif`
        ctx.fillText(sym.char, cx, cy + 2)
    }
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'slot',
            description: 'Spin the pro slot machine (3×3)',
            category: 'economy',
            aliases: ['slots', 'spin', 'bet'],
            usage: `${client.config.prefix}slot [amount]`,
            baseXp: 30,
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const jid = M.sender.jid
        const inp = joined.trim() || '50'
        try {
            const bal = await ECO.getBalance(jid)
            const bet = parseAmountInput(inp, bal.wallet)
            if (bet <= 0) return void M.reply('❌ Provide a valid bet amount.')
            if (bet > 10_000_000) return void M.reply('❌ Max bet is 10,000,000.')
            if (bal.wallet < bet) return void M.reply(`❌ You need ${formatMoney(bet)} — you have ${formatMoney(bal.wallet)}.`)

            const isWin = Math.random() < 0.8
            let winnings = 0
            const winRows: number[] = []
            let jackpot = false

            const reel: Sym[][] = []
            for (let i = 0; i < 3; i++) reel.push([wPick(), wPick(), wPick()])
            const grid: Sym[][] = [
                [reel[0][0], reel[1][0], reel[2][0]],
                [reel[0][1], reel[1][1], reel[2][1]],
                [reel[0][2], reel[1][2], reel[2][2]],
            ]

            if (isWin) {
                const wr = Math.floor(Math.random() * 3); winRows.push(wr)
                const ws = SYMS[Math.floor(Math.random() * SYMS.length)]
                grid[wr] = [ws, ws, ws]
                if (wr === 1 && Math.random() < 0.1) { jackpot = true; winnings = bet * 10 }
                else winnings = ws.points * bet
            } else {
                const fd = (): Sym[] => {
                    const s1 = SYMS[Math.floor(Math.random() * SYMS.length)]
                    let s2 = SYMS[Math.floor(Math.random() * SYMS.length)]
                    let s3 = SYMS[Math.floor(Math.random() * SYMS.length)]
                    if (s1.id === s2.id && s2.id === s3.id)
                        s3 = SYMS.filter(x => x.id !== s1.id)[0]
                    return [s1, s2, s3]
                }
                for (let r = 0; r < 3; r++) grid[r] = fd()
                winnings = 0
            }

            await ECO.addWallet(jid, winnings - bet)
            const bal2 = await ECO.getBalance(jid)

            // ── Rich caption ───────────────────────────────────────────────
            const resultStr = winnings > 0
                ? `📈 You won ${formatMoney(winnings)} coins!${jackpot ? ' 🎉 JACKPOT!' : ''}`
                : `📉 You lost ${formatMoney(bet)} coins.`
            const winSymName = winRows.length > 0 ? grid[winRows[0]][0].label : 'none'
            const cap = [
                `🎰 *SLOT MACHINE*`,
                `━━━━━━━━━━━━━━━`,
                resultStr,
                winnings > 0 ? `🏆 Match: *${winSymName}* (×${grid[winRows[0]][0].points})` : '',
                `💵 Bet: ${formatMoney(bet)}`,
                `━━━━━━━━━━━━━━━`,
                `📊 *Wallet* : ${formatMoney(bal2.wallet)}`,
                `🏦 *Bank*   : ${formatMoney(bal2.bank)}`,
                `💎 *Total*  : ${formatMoney(bal2.totalWealth)}`,
                `━━━━━━━━━━━━━━━`,
                `🎲 Play again: .slot <amount>`,
            ].filter(Boolean).join('\n')

            // ── Draw canvas ───────────────────────────────────────────────
            const cv = createCanvas(W, H)
            const ctx = cv.getContext('2d')

            // Background
            let bg: import('@napi-rs/canvas').Image | null = null
            try { bg = await loadImage(BG_URL) } catch { /* use gradient */ }
            if (bg) {
                ctx.drawImage(bg, 0, 0, W, H)
                ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H)
            } else {
                drawGradientBg(ctx)
            }
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H)

            // Outer golden frame
            ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = 4
            roundRect(ctx, 20, 20, W - 40, H - 40, 24); ctx.stroke()
            ctx.strokeStyle = 'rgba(255,215,0,0.15)'; ctx.lineWidth = 1
            roundRect(ctx, 30, 30, W - 60, H - 60, 20); ctx.stroke()

            // Left decorative bar
            const lx = 30, ly = 120, lw = 40, lh = 380
            roundRect(ctx, lx, ly, lw, lh, 12)
            const lg = ctx.createLinearGradient(lx, ly, lx + lw, ly)
            lg.addColorStop(0, '#ff6f00'); lg.addColorStop(0.5, '#ffd600'); lg.addColorStop(1, '#ff8f00')
            ctx.fillStyle = lg; ctx.fill()
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2; ctx.stroke()
            for (let i = 0; i < 8; i++) {
                const by = ly + 30 + i * 45
                ctx.beginPath(); ctx.arc(lx + lw / 2, by, 10, 0, Math.PI * 2)
                ctx.fillStyle = i % 3 === 0 ? '#ff1744' : i % 3 === 1 ? '#00e5ff' : '#ffd700'
                ctx.fill()
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
            }

            // Right decorative bar
            const rx = W - 70
            roundRect(ctx, rx, ly, lw, lh, 12)
            const rg = ctx.createLinearGradient(rx, ly, rx + lw, ly)
            rg.addColorStop(0, '#ff8f00'); rg.addColorStop(0.5, '#ffd600'); rg.addColorStop(1, '#ff6f00')
            ctx.fillStyle = rg; ctx.fill()
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2; ctx.stroke()
            for (let i = 0; i < 8; i++) {
                const by = ly + 30 + i * 45
                ctx.beginPath(); ctx.arc(rx + lw / 2, by, 10, 0, Math.PI * 2)
                ctx.fillStyle = i % 3 === 0 ? '#00e5ff' : i % 3 === 1 ? '#ffd700' : '#ff1744'
                ctx.fill()
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
            }

            // Header
            ctx.textAlign = 'center'
            ctx.shadowColor = jackpot ? '#ffd700' : '#e040fb'
            ctx.shadowBlur = jackpot ? 40 : 20
            ctx.fillStyle = jackpot ? '#ffd700' : '#e040fb'
            ctx.font = 'bold 42px "Segoe UI", "Arial", sans-serif'
            ctx.fillText(jackpot ? 'JACKPOT!' : 'SLOT MACHINE', W / 2, 70)
            ctx.shadowBlur = 0

            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 15px "Segoe UI", sans-serif'
            ctx.fillText(`BET: ${formatMoney(bet)}  •  MATCH LINE TO WIN!`, W / 2, 100)

            // Reel Grid with machine body
            ctx.fillStyle = 'rgba(20,10,40,0.85)'
            roundRect(ctx, GRID_X - 20, GRID_Y - 20, 3 * BOX + 40, 3 * BOX + 20, 24)
            ctx.fill()
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3
            roundRect(ctx, GRID_X - 20, GRID_Y - 20, 3 * BOX + 40, 3 * BOX + 20, 24)
            ctx.stroke()
            ctx.strokeStyle = 'rgba(255,215,0,0.2)'; ctx.lineWidth = 6
            roundRect(ctx, GRID_X - 14, GRID_Y - 14, 3 * BOX + 28, 3 * BOX + 8, 20)
            ctx.stroke()

            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const x = GRID_X + c * BOX, y = GRID_Y + r * BOX
                    const bw = BOX - GAP, bh = BOX - GAP
                    const isWinRow = winRows.includes(r)

                    // Cell background
                    const cellGrad = ctx.createLinearGradient(x, y, x, y + bh)
                    cellGrad.addColorStop(0, isWinRow ? '#3a1a5a' : '#1a0a2e')
                    cellGrad.addColorStop(1, isWinRow ? '#1a0528' : '#0d001a')
                    ctx.fillStyle = cellGrad
                    roundRect(ctx, x, y, bw, bh, 14); ctx.fill()

                    // Border
                    ctx.strokeStyle = isWinRow ? '#ffd700' : 'rgba(255,255,255,0.3)'
                    ctx.lineWidth = isWinRow ? 3 : 2
                    roundRect(ctx, x, y, bw, bh, 14); ctx.stroke()

                    // Inner highlight for winning
                    if (isWinRow) {
                        ctx.strokeStyle = 'rgba(255,215,0,0.3)'; ctx.lineWidth = 5
                        roundRect(ctx, x + 4, y + 4, bw - 8, bh - 8, 10); ctx.stroke()
                    }

                    // Draw symbol
                    drawSymbol(ctx, grid[r][c], x + bw / 2, y + bh / 2, 90, isWinRow)
                }
            }

            // Result Banner
            const banY = GRID_Y + 3 * BOX + 30
            const banGrad = ctx.createLinearGradient(0, banY, 0, banY + 65)
            banGrad.addColorStop(0, winnings > 0 ? '#1b5e20' : '#b71c1c')
            banGrad.addColorStop(1, winnings > 0 ? '#0d2e0d' : '#5c0000')
            ctx.fillStyle = banGrad
            roundRect(ctx, GRID_X - 10, banY, 3 * BOX + 20, 65, 16); ctx.fill()
            ctx.strokeStyle = winnings > 0 ? '#4caf50' : '#ff5252'; ctx.lineWidth = 2
            roundRect(ctx, GRID_X - 10, banY, 3 * BOX + 20, 65, 16); ctx.stroke()

            ctx.font = 'bold 24px "Segoe UI", sans-serif'
            ctx.fillStyle = '#ffffff'
            ctx.fillText(
                winnings > 0 ? `WON: ${formatMoney(winnings)}` : `LOST: ${formatMoney(bet)}`,
                W / 2, banY + 42,
            )

            // Balance footer
            const ftY = banY + 85
            ctx.font = 'bold 14px "Segoe UI", sans-serif'
            ctx.fillStyle = 'rgba(255,255,255,0.5)'
            ctx.fillText(`Wallet: ${formatMoney(bal2.wallet)}  •  Bank: ${formatMoney(bal2.bank)}  •  Total: ${formatMoney(bal2.totalWealth)}`, W / 2, ftY)
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI", sans-serif'
            ctx.fillText('Ari-Ani Casino • .slot <amount> to spin again', W / 2, ftY + 20)

            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap)
        } catch (err) {
            return void M.reply(`❌ ${err instanceof Error ? err.message : 'Error'}`)
        }
    }
}