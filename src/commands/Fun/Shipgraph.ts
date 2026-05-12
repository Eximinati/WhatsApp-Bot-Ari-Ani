import sharp from 'sharp'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IBondModel, ISimplifiedMessage } from '../../typings/index.js'
import { bondScore, normalizeJid } from '../../core/Ship/index.js'
import { MessageType, Mimetype } from '../../core/types.js'

const SIZE = 900
const CENTER = SIZE / 2
const RING_R = 340

const escapeXml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const colorFor = (score: number): string => {
    const t = Math.max(0, Math.min(1, score / 100))
    const r = Math.round(255 * (1 - Math.max(0, t - 0.5) * 2))
    const g = Math.round(255 * Math.min(1, t * 2))
    return `rgb(${r}, ${g}, 80)`
}

const widthFor = (score: number): number => 1.5 + (score / 100) * 6

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'shipgraph',
            description: 'Render the polygraph of ships around a user',
            aliases: ['shiptree'],
            category: 'fun',
            usage: `${client.config.prefix}shipgraph [tag user]`,
            baseXp: 20
        })
    }

    private displayName = (jid: string): string => {
        const c = this.client.contacts.get(jid)
        return c?.notify || c?.name || c?.vname || jid.split('@')[0] || 'user'
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const focal =
            normalizeJid(M.quoted?.sender || M.mentioned[0] || M.sender.jid) ||
            M.sender.jid

        const botJid = this.client.user?.jid

        const query = botJid
            ? { members: { $all: [focal], $nin: [botJid] } }
            : { members: focal }

        const bonds = (await this.client.DB.bond.find(query)) as IBondModel[]

        if (!bonds.length) {
            await M.reply(
                `No bonds yet for ${this.displayName(focal)}. Use !ship to start.`,
                MessageType.text,
                undefined,
                [focal]
            )
            return
        }

        const scoredBonds = bonds.map((b) => ({ bond: b, score: bondScore(b) }))

        const PARTNER_CAP = 18
        const partnerScore = new Map<string, number>()

        for (const { bond, score } of scoredBonds) {
            for (const m of bond.members) {
                if (m === focal) continue
                const prev = partnerScore.get(m) ?? 0
                if (score > prev) partnerScore.set(m, score)
            }
        }

        const partnerList = Array.from(partnerScore.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, PARTNER_CAP)
            .map(([jid]) => jid)

        const visibleSet = new Set<string>([focal, ...partnerList])

        const positions = new Map<string, { x: number; y: number }>()
        positions.set(focal, { x: CENTER, y: CENTER })

        const N = partnerList.length || 1
        partnerList.forEach((jid, i) => {
            const angle = (i / N) * 2 * Math.PI - Math.PI / 2
            positions.set(jid, {
                x: CENTER + RING_R * Math.cos(angle),
                y: CENTER + RING_R * Math.sin(angle)
            })
        })

        const edgeSvg: string[] = []
        const focalPos = positions.get(focal)!

        for (const { bond, score } of scoredBonds) {
            const stroke = colorFor(score)
            const w = widthFor(score)
            const dash = bond.size > 2 ? 'stroke-dasharray="6 4"' : ''

            for (const member of bond.members) {
                if (member === focal || !visibleSet.has(member)) continue
                const b = positions.get(member)!
                edgeSvg.push(
                    `<line x1="${focalPos.x.toFixed(1)}" y1="${focalPos.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${stroke}" stroke-width="${w.toFixed(1)}" ${dash} stroke-linecap="round" opacity="0.85"/>`
                )
            }
        }

        const labelSvg: string[] = []

        for (const { bond, score } of scoredBonds) {
            if (bond.size !== 2) continue

            const ms = bond.members.filter((m) => visibleSet.has(m))
            if (ms.length !== 2) continue

            const a = positions.get(ms[0])!
            const b = positions.get(ms[1])!
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2

            labelSvg.push(
                `<rect x="${(mx - 22).toFixed(1)}" y="${(my - 11).toFixed(1)}" width="44" height="22" rx="4" fill="rgba(20,22,30,0.85)"/>`,
                `<text x="${mx.toFixed(1)}" y="${(my + 5).toFixed(1)}" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">${score}%</text>`
            )
        }

        const nodeSvg: string[] = []

        for (const jid of partnerList) {
            const p = positions.get(jid)!
            const name = escapeXml(this.displayName(jid))

            nodeSvg.push(
                `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="22" fill="#1f6feb" stroke="#0d419d" stroke-width="2"/>`,
                `<text x="${p.x.toFixed(1)}" y="${(p.y + 42).toFixed(1)}" font-size="14" fill="#e6edf3" text-anchor="middle">${name.slice(0, 14)}</text>`
            )
        }

        const fp = positions.get(focal)!
        const focalName = escapeXml(this.displayName(focal))

        nodeSvg.push(
            `<circle cx="${fp.x.toFixed(1)}" cy="${fp.y.toFixed(1)}" r="32" fill="#db61a2" stroke="#a4346e" stroke-width="3"/>`,
            `<text x="${fp.x.toFixed(1)}" y="${(fp.y + 56).toFixed(1)}" font-size="16" font-weight="bold" fill="#ffe4f1" text-anchor="middle">${focalName.slice(0, 16)}</text>`
        )

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<rect width="${SIZE}" height="${SIZE}" fill="#0d1117"/>
<text x="${CENTER}" y="40" font-size="22" font-weight="bold" fill="#f0f6fc" text-anchor="middle">Ship network · ${focalName}</text>
<text x="${CENTER}" y="64" font-size="13" fill="#8b949e" text-anchor="middle">${bonds.length} bonds · ${partnerList.length} partners</text>
${edgeSvg.join('\n')}
${labelSvg.join('\n')}
${nodeSvg.join('\n')}
</svg>`

        try {
            const png = await sharp(Buffer.from(svg)).png().toBuffer()
            await M.reply(png, MessageType.image, Mimetype.png, [focal, ...partnerList])
        } catch (err) {
            await M.reply(`Couldn't render graph: ${String(err)}`)
        }
    }
}
