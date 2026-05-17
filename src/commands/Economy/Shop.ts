import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'

const W = 680, R = 22, BG1 = '#1a1a2e', BG2 = '#0d0d1a', AC = '#ffd740'
function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath() }
const ECO = new EconomyService()

export default class Command extends CommandModule {
    constructor(c: RuntimeClient, h: MessagePipeline) { super(c, h, { command: 'shop', description: 'Browse the economy shop', category: 'economy', usage: `${c.config.prefix}shop`, aliases: ['store', 'items'], baseXp: 5 }) }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try {
            const items = ECO.getShopItems()
            const Hr = 120 + items.length * 34
            const cv = createCanvas(W, Hr), ctx = cv.getContext('2d')
            const g = ctx.createLinearGradient(0, 0, 0, Hr); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hr)
            ctx.fillStyle = AC; ctx.font = 'bold 28px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🏪 SHOP', W / 2, 48)
            ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 30, 70, W - 60, Hr - 90, R); ctx.fill()
            items.forEach((it, i) => {
                const y = 100 + i * 34
                ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'; rr(ctx, 40, y - 8, W - 80, 30, 8); ctx.fill()
                ctx.fillStyle = '#fff'; ctx.font = '16px "Segoe UI",sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${it.type === 'tool' ? '🔧' : it.type === 'consumable' ? '🧪' : '⚡'} ${it.name}`, 50, y + 13)
                ctx.fillStyle = AC; ctx.textAlign = 'right'; ctx.fillText(`💰 ${formatMoney(it.price)}`, W - 50, y + 13)
            })
            const cap = items.map(i => `${i.name} — ${formatMoney(i.price)} (${i.type})`).join('\n')
            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, `🏪 *SHOP*\n━━━━━━\n${cap}`)
        } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}