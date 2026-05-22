import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'

const W = 680, H = 400, R = 22
const BG1 = '#2d1b00', BG2 = '#1a1000', AC = '#ffab40'


const economy = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'mine', description: 'Mine for valuable ores', category: 'economy', usage: `${client.config.prefix}mine`, aliases: ['dig'], baseXp: 15 })
    }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try { const res = await economy.mine(M.sender.jid); const cv = createCanvas(W, H), ctx = cv.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

            ctx.fillStyle = 'rgba(255,171,64,0.04)'
            ctx.beginPath(); ctx.arc(580, 50, 120, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(80, 320, 80, 0, Math.PI * 2); ctx.fill()

            ctx.fillStyle = AC; ctx.font = 'bold 32px "Segoe UI", "Arial", sans-serif'; ctx.textAlign = 'center'
            ctx.fillText('MINING', W / 2, 58)
            ctx.fillStyle = AC; ctx.fillRect(W / 2 - 50, 72, 100, 3)

            if (res.ok && res.success) {
                ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 60, 90, 560, 190, R); ctx.fill()
                ctx.strokeStyle = AC; ctx.lineWidth = 1.5; rr(ctx, 60, 90, 560, 190, R); ctx.stroke()

                ctx.fillStyle = '#ffd740'; ctx.font = 'bold 48px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`+${formatMoney(res.reward || 0)}`, W / 2, 168)
                ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '18px "Segoe UI", "Arial", sans-serif'
                ctx.fillText('You dug up a valuable haul!', W / 2, 208)

                if (res.rare) {
                    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 15px "Segoe UI", "Arial", sans-serif'
                    ctx.fillText(`RARE: ${res.rare.text} (+${formatMoney(res.rare.bonus)} bonus)`, W / 2, 235)
                }

                ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '15px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)}  •  Bank: ${formatMoney(res.account.bank)}`, W / 2, 265)
            } else if (res.reason === 'cooldown') {
                ctx.fillStyle = 'rgba(255,107,107,0.12)'; rr(ctx, 60, 90, 560, 190, R); ctx.fill()
                ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 1.5; rr(ctx, 60, 90, 560, 190, R); ctx.stroke()

                ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 32px "Segoe UI", "Arial", sans-serif'; ctx.fillText('COOLDOWN', W / 2, 160)
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wait ${formatDurationMs(res.remainingMs || 0)}`, W / 2, 200)
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px "Segoe UI", "Arial", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)}  •  Bank: ${formatMoney(res.account.bank)}`, W / 2, 240)
            } else {
                ctx.fillStyle = 'rgba(255,200,0,0.08)'; rr(ctx, 60, 90, 560, 190, R); ctx.fill()
                ctx.strokeStyle = '#ffc107'; ctx.lineWidth = 1.5; rr(ctx, 60, 90, 560, 190, R); ctx.stroke()
                ctx.fillStyle = '#ffc107'; ctx.font = 'bold 28px "Segoe UI", "Arial", sans-serif'; ctx.fillText('Nothing useful came out...', W / 2, 175)
            }

            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI", "Arial", sans-serif'; ctx.fillText('Ari-Ani Mines  •  /mine to dig again', W / 2, H - 16)

            const cap = res.ok && res.success
                ? `⛏️ *MINING*\n━━━━━━━━\n💎 Haul: +${formatMoney(res.reward || 0)}${res.rare ? `\n🌟 Rare: ${res.rare.text} (+${formatMoney(res.rare.bonus)})` : ''}\n━━━━━━━━\n📊 Wallet: ${formatMoney(res.account.wallet)}\n🏦 Bank: ${formatMoney(res.account.bank)}\n💎 Total: ${formatMoney(res.account.totalWealth)}`
                : res.reason === 'cooldown'
                    ? `⛏️ *MINING*\n━━━━━━━━\n⏳ Cooldown: ${formatDurationMs(res.remainingMs || 0)}`
                    : `⛏️ *MINING*\n━━━━━━━━\n Nothing useful came out!`

            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap)
        } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}