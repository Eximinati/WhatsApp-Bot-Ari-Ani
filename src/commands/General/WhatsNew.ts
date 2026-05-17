import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'whatsnew',
            description: 'Show new features and commands added',
            category: 'general',
            usage: `${client.config.prefix}whatsnew`,
            aliases: ['changelog', 'new', 'updates'],
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const p = this.client.config.prefix
        const pipeline = this.handler

        const now = new Date()
        const threeWeeksAgo = new Date(now.getTime() - (21 * 24 * 60 * 60 * 1000))

        const newCommands: { date: Date; name: string; category: string }[] = []

        for (const [name, cmd] of pipeline.commands) {
            const since = cmd.config.since
            if (since) {
                const cmdDate = new Date(since)
                if (!isNaN(cmdDate.getTime()) && cmdDate >= threeWeeksAgo && cmdDate <= now) {
                    newCommands.push({
                        date: cmdDate,
                        name,
                        category: cmd.config.category || 'other'
                    })
                }
            }
        }

        for (const [name, cmd] of pipeline.aliases) {
            const since = cmd.config.since
            if (since) {
                const cmdDate = new Date(since)
                if (!isNaN(cmdDate.getTime()) && cmdDate >= threeWeeksAgo && cmdDate <= now) {
                    const exists = newCommands.find(c => c.name === name)
                    if (!exists) {
                        newCommands.push({
                            date: cmdDate,
                            name,
                            category: cmd.config.category || 'other'
                        })
                    }
                }
            }
        }

        if (newCommands.length === 0) {
            const text = `🆕 WHAT'S NEW (Last 3 Weeks)

📅 No new commands in the last 3 weeks!

💡 Use ${p}help for full command list`

            return void M.reply(text)
        }

        newCommands.sort((a, b) => b.date.getTime() - a.date.getTime())

        const byDate: Record<string, { name: string; category: string }[]> = {}
        for (const cmd of newCommands) {
            const dateKey = cmd.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            if (!byDate[dateKey]) byDate[dateKey] = []
            byDate[dateKey].push({ name: cmd.name, category: cmd.category })
        }

        let text = `🆕 WHAT'S NEW (Last 3 Weeks)\n`

        const categoryEmoji: Record<string, string> = {
            media: '🎵',
            general: '💬',
            utility: '🔧',
            fun: '😂',
            gaming: '🎲',
            social: '🌐',
            moderation: '🛡️',
            educative: '📚',
            anime: '🎌',
            bots: '🤖',
            dev: '👨‍💻',
            config: '⚙️',
            whatsapp: '📱',
            other: '📦'
        }

        for (const [dateStr, cmds] of Object.entries(byDate)) {
            text += `\n📅 ${dateStr}\n`

            const byCategory: Record<string, string[]> = {}
            for (const cmd of cmds) {
                if (!byCategory[cmd.category]) byCategory[cmd.category] = []
                byCategory[cmd.category].push(cmd.name)
            }

            for (const [cat, cmdsList] of Object.entries(byCategory)) {
                const emoji = categoryEmoji[cat] || '📦'
                text += `\n${emoji} ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`
                for (const cmd of cmdsList.sort()) {
                    text += `• ${cmd}\n`
                }
            }
        }

        const totalCommands = pipeline.commands.size
        const newCount = newCommands.length
        text += `\n📊 ${newCount} new commands | ${totalCommands} total\n`
        text += `\n💡 Use ${p}help for full command list`

        await M.reply(text)
    }
}