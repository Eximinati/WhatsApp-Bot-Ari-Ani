import { createCanvas } from '@napi-rs/canvas'
import { MessageType, Mimetype } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

const W = 680, H = 340, R = 28
const BG1 = '#1a0315', BG2 = '#0d0010', AC = '#ff80ab'

function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

const HUG_GIFS = [
    'https://c.tenor.com/JTqU0DkRfXsAAAAC/anime-hug.gif',
    'https://c.tenor.com/5oDq9gt2DSUAAAAC/anime-hug.gif',
    'https://c.tenor.com/0PIj7X6DFuIAAAAC/anime-hug.gif',
    'https://c.tenor.com/G_IvO7mhW6wAAAAC/anime-hug.gif',
    'https://c.tenor.com/6kYNP3Mjz9YAAAAC/anime-hug.gif',
]

function tag(jid: string): string { return `@${jid.split('@')[0]}` }

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'hug', description: 'Hug someone 🤗', category: 'fun', usage: `${client.config.prefix}hug @user`, aliases: ['cuddle', 'embrace'], baseXp: 20 })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.mentioned.length) return void M.reply('🤗 Mention someone to hug!')
        const target = M.mentioned[0]
        const tags = [M.sender.jid, target]
        const sTag = tag(M.sender.jid), tTag = tag(target)

        // Canvas fallback
        const cv = createCanvas(W, H), ctx = cv.getContext('2d')
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = 'rgba(255,128,171,0.06)'; ctx.beginPath(); ctx.arc(W * 0.8, 60, 140, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(W * 0.2, 280, 90, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = AC; ctx.font = 'bold 36px "Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('🤗 WARM HUG! 🤗', W / 2, 80)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, W / 2 - 220, 110, 440, 130, R); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Segoe UI Emoji",sans-serif'
        ctx.fillText(sTag, W / 2 - 100, 160)
        ctx.fillStyle = AC; ctx.font = 'bold 40px "Segoe UI Emoji",sans-serif'; ctx.fillText('🫂', W / 2, 200)
        ctx.fillStyle = '#fff'; ctx.fillText(tTag, W / 2 + 100, 160)
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '20px "Segoe UI",sans-serif'; ctx.fillText(`${sTag} gave ${tTag} a warm hug!`, W / 2, 280)
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Fun • /hug @user', W / 2, H - 16)
        const canvasBuf = cv.toBuffer('image/png')
        const caption = `🤗 *WARM HUG!*\n━━━━━━━━━━\n${sTag} hugged ${tTag} 🫂\n━━━━━━━━━━\nSo wholesome! 💖`

        const gifUrl = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)]
        try {
            const buf = await this.client.getBuffer(gifUrl)
            const video = await this.client.util.GIFBufferToVideoBuffer(buf)
            return void M.reply(video, MessageType.video, Mimetype.gif, tags, caption)
        } catch {
            return void M.reply(canvasBuf, MessageType.image, Mimetype.png, tags, caption)
        }
    }
}