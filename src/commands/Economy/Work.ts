import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'

const W = 680, H = 380, R = 22
const BG1 = '#1a1a2e', BG2 = '#16213e', AC = '#4fc3f7'

function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

const ECO = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'work', description: 'Work to earn coins', category: 'economy', usage: `${client.config.prefix}work`, aliases: ['job'], baseXp: 20 })
    }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try {
            const res = await ECO.work(M.sender.jid)
            const cv = createCanvas(W, H), ctx = cv.getContext('2d')
            const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

            ctx.fillStyle = 'rgba(79,195,247,0.04)'
            ctx.beginPath(); ctx.arc(580, 50, 120, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(80, 300, 80, 0, Math.PI * 2); ctx.fill()

            ctx.fillStyle = AC; ctx.font = 'bold 32px "Segoe UI", "Arial", sans-serif'; ctx.textAlign = 'center'
            ctx.fillText('WORK', W / 2, 58)
            ctx.fillStyle = AC; ctx.fillRect(W / 2 - 40, 72, 80, 3)

            if (res.ok && res.success) {
                ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 60, 90, 560, 180, R); ctx.fill()
                ctx.strokeStyle = AC; ctx.lineWidth = 1.5; rr(ctx, 60, 90, 560, 180, R); ctx.stroke()

                ctx.fillStyle = '#81d4fa'; ctx.font = 'bold 48px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`+${formatMoney(res.reward || 0)}`, W / 2, 165)
                ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '18px "Segoe UI", "Arial", sans-serif'
                ctx.fillText('Hard work pays off!', W / 2, 208)
                ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '15px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)}  •  Bank: ${formatMoney(res.account.bank)}`, W / 2, 245)
            } else if (res.reason === 'cooldown') {
                ctx.fillStyle = 'rgba(255,107,107,0.12)'; rr(ctx, 60, 90, 560, 180, R); ctx.fill()
                ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 1.5; rr(ctx, 60, 90, 560, 180, R); ctx.stroke()

                ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 32px "Segoe UI", "Arial", sans-serif'; ctx.fillText('COOLDOWN', W / 2, 155)
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wait ${formatDurationMs(res.remainingMs || 0)}`, W / 2, 195)
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)}  •  Bank: ${formatMoney(res.account.bank)}`, W / 2, 230)
            } else {
                ctx.fillStyle = 'rgba(255,200,0,0.08)'; rr(ctx, 60, 90, 560, 180, R); ctx.fill()
                ctx.strokeStyle = '#ffc107'; ctx.lineWidth = 1.5; rr(ctx, 60, 90, 560, 180, R); ctx.stroke()
                ctx.fillStyle = '#ffc107'; ctx.font = 'bold 28px "Segoe UI", "Arial", sans-serif'; ctx.fillText('No jobs available right now...', W / 2, 170)
            }

            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI", "Arial", sans-serif'; ctx.fillText('Ari-Ani Economy  •  /help for more', W / 2, H - 16)

            const cap = res.ok && res.success
                ? `💼 *WORK*\n━━━━━━━━\n💰 Earned: +${formatMoney(res.reward || 0)}\n━━━━━━━━\n📊 Wallet: ${formatMoney(res.account.wallet)}\n🏦 Bank: ${formatMoney(res.account.bank)}\n💎 Total: ${formatMoney(res.account.totalWealth)}`
                : res.reason === 'cooldown'
                    ? `💼 *WORK*\n━━━━━━━━\n⏳ Cooldown: ${formatDurationMs(res.remainingMs || 0)}`
                    : `💼 *WORK*\n━━━━━━━━\n😴 No jobs available`

            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap)
        } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}