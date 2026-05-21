import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import getUrls from 'get-urls'
import { exec, ChildProcess } from 'child_process'
import { readFile, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { promisify } from 'util'

const FFMPEG_TIMEOUT_MS = 30_000

async function execWithTimeout(cmd: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
        let timedOut = false
        const timer = setTimeout(() => {
            timedOut = true
            reject(new Error(`FFmpeg timeout after ${timeoutMs}ms`))
        }, timeoutMs)

        exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
            clearTimeout(timer)
            if (timedOut) return
            if (err) reject(err)
            else resolve(stdout || stderr)
        })
    })
}

async function cleanup(paths: string[]): Promise<void> {
    await Promise.all(
        paths.map(async (p) => {
            try { await unlink(p) } catch { /* ignore */ }
        })
    )
}

export default class Toolkit {
    exec = promisify(exec)
    execWithTimeout = execWithTimeout

    GIFBufferToVideoBuffer = async (image: Buffer): Promise<Buffer> => {
        const base = `${tmpdir()}/${Math.random().toString(36)}`
        const gifPath = `${base}.gif`
        const mp4Path = `${base}.mp4`

        await writeFile(gifPath, image)
        try {
            const result = await execWithTimeout(
                `ffmpeg -f gif -i ${gifPath} -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${mp4Path}`,
                FFMPEG_TIMEOUT_MS
            )
            void result
            const buffer = await readFile(mp4Path)
            return buffer
        } finally {
            await cleanup([gifPath, mp4Path])
        }
    }

    transcodeAudioToWav = async (audio: Buffer): Promise<Buffer> => {
        const base = `${tmpdir()}/${Math.random().toString(36)}`
        const inPath = `${base}.in`
        const outPath = `${base}.wav`
        await writeFile(inPath, audio)
        try {
            const result = await execWithTimeout(`ffmpeg -y -i ${inPath} -ar 16000 -ac 1 -f wav ${outPath}`, FFMPEG_TIMEOUT_MS)
            void result
            return await readFile(outPath)
        } finally {
            await cleanup([inPath, outPath])
        }
    }

    readdirRecursive = (directory: string): string[] => {
        const results: string[] = []
        const read = (path: string): void => {
            const files = readdirSync(path)
            for (const file of files) {
                const dir = join(path, file)
                if (statSync(dir).isDirectory()) read(dir)
                else results.push(dir)
            }
        }
        read(directory)
        return results
    }

    capitalize = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`
    getUrls = (text: string): string[] => Array.from(getUrls(text))

    chunk = <T>(arr: T[], length: number): T[][] => {
        const result = []
        for (let i = 0; i < arr.length / length; i++) {
            result.push(arr.slice(i * length, i * length + length))
        }
        return result
    }
}