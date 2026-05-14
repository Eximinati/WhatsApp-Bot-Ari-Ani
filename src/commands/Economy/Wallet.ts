import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'

import {
    ISimplifiedMessage
} from '../../typings/index.js'

import {
    createCanvas,
    loadImage
} from '@napi-rs/canvas'

import path from 'path'

import { MessageType } from '../../core/types.js'

import getEconomy from '../../pipeline/getEconomy.js'

function formatMoney(amount: number): string {
    return `$${amount.toLocaleString()}`
}

export default class Command extends CommandModule {
    constructor(
        client: RuntimeClient,
        handler: MessagePipeline
    ) {
        super(client, handler, {
            command: 'wallet',
            description:
                'Shows your economy balance',
            category: 'economy',
            usage: `${client.config.prefix}wallet`,
            aliases: ['wal', 'bal', 'balance'],
            baseXp: 5
        })
    }

    run = async (
        M: ISimplifiedMessage
    ): Promise<void> => {
        try {
            await M.reply(
                '♻️ *Fetching your economy data...*'
            )

            const mentioned =
                M.mentioned?.[0] ||
                M.quoted?.sender ||
                M.sender.jid

            const economy =
                await getEconomy(
                    mentioned
                )

            const username =
                M.pushName ||
                mentioned
                    ?.split('@')[0] ||
                'User'

            const wallet =
                economy.wallet || 0

            const bank =
                economy.bank || 0

            const total =
                wallet + bank

            const rank =
                economy.economyStats?.wealthRank || 0

            const tool =
                economy.equippedToolKey ||
                'None'

            const job =
                economy.jobKey ||
                'None'

            const faction =
                economy.factionKey ||
                'None'

            const streak =
                economy.streakCount || 0

            const rareMeter =
                economy.rareMeter || 0

            const inventoryCount =
                economy.inventory?.reduce(
                    (acc, item) =>
                        acc +
                        (item.number || 0),
                    0
                ) || 0

            const width = 1000
            const height = 650

            const canvas =
                createCanvas(
                    width,
                    height
                )

            const ctx =
                canvas.getContext('2d')

            const gradient =
                ctx.createLinearGradient(
                    0,
                    0,
                    width,
                    height
                )

            gradient.addColorStop(
                0,
                '#0a0f24'
            )

            gradient.addColorStop(
                1,
                '#1f3b73'
            )

            ctx.fillStyle = gradient

            ctx.fillRect(
                0,
                0,
                width,
                height
            )

            
            ctx.fillStyle = '#FFD700'

            ctx.font =
                'bold 58px Sans'

            ctx.textAlign =
                'center'

            ctx.shadowColor =
                'rgba(255,215,0,0.7)'

            ctx.shadowBlur = 20

            ctx.fillText(
                '💰 ECONOMY BALANCE',
                width / 2,
                80
            )

            ctx.shadowBlur = 0

            
            const panelX = 40
            const panelY = 120
            const panelW = 920
            const panelH = 470

            ctx.beginPath()

            ctx.roundRect(
                panelX,
                panelY,
                panelW,
                panelH,
                35
            )

            ctx.fillStyle =
                'rgba(255,255,255,0.10)'

            ctx.fill()

            
            ctx.fillStyle = '#ffffff'

            ctx.textAlign = 'left'

            ctx.font =
                'bold 34px Sans'

            ctx.fillText(
                `👤 User: ${username}`,
                80,
                190
            )

            ctx.fillText(
                `🏦 Bank: ${formatMoney(bank)}`,
                80,
                260
            )

            ctx.fillText(
                `👛 Wallet: ${formatMoney(wallet)}`,
                80,
                330
            )

            ctx.fillStyle =
                '#FFD700'

            ctx.font =
                'bold 44px Sans'

            ctx.fillText(
                `💵 Total Wealth: ${formatMoney(total)}`,
                80,
                430
            )

            
            ctx.fillStyle = '#ffffff'

            ctx.font =
                '28px Sans'

            ctx.fillText(
                `📈 Rank: #${rank}`,
                80,
                500
            )

            ctx.fillText(
                `🎒 Inventory: ${inventoryCount} items`,
                80,
                545
            )

            
            ctx.fillStyle =
                '#00FFB3'

            ctx.font =
                'bold 26px Sans'

            ctx.fillText(
                `🔧 Tool: ${tool}`,
                620,
                230
            )

            ctx.fillText(
                `💼 Job: ${job}`,
                620,
                290
            )

            ctx.fillText(
                `⚔️ Faction: ${faction}`,
                620,
                350
            )

            ctx.fillText(
                `🔥 Streak: ${streak}`,
                620,
                410
            )

            ctx.fillText(
                `✨ Rare Meter: ${rareMeter}%`,
                620,
                470
            )

            
            ctx.fillStyle =
                'rgba(255,255,255,0.2)'

            ctx.fillRect(
                620,
                500,
                250,
                25
            )

            ctx.fillStyle =
                '#FFD700'

            ctx.fillRect(
                620,
                500,
                Math.max(
                    10,
                    (rareMeter / 100) *
                        250
                ),
                25
            )

            
            const thumbPath =
                path.resolve(
                    './src/core/images/wallet.png'
                )

            try {
                const img =
                    await loadImage(
                        thumbPath
                    )

                ctx.drawImage(
                    img,
                    760,
                    140,
                    150,
                    150
                )
            } catch {
                ctx.font =
                    '120px Sans'

                ctx.fillText(
                    '💎',
                    800,
                    260
                )
            }

            
            ctx.font =
                '22px Sans'

            ctx.fillStyle =
                '#cccccc'

            ctx.textAlign =
                'center'

            ctx.fillText(
                'Ari-Ani Advanced Economy System',
                width / 2,
                625
            )

            
            const image =
                await canvas.encode(
                    'png'
                )

            
            await M.reply(
                image,
                MessageType.image,
                undefined,
                undefined,
`💰 Economy Balance

👛 Wallet: ${formatMoney(wallet)}
🏦 Bank: ${formatMoney(bank)}
💵 Total Wealth: ${formatMoney(total)}

📈 Rank: #${rank}
🔧 Tool: ${tool}
💼 Job: ${job}
⚔️ Faction: ${faction}

🔥 Streak: ${streak}
✨ Rare Meter: ${rareMeter}%`
            )
        } catch (err) {
            this.client.log(
                String(err),
                true
            )

            return void M.reply(
                '❌ Failed to fetch economy data.'
            )
        }
    }
}
