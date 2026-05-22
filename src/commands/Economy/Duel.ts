import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'

const W = 680, H = 380, R = 22, BG1 = '#1a1a00', BG2 = '#0d0d00', AC = '#ffd600'

const economy = new EconomyService()

export default class Command extends CommandModule {
    constructor(c: RuntimeClient, h: MessagePipeline) {
        super(c, h, { command: 'duel', description: 'Duel another player', category: 'economy', usage: `${c.config.prefix}duel @user <bet>`, aliases: ['fight'], baseXp: 30 }) }
    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const parts = joined.trim().split(/\s+/)
        const tid = (parts[0] || '').replace('@', '') + '@s.whatsapp.net'; const bet = parts.slice(1).join(' ') || '50'
        if (!tid || tid === M.sender.jid) return void M.reply('❌ Mention a valid user to duel.')
        try { const res = await economy.duel(M.sender.jid, tid, bet); const cv = createCanvas(W, H), ctx = cv.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
            ctx.fillStyle = AC; ctx.font = 'bold 32px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚔️ DUEL', W / 2, 60)
            if (res.draw) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, 60, 90, 560, 170, R); ctx.fill(); ctx.fillStyle = AC; ctx.font = 'bold 46px "Segoe UI",sans-serif'; ctx.fillText('🤝 DRAW!', W / 2, 170); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText(`Both matched at power ${res.challengerPower}`, W / 2, 220) }
            else if (res.ok) { const won = res.winnerJid === M.sender.jid; ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, 60, 90, 560, 170, R); ctx.fill(); ctx.fillStyle = won ? '#4caf50' : '#ff5252'; ctx.font = 'bold 46px "Segoe UI",sans-serif'; ctx.fillText(won ? `🏆 YOU WON +${formatMoney(res.bet)}` : `💔 YOU LOST -${formatMoney(res.bet)}`, W / 2, 170); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText(`Power: ${res.challengerPower} vs ${res.targetPower}`, W / 2, 220) }
            else if (res.reason === 'cooldown') { ctx.fillStyle = 'rgba(255,160,60,0.12)'; rr(ctx, 60, 90, 560, 170, R); ctx.fill(); ctx.fillStyle = '#ffa040'; ctx.font = 'bold 30px "Segoe UI",sans-serif'; ctx.fillText('⏳ Cooldown', W / 2, 170); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText(`Wait ${formatDurationMs(res.remainingMs || 0)}`, W / 2, 215) }
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '14px "Segoe UI",sans-serif'; ctx.fillText(`W: ${formatMoney(res.challenger.wallet)} | B: ${formatMoney(res.challenger.bank)}`, W / 2, 285)
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Economy', W / 2, H - 16)
            const cap = res.draw ? '🤝 Draw!' : res.ok ? (res.winnerJid === M.sender.jid ? `⚔️ Won +${formatMoney(res.bet)}` : `⚔️ Lost -${formatMoney(res.bet)}`) : `⏳ ${formatDurationMs(res.remainingMs || 0)}`
            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap) } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}