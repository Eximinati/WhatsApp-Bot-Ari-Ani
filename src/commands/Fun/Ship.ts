import { createCanvas } from '@napi-rs/canvas'
import { MessageType, Mimetype } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import {
    canonicalizeShip,
    computeBondGrowth,
    computeRizz,
    shipBond
} from '../../core/Ship/index.js'

const W = 720, H = 440, R = 28

const tagFor = (jid: string): string => `@${jid.split('@')[0]}`

const flavorForBond = (pct: number): string => {
    if (pct < 10) return 'Run. Run far. 🚩'
    if (pct < 25) return "There's still time to reconsider your choices."
    if (pct < 50) return 'Good enough, I guess! 💫'
    if (pct < 75) return "Stay together and you'll find a way ⭐️"
    if (pct < 90) return 'Amazing! You two will be a good couple 💖'
    if (pct < 99) return 'Fated to be together 💙'
    return 'Soulmate-tier. The stars themselves are jealous. 💞'
}

const flavorForRizz = (pct: number): string => {
    if (pct < 20) return 'Severely undersold. Touch grass first. 🌱'
    if (pct < 40) return 'A diamond in the rough.'
    if (pct < 60) return 'Solid presence.'
    if (pct < 80) return 'Local heartthrob. 💘'
    if (pct < 95) return 'Certified menace. 🔥'
    return 'Rizz incarnate. ✨'
}

function roundRect(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

interface ShipGifEntry { id: number; shipPercent: string; gifLink: string }
interface ShipAsset { shipJson: ShipGifEntry[] }

export default class Command extends CommandModule {
    private shipAssets: ShipAsset | null = null

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ship', description: 'Ship 💖 people', category: 'fun',
            usage: `${client.config.prefix}ship [@user(s)]`, baseXp: 50
        })
    }

    private getShipAssets(): ShipAsset | null {
        if (this.shipAssets) return this.shipAssets
        try {
            const raw = this.client.assets.get('ship')
            if (!raw) return null
            this.shipAssets = JSON.parse(raw.toString()) as ShipAsset
            return this.shipAssets
        } catch { return null }
    }

    private pickGif(percent: number): string | null {
        const data = this.getShipAssets()
        if (!data?.shipJson?.length) return null
        const candidates = data.shipJson.filter(e => Math.abs(parseInt(e.shipPercent) - percent) <= 10)
        if (!candidates.length) return null
        return candidates[Math.floor(Math.random() * candidates.length)].gifLink
    }

    private drawShipCanvas(
        pct: number, raw: number, capped: boolean,
        base: number, growth: number,
        tags: string, flavor: string, members: number,
        mode: 'ship' | 'rizz'
    ): Buffer {
        const cv = createCanvas(W, H), ctx = cv.getContext('2d')

        // Gradient background — romantic colors
        const grad = ctx.createLinearGradient(0, 0, W, H)
        if (pct >= 80) {
            grad.addColorStop(0, '#2d0020'); grad.addColorStop(0.5, '#4a0035'); grad.addColorStop(1, '#1a0015')
        } else if (pct >= 50) {
            grad.addColorStop(0, '#1a1030'); grad.addColorStop(0.5, '#2d1045'); grad.addColorStop(1, '#0d0820')
        } else {
            grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(0.5, '#162040'); grad.addColorStop(1, '#0d0d1a')
        }
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

        // Floating hearts background
        ctx.fillStyle = 'rgba(255,105,180,0.04)'
        for (let i = 0; i < 15; i++) {
            const hx = (i * 53 + 30) % W, hy = (i * 71 + 20) % H, s = 8 + (i % 12)
            ctx.font = `${s}px "Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center'
            ctx.fillText(['💕', '💖', '💗', '💘', '💝', '✨', '💫'][i % 7], hx, hy)
        }

        // Outermost glow ring
        ctx.fillStyle = 'rgba(255,105,180,0.03)'; roundRect(ctx, 10, 10, W - 20, H - 20, 30); ctx.fill()
        ctx.strokeStyle = pct >= 80 ? 'rgba(255,105,180,0.3)' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = 3
        roundRect(ctx, 20, 20, W - 40, H - 40, 26); ctx.stroke()

        // Title
        ctx.textAlign = 'center'
        ctx.shadowColor = pct >= 80 ? '#ff69b4' : '#e040fb'; ctx.shadowBlur = 25
        ctx.fillStyle = pct >= 80 ? '#ff69b4' : '#e040fb'
        ctx.font = 'bold 38px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif'
        ctx.fillText(mode === 'rizz' ? '✨ Rizz Meter ✨' : '💖 Matchmaking 💖', W / 2, 65)
        ctx.shadowBlur = 0

        // Tags / names
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px "Segoe UI",sans-serif'
        ctx.fillText(tags, W / 2, 115)

        // Percentage — big glowing number
        ctx.shadowColor = pct >= 80 ? '#ff69b4' : pct >= 50 ? '#e040fb' : '#4fc3f7'
        ctx.shadowBlur = 30
        ctx.fillStyle = pct >= 80 ? '#ff69b4' : pct >= 50 ? '#e040fb' : '#4fc3f7'
        ctx.font = 'bold 72px "Segoe UI",sans-serif'
        ctx.fillText(`${pct}%`, W / 2, 200)
        ctx.shadowBlur = 0

        // ── Progress bar ──────────────────────────────────────────────
        const barX = 100, barY = 225, barW = 520, barH = 22
        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(ctx, barX, barY, barW, barH, 11); ctx.fill()
        // Fill
        const fillW = Math.max(barH, (barW * pct) / 100)
        const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0)
        if (pct >= 80) { barGrad.addColorStop(0, '#ff1744'); barGrad.addColorStop(0.5, '#ff4081'); barGrad.addColorStop(1, '#ff80ab') }
        else if (pct >= 50) { barGrad.addColorStop(0, '#7c4dff'); barGrad.addColorStop(1, '#b388ff') }
        else { barGrad.addColorStop(0, '#0277bd'); barGrad.addColorStop(1, '#4fc3f7') }
        ctx.fillStyle = barGrad
        roundRect(ctx, barX, barY, fillW, barH, 11); ctx.fill()
        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(ctx, barX, barY, fillW, barH / 2, 11); ctx.fill()

        // ── Stats ─────────────────────────────────────────────────────
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '14px "Segoe UI",sans-serif'
        ctx.fillText(`Base ${base}  •  Growth ${growth >= 0 ? '+' : ''}${growth}${capped ? '  •  (capped)' : ''}`, W / 2, 275)

        // ── Flavor text ───────────────────────────────────────────────
        ctx.fillStyle = pct >= 80 ? '#ff69b4' : pct >= 50 ? '#e040fb' : '#4fc3f7'
        ctx.font = 'bold 18px "Segoe UI",sans-serif'
        // Word-wrap flavor
        const words = flavor.split(' ')
        let line = ''; let ly = 315; const maxW = 540
        for (const w of words) {
            const test = line ? line + ' ' + w : w
            if (ctx.measureText(test).width > maxW) { ctx.fillText(line, W / 2, ly); line = w; ly += 26 }
            else line = test
        }
        if (line) ctx.fillText(line, W / 2, ly)

        // ── Heart decoration at bottom ───────────────────────────────
        ctx.font = 'bold 28px "Segoe UI Emoji",sans-serif'
        ctx.fillText(pct >= 80 ? '💞💕💞' : pct >= 50 ? '💖💗💖' : pct >= 25 ? '💫💫💫' : '💔💔💔', W / 2, ly + 45)

        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI",sans-serif'
        ctx.fillText('Ari-Ani Fun • /ship @user @user', W / 2, H - 16)

        return cv.toBuffer('image/png')
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const resolved = canonicalizeShip(M.sender.jid, M.mentioned, M.quoted?.sender)

        // ───── SELF RIZZ ─────
        if (resolved.kind === 'self') {
            const target = resolved.member
            const breakdown = await computeRizz(this.client, target)
            const pct = breakdown.score
            const header = target === M.sender.jid ? '✨ Your Rizz ✨' : `✨ ${tagFor(target)}'s Rizz ✨`
            const flavor = flavorForRizz(pct)
            const cap = `${header}\nRizz: ${pct}%\n\nBase ${breakdown.base} · Outsiders ${breakdown.outsiderCount} (+${breakdown.outsiderTerm}) · Bonds +${breakdown.bondTerm}\n${flavor}`

            const canvasBuf = this.drawShipCanvas(pct, pct, false, breakdown.base, breakdown.bondTerm, tagFor(target), flavor, 1, 'rizz')

            // Try GIF first
            const gif = this.pickGif(pct)
            if (gif) {
                try {
                    const buf = await this.client.getBuffer(gif)
                    const video = await this.client.util.GIFBufferToVideoBuffer(buf)
                    return void M.reply(video, MessageType.video, Mimetype.gif, [target], cap)
                } catch { /* fall through */ }
            }
            return void M.reply(canvasBuf, MessageType.image, Mimetype.png, [target], cap)
        }

        // ───── SHIP MODE ─────
        const bond = await shipBond(this.client, M.sender.jid, resolved.members)
        const growth = computeBondGrowth(bond.contributions)
        const raw = bond.base + growth
        const pct = Math.max(1, Math.min(99, Math.round(raw)))
        const capped = raw > 99 || raw < 1
        const tags = resolved.members.map(tagFor).join(' × ')
        const flavor = flavorForBond(pct)
        const cap = `❣️ *Matchmaking* ❣️\n\n${tags}\n\nShipCent: ${pct}%${capped ? ' (capped)' : ''}\n\nBase ${bond.base} · Growth ${growth >= 0 ? '+' : ''}${growth}\n${flavor}`

        const canvasBuf = this.drawShipCanvas(pct, raw, capped, bond.base, growth, tags, flavor, resolved.members.length, 'ship')

        // Try GIF first, fallback to canvas
        const gif = this.pickGif(pct)
        if (gif) {
            try {
                const buf = await this.client.getBuffer(gif)
                const video = await this.client.util.GIFBufferToVideoBuffer(buf)
                return void M.reply(video, MessageType.video, Mimetype.gif, resolved.members, cap)
            } catch { /* fall through */ }
        }
        return void M.reply(canvasBuf, MessageType.image, Mimetype.png, resolved.members, cap)
    }
}
