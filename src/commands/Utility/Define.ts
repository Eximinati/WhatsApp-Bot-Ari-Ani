import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'define', description: 'Look up word definitions',
            category: 'utility', usage: `${client.config.prefix}define <word>`,
            aliases: ['dict', 'meaning', 'word'], baseXp: 15
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const word = joined.trim().toLowerCase()
        if (!word) return void M.reply(`╭──────────────────────────────╮\n│      📖  DICTIONARY            │\n├──────────────────────────────┤\n│ Usage: *${this.client.config.prefix}define <word>*│\n╰──────────────────────────────╯`)
        if (word.length > 50) return void M.reply(`╭──────────────────────────────╮\n│      📖  DICTIONARY            │\n├──────────────────────────────┤\n│ ❌ Word too long               │\n╰──────────────────────────────╯`)
        try {
            await M.reply('🔍 *Looking up...*')
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
            if (res.status === 404) return void M.reply(`╭──────────────────────────────╮\n│      📖  DICTIONARY            │\n├──────────────────────────────┤\n│ ❌ *${word.padEnd(24).slice(0,24)}│\n│    not found                   │\n╰──────────────────────────────╯`)
            const data = await res.json() as Array<{ word: string; meanings: Array<{ partOfSpeech: string; definitions: Array<{ definition: string }> }> }>
            const entry = data[0]
            let text = `╭──────────────────────────────╮\n│      📖  DICTIONARY            │\n├──────────────────────────────┤\n│ 📝 *${entry.word.padEnd(25).slice(0,25)}│\n│ ${(entry.meanings?.[0]?.definitions?.[0]?.definition || '').substring(0,26).padEnd(26)}│\n╰──────────────────────────────╯`
            return void M.reply(text)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      📖  DICTIONARY            │\n├──────────────────────────────┤\n│ ❌ Lookup failed               │\n╰──────────────────────────────╯`)
        }
    }
}
