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
const BG1 = '#1a0a0a', BG2 = '#2d0000', AC = '#e43f5a'
const economy = new EconomyService()

export default class Command extends CommandModule {
    constructor(c: RuntimeClient, h: MessagePipeline) {
        super(c, h, { command: 'withdraw', description: 'Withdraw coins from your bank', category: 'economy', usage: `${c.config.prefix}withdraw <amount>`, aliases: ['with', 'wd'], baseXp: 8 })
    }
    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const amt = joined.trim() || 'all'
        try {
            const bal = await economy.getBalance(M.sender.jid)
            const check = parseAmountInput(amt, bal.bank)
            if (check <= 0) return void M.reply('⚠️ Specify a valid amount to withdraw.')
            const res = await economy.withdraw(M.sender.jid, amt)
            const cv = createCanvas(W, H), ctx = cv.getContext('2d')
            const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
            ctx.fillStyle = AC; ctx.font = 'bold 30px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('📤 WITHDRAW', W / 2, 55)
            ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 80, 85, 520, 170, R); ctx.fill()
            ctx.fillStyle = AC; ctx.font = 'bold 50px "Segoe UI",sans-serif'; ctx.fillText(`+${formatMoney(res.amount)}`, W / 2, 165)
            ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText('withdrawn to your wallet', W / 2, 210)
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px "Segoe UI",sans-serif'
            ctx.fillText(`💵 Wallet: ${formatMoney(res.account.wallet)}  •  🏦 Bank: ${formatMoney(res.account.bank)}`, W / 2, 250)
            ctx.fillStyle = 'rgba(228,63,90,0.12)'; rr(ctx, W / 2 - 100, 260, 200, 30, 15); ctx.fill()
            ctx.fillStyle = AC; ctx.font = '13px "Segoe UI",sans-serif'; ctx.fillText('⚠️ Keep cash safe from robbery!', W / 2, 280)
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Economy', W / 2, H - 16)
            const cap = `📤 *WITHDRAW*\n━━━━━━━━\n💵 Amount : ${formatMoney(res.amount)}\n⚠️ Cash in wallet — protect it!\n━━━━━━━━\n📊 Wallet : ${formatMoney(res.account.wallet)}\n🏦 Bank   : ${formatMoney(res.account.bank)}\n💎 Total  : ${formatMoney(res.account.totalWealth)}`
            return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, cap)
        } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) }
    }
}