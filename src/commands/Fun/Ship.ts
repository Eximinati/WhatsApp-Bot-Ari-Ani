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

interface ShipGifEntry {
    id: number
    shipPercent: string
    gifLink: string
}

interface ShipAsset {
    shipJson: ShipGifEntry[]
}

const tagFor = (jid: string): string => `@${jid.split('@')[0]}`

const flavorForBond = (pct: number): string => {
    if (pct < 10) return 'Run. Run far. 🚩'
    if (pct < 25) return "There's still time to reconsider your choices."
    if (pct < 50) return 'Good enough, I guess! 💫'
    if (pct < 75) return "Stay together and you'll find a way ⭐️"
    if (pct < 90) return 'Amazing! You two will be a good couple 💖'
    if (pct < 99) return 'Fated to be together 💙'
    return 'Soulmate-tier. The stars themselves are jealous. 💞'
}

const flavorForRizz = (pct: number): string => {
    if (pct < 20) return 'Severely undersold. Touch grass first. 🌱'
    if (pct < 40) return 'A diamond in the rough.'
    if (pct < 60) return 'Solid presence.'
    if (pct < 80) return 'Local heartthrob. 💘'
    if (pct < 95) return 'Certified menace. 🔥'
    return 'Rizz incarnate. ✨'
}

export default class Command extends CommandModule {
    private shipAssets: ShipAsset | null = null

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ship',
            description: 'Ship 💖 people',
            category: 'fun',
            usage: `${client.config.prefix}ship [@user(s)]`,
            baseXp: 50
        })
    }

    private getShipAssets(): ShipAsset | null {
        if (this.shipAssets) return this.shipAssets

        try {
            const raw = this.client.assets.get('ship')
            if (!raw) return null

            this.shipAssets = JSON.parse(raw.toString()) as ShipAsset
            return this.shipAssets
        } catch {
            return null
        }
    }

    private pickGif(percent: number): string | null {
        const data = this.getShipAssets()
        if (!data?.shipJson?.length) return null

        const candidates = data.shipJson.filter(
            (e) => Math.abs(parseInt(e.shipPercent) - percent) <= 10
        )

        if (!candidates.length) return null
        return candidates[Math.floor(Math.random() * candidates.length)].gifLink
    }

    private async sendWithGif(
        M: ISimplifiedMessage,
        percent: number,
        mentions: string[],
        caption: string
    ): Promise<void> {
        const gif = this.pickGif(percent)

        if (!gif) {
            return void M.reply(caption, MessageType.text, undefined, mentions)
        }

        try {
            const buf = await this.client.getBuffer(gif)
            const video = await this.client.util.GIFBufferToVideoBuffer(buf)

            return void M.reply(video, MessageType.video, Mimetype.gif, mentions, caption)
        } catch {
            return void M.reply(caption, MessageType.text, undefined, mentions)
        }
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const resolved = canonicalizeShip(
            M.sender.jid,
            M.mentioned,
            M.quoted?.sender
        )

        // ───── SELF RIZZ ─────
        if (resolved.kind === 'self') {
            const target = resolved.member
            const breakdown = await computeRizz(this.client, target)

            const pct = breakdown.score
            const header =
                target === M.sender.jid
                    ? '✨ Your Rizz ✨'
                    : `✨ ${tagFor(target)}'s Rizz ✨`

            const caption =
`${header}
Rizz: ${pct}%

Base ${breakdown.base} · Outsiders ${breakdown.outsiderCount} (+${breakdown.outsiderTerm}) · Bonds +${breakdown.bondTerm}
${flavorForRizz(pct)}`

            return void this.sendWithGif(M, pct, [target], caption)
        }

        // ───── SHIP MODE ─────
        const bond = await shipBond(this.client, M.sender.jid, resolved.members)
        const growth = computeBondGrowth(bond.contributions)

        const raw = bond.base + growth
        const pct = Math.max(1, Math.min(99, Math.round(raw)))
        const capped = raw > 99 || raw < 1

        const tags = resolved.members.map(tagFor).join(' × ')

        const caption =
`❣️....Matchmaking....❣️

${tags}

ShipCent: ${pct}%${capped ? ' (capped)' : ''}

Base ${bond.base} · Growth ${growth >= 0 ? '+' : ''}${growth}
${flavorForBond(pct)}`

        return void this.sendWithGif(M, pct, resolved.members, caption)
    }
}
