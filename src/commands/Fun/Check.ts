import { createCanvas } from '@napi-rs/canvas'
import { MessageType, Mimetype } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

const W = 680, H = 320

const tagFor = (jid: string): string => `@${jid.split('@')[0]}`

// ───── CHECK ALIASES ──────────────────────────────────────────────────
const CHECK_ALIASES = [
    'awesomecheck', 'greatcheck', 'gaycheck', 'cutecheck',
    'lesbiancheck', 'hornycheck', 'prettycheck', 'lovelycheck',
    'uglycheck', 'beautifulcheck', 'handsomecheck', 'charactercheck'
]

const BASE_COMMANDS = ['checkuser', 'cu']

// ───── CHARACTER TYPES ────────────────────────────────────────────────
const CHARACTER_TYPES = [
    'Compassionate', 'Generous', 'Grumpy', 'Forgiving',
    'Obedient', 'Good', 'Simp', 'Kind-Hearted',
    'Patient', 'UwU', 'Top Anyway', 'Helpful',
    'Chaotic', 'Wholesome', 'Sassy', 'Clumsy',
    'Wise', 'Mischievous', 'Gentle', 'Loyal',
    'Brave', 'Chill', 'Dramatic', 'Nerdy',
    'Flirty', 'Bold', 'Mysterious', 'Sunshine',
    'Tsundere', 'Yandere'
]

// ───── GRADIENT PALETTES PER CHECK TYPE ───────────────────────────────
const palette = (checkType: string): [string, string] => {
    switch (checkType) {
        case 'gay': return ['#ff006e', '#8338ec']
        case 'lesbian': return ['#ff4770', '#ff9f1c']
        case 'cute': return ['#ff70a6', '#ffd60a']
        case 'pretty': return ['#e599f7', '#845ef7']
        case 'beautiful': return ['#ff6b6b', '#f06595']
        case 'handsome': return ['#4dabf7', '#3b5bdb']
        case 'lovely': return ['#f783ac', '#da77f2']
        case 'awesome': return ['#ff922b', '#ff6b6b']
        case 'great': return ['#20c997', '#38d9a9']
        case 'horny': return ['#f06595', '#cc5de8']
        case 'ugly': return ['#868e96', '#495057']
        case 'character': return ['#9775fa', '#5c7cfa']
        default: return ['#e040fb', '#ff69b4']
    }
}

// ───── EMOJI PER CHECK TYPE ───────────────────────────────────────────
const emojiFor = (checkType: string): string => {
    switch (checkType) {
        case 'awesome': return '🌟'
        case 'great': return '🏆'
        case 'gay': return '🏳️‍🌈'
        case 'cute': return '🎀'
        case 'lesbian': return '💜'
        case 'horny': return '🍆'
        case 'pretty': return '💅'
        case 'lovely': return '💝'
        case 'ugly': return '👹'
        case 'beautiful': return '💐'
        case 'handsome': return '✨'
        case 'character': return '🎭'
        default: return '📊'
    }
}

function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

export default class Command extends CommandModule {

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'checkuser',
            aliases: ['cu', ...CHECK_ALIASES],
            description: 'Check user stats ✨',
            category: 'fun',
            usage: `${client.config.prefix}checkuser [@user] | ${client.config.prefix}awesomecheck [@user]`,
            baseXp: 15
        })
    }

    private drawCheckCanvas(
        name: string, checkType: string, resultLabel: string,
        pct: number
    ): Buffer {
        const cv = createCanvas(W, H), ctx = cv.getContext('2d')
        const [c1, c2] = palette(checkType)
        const emoji = emojiFor(checkType)

        // Gradient background
        const grad = ctx.createLinearGradient(0, 0, W, H)
        grad.addColorStop(0, c1); grad.addColorStop(1, c2)
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

        // Subtle pattern overlay
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        for (let i = 0; i < 12; i++) {
            ctx.font = `${10 + (i % 8)}px "Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center'
            ctx.fillText(['⭐', '✨', '💫', '🌟'][i % 4], (i * 67 + 20) % W, (i * 83 + 15) % H)
        }

        // Outer glow ring
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 12, 12, W - 24, H - 24, 24); ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3
        rr(ctx, 20, 20, W - 40, H - 40, 20); ctx.stroke()

        // Title
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(255,255,255,0.4)'; ctx.shadowBlur = 20
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 36px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif'
        ctx.fillText(`${emoji} ${checkType.toUpperCase()} CHECK ${emoji}`, W / 2, 60)
        ctx.shadowBlur = 0

        // Badge for the user
        ctx.fillStyle = 'rgba(0,0,0,0.20)'; rr(ctx, W / 2 - 190, 80, 380, 50, 25); ctx.fill()
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px "Segoe UI",sans-serif'
        ctx.fillText(name, W / 2, 113)

        // Big percentage
        ctx.shadowColor = 'rgba(255,255,255,0.5)'; ctx.shadowBlur = 35
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 80px "Segoe UI",sans-serif'
        ctx.fillText(`${pct}%`, W / 2, 200)
        ctx.shadowBlur = 0

        // Result label
        ctx.fillStyle = 'rgba(0,0,0,0.20)'; rr(ctx, W / 2 - 180, 215, 360, 44, 22); ctx.fill()
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px "Segoe UI",sans-serif'
        ctx.fillText(resultLabel, W / 2, 245)

        // Footer
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '12px "Segoe UI",sans-serif'
        ctx.fillText(`Ari-Ani Fun • /${checkType || 'check'} @user`, W / 2, H - 16)

        return cv.toBuffer('image/png')
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const rawCmd = (M.content ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? ''
        const cmd = rawCmd.startsWith(this.client.config.prefix)
            ? rawCmd.slice(this.client.config.prefix.length)
            : rawCmd

        const isBase = BASE_COMMANDS.includes(cmd)
        const checkType = isBase ? null : cmd.replace('check', '')

        // If the target is quoted, include them in mentions
        if (M.quoted?.sender) {
            if (!M.mentioned.includes(M.quoted.sender)) {
                M.mentioned.push(M.quoted.sender)
            }
        }

        const target = M.mentioned.length > 0
            ? M.mentioned[0]
            : M.sender.jid

        const targetName = tagFor(target)
        const pct = Math.floor(Math.random() * 100) + 1

        // ───── BASE COMMAND: list available checks ─────
        if (isBase && !checkType && M.mentioned.length === 0 && !M.quoted?.sender) {
            const list = `🎃 *Available Checks:*\n\n${CHECK_ALIASES.map(
                (c, i) => `${emojiFor(c.replace('check', ''))} *${c}*`
            ).join('\n')}\n\n🛠️ *Usage:* ${this.client.config.prefix}checkuser @user\nOr: ${this.client.config.prefix}awesomecheck @user`
            return void M.reply(list, MessageType.text, undefined, [target])
        }

        // ───── BUILD RESULT ─────
        const resolvedType = checkType || 'check'
        let resultLabel: string
        if (resolvedType === 'character') {
            resultLabel = CHARACTER_TYPES[Math.floor(Math.random() * CHARACTER_TYPES.length)]
        } else {
            resultLabel = `${pct}% ${resolvedType}`
        }

        const title = resolvedType.toUpperCase()
        const caption = `*=======[${title} CHECK]=======*\n\n${targetName} is ${resultLabel} ${emojiFor(resolvedType)}`

        // Draw canvas card
        const canvasBuf = this.drawCheckCanvas(targetName, resolvedType, resultLabel, pct)

        // Try GIF from the appropriate SHIP gif-alike stash, or canvas → video
        try {
            const video = await this.client.util.imageToVideoBuffer(canvasBuf, 4)
            return void M.reply(video, MessageType.video, Mimetype.gif, [target], caption)
        } catch {
            return void M.reply(canvasBuf, MessageType.image, Mimetype.png, [target], caption)
        }
    }
}