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
const H = 520
const RADIUS = 28

const BG_TOP = '#141e30'
const BG_BOT = '#243b55'
const ACCENT = '#00d2ff'
const CARD_BG = 'rgba(255,255,255,0.06)'
const TEXT_PRIMARY = '#ffffff'
const TEXT_SECONDARY = 'rgba(255,255,255,0.7)'

const economy = new EconomyService()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'wallet',
            description: 'View your economy balance & profile',
            category: 'economy',
            usage: `${client.config.prefix}wallet`,
            aliases: ['bal', 'balance', 'money'],
            baseXp: 15,
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const targetJid = joined.trim().startsWith('@')
            ? joined.trim().replace('@', '').split(/\s+/)[0] + '@s.whatsapp.net'
            : M.sender.jid
        const jid = targetJid || M.sender.jid

        try {
            const [balance, rank] = await Promise.all([
                economy.getBalance(jid),
                economy.getWealthRank(jid),
            ])

            const canvas = createCanvas(W, H)
            const ctx = canvas.getContext('2d')

            // Background
            const grad = ctx.createLinearGradient(0, 0, 0, H)
            grad.addColorStop(0, BG_TOP)
            grad.addColorStop(1, BG_BOT)
            ctx.fillStyle = grad
            ctx.fillRect(0, 0, W, H)

            // Decorative accents
            ctx.fillStyle = 'rgba(0,210,255,0.05)'
            ctx.beginPath(); ctx.arc(620, 80, 160, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(100, 440, 90, 0, Math.PI * 2); ctx.fill()

            // Title
            ctx.fillStyle = ACCENT
            ctx.font = 'bold 34px "Segoe UI", sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('💰 FINANCIAL PROFILE', W / 2, 60)

            // Rank badge
            ctx.fillStyle = 'rgba(0,210,255,0.12)'
            rr(ctx, W / 2 - 100, 72, 200, 36, 18)
            ctx.fill()
            ctx.fillStyle = ACCENT
            ctx.font = '16px "Segoe UI", sans-serif'
            ctx.fillText(`Rank #${rank.rank} • Wealth: ${formatMoney(rank.totalWealth)}`, W / 2, 97)

            // Wallet & Bank cards
            const cardY = 120
            const cardH = 120
            const cardW = 280

            // Wallet card
            ctx.fillStyle = CARD_BG
            rr(ctx, 60, cardY, cardW, cardH, RADIUS)
            ctx.fill()
            ctx.strokeStyle = 'rgba(0,210,255,0.25)'
            ctx.lineWidth = 1.5
            rr(ctx, 60, cardY, cardW, cardH, RADIUS)
            ctx.stroke()

            ctx.fillStyle = 'rgba(0,210,255,0.8)'
            ctx.font = 'bold 15px "Segoe UI", sans-serif'
            ctx.textAlign = 'left'
            ctx.fillText('💵 WALLET', 90, cardY + 36)
            ctx.fillStyle = TEXT_PRIMARY
            ctx.font = 'bold 40px "Segoe UI", sans-serif'
            ctx.fillText(formatMoney(balance.wallet), 90, cardY + 80)
            ctx.fillStyle = TEXT_SECONDARY
            ctx.font = '14px "Segoe UI", sans-serif'
            ctx.fillText('Available to spend', 90, cardY + 106)

            // Bank card
            ctx.fillStyle = CARD_BG
            rr(ctx, 380, cardY, cardW, cardH, RADIUS)
            ctx.fill()
            ctx.strokeStyle = 'rgba(0,210,255,0.25)'
            ctx.lineWidth = 1.5
            rr(ctx, 380, cardY, cardW, cardH, RADIUS)
            ctx.stroke()

            ctx.fillStyle = 'rgba(0,210,255,0.8)'
            ctx.font = 'bold 15px "Segoe UI", sans-serif'
            ctx.fillText('🏦 BANK', 410, cardY + 36)
            ctx.fillStyle = TEXT_PRIMARY
            ctx.font = 'bold 40px "Segoe UI", sans-serif'
            ctx.fillText(formatMoney(balance.bank), 410, cardY + 80)
            ctx.fillStyle = TEXT_SECONDARY
            ctx.font = '14px "Segoe UI", sans-serif'
            ctx.fillText('Safe from robbery', 410, cardY + 106)

            // Total wealth bar
            const barY = 260
            const walletPct = balance.totalWealth > 0
                ? Math.round((balance.wallet / balance.totalWealth) * 100)
                : 0
            const bankPct = 100 - walletPct

            ctx.fillStyle = TEXT_SECONDARY
            ctx.textAlign = 'center'
            ctx.font = '14px "Segoe UI", sans-serif'
            ctx.fillText(`Total Wealth: ${formatMoney(balance.totalWealth)}`, W / 2, barY)

            // Bar track
            const barW = 500
            const barX = (W - barW) / 2
            ctx.fillStyle = 'rgba(255,255,255,0.1)'
            rr(ctx, barX, barY + 12, barW, 16, 8)
            ctx.fill()

            if (walletPct > 0) {
                const walletW = Math.max((barW * walletPct) / 100, 12)
                const walletGrad = ctx.createLinearGradient(barX, 0, barX + walletW, 0)
                walletGrad.addColorStop(0, '#00d2ff')
                walletGrad.addColorStop(1, '#00a3cc')
                ctx.fillStyle = walletGrad
                rr(ctx, barX, barY + 12, walletW, 16, 8)
                ctx.fill()
            }

            // Stats row
            const statsY = 305
            const stats = [
                { label: 'Job', value: balance.jobKey || 'Unemployed' },
                { label: 'Faction', value: balance.factionKey || 'None' },
                { label: 'Tool', value: balance.equippedToolKey || 'None' },
            ]
            const statW = 180
            const statGap = 40
            const statStartX = (W - (statW * 3 + statGap * 2)) / 2
            const statH = 72

            stats.forEach((s, i) => {
                const sx = statStartX + i * (statW + statGap)
                ctx.fillStyle = CARD_BG
                rr(ctx, sx, statsY, statW, statH, 16)
                ctx.fill()

                ctx.fillStyle = ACCENT
                ctx.font = 'bold 13px "Segoe UI", sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText(s.label, sx + statW / 2, statsY + 28)

                ctx.fillStyle = TEXT_PRIMARY
                ctx.font = 'bold 20px "Segoe UI", sans-serif'
                ctx.fillText(s.value, sx + statW / 2, statsY + 54)
            })

            // Inventory section
            const invY = 400
            const invKeys = Object.keys(balance.inventory).filter(
                (k) => (balance.inventory[k] || 0) > 0,
            )

            ctx.fillStyle = ACCENT
            ctx.font = 'bold 16px "Segoe UI", sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('🎒 INVENTORY', W / 2, invY)

            if (invKeys.length > 0) {
                const itemsDraw = invKeys.map((k) => `${k.replace(/_/g, ' ')} x${balance.inventory[k]}`).join('  •  ')
                ctx.fillStyle = TEXT_SECONDARY
                ctx.font = '15px "Segoe UI", sans-serif'
                ctx.fillText(itemsDraw, W / 2, invY + 30)
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.35)'
                ctx.font = '15px "Segoe UI", sans-serif'
                ctx.fillText('No items yet — visit the shop!', W / 2, invY + 30)
            }

            // Active buffs
            const buffY = invY + 55
            const activeBuffs = balance.activeBuffs.filter(
                (b) => b.type === 'buff' && b.expiresAt && new Date(b.expiresAt).getTime() > Date.now(),
            )
            if (activeBuffs.length > 0) {
                const buffNames = activeBuffs.map((b) => (b as { name: string }).name).join(', ')
                ctx.fillStyle = 'rgba(0,210,255,0.6)'
                ctx.font = '13px "Segoe UI", sans-serif'
                ctx.fillText(`⚡ Active: ${buffNames}`, W / 2, buffY)
            }

            // Footer
            ctx.fillStyle = 'rgba(255,255,255,0.25)'
            ctx.font = '13px "Segoe UI", sans-serif'
            ctx.fillText('Ari-Ani Economy • /help for more', W / 2, H - 16)

            const buffer = canvas.toBuffer('image/png')

            const invStr = invKeys.length > 0
                ? invKeys.map((k) => `${k.replace(/_/g, ' ')}: ${balance.inventory[k]}`).join(' • ')
                : 'None'

            const buffStr = activeBuffs.length > 0
                ? activeBuffs.map((b) => (b as { name: string }).name).join(', ')
                : 'None'

            const caption = [
                `💰 *FINANCIAL PROFILE*`,
                `━━━━━━━━━━━━━━━`,
                `🏷 Rank   : #${rank.rank} (${formatMoney(rank.totalWealth)})`,
                `━━━━━━━━━━━━━━━`,
                `💵 Wallet : ${formatMoney(balance.wallet)}`,
                `🏦 Bank   : ${formatMoney(balance.bank)}`,
                `💎 Total  : ${formatMoney(balance.totalWealth)}`,
                `━━━━━━━━━━━━━━━`,
                `🔧 Job    : ${balance.jobKey || 'Unemployed'}`,
                `🏴 Faction: ${balance.factionKey || 'None'}`,
                `🛠 Tool   : ${balance.equippedToolKey || 'None'}`,
                `🎒 Items  : ${invStr}`,
                `⚡ Buffs  : ${buffStr}`,
            ].join('\n')

            return void M.reply(buffer, MessageType.image, Mimetype.png, undefined, caption)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong.'
            return void M.reply(`❌ ${msg}`)
        }
    }
}