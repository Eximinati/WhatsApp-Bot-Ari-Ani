declare module 'gif-encoder-2' {
    import { SKRSContext2D } from '@napi-rs/canvas'

    interface GIFEncoderOptions {
        width: number
        height: number
        repeat?: number
        quality?: number
        delay?: number
    }

    class GIFEncoder {
        constructor(width: number, height: number, options?: Partial<GIFEncoderOptions>)
        start(): void
        setRepeat(repeat: number): void
        setDelay(ms: number): void
        setQuality(quality: number): void
        addFrame(ctx: SKRSContext2D | Uint8ClampedArray | Buffer): void
        finish(): void
        out: {
            getData(): Uint8Array
        }
    }

    export default GIFEncoder
}