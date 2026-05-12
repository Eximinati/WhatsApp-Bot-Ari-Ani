import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

interface Q { question: string; options: string[]; answer: number; category?: string }
export default class Command extends CommandModule {
    private questions: Q[] = [
        { question: 'Capital of Japan?', options: ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], answer: 2, category: 'Geo' },
        { question: 'Painted Mona Lisa?', options: ['Van Gogh', 'Da Vinci', 'Picasso', 'Michelangelo'], answer: 1, category: 'Art' },
        { question: 'Largest planet?', options: ['Mars', 'Jupiter', 'Saturn', 'Neptune'], answer: 1, category: 'Science' },
        { question: 'WWII ended?', options: ['1943', '1944', '1945', '1946'], answer: 2, category: 'History' },
        { question: 'Symbol for gold?', options: ['Ag', 'Fe', 'Au', 'Cu'], answer: 2, category: 'Science' },
        { question: 'Hardest natural substance?', options: ['Gold', 'Iron', 'Diamond', 'Platinum'], answer: 2, category: 'Science' },
        { question: 'Largest ocean?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3, category: 'Geo' },
        { question: 'Smallest country?', options: ['Monaco', 'Vatican', 'San Marino', 'Liechtenstein'], answer: 1, category: 'Geo' }
    ]
    private scores = new Map<string, { correct: number; total: number }>()
    private lasts = new Map<string, Q>()

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'quiz', description: 'Answer trivia questions',
            category: 'gaming', usage: `${client.config.prefix}quiz [1-4]`,
            aliases: ['trivia'], baseXp: 15
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const input = joined.trim().toLowerCase()
        const s = this.scores.get(M.sender.jid) || { correct: 0, total: 0 }

        if (input.match(/^[1-4]$/)) {
            const ans = parseInt(input) - 1
            const last = this.lasts.get(M.sender.jid)
            if (!last) return void M.reply(`╭──────────────────────────────╮\n│      🧠  QUIZ                  │\n├──────────────────────────────┤\n│ ❌ No active question          │\n│ 💡 *${this.client.config.prefix}quiz* to start│\n╰──────────────────────────────╯`)
            s.total++; if (ans === last.answer) s.correct++
            this.scores.set(M.sender.jid, s)
            const acc = Math.round((s.correct / s.total) * 100)
            let text = `╭──────────────────────────────╮\n│      📝  QUIZ ANSWER           │\n├──────────────────────────────┤\n│ ${ans === last.answer ? '✅ Correct!' : '❌ Wrong! ' + last.options[last.answer]}│\n│ 📊 ${s.correct}/${s.total} (${acc}%)            │\n╰──────────────────────────────╯`
            return void M.reply(text)
        }

        const q = this.questions[Math.floor(Math.random() * this.questions.length)]
        this.lasts.set(M.sender.jid, q)
        let text = `╭──────────────────────────────╮\n│      🧠  TRIVIA                 │\n├──────────────────────────────┤\n│ 📁 ${(q.category || 'General').padEnd(26).slice(0,26)}│\n│ ❓ ${q.question.substring(0,26).padEnd(26)}│\n├──────────────────────────────┤\n`
        q.options.forEach((o, i) => { text += `│ ${i + 1}. ${o.padEnd(24).slice(0,24)}│\n` })
        text += `╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
