import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType } from '../../core/types.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'weather',
            aliases: ['wthr'],
            description: 'Gives you the weather of the given state or city',
            category: 'educative',
            usage: `${client.config.prefix}weather [place_name]`,
            baseXp: 50
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        if (!joined) return void M.reply(`🌤️ *Weather*\n\nUsage: \`${this.client.config.prefix}weather [place_name]\``)
        const place = joined.trim()
        try {
            const response = await fetch(
                `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(place)}&units=metric&appid=060a6bcfa19809c2cd4d97a212b19273`
            )
            if (!response.ok) throw new Error('API request failed')
            const data = await response.json() as { name?: string; main?: { temp: number; humidity: number; feels_like: number }; weather?: Array<{ description: string; main: string }>; wind?: { speed: number } }
            const temp = data.main?.temp ?? 'N/A'
            const feels = data.main?.feels_like ?? 'N/A'
            const humidity = data.main?.humidity ?? 'N/A'
            const desc = data.weather?.[0]?.description ?? 'N/A'
            const wind = data.wind?.speed ?? 'N/A'
            const city = data.name ?? place

            let text = `╭──────────────────────────────╮\n│      🌤️  WEATHER               │\n├──────────────────────────────┤\n│ 📍 ${city.substring(0,27).padEnd(27)}│\n│ 🌡️ Temp: ${temp}°C │ 🤗 Feels: ${feels}°C│\n│ 💧 Humidity: ${humidity}% │ Wind: ${wind}m/s│\n│ ☁️ ${desc.substring(0,27).padEnd(27)}│\n╰──────────────────────────────╯`

            return void M.reply(text)
        } catch {
            return void M.reply(`❌ Could not fetch weather for *${place}*. Check the spelling and try again.`)
        }
    }
}
