import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, parseAmountInput } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'

const W = 680, H = 360, R = 22
const BG1 = '#0d1a26', BG2 = '#1a2a3a', AC = '#6c63ff'

const economy = new EconomyService()

export default class Command extends CommandModule {
    constructor(c: RuntimeClient, h: MessagePipeline) {
        super(c, h, { command: 'deposit', description: 'Deposit coins into your bank', category: 'economy', usage: `${c.config.prefix}deposit <amount>`, aliases: ['dep'], baseXp: 8 })
    }
    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const amt = joined.trim() || 'all'
        try {
            const bal = await economy.getBalance(M.sender.jid)
            const check = parseAmountInput(amt, bal.wallet)
            if (check <= 0) return void M.reply('⚠️ Specify a valid amount to deposit.')
            const res = await economy.deposit(M.sender.jid, amt)
            const cv = createCanvas(W, H), ctx = cv.getContext('2d')
            const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
            ctx.fillStyle = AC; ctx.font = 'bold 30px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('📥 DEPOSIT', W / 2, 55)
            ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 80, 85, 520, 170, R); ctx.fill()
            ctx.fillStyle = AC; ctx.font = 'bold 50px "Segoe UI",sans-serif'; ctx.fillText(`-${formatMoney(res.amount)}`, W / 2, 165)
            ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText('deposited into your vault', W / 2, 210)
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px "Segoe UI",sans-serif'
            ctx.fillText(`💵 Wallet: ${formatMoney(res.account.wallet)}  •  🏦 Bank: ${formatMoney(res.account.bank)}`, W / 2, 250)
            ctx.fillStyle = 'rgba(76,175,80,0.15)'; rr(ctx, W / 2 - 80, 260, 160, 30, 15); ctx.fill()
            ctx.fillStyle = '#4caf50'; ctx.font = '13px "Segoe UI",sans-serif'; ctx.fillText('🔒 Protected from robbery', W / 2, 280)
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Economy', W / 2, H - 16)
            const cap = `📥 *DEPOSIT*\n━━━━━━━━\n💵 Amount : ${formatMoney(res.amount)}\n🔒 Secured in vault\n━━━━━━━━\n📊 Wallet : ${formatMoney(res.account.wallet)}\n🏦 Bank   : ${formatMoney(res.account.bank)}\n💎 Total  : ${formatMoney(res.account.totalWealth)}`
            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap)
        } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}