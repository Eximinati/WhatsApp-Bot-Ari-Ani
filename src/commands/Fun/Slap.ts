import { createCanvas } from '@napi-rs/canvas'
import { MessageType, Mimetype } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

const W = 680, H = 340, R = 28
const BG1 = '#1a0a00', BG2 = '#2d1000', AC = '#ff9100'

function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

const SLAP_GIFS = [
    'https://c.tenor.com/Ws6Dm1ZW_vMAAAAC/anime-slap.gif',
    'https://c.tenor.com/eU5H6GbVjrcAAAAC/anime-slap.gif',
    'https://c.tenor.com/XiYuU9h44-AAAAAC/anime-slap-mad.gif',
    'https://c.tenor.com/5eYIY2KUc18AAAAC/anime-slap.gif',
    'https://c.tenor.com/Sv8LQZA7Zy8AAAAC/anime-slap.gif',
]

const slapMessages = [
    'slapped',
    'whacked',
    'smacked',
    'delivered a reality check to',
    'power-slapped',
    'backhanded',
    'gave a five-finger discount to',
]

function tag(jid: string): string { return `@${jid.split('@')[0]}` }

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'slap', description: 'Slap someone 🖐️', category: 'fun', usage: `${client.config.prefix}slap @user`, aliases: ['hit', 'smack'], baseXp: 18 })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.mentioned.length) return void M.reply('🖐️ Mention someone to slap!')
        const target = M.mentioned[0]
        const tags = [M.sender.jid, target]
        const sTag = tag(M.sender.jid), tTag = tag(target)
        const verb = slapMessages[Math.floor(Math.random() * slapMessages.length)]

        const cv = createCanvas(W, H), ctx = cv.getContext('2d')
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = 'rgba(255,145,0,0.06)'; ctx.beginPath(); ctx.arc(W * 0.7, 70, 130, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(W * 0.3, 280, 90, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = AC; ctx.font = 'bold 36px "Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('🖐️ SLAP ATTACK! 🖐️', W / 2, 80)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, W / 2 - 220, 110, 440, 130, R); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Segoe UI Emoji",sans-serif'
        ctx.fillText(sTag, W / 2 - 100, 155)
        ctx.fillStyle = AC; ctx.font = 'bold 36px "Segoe UI Emoji",sans-serif'; ctx.fillText('💥', W / 2, 200)
        ctx.fillStyle = '#fff'; ctx.fillText(tTag, W / 2 + 100, 155)
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '17px "Segoe UI",sans-serif'; ctx.fillText(`${sTag} ${verb} ${tTag}! Ouch!`, W / 2, 280)
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Fun • /slap @user', W / 2, H - 16)
        const canvasBuf = cv.toBuffer('image/png')
        const caption = `🖐️ *SLAP ATTACK!*\n━━━━━━━━━━\n${sTag} ${verb} ${tTag}!\n━━━━━━━━━━\nThat's gotta hurt! 💥`

        const gifUrl = SLAP_GIFS[Math.floor(Math.random() * SLAP_GIFS.length)]
        try {
            const buf = await this.client.getBuffer(gifUrl)
            const video = await this.client.util.GIFBufferToVideoBuffer(buf)
            return void M.reply(video, MessageType.video, Mimetype.gif, tags, caption)
        } catch {
            return void M.reply(canvasBuf, MessageType.image, Mimetype.png, tags, caption)
        }
    }
}