import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    private pendingSelection: Set<string> = new Set()

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'media',
            description: 'Configure how media is sent to you',
            category: 'utility',
            usage: `${client.config.prefix}media`,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const args = M.args.join(' ').toLowerCase()
        const jid = M.sender.jid

        if (args === 'reset') {
            return void this.resetMedia(M, jid)
        }

        if (args === 'doc' || args === 'document') {
            return void this.setMedia(M, jid, 'document')
        }

        if (args === 'audio' || args === 'music') {
            return void this.setMedia(M, jid, 'audio')
        }

        if (args === 'video' || args === 'vid') {
            return void this.setMedia(M, jid, 'video')
        }

        if (args === 'default') {
            return void this.showMenu(M, jid, true)
        }

        return void this.showMenu(M, jid, false)
    }

    private showMenu = async (M: ISimplifiedMessage, jid: string, showDefault: boolean): Promise<void> => {
        const user = await this.client.getUser(jid)
        const current = (user as any).mediaPreference || 'video'
        const prefix = this.client.config.prefix

        const menu = `📦 *Media Send Preference*

Current: *${current.toUpperCase()}* ${current === 'video' ? '(Default)' : ''}

┌─────────────────────────────────────┐
│  1️⃣  Send as Document               │
│  2️⃣  Send as Document (Make Default)│
│  3️⃣  Send as Audio                  │
│  4️⃣  Send as Audio (Make Default)   │
│  5️⃣  Send as Video                  │
│  6️⃣  Send as Video (Make Default)   │
│  7️⃣  Reset to Default               │
└─────────────────────────────────────┘

💡 Reply with a *number* to select option

📋 *Commands:*
• ${prefix}media doc     - Send as document
• ${prefix}media audio   - Send as audio
• ${prefix}media video   - Send as video
• ${prefix}media reset  - Reset to default`

        this.client.menus.set(jid, {
            commandName: 'media',
            chatJid: M.from,
            step: 'selection'
        })
        const sent = await M.reply(menu)
        if (sent?.key?.id) {
            this.client.menus.addId(jid, 'media', sent.key.id)
        }
    }

    handleMenuSelection = async (M: ISimplifiedMessage, session: any, index: number): Promise<void> => {
        const jid = M.sender.jid
        this.client.menus.clear(jid)

        switch (index) {
            case 1:
                return void this.setMedia(M, jid, 'document')
            case 2:
                await this.setMedia(M, jid, 'document')
                return void M.reply('\n✅ This is now your *default* media preference.')
            case 3:
                return void this.setMedia(M, jid, 'audio')
            case 4:
                await this.setMedia(M, jid, 'audio')
                return void M.reply('\n✅ This is now your *default* media preference.')
            case 5:
                return void this.setMedia(M, jid, 'video')
            case 6:
                await this.setMedia(M, jid, 'video')
                return void M.reply('\n✅ This is now your *default* media preference.')
            case 7:
                return void this.resetMedia(M, jid)
            default:
                return void M.reply('❌ Invalid option. Reply with a number 1-7 or use commands.')
        }
    }

    private setMedia = async (M: ISimplifiedMessage, jid: string, pref: 'document' | 'audio' | 'video'): Promise<void> => {
        await this.client.setMediaPreference(jid, pref)

        const emoji = pref === 'document' ? '📄' : pref === 'audio' ? '🎵' : '🎬'
        const desc = pref === 'document' ? 'document (file)' : pref === 'audio' ? 'audio (music)' : 'video (clip)'

        return void M.reply(`${emoji} Media preference set to *${pref.toUpperCase()}*\n\nAll media will now be sent as ${desc}.`)
    }

    private resetMedia = async (M: ISimplifiedMessage, jid: string): Promise<void> => {
        await this.client.resetMediaPreference(jid)

        return void M.reply('✅ Media preference has been *reset* to default (video).\n\nUse /media to choose again.')
    }
}