import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import request from '../../core/request.js'

interface CovidCountryData {
    country: string
    cases: number
    todayCases: number
    deaths: number
    todayDeaths: number
    recovered: number
    todayRecovered: number
    active: number
    critical: number
    tests: number
    population: number
    continent: string
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'covid',
            aliases: ['covid19'],
            description: 'Get COVID-19 statistics for a country',
            category: 'educative',
            usage: `${client.config.prefix}covid [country]`
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        if (!joined?.trim()) {
            return void M.reply('🔎 Provide a country name')
        }

        const country = joined.trim()

        try {
            const data = await request.json<CovidCountryData>(
                `https://disease.sh/v3/covid-19/countries/${encodeURIComponent(country)}`
            )

            const text =
`🦠 COVID-19 — ${data.country}

🏥 Total Cases: ${data.cases.toLocaleString()}
🆕 Today Cases: ${data.todayCases.toLocaleString()}
💀 Deaths: ${data.deaths.toLocaleString()}
⚠️ Today Deaths: ${data.todayDeaths.toLocaleString()}
☘ Recovered: ${data.recovered.toLocaleString()}
🎗 Active: ${data.active.toLocaleString()}
😳 Critical: ${data.critical.toLocaleString()}
🧪 Tests: ${data.tests.toLocaleString()}
👥 Population: ${data.population.toLocaleString()}
🌍 Continent: ${data.continent}`

            return void M.reply(text)
        } catch (err) {
            return void M.reply(
                `❌ No COVID data found for "${country}".\nTry using a full country name.`
            )
        }
    }
}
