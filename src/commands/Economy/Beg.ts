import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'

const W = 680, H = 360, R = 22
const BG1 = '#1a1a2e', BG2 = '#16213e', AC = '#f0a500'

function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

const ECO = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'beg', description: 'Beg for spare coins', category: 'economy', usage: `${client.config.prefix}beg`, aliases: ['plead'], baseXp: 10 })
    }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try {
            const res = await ECO.beg(M.sender.jid)
            const cv = createCanvas(W, H), ctx = cv.getContext('2d')
            const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
            ctx.fillStyle = AC; ctx.font = 'bold 30px "Segoe UI",sans-serif'; ctx.textAlign = 'center'
            ctx.fillText('🥺 BEGGING', W / 2, 60)
            if (res.ok && res.success) {
                ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 80, 90, 520, 160, R); ctx.fill()
                ctx.fillStyle = AC; ctx.font = 'bold 50px "Segoe UI",sans-serif'
                ctx.fillText(`+${formatMoney(res.reward || 0)}`, W / 2, 170)
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '20px "Segoe UI",sans-serif'
                ctx.fillText('A kind stranger tossed you some cash.', W / 2, 215)
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '16px "Segoe UI",sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)}  •  Bank: ${formatMoney(res.account.bank)}`, W / 2, 250)
            } else if (res.reason === 'cooldown') {
                ctx.fillStyle = 'rgba(255,107,107,0.12)'; rr(ctx, 80, 90, 520, 160, R); ctx.fill()
                ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 32px "Segoe UI",sans-serif'; ctx.fillText('⏳ Cooldown', W / 2, 160)
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText(`Wait ${formatDurationMs(res.remainingMs || 0)}`, W / 2, 210)
            } else {
                ctx.fillStyle = 'rgba(255,107,107,0.12)'; rr(ctx, 80, 90, 520, 160, R); ctx.fill()
                ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 32px "Segoe UI",sans-serif'; ctx.fillText('❌ No luck begging', W / 2, 160)
            }
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Economy • /help for more', W / 2, H - 16)
            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined,
                res.ok && res.success ? `🥺 +${formatMoney(res.reward || 0)} | Wallet: ${formatMoney(res.account.wallet)} | Bank: ${formatMoney(res.account.bank)}` : `⏳ Cooldown — ${formatDurationMs(res.remainingMs || 0)}`)
        } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}