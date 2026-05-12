import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import request from '../../core/request.js'

interface Element {
    name: string
    symbol: string
    number: number
    atomic_mass?: number
    category?: string
    phase?: string
    density?: number | null
    melt?: number | null
    boil?: number | null
    summary?: string
}

interface PeriodicTable {
    elements: Element[]
}

const TABLE_URL =
    'https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json'

let cache: Promise<PeriodicTable> | null = null

const getTable = (): Promise<PeriodicTable> => {
    if (!cache) cache = request.json<PeriodicTable>(TABLE_URL)
    return cache
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'elements',
            aliases: ['element', 'periodic'],
            description: 'Get information about a chemical element',
            category: 'educative',
            usage: `${client.config.prefix}element [name or symbol]`
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        if (!joined?.trim()) {
            return void M.reply('🔎 Provide an element name or symbol')
        }

        const query = joined.trim().toLowerCase()

        let table: PeriodicTable

        try {
            table = await getTable()
        } catch {
            cache = null
            return void M.reply('❌ Failed to load periodic table data')
        }

        const element = table.elements.find(
            e =>
                e.symbol.toLowerCase() === query ||
                e.name.toLowerCase() === query
        )

        if (!element) {
            return void M.reply(`🔍 No element found for "${joined}"`)
        }

        const text =
`🧪 ELEMENT INFO

Name: ${element.name}
Symbol: ${element.symbol}
Atomic Number: ${element.number}
Atomic Mass: ${element.atomic_mass ?? '—'}
Category: ${element.category ?? '—'}
Phase: ${element.phase ?? '—'}

🔥 Melting: ${element.melt ?? '—'} K
💨 Boiling: ${element.boil ?? '—'} K

📝 ${element.summary || 'No description available'}`

        return void M.reply(text)
    }
}
