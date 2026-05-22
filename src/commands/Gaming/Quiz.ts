import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

interface Q {
    question: string
    options: string[]
    answer: number
    category?: string
}

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
            command: 'quiz',
            description: 'Answer trivia questions',
            category: 'gaming',
            usage: `${client.config.prefix}quiz [1-4]`,
            aliases: ['trivia'],
            baseXp: 15
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const input = joined.trim().toLowerCase()
        const jid = M.sender.jid

        // Start a new question
        const q = this.questions[Math.floor(Math.random() * this.questions.length)]
        
        this.client.menus.set(jid, {
            commandName: 'quiz',
            step: 'question',
            chatJid: M.from,
            data: { q }
        })

        const options = q.options
            .map((o, i) => `${i + 1}. ${o}`)
            .join('\n')

        const sent = await M.reply(
            `🧠 Trivia\n\n` +
            `Category: ${q.category || 'General'}\n` +
            `Question: ${q.question}\n\n` +
            `${options}`
        )
        if (sent?.key?.id) {
            this.client.menus.addId(jid, 'quiz', sent.key.id)
        }
    }

    handleMenuSelection = async (M: ISimplifiedMessage, session: any, index: number): Promise<void> => {
        const jid = M.sender.jid
        const { q } = session.data
        const s = this.scores.get(jid) || { correct: 0, total: 0 }

        if (index < 1 || index > 4) {
            return void M.reply('❌ Please reply with a number between 1 and 4.')
        }

        const ans = index - 1
        s.total++
        if (ans === q.answer) s.correct++
        this.scores.set(jid, s)

        const acc = Math.round((s.correct / s.total) * 100)
        const result = ans === q.answer
            ? `✅ Correct!`
            : `❌ Wrong! Correct answer: ${q.options[q.answer]}`

        this.client.menus.clear(jid)
        
        return void M.reply(
            `🧠 Quiz Result\n\n${result}\nScore: ${s.correct}/${s.total} (${acc}%)`
        )
    }
}
