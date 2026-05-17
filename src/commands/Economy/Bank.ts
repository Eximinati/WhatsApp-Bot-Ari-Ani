import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, parseAmountInput } from '../../core/economy/utils.js'

const W = 680
const H = 440
const RADIUS = 24

const BG_TOP = '#1b1b2f'
const BG_BOT = '#2d2d44'
const ACCENT = '#6c63ff'
const ACCENT_ALT = '#e43f5a'
const CARD_BG = 'rgba(255,255,255,0.05)'
const TEXT_PRIMARY = '#ffffff'
const TEXT_SECONDARY = 'rgba(255,255,255,0.65)'

const roundRect = (
    ctx: import('@napi-rs/canvas').SKRSContext2D,
    x: number, y: number, w: number, h: number, r: number,
): void => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
}

const ECONOMY = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'bank',
            description: 'View or manage your bank account',
            category: 'economy',
            usage: `${client.config.prefix}bank [deposit|withdraw] [amount]`,
            aliases: ['vault'],
            baseXp: 10,
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const jid = M.sender.jid
        const action = args[0]?.toLowerCase()

        try {
            const canvas = createCanvas(W, H)
            const ctx = canvas.getContext('2d')

            // Background gradient
            const grad = ctx.createLinearGradient(0, 0, 0, H)
            grad.addColorStop(0, BG_TOP)
            grad.addColorStop(1, BG_BOT)
            ctx.fillStyle = grad
            ctx.fillRect(0, 0, W, H)

            // Decorative vault iconography
            ctx.fillStyle = 'rgba(108,99,255,0.04)'
            ctx.beginPath(); ctx.arc(580, 70, 130, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(90, 380, 80, 0, Math.PI * 2); ctx.fill()

            ctx.fillStyle = ACCENT
            ctx.font = 'bold 32px "Segoe UI", sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('🏦 BANK VAULT', W / 2, 58)

            let caption = ''

            if (action === 'deposit' || action === 'dep') {
                const account = await ECONOMY.getBalance(jid)
                const amountInput = args.slice(1).join(' ') || 'all'
                const amount = parseAmountInput(amountInput, account.wallet)

                if (amount <= 0) {
                    return void M.reply('⚠️ Please specify a valid amount to deposit.')
                }

                const result = await ECONOMY.deposit(jid, amountInput)

                // Success card
                ctx.fillStyle = CARD_BG
                roundRect(ctx, 80, 90, 520, 180, RADIUS)
                ctx.fill()
                ctx.strokeStyle = 'rgba(108,99,255,0.3)'
                ctx.lineWidth = 2
                roundRect(ctx, 80, 90, 520, 180, RADIUS)
                ctx.stroke()

                ctx.fillStyle = ACCENT
                ctx.font = 'bold 44px "Segoe UI", sans-serif'
                ctx.fillText(`-${formatMoney(result.amount)}`, W / 2, 160)

                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '20px "Segoe UI", sans-serif'
                ctx.fillText('deposited into bank vault', W / 2, 200)

                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '17px "Segoe UI", sans-serif'
                ctx.fillText(
                    `💵 Wallet: ${formatMoney(result.account.wallet)}  •  🏦 Bank: ${formatMoney(result.account.bank)}`,
                    W / 2, 240,
                )

                ctx.fillStyle = 'rgba(76,175,80,0.12)'
                roundRect(ctx, W / 2 - 80, 255, 160, 30, 15)
                ctx.fill()
                ctx.fillStyle = '#4caf50'
                ctx.font = '13px "Segoe UI", sans-serif'
                ctx.fillText('🔒 Protected from robbery', W / 2, 275)

                caption = [
                    `🏦 *BANK — DEPOSIT*`,
                    `━━━━━━━━━━━━━━━`,
                    `📥 Amount  : -${formatMoney(result.amount)}`,
                    `🔒 Secured in vault`,
                    `━━━━━━━━━━━━━━━`,
                    `💵 Wallet : ${formatMoney(result.account.wallet)}`,
                    `🏦 Bank   : ${formatMoney(result.account.bank)}`,
                    `💎 Total  : ${formatMoney(result.account.totalWealth)}`,
                ].join('\n')
            } else if (action === 'withdraw' || action === 'with') {
                const account = await ECONOMY.getBalance(jid)
                const amountInput = args.slice(1).join(' ') || 'all'
                const amount = parseAmountInput(amountInput, account.bank)

                if (amount <= 0) {
                    return void M.reply('⚠️ Please specify a valid amount to withdraw.')
                }

                const result = await ECONOMY.withdraw(jid, amountInput)

                ctx.fillStyle = CARD_BG
                roundRect(ctx, 80, 90, 520, 180, RADIUS)
                ctx.fill()
                ctx.strokeStyle = 'rgba(228,63,90,0.3)'
                ctx.lineWidth = 2
                roundRect(ctx, 80, 90, 520, 180, RADIUS)
                ctx.stroke()

                ctx.fillStyle = ACCENT_ALT
                ctx.font = 'bold 44px "Segoe UI", sans-serif'
                ctx.fillText(`+${formatMoney(result.amount)}`, W / 2, 160)

                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '20px "Segoe UI", sans-serif'
                ctx.fillText('withdrawn to wallet', W / 2, 200)

                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '17px "Segoe UI", sans-serif'
                ctx.fillText(
                    `💵 Wallet: ${formatMoney(result.account.wallet)}  •  🏦 Bank: ${formatMoney(result.account.bank)}`,
                    W / 2, 240,
                )

                ctx.fillStyle = 'rgba(228,63,90,0.12)'
                roundRect(ctx, W / 2 - 100, 255, 200, 30, 15)
                ctx.fill()
                ctx.fillStyle = ACCENT_ALT
                ctx.font = '13px "Segoe UI", sans-serif'
                ctx.fillText('⚠️ Keep cash safe from theft!', W / 2, 275)

                caption = [
                    `🏦 *BANK — WITHDRAW*`,
                    `━━━━━━━━━━━━━━━`,
                    `📤 Amount  : +${formatMoney(result.amount)}`,
                    `⚠️ Cash is now in wallet — protect it!`,
                    `━━━━━━━━━━━━━━━`,
                    `💵 Wallet : ${formatMoney(result.account.wallet)}`,
                    `🏦 Bank   : ${formatMoney(result.account.bank)}`,
                    `💎 Total  : ${formatMoney(result.account.totalWealth)}`,
                ].join('\n')
            } else {
                const balance = await ECONOMY.getBalance(jid)

                // Bank card
                ctx.fillStyle = CARD_BG
                roundRect(ctx, 60, 90, 560, 130, RADIUS)
                ctx.fill()
                ctx.strokeStyle = 'rgba(108,99,255,0.25)'
                ctx.lineWidth = 1.5
                roundRect(ctx, 60, 90, 560, 130, RADIUS)
                ctx.stroke()

                ctx.fillStyle = 'rgba(108,99,255,0.7)'
                ctx.font = 'bold 16px "Segoe UI", sans-serif'
                ctx.fillText('🏦 SAVINGS BALANCE', W / 2, 128)

                ctx.fillStyle = TEXT_PRIMARY
                ctx.font = 'bold 52px "Segoe UI", sans-serif'
                ctx.fillText(formatMoney(balance.bank), W / 2, 178)

                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '15px "Segoe UI", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(balance.wallet)} available to deposit`, W / 2, 206)

                // Commands card
                ctx.fillStyle = CARD_BG
                roundRect(ctx, 60, 240, 560, 90, RADIUS)
                ctx.fill()
                ctx.strokeStyle = 'rgba(108,99,255,0.15)'
                ctx.lineWidth = 1
                roundRect(ctx, 60, 240, 560, 90, RADIUS)
                ctx.stroke()

                ctx.fillStyle = ACCENT
                ctx.font = 'bold 15px "Segoe UI", sans-serif'
                ctx.fillText('📥 Deposit', 160, 275)
                ctx.fillText('📤 Withdraw', 520, 275)

                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '13px "Segoe UI", sans-serif'
                ctx.fillText('/bank deposit <amount>', 160, 300)
                ctx.fillText('/bank withdraw <amount>', 520, 300)

                caption = [
                    `🏦 *BANK VAULT*`,
                    `━━━━━━━━━━━━━━━`,
                    `💰 Balance : ${formatMoney(balance.bank)}`,
                    `💵 Wallet  : ${formatMoney(balance.wallet)}`,
                    `💎 Total   : ${formatMoney(balance.totalWealth)}`,
                    `━━━━━━━━━━━━━━━`,
                    `📥 /bank deposit <amount>`,
                    `📤 /bank withdraw <amount>`,
                ].join('\n')
            }

            // Footer
            ctx.fillStyle = 'rgba(255,255,255,0.25)'
            ctx.font = '13px "Segoe UI", sans-serif'
            ctx.fillText('Ari-Ani Economy • Bank funds are protected from robbery', W / 2, H - 16)

            const buffer = canvas.toBuffer('image/png')
            return void M.reply(buffer, MessageType.image, Mimetype.png, undefined, caption)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong.'
            return void M.reply(`❌ ${msg}`)
        }
    }
}