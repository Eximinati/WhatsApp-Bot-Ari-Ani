import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'translate', description: 'Translate text',
            category: 'social', usage: `${client.config.prefix}translate <text> | [lang]`,
            aliases: ['tr'], baseXp: 15
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const parts = joined.trim().split('|').map(p => p.trim())
        if (!parts[0]) return void M.reply(`╭──────────────────────────────╮\n│      🌐  TRANSLATE             │\n├──────────────────────────────┤\n│ Usage: *${this.client.config.prefix}tr <text> | es*│\n╰──────────────────────────────╯`)
        const text = parts[0]
        let lang = (parts[1] || 'en').toLowerCase()
        const langs: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ar: 'Arabic', hi: 'Hindi', tr: 'Turkish', nl: 'Dutch' }
        if (lang.length !== 2) {
            const f = Object.entries(langs).find(([, v]) => v.toLowerCase() === lang)
            if (f) lang = f[0]
        }
        if (!langs[lang]) return void M.reply(`╭──────────────────────────────╮\n│      🌐  TRANSLATE             │\n├──────────────────────────────┤\n│ ❌ Unsupported: *${lang.padEnd(20).slice(0,20)}│\n╰──────────────────────────────╯`)
        try {
            await M.reply('🌐 *Translating...*')
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`)
            const data = await res.json() as { responseData?: { translatedText?: string } }
            const result = data.responseData?.translatedText || ''
            let r = `╭──────────────────────────────╮\n│      🌐  TRANSLATED             │\n├──────────────────────────────┤\n│ 📝 ${text.substring(0,26).padEnd(26)}│\n│ 🌍 ${langs[lang].padEnd(27).slice(0,27)}│\n│ ${result.substring(0,28).padEnd(28)}│\n╰──────────────────────────────╯`
            return void M.reply(r)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      🌐  TRANSLATE             │\n├──────────────────────────────┤\n│ ❌ Translation failed          │\n╰──────────────────────────────╯`)
        }
    }
}
