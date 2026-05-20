import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IBondModel, IUserRizzModel, ISimplifiedMessage } from '../../typings/index.js'
import {
    baseRizzFor,
    computeBondGrowth,
    computeRizzScore,
    normalizeJid
} from '../../core/Ship/index.js'
import { MessageType } from '../../core/types.js'

const tagFor = (jid: string): string => `@${jid.split('@')[0]}`

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'shiptop',
            description: 'Group leaderboards: top bonds, top rizz, biggest playboys',
            category: 'fun',
            usage: `${client.config.prefix}shiptop`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const scope = new Set<string>()

        if (M.groupMetadata) {
            for (const p of M.groupMetadata.participants) {
                const n = normalizeJid(p.id)
                if (n) scope.add(n)
            }
        } else {
            const a = normalizeJid(M.sender.jid)
            const b = normalizeJid(M.from)
            if (a) scope.add(a)
            if (b) scope.add(b)
        }

        const botJid = normalizeJid(this.client.user?.jid)
        if (botJid) scope.delete(botJid)

        const scopeArr = Array.from(scope)

        // FIXED: removed unsafe $nin + $in combo issue
        const query = botJid
            ? { members: { $in: scopeArr, $ne: botJid } }
            : { members: { $in: scopeArr } }

        const bondDocs = (await this.client.DB.bond.find(query).lean()) as unknown as IBondModel[]

        const bonds = bondDocs.filter((b) =>
            b.members.every((m) => scope.has(m))
        )

        const scored = bonds.map((b) => {
            const growth = computeBondGrowth(b.contributions)
            const score = Math.max(1, Math.min(99, Math.round(b.base + growth)))
            return { b, growth, score }
        })

        scored.sort((a, b) => b.score - a.score || b.b.shipCount - a.b.shipCount)

        const topBonds = scored.slice(0, 5)
        const mentions = new Set<string>()

        const appearance = new Map<string, { count: number; shipped: number }>()

        for (const b of bonds) {
            for (const m of b.members) {
                const cur = appearance.get(m)
                if (cur) {
                    cur.count += b.shipCount
                    cur.shipped += 1
                } else {
                    appearance.set(m, {
                        count: b.shipCount,
                        shipped: 1
                    })
                }
            }
        }

        const playboys = Array.from(appearance.entries())
            .sort((a, b) => b[1].shipped - a[1].shipped || b[1].count - a[1].count)
            .slice(0, 5)

        const rizzCandidates = Array.from(appearance.keys())

        const growthsByMember = new Map<string, number[]>()

        for (const entry of scored) {
            for (const m of entry.b.members) {
                const arr = growthsByMember.get(m)
                if (arr) {
                    arr.push(entry.growth)
                } else {
                    growthsByMember.set(m, [entry.growth])
                }
            }
        }

        const rizzDocs = rizzCandidates.length
            ? ((await this.client.DB.rizz.find({
                  _id: { $in: rizzCandidates }
              })) as IUserRizzModel[])
            : []

        const rizzByJid = new Map<string, IUserRizzModel>()
        for (const r of rizzDocs) rizzByJid.set(r._id, r)

        const rizzScored: Array<{ jid: string; score: number }> = []

        for (const jid of rizzCandidates) {
            const r = rizzByJid.get(jid)
            const base = r?.baseRizz ?? baseRizzFor(jid)
            const outsiders = (r?.outsiderShippers || []).length

            const breakdown = computeRizzScore(
                base,
                outsiders,
                growthsByMember.get(jid) || []
            )

            rizzScored.push({
                jid,
                score: breakdown.score
            })
        }

        rizzScored.sort((a, b) => b.score - a.score)
        const topRizz = rizzScored.slice(0, 5)

        const lines: string[] = []

        lines.push(`🏆 Ship Leaderboard 🏆`)
        lines.push('')

        if (!topBonds.length) {
            lines.push('No bonds yet in this chat. Use !ship to start.')
        } else {
            lines.push('Top Bonds')
            topBonds.forEach((entry, i) => {
                const tags = entry.b.members.map((m) => {
                    mentions.add(m)
                    return tagFor(m)
                }).join(' × ')

                lines.push(`${i + 1}. ${tags} — ${entry.score}%`)
            })
            lines.push('')
        }

        if (topRizz.length) {
            lines.push('Top Rizz')

            topRizz.forEach((entry, i) => {
                mentions.add(entry.jid)
                lines.push(`${i + 1}. ${tagFor(entry.jid)} — ${entry.score}%`)
            })

            lines.push('')
        }

        if (playboys.length) {
            lines.push('Most Shipped')

            playboys.forEach(([jid, stats], i) => {
                mentions.add(jid)
                lines.push(
                    `${i + 1}. ${tagFor(jid)} — ${stats.shipped} bonds, ${stats.count} ships`
                )
            })
        }

        return void M.reply(
            lines.join('\n'),
            MessageType.text,
            undefined,
            Array.from(mentions)
        )
    }
}
