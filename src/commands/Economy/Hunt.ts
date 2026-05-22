import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'

const W = 680, H = 380, R = 22
const BG1 = '#1a3a1a', BG2 = '#0d1f0d', AC = '#8bc34a'


const economy = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'hunt', description: 'Go hunting for coins', category: 'economy', usage: `${client.config.prefix}hunt`, aliases: ['hunting'], baseXp: 15 })
    }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try { const res = await economy.hunt(M.sender.jid); const cv = createCanvas(W, H), ctx = cv.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

            ctx.fillStyle = 'rgba(139,195,74,0.04)'
            ctx.beginPath(); ctx.arc(580, 50, 120, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(80, 300, 80, 0, Math.PI * 2); ctx.fill()

            ctx.fillStyle = AC; ctx.font = 'bold 32px "Segoe UI", "Arial", sans-serif'; ctx.textAlign = 'center'
            ctx.fillText('HUNTING', W / 2, 58)
            ctx.fillStyle = AC; ctx.fillRect(W / 2 - 60, 72, 120, 3)

            if (res.ok && res.success) {
                ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 60, 90, 560, 180, R); ctx.fill()
                ctx.strokeStyle = AC; ctx.lineWidth = 1.5; rr(ctx, 60, 90, 560, 180, R); ctx.stroke()

                ctx.fillStyle = '#aed581'; ctx.font = 'bold 48px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`+${formatMoney(res.reward || 0)}`, W / 2, 170)
                ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '18px "Segoe UI", "Arial", sans-serif'
                ctx.fillText('You brought down a prized game!', W / 2, 210)
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
                ctx.fillStyle = '#ffc107'; ctx.font = 'bold 28px "Segoe UI", "Arial", sans-serif'; ctx.fillText('Trail went cold...', W / 2, 170)
            }

            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI", "Arial", sans-serif'; ctx.fillText('Ari-Ani Economy  •  /hunt to try again', W / 2, H - 16)

            const cap = res.ok && res.success
                ? `🏹 *HUNTING*\n━━━━━━━━\n🦌 Caught! +${formatMoney(res.reward || 0)}\n━━━━━━━━\n📊 Wallet: ${formatMoney(res.account.wallet)}\n🏦 Bank: ${formatMoney(res.account.bank)}\n💎 Total: ${formatMoney(res.account.totalWealth)}`
                : res.reason === 'cooldown'
                    ? `🏹 *HUNTING*\n━━━━━━━━\n⏳ Cooldown: ${formatDurationMs(res.remainingMs || 0)}`
                    : `🏹 *HUNTING*\n━━━━━━━━\n🦌 Trail went cold!`

            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap)
        } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}