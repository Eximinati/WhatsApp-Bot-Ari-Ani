import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'
const W = 680, H = 380, R = 22, BG1 = '#1a0a2e', BG2 = '#0d0020', AC = '#7c4dff'
const economy = new EconomyService()
export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'rob', description: 'Rob another player\'s wallet', category: 'economy', usage: `${client.config.prefix}rob @user`, aliases: ['steal'], baseXp: 30 }) }
    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const tid = joined.trim().replace('@', '').split(/\s+/)[0] + '@s.whatsapp.net'
        if (!tid || tid === M.sender.jid) return void M.reply('❌ Mention a valid user to rob.')
        try { const res = await economy.rob(M.sender.jid, tid); const cv = createCanvas(W, H), ctx = cv.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
            ctx.fillStyle = AC; ctx.font = 'bold 32px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🕵️ ROBBERY', W / 2, 60)
            if (res.ok && res.success) {
                ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, 60, 90, 560, 170, R); ctx.fill(); ctx.fillStyle = AC; ctx.font = 'bold 50px "Segoe UI",sans-serif'; ctx.fillText(`+${formatMoney(res.amount || 0)}`, W / 2, 170); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText("You slipped away with someone else's cash.", W / 2, 220) }
            else if (res.reason === 'cooldown') { ctx.fillStyle = 'rgba(255,160,60,0.12)'; rr(ctx, 60, 90, 560, 170, R); ctx.fill(); ctx.fillStyle = '#ffa040'; ctx.font = 'bold 30px "Segoe UI",sans-serif'; ctx.fillText('⏳ Cooldown', W / 2, 170); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText(`Wait ${formatDurationMs(res.remainingMs || 0)}`, W / 2, 215) }
            else if (res.reason === 'poor-target') { ctx.fillStyle = 'rgba(255,150,0,0.1)'; rr(ctx, 60, 90, 560, 170, R); ctx.fill(); ctx.fillStyle = '#ff8a65'; ctx.font = 'bold 28px "Segoe UI",sans-serif'; ctx.fillText('Target too poor!', W / 2, 170) }
            else { ctx.fillStyle = 'rgba(255,80,80,0.1)'; rr(ctx, 60, 90, 560, 170, R); ctx.fill(); ctx.fillStyle = '#ff5252'; ctx.font = 'bold 48px "Segoe UI",sans-serif'; ctx.fillText(`-${formatMoney(res.amount || 0)}`, W / 2, 170); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText('Robbery failed — you paid compensation.', W / 2, 220) }
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '14px "Segoe UI",sans-serif'; ctx.fillText(`Your wallet: ${formatMoney(res.thief.wallet)} | Bank: ${formatMoney(res.thief.bank)}`, W / 2, 285); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Economy', W / 2, H - 16)
            const cap = res.ok && res.success ? `🕵️ Robbed! +${formatMoney(res.amount || 0)} | Wallet: ${formatMoney(res.thief.wallet)}` : res.reason === 'cooldown' ? `⏳ ${formatDurationMs(res.remainingMs || 0)}` : res.reason === 'poor-target' ? 'Target too poor.' : `❌ Failed! -${formatMoney(res.amount || 0)}`
            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap) } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}