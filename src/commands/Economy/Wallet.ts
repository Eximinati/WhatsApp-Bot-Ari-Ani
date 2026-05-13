import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

import {
    createCanvas,
    loadImage
} from '@napi-rs/canvas'

import path from 'path'

import getEconomy from '../../pipeline/getEconomy.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'wallet',
            description: 'Shows your wallet balance in USD',
            category: 'economy',
            usage: `${client.config.prefix}wallet`,
            aliases: ['wal'],
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            await M.reply(
                '♻️ *Fetching your wallet data...*'
            )

            const economy = await getEconomy(
                M.sender.jid
            )

            const username =
                M.pushName ||
                M.sender.username ||
                'User'

            const wallet = economy.wallet

            
            const width = 900
            const height = 500

            const canvas = createCanvas(width, height)

            const ctx = canvas.getContext('2d')

            
            const gradient = ctx.createLinearGradient(
                0,
                0,
                width,
                height
            )

            gradient.addColorStop(0, '#0a0f24')
            gradient.addColorStop(1, '#1c294d')

            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, width, height)

            
            ctx.fillStyle = '#FFD700'

            ctx.font = 'bold 60px Sans'

            ctx.textAlign = 'center'

            ctx.shadowColor = 'rgba(255, 215, 0, 0.6)'
            ctx.shadowBlur = 20

            ctx.fillText(
                '💼 WALLET',
                width / 2,
                80
            )

            ctx.shadowBlur = 0

            
            const panelX = 50
            const panelY = 130
            const panelW = width - 100
            const panelH = 320

            ctx.beginPath()

            ctx.roundRect(
                panelX,
                panelY,
                panelW,
                panelH,
                30
            )

            ctx.fillStyle = 'rgba(255,255,255,0.12)'

            ctx.shadowColor = 'rgba(0,0,0,0.5)'
            ctx.shadowBlur = 15

            ctx.fill()

            ctx.shadowBlur = 0

            
            ctx.fillStyle = '#ffffff'

            ctx.textAlign = 'left'

            ctx.font = 'bold 36px Sans'

            ctx.fillText(
                `👤 Name: ${username}`,
                panelX + 40,
                panelY + 80
            )

            ctx.fillText(
                `🔖 Tag: #${M.sender.jid
                    .split('@')[0]
                    .slice(0, 6)}`,
                panelX + 40,
                panelY + 150
            )

            
            ctx.fillStyle = '#FFD700'

            ctx.font = 'bold 48px Sans'

            ctx.fillText(
                `💵 USD: ${wallet.toLocaleString()}`,
                panelX + 40,
                panelY + 240
            )

            
            const thumbPath = path.resolve(
                './src/core/images/wallet.png'
            )

            try {
                const img = await loadImage(thumbPath)

                ctx.drawImage(
                    img,
                    panelX + panelW - 180,
                    panelY + 70,
                    130,
                    130
                )
            } catch {
                ctx.font = '100px Sans'

                ctx.fillText(
                    '💎',
                    panelX + panelW - 150,
                    panelY + 160
                )
            }

            
            ctx.font = '24px Sans'

            ctx.fillStyle = '#cccccc'

            ctx.textAlign = 'center'

            ctx.fillText(
                'Ari-Ani Economy System',
                width / 2,
                height - 30
            )

            
            const image = await canvas.encode('png')

            
            await this.client.sendMessage(M.from, {
                image,
                caption:
`💰 Wallet Balance

💵 USD: ${wallet.toLocaleString()}`
            })

        } catch (err) {
            this.client.log(String(err), true)

            return void M.reply(
                '❌ An error occurred while fetching your wallet.'
            )
        }
    }
}
