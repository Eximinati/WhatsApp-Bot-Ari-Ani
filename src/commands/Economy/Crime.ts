import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'

const W = 680, H = 380, R = 22
const BG1 = '#1a0005', BG2 = '#2d0008', ACw = '#ff1744', ACl = '#ff5252'

function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

const ECO = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'crime', description: 'Commit a crime for quick cash', category: 'economy', usage: `${client.config.prefix}crime`, aliases: ['heist'], baseXp: 25 })
    }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try { const res = await ECO.crime(M.sender.jid); const cv = createCanvas(W, H), ctx = cv.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

            // Decorations
            ctx.fillStyle = 'rgba(255,23,68,0.04)'
            ctx.beginPath(); ctx.arc(580, 50, 120, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(80, 300, 80, 0, Math.PI * 2); ctx.fill()

            // Header
            ctx.fillStyle = ACl; ctx.font = 'bold 32px "Segoe UI", "Arial", sans-serif'; ctx.textAlign = 'center'
            ctx.fillText('CRIME', W / 2, 58)
            ctx.fillStyle = ACl; ctx.fillRect(W / 2 - 50, 72, 100, 3)

            const ok = res.ok && res.success
            const cd = res.reason === 'cooldown'

            // Result card
            const cardColor = ok ? 'rgba(76,175,80,0.1)' : cd ? 'rgba(255,107,107,0.12)' : 'rgba(255,200,0,0.08)'
            const borderColor = ok ? '#4caf50' : cd ? '#ff6b6b' : '#ffc107'
            ctx.fillStyle = cardColor; rr(ctx, 60, 90, 560, 180, R); ctx.fill()
            ctx.strokeStyle = borderColor; ctx.lineWidth = 1.5; rr(ctx, 60, 90, 560, 180, R); ctx.stroke()

            if (ok) {
                ctx.fillStyle = '#4caf50'; ctx.font = 'bold 48px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`+${formatMoney(res.reward || 0)}`, W / 2, 170)
                ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '18px "Segoe UI", "Arial", sans-serif'
                ctx.fillText('Crime successful — you got away!', W / 2, 210)
                ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '15px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)}  •  Bank: ${formatMoney(res.account.bank)}`, W / 2, 245)
            } else if (cd) {
                ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 32px "Segoe UI", "Arial", sans-serif'
                ctx.fillText('COOLDOWN', W / 2, 155)
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wait ${formatDurationMs(res.remainingMs || 0)}`, W / 2, 195)
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)}  •  Bank: ${formatMoney(res.account.bank)}`, W / 2, 230)
            } else {
                ctx.fillStyle = '#ffc107'; ctx.font = 'bold 32px "Segoe UI", "Arial", sans-serif'
                ctx.fillText('Busted!', W / 2, 155)
                ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '18px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`You got caught! -${formatMoney(res.reward || 0)} fine`, W / 2, 195)
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)}  •  Bank: ${formatMoney(res.account.bank)}`, W / 2, 230)
            }

            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI", "Arial", sans-serif'; ctx.fillText('Ari-Ani Underworld  •  /crime to try again', W / 2, H - 16)

            const cap = ok
                ? `🔫 *CRIME*\n━━━━━━━━\n✅ Successful! +${formatMoney(res.reward || 0)}\n━━━━━━━━\n📊 Wallet: ${formatMoney(res.account.wallet)}\n🏦 Bank: ${formatMoney(res.account.bank)}\n💎 Total: ${formatMoney(res.account.totalWealth)}`
                : cd
                    ? `🔫 *CRIME*\n━━━━━━━━\n⏳ Cooldown: ${formatDurationMs(res.remainingMs || 0)}`
                    : `🔫 *CRIME*\n━━━━━━━━\n🚔 Busted! -${formatMoney(res.reward || 0)} fine\n━━━━━━━━\n📊 Wallet: ${formatMoney(res.account.wallet)}\n🏦 Bank: ${formatMoney(res.account.bank)}\n💎 Total: ${formatMoney(res.account.totalWealth)}`

            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap)
        } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}