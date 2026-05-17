import { createCanvas } from '@napi-rs/canvas'
import { MessageType, Mimetype } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

const W = 680, H = 340, R = 28
const BG1 = '#0a0000', BG2 = '#2d0000', AC = '#ff1744'

function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

const KILL_GIFS = [
    'https://c.tenor.com/NbC0i0eCMGQAAAAC/anime-kill.gif',
    'https://c.tenor.com/3ks5TjBck2oAAAAC/anime-attack.gif',
    'https://c.tenor.com/TcLJ0FqUHY4AAAAC/anime-punch.gif',
    'https://c.tenor.com/aOqNQrLHOqkAAAAC/anime-kill.gif',
    'https://c.tenor.com/6PyX_v9YcUcAAAAC/anime-fight.gif',
]

const DEATH_MESSAGES = [
    'was obliterated by',
    'got absolutely destroyed by',
    'was sent to the shadow realm by',
    'met their demise at the hands of',
    'got rekt by',
    'was eliminated by',
    'took a critical hit from',
    'got KO\'d by',
]

function tag(jid: string): string { return `@${jid.split('@')[0]}` }

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, { command: 'kill', description: 'Kill someone (in fun) 🔪', category: 'fun', usage: `${client.config.prefix}kill @user`, aliases: ['murder', 'eliminate', 'destroy'], baseXp: 25 })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.mentioned.length) return void M.reply('🔪 Mention someone to kill!')
        const target = M.mentioned[0]
        const tags = [M.sender.jid, target]
        const sTag = tag(M.sender.jid), tTag = tag(target)
        const msg = DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)]

        // Canvas fallback
        const cv = createCanvas(W, H), ctx = cv.getContext('2d')
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = 'rgba(255,23,68,0.06)'; ctx.beginPath(); ctx.arc(W * 0.3, 60, 130, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(W * 0.7, 280, 100, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = AC; ctx.font = 'bold 36px "Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('🔪 ELIMINATION! 🔪', W / 2, 80)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, W / 2 - 220, 110, 440, 130, R); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Segoe UI Emoji",sans-serif'
        ctx.fillText(sTag, W / 2 - 100, 155)
        ctx.fillStyle = AC; ctx.font = 'bold 36px "Segoe UI Emoji",sans-serif'; ctx.fillText('💀', W / 2, 200)
        ctx.fillStyle = '#fff'; ctx.fillText(tTag, W / 2 + 100, 155)
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '17px "Segoe UI",sans-serif'; ctx.fillText(`${tTag} ${msg} ${sTag}!`, W / 2, 280)
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Fun • /kill @user (just for fun!)', W / 2, H - 16)
        const canvasBuf = cv.toBuffer('image/png')
        const caption = `🔪 *ELIMINATION!*\n━━━━━━━━━━\n${tTag} ${msg} ${sTag}! 💀\n━━━━━━━━━━\n☠️ Rest in pieces...`

        const gifUrl = KILL_GIFS[Math.floor(Math.random() * KILL_GIFS.length)]
        try {
            const buf = await this.client.getBuffer(gifUrl)
            const video = await this.client.util.GIFBufferToVideoBuffer(buf)
            return void M.reply(video, MessageType.video, Mimetype.gif, tags, caption)
        } catch {
            return void M.reply(canvasBuf, MessageType.image, Mimetype.png, tags, caption)
        }
    }
}