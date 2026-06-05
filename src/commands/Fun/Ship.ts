import { createCanvas } from '@napi-rs/canvas'
import { MessageType, Mimetype } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import {
    canonicalizeShip,
    computeBondGrowth,
    computeRizz,
    shipBond
} from '../../core/Ship/index.js'

const W = 800, H = 480

const tagFor = (jid: string): string => `@${jid.split('@')[0]}`

// ───── TIER SYSTEM ────────────────────────────────────────────────────
type Tier = '💔' | '💫' | '💖' | '💞' | '🔥'

const tierFor = (pct: number): Tier => {
    if (pct >= 90) return '🔥'
    if (pct >= 70) return '💞'
    if (pct >= 50) return '💖'
    if (pct >= 25) return '💫'
    return '💔'
}

const tierLabel = (t: Tier): string => {
    switch (t) {
        case '🔥': return 'Soulmate — Written in the stars!'
        case '💞': return 'Fated — The universe ships it.'
        case '💖': return 'Blossoming — Something real is growing.'
        case '💫': return 'Curious — Worth exploring further.'
        case '💔': return 'Doomed — Run while you still can.'
    }
}

// ───── RANK / TITLE (for rizz) ────────────────────────────────────────
const rankFor = (pct: number): string => {
    if (pct >= 95) return '👑 Rizz Royalty'
    if (pct >= 85) return '🔥 Certified Menace'
    if (pct >= 70) return '💘 Local Heartthrob'
    if (pct >= 50) return '⭐ Rising Star'
    if (pct >= 30) return '🌱 Budding Charmer'
    return '🔍 Quiet Observer'
}

// ───── DEEP COMMENT BANK — random per tier ────────────────────────────
// Each tier has 20+ comments. One is randomly picked every invocation.
const SHIP_COMMENTS: Record<Tier, string[]> = {
    '💔': [
        "This isn't a ship. It's a shipwreck in slow motion. 💀",
        'Some bonds are forged in fire. This one was forged in a microwave.',
        'The universe looked at this pairing and said "...pass."',
        'Even a broken clock is right twice a day. This? Zero.',
        'If tension were a bridge, this one hasn`t been built yet.',
        'Chemistry? More like a failed lab experiment. 🧪',
        'You know that feeling when you meet someone and just *know*? Yeah, this ain`t it.',
        'This match was written in sand — at low tide.',
        'The stars whispered "...try again next lifetime." ✨',
        'If this were a movie, the audience would walk out in the first scene.',
        'There`s more spark in a dead battery than in this bond.',
        'Love is patient. This should see other people.',
        'The cosmos looked, sighed, and kept scrolling.',
        'You two share the energy of two strangers in an elevator. Awkward silence.',
        'This ship sailed into an iceberg and the captain said "worth it."',
        'Honestly? Even a calculator would return *undefined*.',
        'The flame that burns brightest also— wait, there is no flame. At all.',
        'If destiny had a delete key, it would have pressed it here.',
        'This is less "written in the stars" and more "scribbled on a napkin."',
        'The forces of the universe have filed a restraining order on this pairing.',
        'Two orbits that will never eclipse. And honestly? That`s okay.',
    ],
    '💫': [
        'Not soulmates yet. But the universe is still writing the first draft.',
        'There`s a spark. A tiny one. But even bonfires start somewhere.',
        'A seed has been planted. Water it — or don`t. We`re just a bot.',
        'The stars aren`t singing yet. But they`ve stopped laughing.',
        'Give it time. Some epics have slow first chapters.',
        'It`s not fireworks. More like a sparkler. But sparklers are cute.',
        'Two puzzle pieces that might fit. Emphasis on *might*.',
        'Curiosity killed the cat, but satisfaction brought it back. Stay curious.',
        'The universe is watching with one eyebrow raised. Keep going.',
        'If this were a rom-com, you`re still in the "meet-cute" montage.',
        'Not every great story starts with a bang. Some start with a quiet moment.',
        'There`s potential. Whether it`s energy or kinetic is up to you.',
        'Like a vine that hasn`t bloomed. Tender, fragile, but alive.',
        'The algorithm is cautiously optimistic. Operative word: cautiously.',
        'If love is a journey, you`re still packing your bags.',
        'Some bonds need time to ripen. This one`s still green — but not rotten.',
        'It`s not a "yes" and it`s not a "no." It`s a "let`s see what happens."',
        'Faint but not gone. There`s music somewhere in the static.',
        'The stars haven`t aligned, but at least they`re in the same galaxy.',
        'A whisper of something more. Whether you listen is your choice.',
    ],
    '💖': [
        'The universe is taking notes. And it likes what it sees. ✍️',
        'This bond has gravity. The good kind — the kind that pulls you closer.',
        'Some people find each other. You two are *finding* each other. There`s a difference.',
        'The stars are starting to hum. Not a full symphony yet. But close.',
        'If love were a garden, you`re seeing the first sprouts. Nurture them.',
        'Two rays of light converging. Still separate, but already warming the same space.',
        'There`s something here. Something real. Something worth protecting.',
        'The cosmos just smiled. Don`t overthink it — just let it happen.',
        'This is the kind of bond that makes people believe in serendipity.',
        'When you look back, this is where you`ll say "it started here."',
        'The foundation is set. Now build. Brick by brick, laugh by laugh.',
        'It`s not perfect. But the best things rarely are. Keep going.',
        'If this were a season, it`d be spring. New growth everywhere.',
        'You two share a wavelength. The signal isn`t fully clear yet, but it`s getting stronger.',
        'There`s a quiet confidence in this bond. The kind that doesn`t need to shout.',
        'Love isn`t about finding the perfect person. It`s about building something worth keeping.',
        'The universe doesn`t make mistakes — just works in progress.',
        'A story is being written here. And the plot twist is that it might actually be beautiful.',
        'You`re past the spark. Now you`re building the flame. 🔥',
        'Some bonds feel like home. You`re on the porch. The door is opening.',
    ],
    '💞': [
        'Love isn`t found — it`s built. And you two have a skyscraper.',
        'Some souls recognize each other before their eyes meet. That`s this.',
        'The universe didn`t just ship it — it over-nighted it with express delivery.',
        'If destiny had a greatest hits album, this bond would be track one.',
        'Two hearts that don`t just beat — they harmonize.',
        'You know that feeling when you`re exactly where you`re meant to be? That`s this.',
        'The stars have been waiting for this pairing since the Big Bang.',
        'Some connections transcend logic. This is one of them. Cherish it.',
        'Love is a canvas. You two? You`re painting a masterpiece.',
        'If happiness had a pulse, it would beat right here, between you.',
        'The universe is known for accidents. This wasn`t one of them.',
        'Two parallel lines that decided to intersect. Defying physics. Defying odds.',
        'Some bonds are fragile glass. This is tempered steel wrapped in silk.',
        'When people talk about "the one" — this is the blueprint.',
        'Love isn`t just an emotion. It`s a decision. And the cosmos has decided.',
        'This isn`t just chemistry. It`s alchemy. Turning ordinary into gold.',
        'If every love story were a constellation, this one would light up the entire sky.',
        'Two orbits that were always meant to collide. In the best way.',
        'The kind of bond that makes poets jealous and cynics convert.',
        'Some things are meant to be. This is one of them. Don`t let go.',
    ],
    '🔥': [
        'Two halves of the same star, finally reunited after billions of years.',
        'This isn`t just a match. It`s a cosmic inevitability dressed in heartbeats.',
        'The universe didn`t just approve — it threw a parade and named a constellation after you.',
        'Love like this makes history jealous. Legends will be written.',
        'If souls had fingerprints, you two would be a perfect match on every surface.',
        'Some love stories are told in whispers. Yours will be shouted from galaxies.',
        'The Big Bang created everything. But this? This is what it was aiming for.',
        'You know that feeling when everything clicks? Multiply it by infinity.',
        'This bond doesn`t just transcend time — it makes time jealous.',
        'Two flames that don`t extinguish each other but burn brighter together.',
        'If destiny had a face, it would be smiling at you right now.',
        'This isn`t chemistry. It`s nuclear fusion — and the reaction is self-sustaining.',
        'When the stars wrote this pairing, they used their finest ink.',
        'Some people wait their whole lives for a connection like this. You found yours.',
        'Soulmates aren`t just a myth. They`re a frequency. And you`re both tuned in.',
        'If the cosmos had a love story, it would be this one. No edits needed.',
        'The universe bends for bonds like this. Gravity itself is jealous.',
        'Not every love story needs words. But this one deserves poetry.',
        'This is the kind of connection that makes angels pause and demons weep.',
        'If forever had a name, it would be written right here, in the space between you.',
    ]
}

const RIZZ_COMMENTS: Record<Tier, string[]> = {
    '💔': [
        'Your rizz is in witness protection. 🔫',
        'Even a mirror would swipe left. Twice.',
        'The game called — it wants its bench player back.',
        'Charisma? Never met her. But they`ve heard rumors.',
        'You have the presence of a houseplant. A dead one.',
        'If rizz were currency, you`d be filing for bankruptcy.',
        'Your aura is "404: Charisma Not Found."',
        'Some people just need time. You need an intervention.',
        'The charm shop called. They said "stop calling."',
        'Even NPCs have more dialogue options than you.',
        'If you were a spice, you`d be flour. Plain. Confused.',
        'Your rizz is running on dial-up. In 2025.',
        'You`re not invisible. You`re aggressively un-noticed.',
    ],
    '💫': [
        'The groundwork is laid. Now add some personality sprinkles.',
        'You`re the opening act. The headliner is still loading.',
        'A diamond in the rough — with emphasis on *rough*.',
        'People notice you exist. Now make them care.',
        'Your aura is a slow burn. Emphasis on *slow*.',
        'Potential: yes. Execution: pending.',
        'You`re at the starting line. The race hasn`t even begun.',
        'A whisper in a world of noise. Turn up the volume.',
        'You`re the preview — not the feature. Yet.',
    ],
    '💖': [
        'Respected in the chat. Feared in the streets. Medium in both.',
        'Solid presence. Like a good Wi-Fi signal — reliable, not flashy.',
        'You`re the person they *want* to reply to. That`s power.',
        'Effortlessly noticed. Not too loud, not too quiet — just right.',
        'Your vibe is a warm cup of tea. Comfortable, consistent, classic.',
        'People leave rooms, but they remember you stayed.',
        'Not everyone needs to shine. Some people glow. You glow.',
        'You have the kind of presence that lingers. In a good way.',
    ],
    '💞': [
        'Heads turn. Conversations pause. Energy shifts. That`s you.',
        'The main character energy is undeniable. Protagonist vibes only.',
        'Some people walk into a room. You own it.',
        'Your aura is a sunset — impossible to ignore, hard to describe.',
        'Confidence without arrogance. Rare. Attractive. Keep it.',
        'You don`t chase attention. It follows you like a loyal shadow.',
        'If charisma were measured in watts, you`d power a city.',
        'The kind of presence that makes people want to be better. That`s rizz.',
    ],
    '🔥': [
        'Rizz so strong it has its own gravitational field. Planets orbit you.',
        'You don`t enter a room — you make an *appearance*.',
        'The kind of energy that makes time zones shift. Legendary.',
        'Charisma isn`t taught. It`s borrowed from lifetimes ago. You remember.',
        'You have the aura of someone who`s lived a thousand lives and smiled through all of them.',
        'Some people are born with it. You *are* it.',
        'If confidence were a currency, you`d crash the economy.',
        'You are the plot twist everyone roots for.',
        'Not just the main character — the entire franchise.',
        'Your presence is a standing ovation that hasn`t started yet.',
        'Rizz level: Mythical. The kind poets wrote about.',
    ]
}

// ───── SHIP GIF GALLERY BY TIER ───────────────────────────────────────
const SHIP_GIFS: Record<Tier, string[]> = {
    '💔': [
        'https://c.tenor.com/Eg138Ow2kNEAAAAM/anime-fight.gif',
        'https://c.tenor.com/jACzsM2_6YAAAAAC/argue-anime.gif',
        'https://c.tenor.com/a904vqCDuvkAAAAM/anime-mad.gif',
        'https://c.tenor.com/Z1CUclMb9QoAAAAC/yaharioreno-seishun.gif',
        'https://c.tenor.com/qXhDrF9rpMkAAAAM/hayase-nagatoro-hachioji-naoto.gif'
    ],
    '💫': [
        'https://c.tenor.com/OwhK0bb5_c0AAAAC/illya-awkward.gif',
        'https://c.tenor.com/mtPSIF0gPuIAAAAM/ao-haru-ride-tv-show.gif',
        'https://c.tenor.com/Nu-KpcmyS98AAAAC/anime-armpit-chitose-chitose-armpit.gif',
        'https://c.tenor.com/3xh4VVaI2EwAAAAC/anime-cuddle.gif',
        'https://c.tenor.com/ey9_MxcN9jgAAAAM/anime-tv-show.gif'
    ],
    '💖': [
        'https://c.tenor.com/q0Me9HdTcuAAAAAM/blushing-couple.gif',
        'https://c.tenor.com/gu6BB0thSOYAAAAM/oh-yeah-lets.gif',
        'https://c.tenor.com/i50gylGKwksAAAAM/cat-kitten.gif',
        'https://c.tenor.com/c4UDLP-NA-cAAAAM/adorable-inlove.gif'
    ],
    '💞': [
        'https://c.tenor.com/71Cux-aY4G4AAAAM/anime-hug.gif',
        'https://c.tenor.com/8gXGvTZc4ucAAAAM/anime-hug-hug.gif',
        'https://c.tenor.com/JioZKGpv6fAAAAAM/hyouka-chitanda-eru.gif',
        'https://c.tenor.com/gGz2mfM0fRcAAAAM/tokyo-ghoul-kaneki.gif'
    ],
    '🔥': [
        'https://c.tenor.com/3OYmSePDSVUAAAAM/black-clover-licht.gif',
        'https://c.tenor.com/uYNjEbCbrOYAAAAM/tonikawa-tonikaku-kawaii.gif',
        'https://c.tenor.com/RiwO7Sj0B-YAAAAd/keisuke-baji-chifuyu-matsuno.gif'
    ]
}

const randomComment = (bank: Record<Tier, string[]>, tier: Tier): string => {
    const pool = bank[tier]
    return pool[Math.floor(Math.random() * pool.length)]
}

// ───── CANVAS HELPERS ─────────────────────────────────────────────────
function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

// ───── CARD CANVAS ────────────────────────────────────────────────────
function drawCard(
    pct: number, tier: Tier, comment: string,
    tags: string, mode: 'ship' | 'rizz'
): Buffer {
    const cv = createCanvas(W, H), ctx = cv.getContext('2d')

    // ─‧ Deep gradient background ─────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H)
    if (pct >= 80) {
        bg.addColorStop(0, '#1a0026'); bg.addColorStop(0.4, '#3d0040'); bg.addColorStop(1, '#0a0012')
    } else if (pct >= 50) {
        bg.addColorStop(0, '#1a0a2e'); bg.addColorStop(0.4, '#2d1045'); bg.addColorStop(1, '#0d0520')
    } else {
        bg.addColorStop(0, '#0f0f1a'); bg.addColorStop(0.4, '#1a1535'); bg.addColorStop(1, '#080818')
    }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

    // ─‧ Outer glow ring with double border ───────────────────────────
    ctx.fillStyle = 'rgba(255,105,180,0.025)'; rr(ctx, 8, 8, W - 16, H - 16, 36); ctx.fill()
    ctx.strokeStyle = pct >= 80 ? 'rgba(255,105,180,0.35)' : pct >= 50 ? 'rgba(224,64,251,0.25)' : 'rgba(79,195,247,0.2)'
    ctx.lineWidth = 2.5
    rr(ctx, 16, 16, W - 32, H - 32, 30); ctx.stroke()

    // Inner subtle ring
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1
    rr(ctx, 28, 28, W - 56, H - 56, 24); ctx.stroke()

    // ─‧ Floating decorative particles ────────────────────────────────
    const particles = ['💕', '💖', '💗', '💘', '💝', '✨', '💫', '⭐', '🌟', '🫧']
    ctx.globalAlpha = 0.06
    for (let i = 0; i < 20; i++) {
        ctx.font = `${10 + (i % 16)}px "Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center'
        ctx.fillText(particles[i % particles.length], (i * 47 + 25) % W, (i * 73 + 15) % H)
    }
    ctx.globalAlpha = 1

    // ─‧ Title ────────────────────────────────────────────────────────
    ctx.textAlign = 'center'
    ctx.shadowColor = pct >= 80 ? '#ff69b4' : pct >= 50 ? '#e040fb' : '#4fc3f7'
    ctx.shadowBlur = 30
    ctx.fillStyle = pct >= 80 ? '#ff69b4' : pct >= 50 ? '#e040fb' : '#4fc3f7'
    ctx.font = 'bold 34px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif'
    ctx.fillText(mode === 'rizz' ? '✨ Rizz Meter ✨' : '💖 ShipCent 💖', W / 2, 70)
    ctx.shadowBlur = 0

    // ─‧ Names/Tags pill ──────────────────────────────────────────────
    const namePillY = 105, pillH = 46, pillR = 23
    ctx.font = 'bold 22px "Segoe UI",sans-serif'
    const nameW = ctx.measureText(tags).width + 50
    const pillX = W / 2 - nameW / 2
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    rr(ctx, pillX, namePillY, nameW, pillH, pillR); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1
    rr(ctx, pillX, namePillY, nameW, pillH, pillR); ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(tags, W / 2, namePillY + 30)

    // ─‧ Big percentage number ────────────────────────────────────────
    const pctY = 195
    ctx.shadowColor = pct >= 80 ? '#ff69b4' : pct >= 50 ? '#e040fb' : '#4fc3f7'
    ctx.shadowBlur = 40
    ctx.fillStyle = pct >= 80 ? '#ff69b4' : pct >= 50 ? '#e040fb' : '#4fc3f7'
    ctx.font = 'bold 90px "Segoe UI",sans-serif'
    ctx.fillText(`${pct}%`, W / 2, pctY)
    ctx.shadowBlur = 0

    // ─‧ Progress bar (luxury style) ──────────────────────────────────
    const barX = 110, barY = 220, barW = 580, barH = 14, barR = 7
    // Track
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; rr(ctx, barX, barY, barW, barH, barR); ctx.fill()
    // Fill with gradient
    const fillW = Math.max(barH, (barW * pct) / 100)
    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0)
    if (pct >= 80) { barGrad.addColorStop(0, '#ff1744'); barGrad.addColorStop(0.5, '#ff4081'); barGrad.addColorStop(1, '#ff80ab') }
    else if (pct >= 50) { barGrad.addColorStop(0, '#7c4dff'); barGrad.addColorStop(1, '#b388ff') }
    else { barGrad.addColorStop(0, '#0277bd'); barGrad.addColorStop(1, '#4fc3f7') }
    ctx.fillStyle = barGrad
    rr(ctx, barX, barY, fillW, barH, barR); ctx.fill()
    // Glossy highlight on bar
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    rr(ctx, barX, barY, fillW, barH / 2, barR); ctx.fill()
    // Percentage markers
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '10px "Segoe UI",sans-serif'
    for (let m = 0; m <= 100; m += 25) {
        const mx = barX + (barW * m) / 100
        ctx.fillText(`${m}`, mx, barY - 6)
    }

    // ─‧ Tier badge ───────────────────────────────────────────────────
    const tierY = 265
    ctx.font = 'bold 22px "Segoe UI",sans-serif'
    ctx.fillStyle = pct >= 80 ? '#ff69b4' : pct >= 50 ? '#e040fb' : '#4fc3f7'
    ctx.fillText(`${tier} ${tierLabel(tier)}`, W / 2, tierY)

    // ─‧ Divider line ─────────────────────────────────────────────────
    const divY = 285
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(W / 2 - 200, divY); ctx.lineTo(W / 2 + 200, divY); ctx.stroke()

    // ─‧ Deep comment (random from bank) ──────────────────────────────
    const commentY = 320
    ctx.fillStyle = pct >= 80 ? '#ffb6c1' : pct >= 50 ? '#e1bee7' : '#b3e5fc'
    ctx.font = 'italic 17px "Segoe UI",sans-serif'
    // Word-wrap the comment
    const words = comment.split(' ')
    let line = ''; let ly = commentY; const maxW = 620
    for (const w of words) {
        const test = line ? line + ' ' + w : w
        if (ctx.measureText(test).width > maxW) {
            ctx.fillText(line, W / 2, ly); line = w; ly += 28
        } else line = test
    }
    if (line) ctx.fillText(line, W / 2, ly)

    // ─‧ Heart footer ─────────────────────────────────────────────────
    const footY = ly + 50
    ctx.font = 'bold 26px "Segoe UI Emoji",sans-serif'
    ctx.fillText(pct >= 80 ? '💞💕💞' : pct >= 50 ? '💖💗💖' : pct >= 25 ? '💫💫💫' : '💔💔💔', W / 2, footY)

    // ─‧ Watermark ────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '11px "Segoe UI",sans-serif'
    ctx.fillText(mode === 'ship' ? 'Ari-Ani • /ship @user @user' : 'Ari-Ani • /ship @user', W / 2, H - 16)

    return cv.toBuffer('image/png')
}

// ───── COMMAND CLASS ──────────────────────────────────────────────────
export default class Command extends CommandModule {

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ship', description: 'Ship 💖 people', category: 'fun',
            usage: `${client.config.prefix}ship [@user(s)]`, baseXp: 50
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const resolved = canonicalizeShip(M.sender.jid, M.mentioned, M.quoted?.sender)

        // ───── SELF RIZZ ─────
        if (resolved.kind === 'self') {
            const target = resolved.member
            const pct = Math.floor(Math.random() * 99) + 1
            const tier = tierFor(pct)
            const isSelf = target === M.sender.jid
            const header = isSelf ? '✨ Your Rizz ✨' : `✨ ${tagFor(target)}'s Rizz ✨`
            const rank = rankFor(pct)
            const comment = randomComment(RIZZ_COMMENTS, tier)

            const cap = `*${header}*\n${rank}  ${tier}\nRizz: *${pct}%*\n\n_${comment}_`

            // Try GIFs from tier gallery
            const gallery = SHIP_GIFS[tier].slice().sort(() => Math.random() - 0.5)
            for (const gifUrl of gallery) {
                try {
                    const buf = await this.client.getBuffer(gifUrl)
                    const video = await this.client.util.GIFBufferToVideoBuffer(buf)
                    return void M.reply(video, MessageType.video, Mimetype.gif, [target], cap)
                } catch { /* try next GIF */ }
            }

            // Canvas → video fallback
            const canvasBuf = drawCard(pct, tier, comment, tagFor(target), 'rizz')
            try {
                const video = await this.client.util.imageToVideoBuffer(canvasBuf, 4)
                return void M.reply(video, MessageType.video, Mimetype.gif, [target], cap)
            } catch {
                return void M.reply(canvasBuf, MessageType.image, Mimetype.png, [target], cap)
            }
        }

        // ───── SHIP MODE ─────
        await shipBond(this.client, M.sender.jid, resolved.members)
        const pct = Math.floor(Math.random() * 99) + 1
        const tier = tierFor(pct)
        const tags = resolved.members.map(tagFor).join(' × ')
        const comment = randomComment(SHIP_COMMENTS, tier)

        const cap = `❣️ *ShipCent* ❣️\n\n${tags}\n\n${tier} ${tierLabel(tier)}\nShipCent: *${pct}%*\n\n_${comment}_`

        // Try GIFs from tier gallery
        const gallery = SHIP_GIFS[tier].slice().sort(() => Math.random() - 0.5)
        for (const gifUrl of gallery) {
            try {
                const buf = await this.client.getBuffer(gifUrl)
                const video = await this.client.util.GIFBufferToVideoBuffer(buf)
                return void M.reply(video, MessageType.video, Mimetype.gif, resolved.members, cap)
            } catch { /* try next GIF */ }
        }

        // Canvas → video fallback
        const canvasBuf = drawCard(pct, tier, comment, tags, 'ship')
        try {
            const video = await this.client.util.imageToVideoBuffer(canvasBuf, 4)
            return void M.reply(video, MessageType.video, Mimetype.gif, resolved.members, cap)
        } catch {
            return void M.reply(canvasBuf, MessageType.image, Mimetype.png, resolved.members, cap)
        }
    }
}