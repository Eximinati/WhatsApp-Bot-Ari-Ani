import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'

const W = 720
const H = 340
const RADIUS = 28

const BG_TOP = '#0f0c29'
const BG_BOT = '#302b63'
const ACCENT = '#f9d423'
const CARD_BG = 'rgba(255,255,255,0.06)'
const TEXT_PRIMARY = '#ffffff'
const TEXT_SECONDARY = 'rgba(255,255,255,0.7)'
const TEXT_ACCENT = '#f9d423'

const economy = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'daily',
            description: 'Claim your daily cash reward',
            category: 'economy',
            usage: `${client.config.prefix}daily`,
            aliases: ['dailycash', 'claim'],
            baseXp: 25,
        })
    }

    run = async (M: ISimplifiedMessage, {}: IParsedArgs): Promise<void> => {
        const jid = M.sender.jid

        try {
            const result = await economy.claimDailyCash(jid)

            const canvas = createCanvas(W, H)
            const ctx = canvas.getContext('2d')

            // Background gradient
            const grad = ctx.createLinearGradient(0, 0, 0, H)
            grad.addColorStop(0, BG_TOP)
            grad.addColorStop(1, BG_BOT)
            ctx.fillStyle = grad
            ctx.fillRect(0, 0, W, H)

            // Decorative circles
            ctx.fillStyle = 'rgba(249,212,35,0.04)'
            ctx.beginPath(); ctx.arc(620, 60, 140, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(100, 280, 100, 0, Math.PI * 2); ctx.fill()

            // Title
            ctx.fillStyle = ACCENT
            ctx.font = 'bold 36px "Segoe UI", sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('✦ DAILY REWARD ✦', W / 2, 70)

            if (result.claimed) {
                // Success card
                const cx = W / 2 - 180, cy = 100, cw = 360, ch = 200
                ctx.fillStyle = CARD_BG
                rr(ctx, cx, cy, cw, ch, RADIUS)
                ctx.fill()

                ctx.strokeStyle = 'rgba(249,212,35,0.3)'
                ctx.lineWidth = 2
                rr(ctx, cx, cy, cw, ch, RADIUS)
                ctx.stroke()

                // Reward amount
                ctx.fillStyle = ACCENT
                ctx.font = 'bold 56px "Segoe UI", sans-serif'
                ctx.fillText(`+${formatMoney(result.reward)}`, W / 2, 175)

                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '22px "Segoe UI", sans-serif'
                ctx.fillText('coins added to your wallet!', W / 2, 215)

                // Balance line
                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '18px "Segoe UI", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(result.account.wallet)}  •  Bank: ${formatMoney(result.account.bank)}`, W / 2, 260)
            } else {
                // Already claimed
                ctx.fillStyle = 'rgba(255,107,107,0.15)'
                rr(ctx, W / 2 - 180, 100, 360, 200, RADIUS)
                ctx.fill()

                ctx.fillStyle = '#ff6b6b'
                ctx.font = 'bold 32px "Segoe UI", sans-serif'
                ctx.fillText('Already Claimed!', W / 2, 175)

                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '20px "Segoe UI", sans-serif'
                ctx.fillText('Come back tomorrow for more cash.', W / 2, 215)

                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '18px "Segoe UI", sans-serif'
                ctx.fillText(`Wallet: ${formatMoney(result.account.wallet)}  •  Bank: ${formatMoney(result.account.bank)}`, W / 2, 260)
            }

            // Footer
            ctx.fillStyle = 'rgba(255,255,255,0.3)'
            ctx.font = '14px "Segoe UI", sans-serif'
            ctx.fillText('Ari-Ani Economy • /help for more', W / 2, H - 20)

            const buffer = canvas.toBuffer('image/png')

            const caption = result.claimed
                ? [
                      `✨ *DAILY REWARD*`,
                      `━━━━━━━━━━━━━━━`,
                      `💵 Claimed : +${formatMoney(result.reward)} coins`,
                      `━━━━━━━━━━━━━━━`,
                      `📊 Wallet : ${formatMoney(result.account.wallet)}`,
                      `🏦 Bank   : ${formatMoney(result.account.bank)}`,
                      `💎 Total  : ${formatMoney(result.account.totalWealth)}`,
                  ].join('\n')
                : [
                      `⏳ *DAILY REWARD*`,
                      `━━━━━━━━━━━━━━━`,
                      `🔒 Status : Already claimed today`,
                      `⏰ Come back tomorrow!`,
                      `━━━━━━━━━━━━━━━`,
                      `📊 Wallet : ${formatMoney(result.account.wallet)}`,
                      `🏦 Bank   : ${formatMoney(result.account.bank)}`,
                      `💎 Total  : ${formatMoney(result.account.totalWealth)}`,
                  ].join('\n')

            return void M.reply(buffer, MessageType.image, Mimetype.png, undefined, caption)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong.'
            return void M.reply(`❌ ${msg}`)
        }
    }
}