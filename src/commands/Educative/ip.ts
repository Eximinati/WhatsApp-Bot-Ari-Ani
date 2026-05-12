import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import axios from 'axios'

interface IpApiResponse {
    status: 'success' | 'fail'
    query: string
    isp: string
    org: string
    country: string
    regionName: string
    city: string
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ip',
            description: 'Gives you info about an IP Address',
            aliases: ['ipa', 'ipaddress'],
            category: 'educative',
            usage: `${client.config.prefix}ip [ip address]`,
            baseXp: 50
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        if (!joined?.trim()) {
            return void M.reply('❗ Please provide an IP address')
        }

        try {
            const { data } = await axios.get<IpApiResponse>(
                `http://ip-api.com/json/${encodeURIComponent(joined.trim())}`,
                { timeout: 15000 }
            )

            if (data.status === 'fail') {
                return void M.reply('❌ Invalid IP address / query')
            }

            const text =
`🌐 *IP Lookup*

📡 IP: ${data.query}
🏢 ISP: ${data.isp}
🏛 Org: ${data.org}
🌍 Country: ${data.country}
📍 Region: ${data.regionName}
🏙 City: ${data.city}`

            return void M.reply(text)

        } catch (err) {
            return void M.reply('❌ Failed to fetch IP information')
        }
    }
}
