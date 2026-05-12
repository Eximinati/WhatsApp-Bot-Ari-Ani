import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'mods',
            description: "Displays the Moderators' contact info",
            category: 'core',
            usage: '!mods',
            aliases: ['moderators', 'mod', 'owner'],
            baseXp: 40
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!this.client.config.mods?.length) {
            return void M.reply(`╭──────────────────────────────╮\n│      🛡️  MODERATORS            │\n├──────────────────────────────┤\n│ ❌ No Mods Set               │\n╰──────────────────────────────╯`)
        }
        let text = `╭──────────────────────────────╮\n`
        text += `│      🛡️  MODERATORS            │\n`
        text += `├──────────────────────────────┤\n`
        this.client.config.mods.forEach((jid, i) => {
            const info = this.client.getContact(jid)
            const name = info.notify || info.vname || info.name || jid.split('@')[0]
            text += `│ #${i + 1} *${name.padEnd(25).slice(0,25)}│\n`
            text += `│ 📞 wa.me/${jid.split('@')[0].padEnd(20).slice(0,20)}│\n`
        })
        text += `╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
