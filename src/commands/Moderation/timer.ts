import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { TimerRegistry } from '../../runtime/TimerRegistry.js'

const TIMERS = TimerRegistry.getInstance()

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'timer',
            aliases: ['tm'],
            category: 'moderation',
            description: 'Starts a timer and locks the group when it expires',
            usage: `${client.config.prefix}timer <minutes> | ${client.config.prefix}timer end`,
            adminOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        if (!M.groupMetadata) return void M.reply('❌ This command can only be used in groups.')

        const arg = joined.trim().toLowerCase()
        const owner = `timer:${M.from}`

        if (arg === 'end') {
            const cleared = TIMERS.clearByOwner(owner)
            if (cleared > 0) {
                return void M.reply('⏰ Timer has been stopped.')
            }
            return void M.reply('⏰ No timer is currently running in this group.')
        }

        const minutes = parseInt(arg, 10)
        if (isNaN(minutes) || minutes <= 0) {
            return void M.reply(
                `🔴 Please provide a valid number of minutes.\n\n*Usage:*\n${this.client.config.prefix}timer <minutes>\n${this.client.config.prefix}timer end`
            )
        }

        const milliseconds = minutes * 60 * 1000
        const startTime = Date.now()
        const endTime = startTime + milliseconds

        // Clear any existing timer for this group first
        TIMERS.clearByOwner(owner)

        // Alert interval: notify every 2 minutes how much time is left
        TIMERS.registerInterval(
            owner,
            async () => {
                const remainingMs = endTime - Date.now()
                const remainingMinutes = Math.ceil(remainingMs / 60_000)
                if (remainingMinutes > 2) {
                    try { await M.reply(`⏰ ${remainingMinutes} minute(s) left.`) } catch { /* ignore send failures */ }
                } else if (remainingMinutes > 0) {
                    try { await M.reply('⏰ Less than 2 minutes left. Group will be locked soon.') } catch { /* ignore */ }
                }
            },
            2 * 60 * 1000,
            `${owner}:alert`
        )

        // Final timeout: lock the group
        TIMERS.registerTimeout(
            owner,
            async () => {
                TIMERS.clearByOwner(owner)
                try {
                    await this.client.groupSettingChange(M.from, '', true /* announcement mode */)
                    await M.reply('⏰ Time is up! This group is now locked.')
                } catch {
                    try { await M.reply('⏰ Time is up!') } catch { /* ignore */ }
                }
            },
            milliseconds,
            `${owner}:lock`
        )

        return void M.reply(
            `⏰ Timer started for *${minutes} minute(s)*.\n\nThis group will be locked when the timer expires. Use \`${this.client.config.prefix}timer end\` to cancel.`
        )
    }
}
