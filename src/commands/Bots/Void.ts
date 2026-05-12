import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ping',
            description: 'Check bot responsiveness',
            category: 'bots',
            usage: `${client.config.prefix}ping`,
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const start = Date.now()
        await M.reply('🏓 *Pinging...*')
        const ms = Date.now() - start
        const icon = ms < 100 ? '⚡' : ms < 300 ? '✅' : ms < 500 ? '🟡' : '🔴'
        const label = ms < 100 ? 'Excellent' : ms < 300 ? 'Good' : ms < 500 ? 'Fair' : 'Slow'

        let text = `╭──────────────────────────────╮\n`
        text += `│      🏓  PONG!               │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ ⏱ *Response:* ${ms}ms ${icon} ${label.padEnd(16)}\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 💡 Use *${this.client.config.prefix}uptime*      │\n`
        text += `╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
