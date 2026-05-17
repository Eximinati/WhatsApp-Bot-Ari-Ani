import { createCanvas } from '@napi-rs/canvas'
import GIFEncoder from 'gif-encoder-2'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'

/** Canvas dimensions per die face (square). */
const DIE_SIZE = 140
/** Padding around each die inside its cell. */
const DIE_PAD = 20
/** Cell size = die + padding on each side. */
const CELL = DIE_SIZE + DIE_PAD * 2
/** Rounded corner radius for the die face. */
const RADIUS = 24
/** Pip (dot) radius. */
const PIP_R = 14

/** Pip positions for each face value (offsets from die center). */
const PIP_POSITIONS: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
}

/** Animation parameters. */
const TOTAL_FRAMES = 18
/** Frames 0..FAST_END cycle random faces quickly. */
const FAST_END = 9
/** Frames FAST_END+1..SLOW_END slow down and converge. */
const SLOW_END = 14
/** Remaining frames hold the final result. */

const FAST_DELAY = 60   // ms
const SLOW_DELAY = 140  // ms
const HOLD_DELAY = 600  // ms

/** Background gradient colours (dark theme). */
const BG_FROM = '#1a1a2e'
const BG_TO = '#16213e'

/** Draw a single die face centred at (cx, cy) inside a ctx. */
const drawDie = (
    ctx: import('@napi-rs/canvas').SKRSContext2D,
    cx: number,
    cy: number,
    value: number
): void => {
    const half = DIE_SIZE / 2
    const x = cx - half
    const y = cy - half

    // Die body — rounded rect
    ctx.beginPath()
    ctx.moveTo(x + RADIUS, y)
    ctx.lineTo(x + DIE_SIZE - RADIUS, y)
    ctx.arcTo(x + DIE_SIZE, y, x + DIE_SIZE, y + RADIUS, RADIUS)
    ctx.lineTo(x + DIE_SIZE, y + DIE_SIZE - RADIUS)
    ctx.arcTo(x + DIE_SIZE, y + DIE_SIZE, x + DIE_SIZE - RADIUS, y + DIE_SIZE, RADIUS)
    ctx.lineTo(x + RADIUS, y + DIE_SIZE)
    ctx.arcTo(x, y + DIE_SIZE, x, y + DIE_SIZE - RADIUS, RADIUS)
    ctx.lineTo(x, y + RADIUS)
    ctx.arcTo(x, y, x + RADIUS, y, RADIUS)
    ctx.closePath()

    // Subtle shadow
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetX = 4
    ctx.shadowOffsetY = 4
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Reset shadow for pips
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Pips
    const positions = PIP_POSITIONS[value] || PIP_POSITIONS[1]
    const spread = DIE_SIZE * 0.28
    ctx.fillStyle = '#1a1a2e'
    for (const [gx, gy] of positions) {
        ctx.beginPath()
        ctx.arc(cx + gx * spread, cy + gy * spread, PIP_R, 0, Math.PI * 2)
        ctx.fill()
    }
}

/** Build a full-frame canvas, draw all dice, and return the rendering context. */
const renderFrame = (
    canvas: import('@napi-rs/canvas').Canvas,
    ctx: import('@napi-rs/canvas').SKRSContext2D,
    faces: number[],
    width: number,
    height: number
): void => {
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height)
    grad.addColorStop(0, BG_FROM)
    grad.addColorStop(1, BG_TO)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    // Each die
    const count = faces.length
    const totalW = count * CELL
    const startX = (width - totalW) / 2 + CELL / 2

    for (let i = 0; i < count; i++) {
        drawDie(ctx, startX + i * CELL, height / 2, faces[i])
    }
}

/** Generate a random die face 1-6. */
const randomFace = (): number => Math.floor(Math.random() * 6) + 1

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'dice',
            description: 'Roll dice (default 1d6)',
            category: 'gaming',
            usage: `${client.config.prefix}dice [sides] [count]`,
            aliases: ['roll'],
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const parts = joined.trim().split(/\s+/).filter(Boolean)

        let sides = 6
        let count = 1

        if (parts[0]) {
            const n = parseInt(parts[0])
            if (!isNaN(n) && n >= 2 && n <= 100) sides = n
        }

        if (parts[1]) {
            const n = parseInt(parts[1])
            if (!isNaN(n) && n >= 1 && n <= 10) count = n
        }

        const rolls = Array.from(
            { length: count },
            () => Math.floor(Math.random() * sides) + 1
        )

        const sum = rolls.reduce((a, b) => a + b, 0)

        // ── Generate animated dice GIF ──
        const generateDiceGif = async (): Promise<Buffer | null> => {
            try {
                const width = Math.max(count * CELL + 40, 220)
                const height = CELL + 40

                const encoder = new GIFEncoder(width, height)
                encoder.start()
                encoder.setRepeat(0) // loop
                encoder.setQuality(10)

                // Pre-create the canvas and ctx once; we'll reuse them per frame.
                const canvas = createCanvas(width, height)
                const ctx = canvas.getContext('2d')

                // Phase 1: fast random tumbling
                for (let f = 0; f <= FAST_END; f++) {
                    const faces = rolls.map(() => randomFace())
                    renderFrame(canvas, ctx, faces, width, height)
                    encoder.setDelay(FAST_DELAY)
                    encoder.addFrame(ctx)
                }

                // Phase 2: slow down — mix of random and correct faces
                for (let f = FAST_END + 1; f <= SLOW_END; f++) {
                    // More likely to show the correct face as we approach the end
                    const faces = rolls.map((r, i) => {
                        const progress = (f - FAST_END) / (SLOW_END - FAST_END)
                        return Math.random() < progress ? r : randomFace()
                    })
                    renderFrame(canvas, ctx, faces, width, height)
                    encoder.setDelay(SLOW_DELAY)
                    encoder.addFrame(ctx)
                }

                // Phase 3: hold the final result
                for (let f = SLOW_END + 1; f < TOTAL_FRAMES; f++) {
                    renderFrame(canvas, ctx, rolls, width, height)
                    encoder.setDelay(HOLD_DELAY)
                    encoder.addFrame(ctx)
                }

                encoder.finish()
                return Buffer.from(encoder.out.getData())
            } catch (err) {
                console.error('[Dice] GIF generation failed:', err)
                return null
            }
        }

        // ── Build text caption ──
        const diceEmoji: Record<number, string> = {
            1: '⚀',
            2: '⚁',
            3: '⚂',
            4: '⚃',
            5: '⚄',
            6: '⚅'
        }

        const lines: string[] = []
        lines.push(`🎲 Dice Roll`)
        lines.push(`Roll: ${count}d${sides}`)
        lines.push(``)

        if (count <= 6) {
            rolls.forEach(r => {
                lines.push(`${diceEmoji[r] || '🎲'} ${r}`)
            })
        } else {
            rolls.forEach((r, i) => {
                lines.push(`#${i + 1}: ${r}`)
            })
        }

        if (count > 1) {
            lines.push(``)
            lines.push(`Total: ${sum}`)
        }

        const caption = lines.join('\n')

        // ── Generate GIF and send ──
        try {
            const gifBuffer = await generateDiceGif()

            if (!gifBuffer) {
                // Fallback: send text-only reply
                return void M.reply(caption)
            }

            // Convert GIF → MP4 for WhatsApp playback
            const videoBuffer = await this.client.util.GIFBufferToVideoBuffer(gifBuffer)

            await M.reply(
                videoBuffer,
                MessageType.video,
                Mimetype.gif,
                undefined,
                caption
            )
        } catch {
            // Fallback: send text-only reply
            return void M.reply(caption)
        }
    }
}