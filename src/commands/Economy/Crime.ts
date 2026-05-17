import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'

const W = 680, H = 360, R = 22, BG1 = '#1a0a0a', BG2 = '#2d0000'
const ACw = '#ff1744', ACl = '#ff5252'
function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath() }
const ECO = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'crime', description: 'Commit a risky crime', category: 'economy', usage: `${client.config.prefix}crime`, aliases: ['steal'], baseXp: 25 }) }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try { const res = await ECO.crime(M.sender.jid); const cv = createCanvas(W, H), ctx = cv.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
            ctx.fillStyle = ACl; ctx.font = 'bold 32px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔫 CRIME', W / 2, 60)
            const ok = res.ok && res.success; const cd = res.reason === 'cooldown'
            ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 80, 90, 520, 160, R); ctx.fill()
            ctx.fillStyle = ok ? ACw : '#ff5252'; ctx.font = 'bold 50px "Segoe UI",sans-serif'
            ctx.fillText(ok ? `+${formatMoney(res.reward || 0)}` : cd ? '⏳ Cooldown' : `-${formatMoney(res.reward || 0)}`, W / 2, 170)
            ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'
            ctx.fillText(ok ? 'Your shady move paid off.' : cd ? `Wait ${formatDurationMs(res.remainingMs || 0)}` : 'You got caught!', W / 2, 215)
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px "Segoe UI",sans-serif'; ctx.fillText(`W: ${formatMoney(res.account.wallet)}  •  B: ${formatMoney(res.account.bank)}`, W / 2, 250)
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Economy', W / 2, H - 16)
            const cap = ok ? `🔫 Crime successful! +${formatMoney(res.reward || 0)} | W: ${formatMoney(res.account.wallet)}` : cd ? `⏳ ${formatDurationMs(res.remainingMs || 0)}` : `🔫 Busted! -${formatMoney(res.reward || 0)}`
            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap) } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}