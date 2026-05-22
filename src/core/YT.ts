import { youtubeDl, type Payload } from 'youtube-dl-exec'
import { readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import request from './request.js'
import { safeUnlink } from '../utils/async.js'
import axios from 'axios'

const YT_URL_RE =
    /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)[\w-]{11}/

const YT_ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([\w-]{11})/

const YOUTUBE_APIS = [
    'https://apis.davidcyril.name.ng/play',
    'https://api.vexc.io/api/downloader',
    'https://api.liyaniam.repl.co/api/yt',
    'https://youtube-no-bug.onrender.com/download',
    'https://api.xyro.io/api/download/video'
]

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const ytdlpBaseFlags = (): Record<string, unknown> => ({
    noWarnings: true,
    noCheckCertificates: true,
    extractorArgs: 'youtube:player_client=tv,android,web',
    userAgent: process.env.YT_USER_AGENT || DEFAULT_USER_AGENT,
    ...(process.env.YT_COOKIES_BROWSER ? { cookiesFromBrowser: process.env.YT_COOKIES_BROWSER } : {}),
    ...(process.env.YT_COOKIES_FILE ? { cookies: process.env.YT_COOKIES_FILE } : {})
})

export default class YT {
    id: string

    constructor(public url: string, public type: 'audio' | 'video') {
        this.id = this.parseId()
    }

    validateURL = (): boolean => YT_URL_RE.test(this.url)

    getInfo = async (): Promise<Payload> => {
        try {
            return (await youtubeDl(this.url, {
                ...ytdlpBaseFlags(),
                dumpSingleJson: true,
                preferFreeFormats: true
            } as Parameters<typeof youtubeDl>[1])) as Payload
        } catch (ytdlpError: any) {
            console.log('[YT] getInfo yt-dlp failed, trying API:', ytdlpError?.message || ytdlpError)
            
            for (const apiBase of YOUTUBE_APIS) {
                try {
                    const params = apiBase.includes('davidcyril') 
                        ? { query: this.url } 
                        : { url: this.url }
                    const { data } = await axios.get(
                        apiBase,
                        { params, timeout: 30000 }
                    )
                    const result = data?.result || data?.data || data
                    if (result) {
                        return {
                            title: result.title || 'Unknown',
                            thumbnail: result.thumbnail || result.thumb || `https://i.ytimg.com/vi/${this.id}/hqdefault.jpg`,
                            duration: result.duration || result.durationSec,
                            channel: result.channel || result.uploader
                        } as any
                    }
                } catch (apiError: any) {
                    console.log('[YT] getInfo API failed:', apiBase, apiError?.message)
                }
            }
            
            throw ytdlpError
        }
    }

    /** Try downloading from external APIs first (fast CDN), fallback to yt-dlp. */
    private downloadFromApis = async (): Promise<Buffer | null> => {
        for (const apiBase of YOUTUBE_APIS) {
            try {
                if (apiBase.includes('davidcyril')) {
                    const { data } = await axios.get(
                        `${apiBase}?query=${encodeURIComponent(this.url)}`,
                        { timeout: 30000 }
                    )
                    const mediaUrl = data?.result?.download_url || data?.download_url
                    if (mediaUrl) {
                        const response = await axios.get(mediaUrl, { 
                            responseType: 'arraybuffer',
                            timeout: 120000 
                        })
                        return Buffer.from(response.data)
                    }
                } else if (apiBase.includes('vexc') || apiBase.includes('xyro') || apiBase.includes('liyaniam')) {
                    const { data } = await axios.get(
                        `${apiBase}?url=${encodeURIComponent(this.url)}`,
                        { timeout: 30000 }
                    )
                    const result = data?.data || data?.result || data
                    const mediaUrl = result?.download || result?.download_url || result?.url
                    if (mediaUrl) {
                        const response = await axios.get(mediaUrl, { 
                            responseType: 'arraybuffer',
                            timeout: 120000 
                        })
                        return Buffer.from(response.data)
                    }
                } else {
                    const { data } = await axios.get(
                        `${apiBase}?url=${encodeURIComponent(this.url)}`,
                        { timeout: 30000 }
                    )
                    const result = data?.result || data?.data || data
                    const mediaUrl = result?.download || result?.download_url || result?.url
                    if (mediaUrl) {
                        const response = await axios.get(mediaUrl, { 
                            responseType: 'arraybuffer',
                            timeout: 120000 
                        })
                        return Buffer.from(response.data)
                    }
                }
            } catch (apiError: any) {
                console.log('[YT] API failed:', apiBase, apiError?.message)
            }
        }
        return null
    }

    getBuffer = async (
        filename = path.join(
            tmpdir(),
            `${Math.random().toString(36).slice(2)}.%(ext)s`
        )
    ): Promise<Buffer> => {
        // 1. Try external APIs first (fast CDN downloads)
        const apiResult = await this.downloadFromApis()
        if (apiResult) return apiResult

        // 2. Fallback to yt-dlp
        console.log('[YT] All APIs failed, falling back to yt-dlp...')
        const common = { ...ytdlpBaseFlags(), output: filename }
        const flags =
            this.type === 'audio'
                ? {
                      ...common,
                      format: 'bestaudio/best',
                      extractAudio: true,
                      audioFormat: 'mp3',
                      audioQuality: 0,
                      preferFFmpeg: true
                  }
                : { ...common, format: 'best[ext=mp4][height<=720]/best[height<=720]/best' }

        await youtubeDl(this.url, flags as Parameters<typeof youtubeDl>[1])
        const { readdir } = await import('fs/promises')
        const tmpDir = path.dirname(filename)
        const prefix = path.basename(filename).replace('%(ext)s', '')
        const dirFiles = await readdir(tmpDir)
        const match = dirFiles.find(f => f.startsWith(prefix))
        const resolved = match ? path.join(tmpDir, match) : filename.replace('%(ext)s', this.type === 'audio' ? 'mp3' : 'mp4')
        try {
            return await readFile(resolved)
        } finally {
            void safeUnlink(resolved)
        }
    }

    getThumbnail = async (): Promise<Buffer> => await request.buffer(`https://i.ytimg.com/vi/${this.id}/hqdefault.jpg`)

    parseId = (): string => {
        const m = this.url.match(YT_ID_RE)
        return m ? m[1] : ''
    }
}