import { youtubeDl, type Payload } from 'youtube-dl-exec'
import { readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import request from './request.js'
import axios from 'axios'

const YT_URL_RE =
    /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)[\w-]{11}/

const YT_ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([\w-]{11})/

const YOUTUBE_APIS = [
    'https://apis.davidcyril.name.ng/play',
    'https://apis-keith.vercel.app/download/dlmp3'
]

const ytdlpBaseFlags = (): Record<string, unknown> => ({
    noWarnings: true,
    noCheckCertificates: true,
    extractorArgs: 'youtube:player_client=tv,android,web',
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
                    const { data } = await axios.get(
                        `${apiBase}?query=${encodeURIComponent(this.url)}`,
                        { timeout: 30000 }
                    )
                    if (data?.result) {
                        return {
                            title: data.result.title || 'Unknown',
                            thumbnail: data.result.thumbnail,
                            duration: data.result.duration,
                            channel: data.result.channel
                        } as any
                    }
                } catch (apiError: any) {
                    console.log('[YT] getInfo API failed:', apiBase, apiError?.message)
                }
            }
            
            throw ytdlpError
        }
    }

    getBuffer = async (
        filename = path.join(
            tmpdir(),
            `${Math.random().toString(36).slice(2)}.${this.type === 'audio' ? 'mp3' : 'mp4'}`
        )
    ): Promise<Buffer> => {
        const common = { ...ytdlpBaseFlags(), output: filename }
        const flags =
            this.type === 'audio'
                ? {
                      ...common,
                      format: 'bestaudio[ext=mp3]/bestaudio/best',
                      extractAudio: true,
                      audioFormat: 'mp3',
                      audioQuality: 0
                  }
                : { ...common, format: 'best[ext=mp4][height<=720]/best[height<=720]/best' }

        try {
            await youtubeDl(this.url, flags as Parameters<typeof youtubeDl>[1])
            try {
                return await readFile(filename)
            } finally {
                unlink(filename).catch(() => {})
            }
        } catch (ytdlpError: any) {
            console.log('[YT] yt-dlp failed, trying API fallback:', ytdlpError?.message || ytdlpError)
            
            for (const apiBase of YOUTUBE_APIS) {
                try {
                    let mediaUrl = ''
                    
                    if (apiBase.includes('davidcyril')) {
                        const { data } = await axios.get(
                            `${apiBase}?query=${encodeURIComponent(this.url)}`,
                            { timeout: 120000 }
                        )
                        mediaUrl = data?.result?.download_url
                    } else if (apiBase.includes('keith')) {
                        const { data } = await axios.get(
                            `${apiBase}?url=${encodeURIComponent(this.url)}`,
                            { timeout: 120000 }
                        )
                        mediaUrl = data?.result?.download || data?.download || data?.url
                    }

                    if (mediaUrl) {
                        console.log('[YT] Got media URL from API:', apiBase)
                        const response = await axios.get(mediaUrl, { 
                            responseType: 'arraybuffer',
                            timeout: 120000 
                        })
                        return Buffer.from(response.data)
                    }
                } catch (apiError: any) {
                    console.log('[YT] API failed:', apiBase, apiError?.message)
                }
            }
            
            throw ytdlpError
        }
    }

    getThumbnail = async (): Promise<Buffer> => await request.buffer(`https://i.ytimg.com/vi/${this.id}/hqdefault.jpg`)

    parseId = (): string => {
        const m = this.url.match(YT_ID_RE)
        return m ? m[1] : ''
    }
}