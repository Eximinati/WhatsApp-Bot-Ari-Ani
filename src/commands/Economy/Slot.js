import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

import {
    createCanvas,
    loadImage
} from '@napi-rs/canvas'

import GIFEncoder from 'gifencoder'

import getEconomy from '../../pipeline/getEconomy.js'

interface ISymbol {
    id: string
    display: string
    points: number
    weight: number
}

function formatMoney(
    amount: number
): string {
    return `$${amount.toLocaleString()}`
}

export default class Command extends CommandModule {
    constructor(
        client: RuntimeClient,
        handler: MessagePipeline
    ) {
        super(client, handler, {
            command: 'slot',
            description:'Animated slot machine',
            category: 'economy',
            usage: `${client.config.prefix}slot <amount>`,
            aliases: ['bet'],
            baseXp: 15
        })
    }

    run = async (
        M: ISimplifiedMessage
    ): Promise<void> => {
        try {
            const args = M.args || []

            if (!args[0]) {
                return void M.reply(
                    '❌ Please provide the amount you want to bet.'
                )
            }

            const betAmount = Number(
                args[0]
            )

            if (
                isNaN(betAmount)
            ) {
                return void M.reply(
                    '❌ Please provide a valid numeric amount.'
                )
            }

            if (
                betAmount <= 0
            ) {
                return void M.reply(
                    '❌ Bet must be greater than zero.'
                )
            }

            if (
                betAmount > 10000000
            ) {
                return void M.reply(
                    '❌ Max bet is 10,000,000 Dollars.'
                )
            }

            const economy =
                await getEconomy(
                    M.sender.jid
                )

            if (
                economy.wallet <
                betAmount
            ) {
                return void M.reply(
`❌ You do not have enough money.

💰 Wallet: ${formatMoney(
    economy.wallet
)}`
                )
            }

            const SYMBOLS: ISymbol[] =
                [
                    {
                        id: 'a',
                        display: '🍑',
                        points: 2,
                        weight: 40
                    },
                    {
                        id: 'b',
                        display: '🍆',
                        points: 4,
                        weight: 30
                    },
                    {
                        id: 'c',
                        display: '🍏',
                        points: 0,
                        weight: 20
                    },
                    {
                        id: 'd',
                        display: '🍄',
                        points: 6,
                        weight: 10
                    }
                ]

            const weightedPick =
                (): ISymbol => {
                    const sum =
                        SYMBOLS.reduce(
                            (
                                a,
                                s
                            ) =>
                                a +
                                s.weight,
                            0
                        )

                    const r =
                        Math.random() *
                        sum

                    let acc = 0

                    for (const s of SYMBOLS) {
                        acc +=
                            s.weight

                        if (
                            r < acc
                        ) {
                            return s
                        }
                    }

                    return SYMBOLS[0]
                }

            const reels: ISymbol[][] =
                []

            for (
                let i = 0;
                i < 3;
                i++
            ) {
                reels.push([
                    weightedPick(),
                    weightedPick(),
                    weightedPick()
                ])
            }

            let grid: ISymbol[][] =
                [
                    [
                        reels[0][0],
                        reels[1][0],
                        reels[2][0]
                    ],
                    [
                        reels[0][1],
                        reels[1][1],
                        reels[2][1]
                    ],
                    [
                        reels[0][2],
                        reels[1][2],
                        reels[2][2]
                    ]
                ]

            const isWin =
                Math.random() <
                0.8

            let totalWinnings = 0

            let winningRows: number[] =
                []

            let isJackpot = false

            if (isWin) {
                const winRow =
                    Math.floor(
                        Math.random() *
                            3
                    )

                winningRows = [
                    winRow
                ]

                const winSymbol =
                    SYMBOLS[
                        Math.floor(
                            Math.random() *
                                SYMBOLS.length
                        )
                    ]

                grid[winRow] = [
                    winSymbol,
                    winSymbol,
                    winSymbol
                ]

                if (
                    winRow === 1 &&
                    Math.random() <
                        0.1
                ) {
                    isJackpot = true

                    totalWinnings =
                        betAmount *
                        10
                } else {
                    totalWinnings =
                        winSymbol.points *
                        betAmount
                }
            } else {
                const forceDifferent =
                    (): ISymbol[] => {
                        const s1 =
                            SYMBOLS[
                                Math.floor(
                                    Math.random() *
                                        SYMBOLS.length
                                )
                            ]

                        let s2 =
                            SYMBOLS[
                                Math.floor(
                                    Math.random() *
                                        SYMBOLS.length
                                )
                            ]

                        let s3 =
                            SYMBOLS[
                                Math.floor(
                                    Math.random() *
                                        SYMBOLS.length
                                )
                            ]

                        if (
                            s1.id ===
                                s2.id &&
                            s2.id ===
                                s3.id
                        ) {
                            s3 =
                                SYMBOLS.find(
                                    (
                                        x
                                    ) =>
                                        x.id !==
                                        s1.id
                                ) ||
                                SYMBOLS[0]
                        }

                        return [
                            s1,
                            s2,
                            s3
                        ]
                    }

                for (
                    let r = 0;
                    r < 3;
                    r++
                ) {
                    grid[r] =
                        forceDifferent()
                }

                totalWinnings = 0
            }

            const netChange =
                totalWinnings -
                betAmount

            
            economy.wallet +=
                netChange

            economy.totalGambles += 1

            if (
                totalWinnings > 0
            ) {
                economy.totalWon +=
                    totalWinnings
            } else {
                economy.totalLost +=
                    betAmount
            }

            if (
                totalWinnings >
                economy.highestWin
            ) {
                economy.highestWin =
                    totalWinnings
            }

            if (isJackpot) {
                economy.jackpots += 1
            }

            await economy.save()

            const total =
                economy.wallet +
                economy.bank

            const asciiRows = grid
                .map((row) =>
                    row
                        .map(
                            (s) =>
                                s.display
                        )
                        .join(
                            ' | '
                        )
                )
                .join('\n')

            const resultLine =
                totalWinnings > 0
                    ? `📈 You won ${formatMoney(
                          totalWinnings
                      )}`
                    : `📉 You lost ${formatMoney(
                          betAmount
                      )}`

            const caption =
`${asciiRows}

${resultLine}

👛 Wallet: ${formatMoney(
    economy.wallet
)}
🏦 Bank: ${formatMoney(
    economy.bank
)}
💰 Total Wealth: ${formatMoney(
    total
)}

🎰 Total Gambles: ${
    economy.totalGambles
}
🏆 Highest Win: ${formatMoney(
    economy.highestWin
)}

🎯 Jackpots: ${
    economy.jackpots
}`

            
            const width = 900
            const height = 650

            const canvas =
                createCanvas(
                    width,
                    height
                )

            const ctx =
                canvas.getContext(
                    '2d'
                )

            const encoder =
                new GIFEncoder(
                    width,
                    height
                )

            encoder.start()
            encoder.setRepeat(0)
            encoder.setDelay(90)
            encoder.setQuality(10)

            const chunks: Buffer[] =
                []

            encoder
                .createReadStream()
                .on(
                    'data',
                    (
                        chunk: Buffer
                    ) => {
                        chunks.push(
                            chunk
                        )
                    }
                )

            let bg: Awaited<
                ReturnType<
                    typeof loadImage
                >
            > | null = null

            try {
                bg =
                    await loadImage(
                        'https://i.ibb.co/Kx1Z4PMP/well.jpg'
                    )
            } catch {}

            const gridX = 145
            const gridY = 120
            const boxSize = 180

            const drawFrame = (
                spinning = false,
                frame = 0
            ): void => {
                ctx.clearRect(
                    0,
                    0,
                    width,
                    height
                )

                if (bg) {
                    ctx.drawImage(
                        bg,
                        0,
                        0,
                        width,
                        height
                    )
                } else {
                    ctx.fillStyle =
                        '#0b0f1a'

                    ctx.fillRect(
                        0,
                        0,
                        width,
                        height
                    )
                }

                ctx.fillStyle =
                    'rgba(0,0,0,0.45)'

                ctx.fillRect(
                    0,
                    0,
                    width,
                    height
                )

                ctx.font =
                    'bold 48px Sans'

                ctx.textAlign =
                    'center'

                ctx.fillStyle =
                    isJackpot
                        ? '#ffd700'
                        : '#ffffff'

                ctx.shadowColor =
                    isJackpot
                        ? '#ffd700'
                        : '#00f0ff'

                ctx.shadowBlur =
                    isJackpot
                        ? 35
                        : 12

                ctx.fillText(
                    isJackpot
                        ? '🎉 JACKPOT! 🎉'
                        : '🎰 SLOT MACHINE',
                    width / 2,
                    60
                )

                ctx.shadowBlur = 0

                for (
                    let r = 0;
                    r < 3;
                    r++
                ) {
                    for (
                        let c = 0;
                        c < 3;
                        c++
                    ) {
                        const x =
                            gridX +
                            c *
                                boxSize

                        const y =
                            gridY +
                            r *
                                boxSize

                        ctx.fillStyle =
                            'rgba(255,255,255,0.12)'

                        ctx.beginPath()

                        ctx.roundRect(
                            x,
                            y,
                            boxSize -
                                12,
                            boxSize -
                                12,
                            25
                        )

                        ctx.fill()

                        ctx.strokeStyle =
                            'rgba(255,255,255,0.22)'

                        ctx.lineWidth = 3

                        ctx.stroke()

                        ctx.font =
                            '86px Sans'

                        let sym: string

                        if (
                            spinning
                        ) {
                            sym =
                                SYMBOLS[
                                    Math.floor(
                                        (Math.random() *
                                            SYMBOLS.length +
                                            frame) %
                                            SYMBOLS.length
                                    )
                                ]
                                    .display
                        } else {
                            sym =
                                grid[r][
                                    c
                                ]
                                    .display
                        }

                        if (
                            winningRows.includes(
                                r
                            )
                        ) {
                            ctx.shadowColor =
                                '#ffd700'

                            ctx.shadowBlur =
                                30

                            ctx.fillStyle =
                                '#fff6d8'
                        } else {
                            ctx.shadowColor =
                                '#00f0ff'

                            ctx.shadowBlur =
                                16

                            ctx.fillStyle =
                                '#ffffff'
                        }

                        ctx.fillText(
                            sym,
                            x +
                                (boxSize -
                                    12) /
                                    2,
                            y +
                                (boxSize -
                                    12) /
                                    2 +
                                28
                        )

                        ctx.shadowBlur = 0
                    }
                }

                ctx.font =
                    'bold 36px Sans'

                ctx.textAlign =
                    'center'

                if (
                    totalWinnings >
                    0
                ) {
                    ctx.fillStyle =
                        '#00ff88'

                    ctx.fillText(
                        `YOU WON: ${formatMoney(
                            totalWinnings
                        )}`,
                        width / 2,
                        height -
                            60
                    )
                } else {
                    ctx.fillStyle =
                        '#ff6b6b'

                    ctx.fillText(
                        `YOU LOST: ${formatMoney(
                            betAmount
                        )}`,
                        width / 2,
                        height -
                            60
                    )
                }
            }

            for (
                let i = 0;
                i < 18;
                i++
            ) {
                drawFrame(
                    true,
                    i
                )

                encoder.addFrame(
                    ctx as any
                )
            }

            for (
                let i = 0;
                i < 10;
                i++
            ) {
                drawFrame(
                    false,
                    i
                )

                encoder.addFrame(
                    ctx as any
                )
            }

            encoder.finish()

            const buffer =
                Buffer.concat(
                    chunks
                )

            await this.client.sendMessage(
                M.from,
                {
                    video: buffer,
                    gifPlayback: true,
                    caption
                },
                {
                    quoted: M as any
                }
            )
        } catch (err) {
            this.client.log(
                String(err),
                true
            )

            return void M.reply(
                '❌ An internal error occurred while spinning the slot.'
            )
        }
    }
}
