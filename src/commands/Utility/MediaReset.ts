import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

const VALID_COMMANDS = ['play', 'ytaudio', 'ytvideo', 'spotify', 'tiktok', 'instagram', 'video']
const NAMES: Record<string, string> = {
    play: 'Play (/play)',
    ytaudio: 'YTAudio (/ytaudio)',
    ytvideo: 'YTVideo (/ytvideo)',
    spotify: 'Spotify (/spotify)',
    tiktok: 'TikTok (/tiktok)',
    instagram: 'Instagram (/instagram)',
    video: 'Video (/ytvideo)'
}

export default class Command extends CommandModule {

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'mediareset',
            aliases: ['mreset'],
            description: 'Reset saved media format preference for a specific command',
            category: 'utility',
            usage: `${client.config.prefix}mediareset play | ${client.config.prefix}mediareset ytaudio`,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const cmd = (M.args[0] || '').toLowerCase().trim()
        const jid = M.sender.jid

        if (!cmd) {
            const list = VALID_COMMANDS.map(c => `• *${c}* — ${NAMES[c]}`).join('\n')
            return void M.reply(`📋 *Media Reset*\n\nReset a saved "Always send as..." preference for a specific command.\n\n${list}\n\nUsage: \`${this.client.config.prefix}mediareset play\``)
        }

        if (!VALID_COMMANDS.includes(cmd)) {
            return void M.reply(`❌ Unknown command *${cmd}*.\n\nValid: ${VALID_COMMANDS.map(c => `*${c}*`).join(', ')}`)
        }

        const cleared = await this.client.mediaMenu.resetPreference(jid, cmd)
        if (cleared) {
            return void M.reply(`✅ Cleared saved preference for *${NAMES[cmd]}*.\n\nNext time you run the command, the format menu will appear.`)
        }
        return void M.reply(`ℹ️ No saved preference to clear for *${NAMES[cmd]}*. You already see the format menu each time.`)
    }
}