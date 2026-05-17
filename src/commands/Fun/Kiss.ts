import { createCanvas } from '@napi-rs/canvas'
import { MessageType, Mimetype } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

const W = 680, H = 340, R = 28
const BG1 = '#2d0015', BG2 = '#1a000a', AC = '#ff4081'

function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

const KISS_GIFS = [
    'https://c.tenor.com/NTqoqF1kLJgAAAAC/anime-kiss.gif',
    'https://c.tenor.com/4D1E5dpckYIAAAAC/anime-kiss-love.gif',
    'https://c.tenor.com/4Vx1x7ACUFsAAAAC/anime-kiss.gif',
    'https://c.tenor.com/X6pEcNA_eLUAAAAC/anime-kiss.gif',
    'https://c.tenor.com/ZJ6Nq2Yh5PwAAAAC/anime-kiss.gif',
]

function tag(jid: string): string { return `@${jid.split('@')[0]}` }

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'kiss', description: 'Kiss someone 💋', category: 'fun', usage: `${client.config.prefix}kiss @user`, baseXp: 20 })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.mentioned.length) return void M.reply('💋 Mention someone to kiss!')
        const target = M.mentioned[0]
        const tags = [M.sender.jid, target]
        const sTag = tag(M.sender.jid), tTag = tag(target)

        // Canvas fallback
        const cv = createCanvas(W, H), ctx = cv.getContext('2d')
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = 'rgba(255,64,129,0.08)'; ctx.beginPath(); ctx.arc(W * 0.75, 70, 150, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(W * 0.25, 270, 100, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = AC; ctx.font = 'bold 36px "Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('💋 KISS ATTACK! 💋', W / 2, 80)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, W / 2 - 220, 110, 440, 130, R); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Segoe UI Emoji",sans-serif'
        ctx.fillText(sTag, W / 2 - 100, 160)
        ctx.fillStyle = AC; ctx.font = 'bold 40px "Segoe UI Emoji",sans-serif'; ctx.fillText('💕', W / 2, 200)
        ctx.fillStyle = '#fff'; ctx.fillText(tTag, W / 2 + 100, 160)
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '20px "Segoe UI",sans-serif'; ctx.fillText(`${sTag} planted a sweet kiss on ${tTag}!`, W / 2, 280)
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Fun • /kiss @user', W / 2, H - 16)
        const canvasBuf = cv.toBuffer('image/png')
        const caption = `💋 *KISS ATTACK!*\n━━━━━━━━━━\n${sTag} kissed ${tTag} 💕\n━━━━━━━━━━\nMwah! So romantic~`

        // Try GIF first, fallback to canvas
        const gifUrl = KISS_GIFS[Math.floor(Math.random() * KISS_GIFS.length)]
        try {
            const buf = await this.client.getBuffer(gifUrl)
            const video = await this.client.util.GIFBufferToVideoBuffer(buf)
            return void M.reply(video, MessageType.video, Mimetype.gif, tags, caption)
        } catch {
            return void M.reply(canvasBuf, MessageType.image, Mimetype.png, tags, caption)
        }
    }
}