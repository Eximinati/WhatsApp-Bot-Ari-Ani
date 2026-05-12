import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'botinfo',
            description: 'Displays bot information',
            category: 'bots',
            usage: `${client.config.prefix}botinfo`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const up = this.getUptime()
        const cmds = this.handler.commands.size
        let text = `╭──────────────────────────────╮\n`
        text += `│      🤖  BOT INFO             │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 📛 *Name:* ${this.client.config.name.padEnd(22).slice(0,22)}│\n`
        text += `│ 🔧 *Prefix:* ${this.client.config.prefix.padEnd(21)}│\n`
        text += `│ 📦 *Commands:* ${String(cmds).padEnd(18)}│\n`
        text += `│ ⏰ *Uptime:* ${up.padEnd(21).slice(0,21)}│\n`
        text += `│ ✅ *Status:* Online           │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 💡 *${this.client.config.prefix}help* for commands   │\n`
        text += `╰──────────────────────────────╯`
        return void M.reply(text)
    }

    private getUptime(): string {
        const now = Date.now()
        const start = (this.client as any).startTime || now
        const d = Math.floor((now - start) / 86400000)
        const h = Math.floor(((now - start) % 86400000) / 3600000)
        const m = Math.floor(((now - start) % 3600000) / 60000)
        return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`
    }
}
