import axios from 'axios'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import MessageModule from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { MessageType } from '../../core/types.js'

interface WeatherAPIResponse {
    location: {
        name: string
        country: string
        region: string
        tz_id: string
    }
    current: {
        temp_c: number
        feelslike_c: number
        humidity: number
        wind_kph: number
        pressure_in: number
        cloud: number
        condition: {
            text: string
            icon: string
        }
    }
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessageModule) {
        super(client, handler, {
            command: 'weather',
            aliases: ['wthr'],
            description:
                'Gets weather information and generates a weather card image',
            category: 'educative',
            usage: `${client.config.prefix}weather [place_name]`,
            baseXp: 50
        })
    }

    run = async (
        M: ISimplifiedMessage,
        { joined }: any
    ): Promise<void> => {
        if (!joined?.trim()) {
            return void M.reply(
                `🌤️ Weather\n\nUsage: ${this.client.config.prefix}weather [place_name]`
            )
        }

        try {
            const url = `https://api.weatherapi.com/v1/current.json?key=${
                process.env.WEATHER_KEY
            }&q=${encodeURIComponent(joined)}&aqi=no`

            const { data } =
                await axios.get<WeatherAPIResponse>(url)

            const canvas = createCanvas(1000, 600)
            const ctx = canvas.getContext('2d')

            const bg = await loadImage(
                'https://i.ibb.co/LXrLhX5s/well.jpg'
            ).catch(() => null)

            if (bg) {
                ctx.drawImage(bg, 0, 0, 1000, 600)
            } else {
                const grad = ctx.createLinearGradient(
                    0,
                    0,
                    1000,
                    600
                )

                grad.addColorStop(0, '#2b5876')
                grad.addColorStop(1, '#4e4376')

                ctx.fillStyle = grad
                ctx.fillRect(0, 0, 1000, 600)
            }

            ctx.fillStyle = 'rgba(0,0,0,0.45)'
            ctx.fillRect(50, 50, 900, 500)

            const icon = await loadImage(
                `https:${data.current.condition.icon}`
            ).catch(() => null)

            if (icon) {
                ctx.drawImage(icon, 720, 80, 200, 200)
            }

            ctx.fillStyle = '#fff'

            ctx.font = 'bold 50px Arial'
            ctx.fillText('🌤 Weather Report', 70, 120)

            ctx.font = 'bold 35px Arial'
            ctx.fillText(
                `${data.location.name}, ${data.location.country}`,
                70,
                180
            )

            ctx.font = '28px Arial'

            ctx.fillText(
                `Region: ${data.location.region}`,
                70,
                230
            )

            ctx.fillText(
                `Timezone: ${data.location.tz_id}`,
                70,
                270
            )

            ctx.font = 'bold 45px Arial'

            ctx.fillText(
                `${data.current.temp_c}°C`,
                70,
                350
            )

            ctx.font = '28px Arial'

            ctx.fillText(
                `Condition: ${data.current.condition.text}`,
                70,
                400
            )

            ctx.fillText(
                `Feels Like: ${data.current.feelslike_c}°C`,
                70,
                440
            )

            ctx.fillText(
                `Humidity: ${data.current.humidity}%`,
                70,
                480
            )

            ctx.fillText(
                `Wind: ${data.current.wind_kph} km/h`,
                70,
                520
            )

            ctx.fillText(
                `Pressure: ${data.current.pressure_in} in`,
                400,
                480
            )

            ctx.fillText(
                `Cloud: ${data.current.cloud}%`,
                400,
                520
            )

            const buffer = canvas.toBuffer('image/png')

            await M.reply(
                buffer,
                MessageType.image,
                undefined,
                undefined,
                `🌤 Weather Report for ${data.location.name}`
            )
        } catch (err) {
            return void M.reply(
                '❌ Failed to fetch weather data. Try again later.'
            )
        }
    }
}
