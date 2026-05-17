import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'

const W = 680, H = 380, R = 22
const BG1 = '#0b3d5c', BG2 = '#0a2a40', AC = '#00bcd4'

function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}
const ECO = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'fish', description: 'Go fishing for coins', category: 'economy', usage: `${client.config.prefix}fish`, aliases: ['fishing'], baseXp: 15 })
    }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try {
            const res = await ECO.fish(M.sender.jid)
            const cv = createCanvas(W, H), ctx = cv.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
            ctx.fillStyle = AC; ctx.font = 'bold 32px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🎣 FISHING', W / 2, 60)
            if (res.ok && res.success) {
                ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, 80, 90, 520, 170, R); ctx.fill()
                ctx.fillStyle = AC; ctx.font = 'bold 52px "Segoe UI",sans-serif'; ctx.fillText(`+${formatMoney(res.reward || 0)}`, W / 2, 170)
                ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '20px "Segoe UI",sans-serif'; ctx.fillText('You reeled in a profitable catch!', W / 2, 220)
                if (res.rare) { ctx.fillStyle = '#ffd700'; ctx.font = '16px "Segoe UI",sans-serif'; ctx.fillText(`🌟 ${res.rare.text} (+${formatMoney(res.rare.bonus)} bonus)`, W / 2, 248) }
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px "Segoe UI",sans-serif'; ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)}  •  Bank: ${formatMoney(res.account.bank)}`, W / 2, 285)
            } else if (res.reason === 'cooldown') {
                ctx.fillStyle = 'rgba(255,180,80,0.12)'; rr(ctx, 80, 90, 520, 170, R); ctx.fill()
                ctx.fillStyle = '#ffa040'; ctx.font = 'bold 30px "Segoe UI",sans-serif'; ctx.fillText('⏳ Cooldown', W / 2, 170)
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText(`Wait ${formatDurationMs(res.remainingMs || 0)}`, W / 2, 215)
            } else {
                ctx.fillStyle = 'rgba(255,150,0,0.1)'; rr(ctx, 80, 90, 520, 170, R); ctx.fill()
                ctx.fillStyle = '#ff8a65'; ctx.font = 'bold 30px "Segoe UI",sans-serif'; ctx.fillText('🐟 Got away!', W / 2, 170); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText('The fish got away this time.', W / 2, 215)
            }
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Economy • /help for more', W / 2, H - 16)
            const cap = res.ok && res.success ? `🎣 +${formatMoney(res.reward || 0)} | Wallet: ${formatMoney(res.account.wallet)}` : res.reason === 'cooldown' ? `⏳ Cooldown ${formatDurationMs(res.remainingMs || 0)}` : `🐟 The fish got away.`
            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap)
        } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}